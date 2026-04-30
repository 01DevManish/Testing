import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "./dynamodb";

export type UserRole = "admin" | "manager" | "employee" | "user";

export interface UserMetadata {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  crmWorkspaceCreated?: boolean;
  dispatchPin?: string;
  profilePic?: string;
  requiresPasswordChange?: boolean;
  passwordUpdatedAt?: number;
  passwordUpdatedBy?: string;
}

const USERS_PARTITION = "DATA#usersMeta";
const userSortKey = (uid: string) => `ITEM#${uid}`;

const normalizeRole = (role: unknown): UserRole => {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};

const normalizeDispatchPin = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const digits = String(value).trim().replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 4) return digits;
  if (digits.length < 4) return digits.padStart(4, "0");
  return undefined;
};

export const sanitizeUserMetadata = (raw: unknown): UserMetadata | null => {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<UserMetadata>;
  const uid = typeof input.uid === "string" ? input.uid.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!uid || !email || !name) return null;

  return {
    uid,
    email,
    name,
    role: normalizeRole(input.role),
    permissions: Array.isArray(input.permissions) ? input.permissions.filter((p): p is string => typeof p === "string") : [],
    crmWorkspaceCreated: Boolean(input.crmWorkspaceCreated),
    dispatchPin: normalizeDispatchPin(input.dispatchPin),
    profilePic: typeof input.profilePic === "string" ? input.profilePic : undefined,
    requiresPasswordChange: Boolean(input.requiresPasswordChange),
    passwordUpdatedAt: typeof input.passwordUpdatedAt === "number" ? input.passwordUpdatedAt : undefined,
    passwordUpdatedBy: typeof input.passwordUpdatedBy === "string" ? input.passwordUpdatedBy : undefined,
  };
};

export const getUserMetadataByUid = async (uid: string): Promise<UserMetadata | null> => {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return null;

  try {
    const res = await docClient.send(
      new QueryCommand({
        TableName: DATA_TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND #s = :sk",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": USERS_PARTITION,
          ":sk": userSortKey(safeUid),
        },
        Limit: 1,
      })
    );

    const payload = res.Items?.[0]?.payload;
    const clean = sanitizeUserMetadata(payload);
    if (clean) return clean;
  } catch {
    return null;
  }
  return null;
};

export const listAllUserMetadata = async (): Promise<UserMetadata[]> => {
  try {
    const rows: UserMetadata[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const res = await docClient.send(
        new QueryCommand({
          TableName: DATA_TABLE_NAME,
          KeyConditionExpression: "#p = :pk AND begins_with(#s, :skPrefix)",
          ExpressionAttributeNames: {
            "#p": "partition",
            "#s": "timestamp_id",
          },
          ExpressionAttributeValues: {
            ":pk": USERS_PARTITION,
            ":skPrefix": "ITEM#",
          },
          ExclusiveStartKey: lastKey,
        })
      );

      (res.Items || []).forEach((item) => {
        const clean = sanitizeUserMetadata(item?.payload);
        if (clean) rows.push(clean);
      });

      lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    return rows;
  } catch {
    return [];
  }
};

export const upsertUserMetadata = async (user: UserMetadata): Promise<void> => {
  const clean = sanitizeUserMetadata(user);
  if (!clean) {
    throw new Error("Invalid user metadata payload");
  }

  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: USERS_PARTITION,
        timestamp_id: userSortKey(clean.uid),
        entityType: "dataset_users_meta",
        payload: clean,
        updatedAt: Date.now(),
      },
    })
  );
};

export const deleteUserMetadataByUid = async (uid: string): Promise<void> => {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return;
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: DATA_TABLE_NAME,
        Key: {
          partition: USERS_PARTITION,
          timestamp_id: userSortKey(safeUid),
        },
      })
    );
  } catch {
    throw new Error("Failed to delete user metadata");
  }
};
