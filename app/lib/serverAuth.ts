import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "./dynamodb";
import { UserMetadata, UserRole, getUserMetadataByUid, sanitizeUserMetadata, upsertUserMetadata } from "./serverUserMetadata";

const AUTH_USERS_PARTITION = "AUTH#users";
const AUTH_EMAILS_PARTITION = "AUTH#emails";
const SESSION_COOKIE_NAME = "eurus_session_token";
const AUTH_COOKIE_NAME = "eurus_auth";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const normalizeEmail = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const toUserKey = (uid: string) => `USER#${uid}`;
const toEmailKey = (email: string) => `EMAIL#${normalizeEmail(email)}`;
const now = () => Date.now();

const toBase64Url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const getSessionSecret = (): string =>
  process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "eurus-dev-session-secret-change-me";

export interface AuthCredentialRecord {
  uid: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SessionUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  permissions: string[];
  dispatchPin?: string;
  exp: number;
}

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
export const AUTH_COOKIE = AUTH_COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

const hashPassword = (password: string, salt?: string): { hash: string; salt: string } => {
  const effectiveSalt = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, effectiveSalt, 64).toString("hex");
  return { hash, salt: effectiveSalt };
};

const passwordMatches = (password: string, hashHex: string, salt: string): boolean => {
  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(hashHex, "hex");
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
};

const readCredentialByUid = async (uid: string): Promise<AuthCredentialRecord | null> => {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return null;

  const result = await docClient.send(
    new QueryCommand({
      TableName: DATA_TABLE_NAME,
      KeyConditionExpression: "#p = :pk AND #s = :sk",
      ExpressionAttributeNames: {
        "#p": "partition",
        "#s": "timestamp_id",
      },
      ExpressionAttributeValues: {
        ":pk": AUTH_USERS_PARTITION,
        ":sk": toUserKey(safeUid),
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0]?.payload as Partial<AuthCredentialRecord> | undefined;
  if (!item?.uid || !item.email || !item.passwordHash || !item.passwordSalt) return null;
  return {
    uid: item.uid,
    email: normalizeEmail(item.email),
    passwordHash: item.passwordHash,
    passwordSalt: item.passwordSalt,
    disabled: Boolean(item.disabled),
    createdAt: typeof item.createdAt === "number" ? item.createdAt : now(),
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : now(),
  };
};

const readCredentialByEmail = async (email: string): Promise<AuthCredentialRecord | null> => {
  const safeEmail = normalizeEmail(email);
  if (!safeEmail) return null;

  const emailResult = await docClient.send(
    new QueryCommand({
      TableName: DATA_TABLE_NAME,
      KeyConditionExpression: "#p = :pk AND #s = :sk",
      ExpressionAttributeNames: {
        "#p": "partition",
        "#s": "timestamp_id",
      },
      ExpressionAttributeValues: {
        ":pk": AUTH_EMAILS_PARTITION,
        ":sk": toEmailKey(safeEmail),
      },
      Limit: 1,
    })
  );

  const mappedUid = emailResult.Items?.[0]?.payload?.uid as string | undefined;
  if (!mappedUid) return null;
  return readCredentialByUid(mappedUid);
};

export const listAuthCredentials = async (): Promise<AuthCredentialRecord[]> => {
  const rows: AuthCredentialRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: DATA_TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :skPrefix)",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": AUTH_USERS_PARTITION,
          ":skPrefix": "USER#",
        },
        ExclusiveStartKey: lastKey,
      })
    );

    (result.Items || []).forEach((item) => {
      const payload = item?.payload as Partial<AuthCredentialRecord> | undefined;
      if (!payload?.uid || !payload.email || !payload.passwordHash || !payload.passwordSalt) return;
      rows.push({
        uid: payload.uid,
        email: normalizeEmail(payload.email),
        passwordHash: payload.passwordHash,
        passwordSalt: payload.passwordSalt,
        disabled: Boolean(payload.disabled),
        createdAt: typeof payload.createdAt === "number" ? payload.createdAt : now(),
        updatedAt: typeof payload.updatedAt === "number" ? payload.updatedAt : now(),
      });
    });

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return rows;
};

export const createAuthCredential = async (uid: string, email: string, password: string): Promise<AuthCredentialRecord> => {
  const safeUid = String(uid || "").trim();
  const safeEmail = normalizeEmail(email);
  if (!safeUid || !safeEmail) throw new Error("Invalid uid/email");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

  const existing = await readCredentialByEmail(safeEmail);
  if (existing) throw new Error("Email already in use");

  const createdAt = now();
  const hashed = hashPassword(password);
  const record: AuthCredentialRecord = {
    uid: safeUid,
    email: safeEmail,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    disabled: false,
    createdAt,
    updatedAt: createdAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: AUTH_USERS_PARTITION,
        timestamp_id: toUserKey(safeUid),
        entityType: "auth_user",
        payload: record,
        updatedAt: createdAt,
      },
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: AUTH_EMAILS_PARTITION,
        timestamp_id: toEmailKey(safeEmail),
        entityType: "auth_email_index",
        payload: { uid: safeUid, email: safeEmail },
        updatedAt: createdAt,
      },
    })
  );

  return record;
};

