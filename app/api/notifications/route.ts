import { NextResponse } from "next/server";
import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "../../lib/dynamodb";
import { getSessionUserFromRequest } from "../../lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NotificationType = "task" | "inventory" | "system" | "order";

const partitionFor = (uid: string) => `NOTIF#${uid}`;
const sortKeyFor = (id: string) => `ITEM#${id}`;

const parseNumber = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export async function GET(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const targetUid = String(url.searchParams.get("uid") || user.uid).trim();
    if (targetUid !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = Math.max(1, Math.min(100, parseNumber(url.searchParams.get("limit"), 20)));
    const res = await docClient.send(
      new QueryCommand({
        TableName: DATA_TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :prefix)",
        ExpressionAttributeNames: { "#p": "partition", "#s": "timestamp_id" },
        ExpressionAttributeValues: { ":pk": partitionFor(targetUid), ":prefix": "ITEM#" },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    const notifications = (res.Items || [])
      .map((i) => i.payload || null)
      .filter((p): p is Record<string, unknown> => Boolean(p));

    return NextResponse.json({ notifications });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetUid = String(body?.targetUid || body?.uid || "").trim();
    const title = String(body?.title || "").trim();
    const message = String(body?.message || body?.body || "").trim();
    const type = (String(body?.type || "system") as NotificationType);
    const link = body?.link ? String(body.link) : (body?.url ? String(body.url) : undefined);
    const actorId = body?.actorId ? String(body.actorId) : undefined;
    const actorName = body?.actorName ? String(body.actorName) : undefined;

    if (!targetUid || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ts = Date.now();
    const id = `notif_${ts}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      id,
      uid: targetUid,
      title,
      message,
      type,
      link,
      actorId,
      actorName,
      read: false,
      timestamp: ts,
    };

    await docClient.send(
      new PutCommand({
        TableName: DATA_TABLE_NAME,
        Item: {
          partition: partitionFor(targetUid),
          timestamp_id: sortKeyFor(id),
          entityType: "notification",
          payload,
          updatedAt: ts,
        },
      })
    );

    return NextResponse.json({ success: true, notification: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const uid = String(body?.uid || user.uid).trim();
    const id = String(body?.id || "").trim();
    const read = Boolean(body?.read);
    if (uid !== user.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await docClient.send(
      new UpdateCommand({
        TableName: DATA_TABLE_NAME,
        Key: {
          partition: partitionFor(uid),
          timestamp_id: sortKeyFor(id),
        },
        UpdateExpression: "SET payload.#read = :read, payload.updatedAt = :updatedAt, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#read": "read" },
        ExpressionAttributeValues: {
          ":read": read,
          ":updatedAt": Date.now(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const uid = String(body?.uid || user.uid).trim();
    if (uid !== user.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = String(body?.id || "").trim();
    const clearAll = Boolean(body?.clearAll);

    if (clearAll) {
      let lastKey: Record<string, unknown> | undefined;
      do {
        const res = await docClient.send(
          new QueryCommand({
            TableName: DATA_TABLE_NAME,
            KeyConditionExpression: "#p = :pk AND begins_with(#s, :prefix)",
            ExpressionAttributeNames: { "#p": "partition", "#s": "timestamp_id" },
            ExpressionAttributeValues: { ":pk": partitionFor(uid), ":prefix": "ITEM#" },
            ProjectionExpression: "timestamp_id",
            ExclusiveStartKey: lastKey,
          })
        );
        for (const item of res.Items || []) {
          if (!item?.timestamp_id) continue;
          await docClient.send(
            new DeleteCommand({
              TableName: DATA_TABLE_NAME,
              Key: { partition: partitionFor(uid), timestamp_id: item.timestamp_id },
            })
          );
        }
        lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastKey);

      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await docClient.send(
      new DeleteCommand({
        TableName: DATA_TABLE_NAME,
        Key: {
          partition: partitionFor(uid),
          timestamp_id: sortKeyFor(id),
        },
      })
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
