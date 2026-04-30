/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
} else {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

const REGION = process.env.AWS_REGION || "ap-south-1";
const DATA_TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";
const BACKUP_DIR = path.join(process.cwd(), "scripts", "backups", "daily");
const BACKUP_S3_BUCKET = (process.env.BACKUP_S3_BUCKET || "").trim();
const BACKUP_S3_PREFIX = (process.env.BACKUP_S3_PREFIX || "dynamo-backups/").trim();

// Keep this list in sync with app/lib/dataEntities.ts
const DATA_ENTITIES = [
  "inventory",
  "partyRates",
  "brands",
  "categories",
  "collections",
  "itemGroups",
  "dispatches",
  "packingLists",
  "parties",
  "transporters",
  "tasks",
  "ermLeads",
  "ermLeadCalls",
  "usersMeta",
  "ermOrders",
];

const isoForFile = () => new Date().toISOString().replace(/[:.]/g, "-");

const makeClientConfig = () => {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
  }
  return { region: REGION };
};

const partitionFor = (entity) => `DATA#${entity}`;

const fetchEntityRows = async (docClient, entity) => {
  const partition = partitionFor(entity);
  const rows = [];
  let lastKey;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: DATA_TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :sk)",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": partition,
          ":sk": "ITEM#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      })
    );

    (result.Items || []).forEach((item) => {
      if (item && typeof item.payload === "object" && item.payload) {
        rows.push(item.payload);
      }
    });

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return rows;
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const uploadToS3IfConfigured = async (filePath, contentBuffer) => {
  if (!BACKUP_S3_BUCKET) return null;

  const s3 = new S3Client(makeClientConfig());
  const fileName = path.basename(filePath);
  const key = `${BACKUP_S3_PREFIX.replace(/^\/+/, "").replace(/\/?$/, "/")}${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BACKUP_S3_BUCKET,
      Key: key,
      Body: contentBuffer,
      ContentType: "application/json",
    })
  );

  return { bucket: BACKUP_S3_BUCKET, key };
};

async function run() {
  const startedAt = new Date();
  const dynamo = new DynamoDBClient(makeClientConfig());
  const docClient = DynamoDBDocumentClient.from(dynamo, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const entities = {};
  const counts = {};
  let totalRows = 0;

  console.log(`Starting backup from table "${DATA_TABLE_NAME}" in region "${REGION}"...`);
  for (const entity of DATA_ENTITIES) {
    const rows = await fetchEntityRows(docClient, entity);
    entities[entity] = rows;
    counts[entity] = rows.length;
    totalRows += rows.length;
    console.log(`- ${entity}: ${rows.length}`);
  }

  const backupPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      region: REGION,
      dataTable: DATA_TABLE_NAME,
      entities: DATA_ENTITIES,
      counts,
      totalRows,
    },
    entities,
  };

  ensureDir(BACKUP_DIR);
  const fileName = `dynamo-data-backup-${isoForFile()}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  const latestPath = path.join(BACKUP_DIR, "dynamo-data-backup-latest.json");

  const content = JSON.stringify(backupPayload, null, 2);
  const buffer = Buffer.from(content, "utf8");
  fs.writeFileSync(filePath, content, "utf8");
  fs.writeFileSync(latestPath, content, "utf8");

  const s3Location = await uploadToS3IfConfigured(filePath, buffer);

  console.log("\nBackup completed successfully.");
  console.log(`File: ${filePath}`);
  console.log(`Rows: ${totalRows}`);
  if (s3Location) {
    console.log(`S3: s3://${s3Location.bucket}/${s3Location.key}`);
  } else {
    console.log("S3 upload: skipped (BACKUP_S3_BUCKET not set)");
  }
}

run().catch((error) => {
  console.error("Backup failed:", error);
  process.exit(1);
});
