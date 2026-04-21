import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";

/**
 * Singleton pattern for Firebase Admin to prevent multiple initializations 
 * during Next.js Hot Module Replacement (HMR).
 */
const globalWithFirebase = global as typeof globalThis & {
  firebaseAdminApp: admin.app.App | undefined;
};

const normalizePrivateKey = (key?: string): string | undefined => {
  if (!key) return undefined;
  const trimmed = key.trim().replace(/^['"]|['"]$/g, "");
  const withNewLines = trimmed.replace(/\\n/g, "\n");
  if (withNewLines.includes("-----BEGIN PRIVATE KEY-----")) return withNewLines;

  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  const body = withNewLines.replace(/\s/g, "");
  if (!body) return undefined;
  const lines = body.match(/.{1,64}/g) || [];
  return `${header}\n${lines.join("\n")}\n${footer}\n`;
};

const toServiceAccount = (raw: unknown): admin.ServiceAccount | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as {
    projectId?: unknown;
    clientEmail?: unknown;
    privateKey?: unknown;
    privateKeyId?: unknown;
  };

  const projectId = typeof candidate.projectId === "string" ? candidate.projectId : undefined;
  const clientEmail = typeof candidate.clientEmail === "string" ? candidate.clientEmail : undefined;
  const privateKey = normalizePrivateKey(
    typeof candidate.privateKey === "string" ? candidate.privateKey : undefined
  );
  const privateKeyId = typeof candidate.privateKeyId === "string" ? candidate.privateKeyId : undefined;

  if (!projectId || !clientEmail || !privateKey) return undefined;

  return {
    projectId,
    clientEmail,
    privateKey,
    ...(privateKeyId ? { privateKeyId } : {}),
  };
};

const buildServiceAccountFromEnv = (): admin.ServiceAccount | undefined => {
  // Preferred: full JSON in one env var
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      const account = toServiceAccount(parsed);
      if (account) return account;
    } catch (e) {
      console.error("[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON parse error:", e);
    }
  }

  // Fallback: split env vars
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID;

  if (!projectId || !clientEmail || !privateKey) return undefined;

  return {
    projectId,
    clientEmail,
    privateKey,
    ...(privateKeyId ? { privateKeyId } : {}),
  };
};

const getFirstAdminApp = (): admin.app.App | undefined => {
  const existing = admin.apps[0];
  return existing ?? undefined;
};

const initAdminApp = (): admin.app.App | undefined => {
  if (globalWithFirebase.firebaseAdminApp) return globalWithFirebase.firebaseAdminApp;

  let serviceAccount: admin.ServiceAccount | undefined;

  // 1. Try Loading from JSON File (Primary)
  const keyPath = path.join(process.cwd(), "firebase-admin-key.json");
  if (fs.existsSync(keyPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      serviceAccount = toServiceAccount(parsed);
    } catch (e) {
      console.error("[FirebaseAdmin] Failed to parse JSON key file:", e);
    }
  }

  // 2. Fallback to env-based service account
  if (!serviceAccount) {
    serviceAccount = buildServiceAccountFromEnv();
  }

  if (!serviceAccount) {
    console.error(
      "[FirebaseAdmin] Missing credentials. Provide firebase-admin-key.json or env vars: FIREBASE_SERVICE_ACCOUNT_JSON (preferred) OR FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
    );
    return undefined;
  }

  try {
    globalWithFirebase.firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DB_URL || "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/",
    });
    console.log("[FirebaseAdmin] SDK Initialized Successfully.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/.test(message)) {
      console.error("[FirebaseAdmin] Initialization Error:", message);
    }
    // If app already exists in admin.apps, reuse it.
    const existingApp = getFirstAdminApp();
    if (existingApp) globalWithFirebase.firebaseAdminApp = existingApp;
  }
  return globalWithFirebase.firebaseAdminApp;
};

/**
 * Helper to get the default or initialized app safely.
 * Throws explicit error if Admin SDK is not initialized.
 */
function getAdminAppOrThrow() {
  const app = initAdminApp() || getFirstAdminApp();
  if (!app) {
    throw new Error(
      "Firebase Admin SDK is not initialized. Configure FIREBASE_PRIVATE_KEY/FIREBASE_CLIENT_EMAIL or firebase-admin-key.json."
    );
  }
  return app;
}

const createLazyService = <T extends object>(factory: () => T): T => {
  return new Proxy({} as T, {
    get(_target, prop) {
      const service = factory() as Record<PropertyKey, unknown>;
      const value = service[prop];
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(service);
      }
      return value;
    },
  });
};

// Export lazy services so callers always get either a real SDK instance or a clear error.
export const adminAuth = createLazyService(() => admin.auth(getAdminAppOrThrow()));
export const adminDb = createLazyService(() => admin.database(getAdminAppOrThrow()));
export const adminMessaging = createLazyService(() => admin.messaging(getAdminAppOrThrow()));

