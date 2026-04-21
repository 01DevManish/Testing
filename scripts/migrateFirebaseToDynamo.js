/* eslint-disable no-console */
const admin = require("firebase-admin");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const path = require("path");
const fs = require("fs");

const TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";
const REGION = process.env.AWS_REGION || "ap-south-1";

const ENTITIES = [
  "inventory",
  "partyRates",
  "brands",
  "categories",
  "collections",
  "itemGroups",
  "dispatches",
  "parties",
  "transporters",
];

const partitionFor = (entity) => `DATA#${entity}`;
const sortFor = (id) => `ITEM#${id}`;

function initFirebaseAdmin() {
  const keyPath = path.join(process.cwd(), "firebase-admin-key.json");
  if (!fs.existsSync(keyPath)) {
    throw new Error("firebase-admin-key.json not found at project root");
  }
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/",
    });
  }
  return admin.database();
}

function initDynamo() {
  const client = new DynamoDBClient({
    region: REGION,
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

async function listExistingKeys(docClient, partition) {
  const keys = [];
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
          ":pk": partition,
          ":sk": "ITEM#",
        },
        ProjectionExpression: "timestamp_id",
        ExclusiveStartKey: lastKey,
      })
    );
    (result.Items || []).forEach((i) => {
      if (typeof i.timestamp_id === "string") keys.push(i.timestamp_id);
    });
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return keys;
}

async function migrateEntity(db, docClient, entity) {
  const partition = partitionFor(entity);
  const snap = await db.ref(entity).once("value");

  const rows = [];
  if (snap.exists()) {
    snap.forEach((child) => {
      rows.push({ id: child.key, ...child.val() });
    });
  }

  const existingKeys = await listExistingKeys(docClient, partition);
  for (const sk of existingKeys) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { partition, timestamp_id: sk },
      })
    );
  }

  let written = 0;
  for (const row of rows) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          partition,
          timestamp_id: sortFor(id),
          entityType: `dataset_${entity}`,
          payload: row,
          updatedAt: Date.now(),
        },
      })
    );
    written++;
  }

  return { entity, removed: existingKeys.length, written };
}

async function run() {
  const db = initFirebaseAdmin();
  const docClient = initDynamo();

  console.log(`Migrating entities to Dynamo table: ${TABLE_NAME}`);
  const summary = [];

  for (const entity of ENTITIES) {
    console.log(`- Migrating ${entity}...`);
    const result = await migrateEntity(db, docClient, entity);
    summary.push(result);
    console.log(`  done: removed=${result.removed}, written=${result.written}`);
  }

  console.log("\nMigration summary:");
  summary.forEach((s) => {
    console.log(`${s.entity}: removed=${s.removed}, written=${s.written}`);
  });
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
