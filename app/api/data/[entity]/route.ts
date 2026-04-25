import { NextRequest, NextResponse } from "next/server";
import { DeleteCommand, PutCommand, QueryCommand, BatchWriteCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "../../../lib/dynamodb";
import { dataPartitionKey, dataSortKey, isDataEntity } from "../../../lib/dataEntities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

type Row = Record<string, unknown> & { id?: string };
type WriteRequest = { DeleteRequest?: { Key: Record<string, unknown> }; PutRequest?: { Item: Record<string, unknown> } };

const emitEntitySignal = async (entity: string): Promise<void> => {
  // No-op: Firebase sync signals removed in Dynamo-only mode.
  void entity;
};

const fetchExistingKeys = async (partition: string): Promise<string[]> => {
  const keys: string[] = [];
  let lastKey: Record<string, unknown> | undefined;

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
        ProjectionExpression: "timestamp_id",
        ExclusiveStartKey: lastKey,
      })
    );

    (result.Items || []).forEach((item) => {
      const sk = item.timestamp_id;
      if (typeof sk === "string") keys.push(sk);
    });

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return keys;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const writeBatchWithRetries = async (requests: WriteRequest[]): Promise<void> => {
  if (!requests.length) return;

  let pending: WriteRequest[] = requests;
  let attempt = 0;

  while (pending.length > 0) {
    attempt += 1;
    const result = await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [DATA_TABLE_NAME]: pending,
        },
      })
    );

    const unprocessed = (result.UnprocessedItems?.[DATA_TABLE_NAME] || []) as WriteRequest[];
    if (!unprocessed.length) return;

    if (attempt >= 10) {
      throw new Error(`Batch write incomplete after retries. Unprocessed items: ${unprocessed.length}`);
    }

    pending = unprocessed;
    await sleep(Math.min(1000 * attempt, 5000));
  }
};

const mergeDefined = (base: Row, patch: Row): Row => {
  const next: Row = { ...base };
  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value !== undefined) next[key] = value;
  });
  return next;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;
    if (!isDataEntity(entity)) {
      return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
    }

    const partition = dataPartitionKey(entity);
    const rows: Row[] = [];
    let lastKey: Record<string, unknown> | undefined;

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
        const payload = item.payload as Row | undefined;
        if (payload && typeof payload === "object") rows.push(payload);
      });

      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    if (entity === "usersMeta") {
      const filtered = rows.filter((row) => {
        const email = String((row as Record<string, unknown>)?.email || "").trim().toLowerCase();
        return email !== HIDDEN_ADMIN_EMAIL;
      });
      return NextResponse.json({ items: filtered });
    }

    if (entity === "inventory") {
      const filtered = rows.filter((row) => {
        const sku = String((row as Record<string, unknown>)?.sku || "").trim();
        const productName = String((row as Record<string, unknown>)?.productName || "").trim();
        // Guard against corrupted/empty rows that break inventory UX.
        return Boolean(sku || productName);
      });
      return NextResponse.json({ items: filtered });
    }

    if (entity === "tasks") {
      const assignedTo = req.nextUrl.searchParams.get("assignedTo")?.trim();
      if (assignedTo) {
        const filtered = rows.filter((row) => String((row as Record<string, unknown>)?.assignedTo || "").trim() === assignedTo);
        return NextResponse.json({ items: filtered });
      }
    }

    return NextResponse.json({ items: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load data";
    console.error("Dynamo data GET error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;
    if (!isDataEntity(entity)) {
      return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
    }

    const body = await req.json();
    const mode = (body?.mode as string) || "upsert";
    const items = Array.isArray(body?.items) ? (body.items as Row[]) : [];

    if (items.length === 0) {
      return NextResponse.json({ success: true, upserted: 0, cleared: 0 });
    }

    const partition = dataPartitionKey(entity);
    let cleared = 0;

    if (mode === "replace") {
      const existingKeys = await fetchExistingKeys(partition);
      for (let i = 0; i < existingKeys.length; i += 25) {
        const chunk = existingKeys.slice(i, i + 25);
        await writeBatchWithRetries(
          chunk.map((sk) => ({
            DeleteRequest: {
              Key: { partition, timestamp_id: sk },
            },
          }))
        );
      }
      cleared = existingKeys.length;
    }

    let upserted = 0;
    const itemsToPut = items.filter(r => typeof r?.id === "string" && r.id.trim());
    
    for (let i = 0; i < itemsToPut.length; i += 25) {
      const chunk = itemsToPut.slice(i, i + 25);
      const keys = chunk.map((row) => ({
        partition,
        timestamp_id: dataSortKey((row.id as string).trim()),
      }));

      const existingResponse = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [DATA_TABLE_NAME]: {
              Keys: keys,
            },
          },
        })
      );

      const existingMap = new Map<string, Row>();
      (existingResponse.Responses?.[DATA_TABLE_NAME] || []).forEach((item) => {
        const sk = item.timestamp_id;
        const payload = item.payload as Row | undefined;
        if (typeof sk !== "string") return;
        if (!payload || typeof payload !== "object") return;
        existingMap.set(sk, payload);
      });

      await writeBatchWithRetries(
        chunk.map((row) => ({
          PutRequest: {
            Item: {
              partition,
              timestamp_id: dataSortKey((row.id as string).trim()),
              entityType: `dataset_${entity}`,
              payload: mergeDefined(
                existingMap.get(dataSortKey((row.id as string).trim())) || {},
                row
              ),
              updatedAt: Date.now(),
            },
          },
        }))
      );
      upserted += chunk.length;
    }

    await emitEntitySignal(entity);
    return NextResponse.json({ success: true, upserted, cleared });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to sync data";
    console.error("Dynamo data POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