export const upsertAuthCredentialForUid = async (uid: string, email: string, password: string): Promise<AuthCredentialRecord> => {
  const safeUid = String(uid || "").trim();
  const safeEmail = normalizeEmail(email);
  if (!safeUid || !safeEmail) throw new Error("Invalid uid/email");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

  const existingByUid = await readCredentialByUid(safeUid);
  const existingByEmail = await readCredentialByEmail(safeEmail);
  if (existingByEmail && existingByEmail.uid !== safeUid) {
    throw new Error("Email already in use");
  }

  const createdAt = existingByUid?.createdAt || now();
  const hashed = hashPassword(password);
  const record: AuthCredentialRecord = {
    uid: safeUid,
    email: safeEmail,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    disabled: false,
    createdAt,
    updatedAt: now(),
  };

  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: AUTH_USERS_PARTITION,
        timestamp_id: toUserKey(safeUid),
        entityType: "auth_user",
        payload: record,
        updatedAt: record.updatedAt,
      },
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: AUTH_EMAILS_PARTITION,
        timestamp_id: toEmailKey(safeEmail),
        entityType: "auth_email_index",
        payload: { uid: safeUid, email: safeEmail },
        updatedAt: record.updatedAt,
      },
    })
  );

  if (existingByUid && normalizeEmail(existingByUid.email) !== safeEmail) {
    await docClient.send(
      new DeleteCommand({
        TableName: DATA_TABLE_NAME,
        Key: {
          partition: AUTH_EMAILS_PARTITION,
          timestamp_id: toEmailKey(existingByUid.email),
        },
      })
    );
  }

  return record;
};

export const verifyEmailPassword = async (email: string, password: string): Promise<AuthCredentialRecord | null> => {
  const cred = await readCredentialByEmail(email);
  if (!cred || cred.disabled) return null;
  if (!passwordMatches(password, cred.passwordHash, cred.passwordSalt)) return null;
  return cred;
};

export const setUserPasswordByUid = async (uid: string, password: string): Promise<void> => {
  const existing = await readCredentialByUid(uid);
  if (!existing) throw new Error("Auth user not found");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

  const hashed = hashPassword(password);
  const updatedRecord: AuthCredentialRecord = {
    ...existing,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    updatedAt: now(),
  };

  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: AUTH_USERS_PARTITION,
        timestamp_id: toUserKey(existing.uid),
        entityType: "auth_user",
        payload: updatedRecord,
        updatedAt: updatedRecord.updatedAt,
      },
    })
  );
};

export const deleteAuthUserByUid = async (uid: string): Promise<void> => {
  const existing = await readCredentialByUid(uid);
  if (!existing) return;

  await docClient.send(
    new DeleteCommand({
      TableName: DATA_TABLE_NAME,
      Key: {
        partition: AUTH_USERS_PARTITION,
        timestamp_id: toUserKey(existing.uid),
      },
    })
  );

  await docClient.send(
    new DeleteCommand({
      TableName: DATA_TABLE_NAME,
      Key: {
        partition: AUTH_EMAILS_PARTITION,
        timestamp_id: toEmailKey(existing.email),
      },
    })
  );
};

export const createFullUserInDynamo = async (input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  dispatchPin?: string;
  profilePic?: string;
  requiresPasswordChange?: boolean;
}): Promise<UserMetadata> => {
  const email = normalizeEmail(input.email);
  const uid = randomUUID();

  await createAuthCredential(uid, email, input.password);

  const metadata = sanitizeUserMetadata({
    uid,
    email,
    name: input.name,
    role: input.role,
    permissions: input.permissions || [],
    dispatchPin: input.dispatchPin,
    profilePic: input.profilePic,
    requiresPasswordChange: Boolean(input.requiresPasswordChange),
  });
  if (!metadata) throw new Error("Invalid user metadata payload");
  await upsertUserMetadata(metadata);
  return metadata;
};

export const issueSessionToken = (user: Omit<SessionUser, "exp">): string => {
  const exp = now() + SESSION_TTL_MS;
  const headerPart = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = toBase64Url(JSON.stringify({ ...user, exp }));
  const signature = createHmac("sha256", getSessionSecret()).update(`${headerPart}.${payloadPart}`).digest("base64url");
  return `${headerPart}.${payloadPart}.${signature}`;
};

export const parseSessionToken = (token: string): SessionUser | null => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = createHmac("sha256", getSessionSecret()).update(`${headerPart}.${payloadPart}`).digest("base64url");
  const providedBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const payloadRaw = fromBase64Url(payloadPart);
    const payload = JSON.parse(payloadRaw) as Partial<SessionUser>;
    if (!payload.uid || !payload.email || !payload.role || !payload.name || typeof payload.exp !== "number") return null;
    if (payload.exp <= now()) return null;
    return {
      uid: payload.uid,
      email: normalizeEmail(payload.email),
      role: payload.role,
      name: payload.name,
      permissions: Array.isArray(payload.permissions) ? payload.permissions.filter((p): p is string => typeof p === "string") : [],
      exp: payload.exp,
    };
  } catch {
    return null;
  }
};

export const getSessionTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const cookieHeader = req.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const target = parts.find((p) => p.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!target) return null;
  return decodeURIComponent(target.slice(`${SESSION_COOKIE_NAME}=`.length));
};

export const getSessionUserFromRequest = async (req: Request): Promise<SessionUser | null> => {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  const parsed = parseSessionToken(token);
  if (!parsed) return null;

  const latestMeta = await getUserMetadataByUid(parsed.uid);
  if (!latestMeta) return null;

  return {
    uid: latestMeta.uid,
    email: normalizeEmail(latestMeta.email),
    role: latestMeta.role,
    name: latestMeta.name,
    permissions: latestMeta.permissions || [],
    dispatchPin: latestMeta.dispatchPin,
    exp: parsed.exp,
  };
};
