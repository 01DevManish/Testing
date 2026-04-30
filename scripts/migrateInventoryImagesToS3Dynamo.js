/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, CopyObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
} else {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

const REGION = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || "ap-south-1";
const TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";
const BUCKET =
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.NEXT_PUBLIC_AWS_S3_BUCKET ||
  process.env.BACKUP_S3_BUCKET ||
  "epanelimages";
const ARCHIVE_PREFIX =
  process.env.NEXT_PUBLIC_S3_ARCHIVE_PREFIX ||
  "Cloudinary_Archive_2026-04-10_10_27_479_Originals/";
const INVENTORY_PREFIX = process.env.AWS_S3_PATH_PREFIX || "inventory/";
const BACKUP_DIR = path.join(process.cwd(), "scripts", "backups");

const PARTITION = "DATA#inventory";

const hasApply = process.argv.includes("--apply");
const dryRun = !hasApply;

const makeClients = () => {
  const config =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          region: REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : { region: REGION };

  const dynamoClient = new DynamoDBClient(config);
  const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const s3Client = new S3Client(config);
  return { docClient, s3Client };
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const uniqStrings = (arr) =>
  Array.from(
    new Set(
      arr
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );

const sanitizeSku = (sku, id) => {
  const base = String(sku || "").trim() || String(id || "").trim() || "NO-SKU";
  return base
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
};

const parseS3KeyFromUrl = (url) => {
  try {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return trimmed.replace(/^\/+/, "").split("?")[0] || null;
    }
    if (trimmed.includes(".amazonaws.com/")) {
      return trimmed.split(".amazonaws.com/")[1].split("?")[0];
    }
    if (trimmed.includes("cloudfront.net/")) {
      return trimmed.split("cloudfront.net/")[1].split("?")[0];
    }
    return null;
  } catch {
    return null;
  }
};

const parseCloudinaryArchiveKey = (url) => {
  try {
    if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return null;
    const file = url.split("/").pop();
    if (!file) return null;
    return `${ARCHIVE_PREFIX}${file}`.replace(/^\/+/, "");
  } catch {
    return null;
  }
};

const inferExt = (key) => {
  const m = String(key || "").match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "webp";
};

const publicUrl = (key) => `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

const headExists = async (s3, key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
};

const copyIfNeeded = async (s3, sourceKey, targetKey) => {
  if (sourceKey === targetKey) return { copied: false, reason: "same-key" };
  if (await headExists(s3, targetKey)) return { copied: false, reason: "exists" };

  const copySource = `${BUCKET}/${sourceKey}`
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");

  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: copySource,
      Key: targetKey,
      MetadataDirective: "COPY",
    })
  );

  return { copied: true, reason: "copied" };
};

const fetchInventoryRows = async (docClient) => {
  const rows = [];
  let lastKey;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :sk)",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": PARTITION,
          ":sk": "ITEM#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      })
    );

    (result.Items || []).forEach((item) => {
      const payload = item.payload;
      if (payload && typeof payload === "object") {
        rows.push({
          id: String(payload.id || ""),
          sk: String(item.timestamp_id || ""),
          row: payload,
        });
      }
    });

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return rows;
};

async function main() {
  console.log(`[img-migrate] Starting ${dryRun ? "DRY RUN" : "APPLY"} for Dynamo inventory`);
  console.log(`[img-migrate] table=${TABLE_NAME}, bucket=${BUCKET}, region=${REGION}`);

  const { docClient, s3Client } = makeClients();
  const items = await fetchInventoryRows(docClient);

  let scanned = 0;
  let changed = 0;
  let unchanged = 0;
  let copied = 0;
  let skippedNoImage = 0;
  let unresolved = 0;
  const updatesPreview = [];

  for (const item of items) {
    scanned += 1;
    const id = String(item.id || "").trim();
    const row = item.row || {};
    if (!id) continue;

    const urls = uniqStrings([row.imageUrl, ...(Array.isArray(row.imageUrls) ? row.imageUrls : [])]);
    if (!urls.length) {
      skippedNoImage += 1;
      continue;
    }

    const skuKey = sanitizeSku(row.sku, id);
    const targetUrls = [];

    for (let i = 0; i < urls.length; i += 1) {
      const src = urls[i];
      const sourceKey = parseS3KeyFromUrl(src) || parseCloudinaryArchiveKey(src);
      if (!sourceKey) {
        unresolved += 1;
        continue;
      }

      const ext = inferExt(sourceKey);
      const suffix = i === 0 ? "" : `-${i + 1}`;
      const targetKey = `${INVENTORY_PREFIX}images/${skuKey}${suffix}.${ext}`.replace(/^\/+/, "");

      const result = await copyIfNeeded(s3Client, sourceKey, targetKey);
      if (result.copied) copied += 1;
      targetUrls.push(publicUrl(targetKey));
    }

    if (!targetUrls.length) {
      unchanged += 1;
      continue;
    }

    const currentMain = String(row.imageUrl || "").trim();
    const currentGallery = uniqStrings(Array.isArray(row.imageUrls) ? row.imageUrls : []);
    const nextMain = targetUrls[0];
    const nextGallery = targetUrls;
    const isSame =
      currentMain === nextMain &&
      currentGallery.length === nextGallery.length &&
      currentGallery.every((v, idx) => v === nextGallery[idx]);

    if (isSame) {
      unchanged += 1;
      continue;
    }

    const nextRow = {
      ...row,
      imageUrl: nextMain,
      imageUrls: nextGallery,
      updatedAt: Date.now(),
    };

    updatesPreview.push({ id, sku: row.sku || "", imageUrl: nextMain, count: nextGallery.length });
    changed += 1;

    if (!dryRun) {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            partition: PARTITION,
            timestamp_id: item.sk || `ITEM#${id}`,
            entityType: "dataset_inventory",
            payload: nextRow,
            updatedAt: Date.now(),
          },
        })
      );
    }
  }

  ensureDir(BACKUP_DIR);
  const report = {
    mode: dryRun ? "dry-run" : "apply",
    table: TABLE_NAME,
    bucket: BUCKET,
    region: REGION,
    scanned,
    changed,
    unchanged,
    copied,
    skippedNoImage,
    unresolved,
    sampleUpdates: updatesPreview.slice(0, 30),
    completedAt: new Date().toISOString(),
  };

  const reportPath = path.join(BACKUP_DIR, `inventory-image-s3-migration-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("[img-migrate] done");
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main().catch((err) => {
  console.error("[img-migrate] failed:", err);
  process.exit(1);
});
