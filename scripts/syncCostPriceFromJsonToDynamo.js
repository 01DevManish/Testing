/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

dotenv.config({ path: path.join(process.cwd(), ".env") });

const REGION = process.env.AWS_REGION || "ap-south-1";
const TABLES_ARG = process.argv.find((a) => a.startsWith("--tables="));
const JSON_ARG = process.argv.find((a) => a.startsWith("--json="));
const APPLY = process.argv.includes("--apply");

const TABLES = TABLES_ARG
  ? TABLES_ARG.replace("--tables=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : [process.env.DYNAMO_DATA_TABLE || "eurus-data"];
const JSON_PATH = JSON_ARG
  ? path.resolve(process.cwd(), JSON_ARG.replace("--json=", ""))
  : path.join(process.cwd(), "test.json");

const PARTITION = "DATA#inventory";

const makeConfig = () =>
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        region: REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : { region: REGION };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(makeConfig()), {
  marshallOptions: { removeUndefinedValues: true },
});

const normalizeSku = (v) => String(v || "").trim().toLowerCase();

const parseCost = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const loadSourceRows = () => {
  const raw = fs.readFileSync(JSON_PATH, "utf8");
  const data = JSON.parse(raw);

  let rows = [];
  if (Array.isArray(data)) rows = data;
  else if (data && typeof data === "object" && data.inventory && typeof data.inventory === "object") {
    rows = Object.values(data.inventory);
  } else if (data && typeof data === "object") {
    rows = Object.values(data).filter((v) => v && typeof v === "object");
  }

  const map = new Map();
  let invalidSku = 0;
  let invalidCost = 0;
  rows.forEach((row) => {
    const sku = normalizeSku(row?.sku);
    if (!sku) {
      invalidSku += 1;
      return;
    }
    const cost = parseCost(row?.costPrice);
    if (cost === null) {
      invalidCost += 1;
      return;
    }
    map.set(sku, cost);
  });

  return {
    skuToCost: map,
    totalRows: rows.length,
    validCostRows: map.size,
    invalidSku,
    invalidCost,
  };
};

const fetchInventoryItems = async (table) => {
  const items = [];
  let startKey;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :sk)",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": PARTITION,
          ":sk": "ITEM#",
        },
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...(out.Items || []));
    startKey = out.LastEvaluatedKey;
  } while (startKey);
  return items;
};

const syncTable = async (table, skuToCost) => {
  const items = await fetchInventoryItems(table);
  let matched = 0;
  let updated = 0;
  let unchanged = 0;
  let missingSku = 0;

  for (const item of items) {
    const payload = item.payload || {};
    const sku = normalizeSku(payload.sku);
    if (!sku) {
      missingSku += 1;
      continue;
    }
    if (!skuToCost.has(sku)) continue;

    matched += 1;
    const nextCost = skuToCost.get(sku);
    const currentCost = parseCost(payload.costPrice);
    if (currentCost === nextCost) {
      unchanged += 1;
      continue;
    }

    const nextPayload = {
      ...payload,
      costPrice: nextCost,
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
  }

  return {
    table,
    totalInventoryItems: items.length,
    matchedBySku: matched,
    updated,
    unchanged,
    missingSku,
  };
};

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`JSON file not found: ${JSON_PATH}`);
  }

  const source = loadSourceRows();
  console.log(
    `[cost-sync] source=${JSON_PATH} totalRows=${source.totalRows} validCostRows=${source.validCostRows} invalidSku=${source.invalidSku} invalidCost=${source.invalidCost}`
  );
  console.log(`[cost-sync] mode=${APPLY ? "apply" : "dry-run"} tables=${TABLES.join(", ")}`);

  const results = [];
  for (const table of TABLES) {
    const res = await syncTable(table, source.skuToCost);
    results.push(res);
  }

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", results }, null, 2));
}

main().catch((err) => {
  console.error("[cost-sync] failed:", err);
  process.exit(1);
});

