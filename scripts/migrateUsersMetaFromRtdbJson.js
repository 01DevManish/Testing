/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";
const REGION = process.env.AWS_REGION || "ap-south-1";
const USERS_PARTITION = "DATA#usersMeta";

const normalizeRole = (role) => {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};

const cleanPermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter((p) => typeof p === "string");
};

const sanitizeUserMeta = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const uid = String(raw.uid || "").trim();
  const email = String(raw.email || "").trim();
  const name = String(raw.name || "").trim();
  if (!uid || !email || !name) return null;

  return {
    uid,
    email,
    name,
    role: normalizeRole(raw.role),
    permissions: cleanPermissions(raw.permissions),
    dispatchPin: typeof raw.dispatchPin === "string" ? raw.dispatchPin : undefined,
    profilePic: typeof raw.profilePic === "string" ? raw.profilePic : undefined,
    requiresPasswordChange: Boolean(raw.requiresPasswordChange),
    passwordUpdatedAt: typeof raw.passwordUpdatedAt === "number" ? raw.passwordUpdatedAt : undefined,
    passwordUpdatedBy: typeof raw.passwordUpdatedBy === "string" ? raw.passwordUpdatedBy : undefined,
  };
};

const initDynamo = () => {
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
};

const initFirebaseAdmin = () => {
  const keyPath = path.join(process.cwd(), "firebase-admin-key.json");
  if (!fs.existsSync(keyPath)) {
    throw new Error("firebase-admin-key.json not found at project root");
  }
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin.auth();
};

async function listAllAuthUsers(auth) {
  const out = [];
  let pageToken = undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    out.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

async function upsert(docClient, user) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        partition: USERS_PARTITION,
        timestamp_id: `ITEM#${user.uid}`,
        entityType: "dataset_users_meta",
        payload: user,
        updatedAt: Date.now(),
      },
    })
  );
}

async function run() {
  const inputArg = process.argv[2];
  const inputPath = inputArg
    ? path.resolve(process.cwd(), inputArg)
    : path.resolve("C:/Users/my841/Downloads/eurus-lifestyle-default-rtdb-export (3).json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input JSON not found: ${inputPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const usersNode = raw && typeof raw === "object" ? raw.users || {} : {};
  const fromJson = {};

  for (const [uid, row] of Object.entries(usersNode)) {
    const normalized = sanitizeUserMeta({ uid, ...(row || {}) });
    if (normalized) fromJson[uid] = normalized;
  }

  const auth = initFirebaseAdmin();
  const authUsers = await listAllAuthUsers(auth);

  const merged = new Map();
  for (const user of authUsers) {
    const base = fromJson[user.uid];
    const mergedUser = sanitizeUserMeta({
      uid: user.uid,
      email: base?.email || user.email || "",
      name: base?.name || user.displayName || (user.email ? user.email.split("@")[0] : ""),
      role: base?.role || "employee",
      permissions: base?.permissions || [],
      dispatchPin: base?.dispatchPin,
      profilePic: base?.profilePic || user.photoURL || undefined,
      requiresPasswordChange: base?.requiresPasswordChange || false,
      passwordUpdatedAt: base?.passwordUpdatedAt,
      passwordUpdatedBy: base?.passwordUpdatedBy,
    });
    if (mergedUser) merged.set(mergedUser.uid, mergedUser);
  }

  for (const [uid, row] of Object.entries(fromJson)) {
    if (!merged.has(uid)) {
      const clean = sanitizeUserMeta(row);
      if (clean) merged.set(uid, clean);
    }
  }

  const docClient = initDynamo();
  let written = 0;
  for (const user of merged.values()) {
    await upsert(docClient, user);
    written++;
  }

  console.log(`User metadata migration completed.`);
  console.log(`JSON users scanned: ${Object.keys(usersNode).length}`);
  console.log(`Auth users scanned: ${authUsers.length}`);
  console.log(`Dynamo user metadata upserted: ${written}`);
}

run().catch((err) => {
  console.error("User metadata migration failed:", err);
  process.exit(1);
});
