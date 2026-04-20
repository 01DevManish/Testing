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

const getFirstAdminApp = (): admin.app.App | undefined => {
  const existing = admin.apps[0];
  return existing ?? undefined;
};

const initAdminApp = (): admin.app.App | undefined => {
  if (globalWithFirebase.firebaseAdminApp) return globalWithFirebase.firebaseAdminApp;

  let serviceAccount: Record<string, unknown> | undefined;

  // 1. Try Loading from JSON File (Primary)
  const keyPath = path.join(process.cwd(), "firebase-admin-key.json");
  if (fs.existsSync(keyPath)) {
    try {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    } catch (e) {
      console.error("[FirebaseAdmin] Failed to parse JSON key file:", e);
    }
  }

  // 2. Fallback to Hardcoded/Env Key
  if (!serviceAccount) {
    const cleanKey = (key: string | undefined) => {
      if (!key) return undefined;
      const header = "-----BEGIN PRIVATE KEY-----";
      const footer = "-----END PRIVATE KEY-----";
      const body = key.replace(header, "").replace(footer, "").replace(/\s/g, "");
      const lines = body.match(/.{1,64}/g) || [];
      return `${header}\n${lines.join("\n")}\n${footer}\n`;
    };

    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID || "eurus-lifestyle",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "ee5042010c8484d6089500a4b35032fda59eabed",
      private_key: cleanKey(process.env.FIREBASE_PRIVATE_KEY) || cleanKey(`-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDLLpmqs88ji7PO
eSpU1uD+IQgYqSyilIieVvoJtpJNN2sxHdQA2fT8WjzmGrw153wsQNyt5seYgIVp
CabWtsYcvxa8rwWpMU8B6V6jjT23kf1gU/wtGRDQVWB3Cn2MqlRLojlxsg5dqFm6
oDqna+8QVvUFfPu3OqgDYyWmz7s1HyT2j58VlYzD8SJbLN/3ZaVAd+k0+ezcw1ga
FwWViezp371MMD9xoiS42YH8PePYsvsyxPjhfPAk6nsMN2AqoDqZa8cToe1hFlBb
OOBIUyfr1PDTm/qfLEHPPKT5ttb25rXZmiU+PW2pIpn2qFvY2GxIt8y4a8cYtK66
LuUoc/hNAgMBAAECggEADUsMdzhh6D2y4yKWxCu11zKSjMh+uNlWceOXYszM2Bv0
2acNsIuSBXOi8dwUbcNqIpwQxBjp/J6F+/gLcBdPsWBILMqXqHjnJiUeUb2DKPA2
f1enU00FRlgbolYvniUjtDoWH4vqeDK0QitLAxqi7rL9v2DsuBFwnh4dv8LuCNzV
gecpB4NVp+YzWf/PbweuYt3PuwLKIJwpSKXoQUBfhBTnOcVFknTMV9aMimyXU3OU
2iF68Qq0TzpoeSVXOcdu4C+lN8SsNIrHg52dvVORddXNGsH+baf9c8K9t9853kJy
aRSjyUbgTevUQX/5N2b08ZONUKbU9lt4Wd4MCE1QoQKBgQD+JEEjrqJ6ea1J8V2K
ngUzAn8TAIVt0/nN4A5VEDU/AG+mpX+PNjJtQFrlxrNtFCweNCiwI+6jgmgtuAQRf
hzH1Qt8IZ+ZgsFZ3HalI5RRpphk3ARKeU1fZ4pGay1vI2UXNN3bmeldazvY6ZTYy
RMdLlTLMjrK6Gl3+bigt57K+IQKBgQDMqvNzb6UKuTSXN+6A+xkfOa6aJ043bEIe
o+gcbGl5qZc/e3x41i7M1WsTSDKlugRuqxe3XuqQPZXLvPtdePTDEdP+Vh9JzttH
mLFZJg8Ys4uEiD4mqEIEj3jYFPRc+NEJJBzGb1EiffsbK9/EkKNxqMIKYBNRX8+f
olIot2H8rQKBgQDa/TKEJL8s+hwwUyNfbftNIF7Rj+zW60tkZvIAKdhGmcbGhDIv
tLFAWdSB94kZ/V8MUW+QbgofP54JtCaoij6qMG0vORhyyIA5M/3jKkJkpxOjKfF5
LCfPQERnNkRo1ZAoPVrfTxxmy1+xAfWpa0qv/mg/i9bGNmI4E4PbyoNjAQKBgQDF
xB6Qmf4RmZre0DYPvhKtYJB99qMW3O4bK2ibJorY++3hctJ49QWt+j+IF0iRaWjl
A0BceUQQ8uFvSIJf9QQWBoEhj1iWemLbEQm1yhfmV3/mJbxgoE+Clpw/uCfUOr3K
pnGDsYbl3HQq8j88ckLtDhPJ8MJZ7En0x+W54FG31QKBgAMJTJnpD5tOHqi30Edw
XtPBnpvw/yGKv0cGkQOSnKx9rgtK8MUrm6qxWtTjprnBNfKQ59DPZGEj4NF2cfNB
Dw47O42FujaIYzO3aWE2KhTIKp4//gInDdis0TtWDrDG/dW9N0IjW21xBdyroMSd
E8xR5kgY4Rqeesghs3arZnFY
-----END PRIVATE KEY-----`),
      client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@eurus-lifestyle.iam.gserviceaccount.com",
    };
  }

  try {
    globalWithFirebase.firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/",
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

