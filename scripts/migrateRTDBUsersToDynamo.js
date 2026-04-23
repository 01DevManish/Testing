const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";

const initDynamo = () => {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
};

const USERS_PARTITION = "DATA#usersMeta";
const userSortKey = (uid) => `ITEM#${uid}`;
const AUTH_USERS_PARTITION = "AUTH#users";
const AUTH_EMAILS_PARTITION = "AUTH#emails";
const authUserSortKey = (uid) => `USER#${uid}`;
const authEmailSortKey = (email) => `EMAIL#${String(email || "").trim().toLowerCase()}`;
const DEFAULT_IMPORTED_USER_PASSWORD = process.env.DEFAULT_IMPORTED_USER_PASSWORD || "ChangeMe@123";

const normalizeRole = (role) => {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};

const sanitizeUserMetadata = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const input = raw;
  const uid = typeof input.uid === "string" ? input.uid.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!uid || !email || !name) return null;

  return {
    uid,
    email,
    name,
    role: normalizeRole(input.role),
    permissions: Array.isArray(input.permissions) ? input.permissions.filter(p => typeof p === "string") : [],
    dispatchPin: typeof input.dispatchPin === "string" ? input.dispatchPin : undefined,
    profilePic: typeof input.profilePic === "string" ? input.profilePic : undefined,
    requiresPasswordChange: Boolean(input.requiresPasswordChange),
    passwordUpdatedAt: typeof input.passwordUpdatedAt === "number" ? input.passwordUpdatedAt : undefined,
    passwordUpdatedBy: typeof input.passwordUpdatedBy === "string" ? input.passwordUpdatedBy : undefined,
  };
};

async function migrateRTDBToDynamo() {
  const docClient = initDynamo();

  // Path to the RTDB export JSON file
  const jsonPath = path.resolve("C:\\Users\\my841\\Downloads\\eurus-lifestyle-default-rtdb-export (3).json");
  
  console.log("Reading RTDB export from:", jsonPath);
  if (!fs.existsSync(jsonPath)) {
    console.error("JSON file not found at:", jsonPath);
    return;
  }

  const rawData = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(rawData);

  if (!data.users) {
    console.log("No 'users' key found in JSON.");
    return;
  }

  const rawUsers = data.users;
  const uids = Object.keys(rawUsers);
  console.log(`Found ${uids.length} users in RTDB export. Migrating to DynamoDB table: ${TABLE_NAME}`);

  let metadataWritten = 0;
  let authWritten = 0;
  for (const uid of uids) {
    const raw = rawUsers[uid];
    // Skip if only presence data
    if (!raw.name || !raw.email) {
      console.warn(`Skipping user ${uid}: missing name or email`);
      continue;
    }
    const clean = sanitizeUserMetadata({ uid, ...raw, requiresPasswordChange: true });
    if (!clean) {
      console.warn(`Skipping invalid user ${uid}`);
      continue;
    }

    try {
      const normalizedEmail = String(clean.email || "").trim().toLowerCase();
      const passwordSalt = crypto.randomBytes(16).toString("hex");
      const passwordHash = crypto.scryptSync(DEFAULT_IMPORTED_USER_PASSWORD, passwordSalt, 64).toString("hex");

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          partition: USERS_PARTITION,
          timestamp_id: userSortKey(clean.uid),
          entityType: "dataset_users_meta",
          payload: clean,
          updatedAt: Date.now(),
        },
      }));
      metadataWritten++;

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          partition: AUTH_USERS_PARTITION,
          timestamp_id: authUserSortKey(clean.uid),
          entityType: "auth_user",
          payload: {
            uid: clean.uid,
            email: normalizedEmail,
            passwordHash,
            passwordSalt,
            disabled: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          updatedAt: Date.now(),
        },
      }));

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          partition: AUTH_EMAILS_PARTITION,
          timestamp_id: authEmailSortKey(normalizedEmail),
          entityType: "auth_email_index",
          payload: {
            uid: clean.uid,
            email: normalizedEmail,
          },
          updatedAt: Date.now(),
        },
      }));
      authWritten++;
      console.log(`Migrated user: ${clean.name} (${clean.email})`);
    } catch (err) {
      console.error(`Failed to migrate user ${uid}:`, err.message);
    }
  }

  console.log(`\nMigration completed.`);
  console.log(`Metadata migrated: ${metadataWritten}`);
  console.log(`Auth credentials migrated: ${authWritten}`);
  console.log(`Default imported password: ${DEFAULT_IMPORTED_USER_PASSWORD}`);
  console.log("Force password change is controlled by requiresPasswordChange field in usersMeta.");
}

migrateRTDBToDynamo().catch(console.error);
