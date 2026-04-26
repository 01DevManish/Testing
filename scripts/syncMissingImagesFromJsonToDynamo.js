/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

dotenv.config({ path: path.join(process.cwd(), ".env") });

const REGION = process.env.AWS_REGION || "ap-south-1";
const PARTITION = "DATA#inventory";
const APPLY = process.argv.includes("--apply");
const TABLES_ARG = process.argv.find((a) => a.startsWith("--tables="));
const JSON_ARG = process.argv.find((a) => a.startsWith("--json="));

const TABLES = TABLES_ARG
  ? TABLES_ARG.replace("--tables=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : [process.env.DYNAMO_DATA_TABLE || "eurus-data"];
const JSON_PATH = JSON_ARG
  ? path.resolve(process.cwd(), JSON_ARG.replace("--json=", ""))
  : path.join(process.cwd(), "test.json");

const normalizeSku = (v) => String(v || "").trim().toLowerCase();
const toStr = (v) => (typeof v === "string" ? v.trim() : "");
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const getImageUrls = (row) => {
  const main = toStr(row?.imageUrl);
  const gallery = Array.isArray(row?.imageUrls) ? row.imageUrls.map(toStr).filter(Boolean) : [];
  return uniq([main, ...gallery]);
};

const loadSourceBySku = () => {
  const raw = fs.readFileSync(JSON_PATH, "utf8");
  const json = JSON.parse(raw);

  let rows = [];
  if (json && typeof json === "object" && json.inventory && typeof json.inventory === "object") {
    rows = Object.values(json.inventory);
  } else if (Array.isArray(json)) {
    rows = json;
  } else if (json && typeof json === "object") {
    rows = Object.values(json).filter((v) => v && typeof v === "object");
  }

  const map = new Map();
  for (const row of rows) {
    const sku = normalizeSku(row?.sku);
    if (!sku) continue;
    const urls = getImageUrls(row);
    if (!urls.length) continue;
    map.set(sku, {
      imageUrl: urls[0],
      imageUrls: urls,
    });
  }
  return { rows: rows.length, skuWithImage: map.size, sourceBySku: map };
};

const makeDdb = () =>
  DynamoDBDocumentClient.from(
    new DynamoDBClient(
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            region: REGION,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : { region: REGION }
    ),
    { marshallOptions: { removeUndefinedValues: true } }
  );

const fetchItems = async (ddb, table) => {
  const items = [];
  let start;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :sk)",
        ExpressionAttributeNames: { "#p": "partition", "#s": "timestamp_id" },
        ExpressionAttributeValues: { ":pk": PARTITION, ":sk": "ITEM#" },
        ExclusiveStartKey: start,
      })
    );
    items.push(...(out.Items || []));
    start = out.LastEvaluatedKey;
  } while (start);
  return items;
};

const syncTable = async (ddb, table, sourceBySku) => {
  const items = await fetchItems(ddb, table);
  let checked = 0;
  let missingImageInDynamo = 0;
  let matchedFromSource = 0;
  let updated = 0;
  const sample = [];

  for (const item of items) {
    checked += 1;
    const payload = item.payload || {};
    const sku = normalizeSku(payload.sku);
    if (!sku) continue;

    const dyUrls = getImageUrls(payload);
    if (dyUrls.length) continue; // do not disturb existing image rows

    missingImageInDynamo += 1;
    const src = sourceBySku.get(sku);
    if (!src) continue;
    matchedFromSource += 1;

    const nextPayload = {
      ...payload,
      imageUrl: src.imageUrl,
      imageUrls: src.imageUrls,
      updatedAt: Date.now(),
    };

    if (APPLY) {
      await ddb.send(
        new PutCommand({
          TableName: table,
          Item: {
            ...item,
            payload: nextPayload,
            updatedAt: Date.now(),
          },
        })
      );
    }
    updated += 1;
    if (sample.length < 20) sample.push({ sku, imageUrl: src.imageUrl });
  }

  return { table, checked, missingImageInDynamo, matchedFromSource, updated, sample };
};

async function main() {
  if (!fs.existsSync(JSON_PATH)) throw new Error(`JSON not found: ${JSON_PATH}`);
  const { rows, skuWithImage, sourceBySku } = loadSourceBySku();
  console.log(`[img-fill] sourceRows=${rows} skuWithImage=${skuWithImage} file=${JSON_PATH}`);
  console.log(`[img-fill] mode=${APPLY ? "apply" : "dry-run"} tables=${TABLES.join(", ")}`);

  const ddb = makeDdb();
  const results = [];
  for (const table of TABLES) {
    results.push(await syncTable(ddb, table, sourceBySku));
  }

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", results }, null, 2));
}

main().catch((err) => {
  console.error("[img-fill] failed:", err);
  process.exit(1);
});

