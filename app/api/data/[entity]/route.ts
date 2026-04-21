import { NextRequest, NextResponse } from "next/server";
import { DeleteCommand, PutCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "../../../lib/dynamodb";
import { dataPartitionKey, dataSortKey, isDataEntity } from "../../../lib/dataEntities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown> & { id?: string };

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

export async function GET(
  _req: NextRequest,
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
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [DATA_TABLE_NAME]: chunk.map((sk) => ({
                DeleteRequest: {
                  Key: { partition, timestamp_id: sk },
                },
              })),
            },
          })
        );
      }
      cleared = existingKeys.length;
    }

    let upserted = 0;
    const itemsToPut = items.filter(r => typeof r?.id === "string" && r.id.trim());
    
    for (let i = 0; i < itemsToPut.length; i += 25) {
      const chunk = itemsToPut.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [DATA_TABLE_NAME]: chunk.map((row) => ({
              PutRequest: {
                Item: {
                  partition,
                  timestamp_id: dataSortKey((row.id as string).trim()),
                  entityType: `dataset_${entity}`,
                  payload: row,
                  updatedAt: Date.now(),
                },
              },
            })),
          },
        })
      );
      upserted += chunk.length;
    }

    return NextResponse.json({ success: true, upserted, cleared });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to sync data";
    console.error("Dynamo data POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
