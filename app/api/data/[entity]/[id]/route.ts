import { NextResponse } from "next/server";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "@/app/lib/dynamodb";
import { DataEntity, dataPartitionKey, dataSortKey, isDataEntity } from "@/app/lib/dataEntities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown> & { id?: string };

const readById = async (entity: DataEntity, id: string): Promise<Row | null> => {
  const result = await docClient.send(
    new GetCommand({
        TableName: DATA_TABLE_NAME,
        Key: {
          partition: dataPartitionKey(entity),
          timestamp_id: dataSortKey(id),
        },
      })
  );
  const payload = result.Item?.payload as Row | undefined;
  if (!payload || typeof payload !== "object") return null;
  return payload;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await params;
    if (!isDataEntity(entity)) {
      return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
    }
    const safeId = String(id || "").trim();
    if (!safeId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const item = await readById(entity, safeId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await params;
    if (!isDataEntity(entity)) {
      return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
    }
    const safeId = String(id || "").trim();
    if (!safeId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const updates = (body?.updates || {}) as Row;
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
    }

    const existing = await readById(entity, safeId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const next: Row = {
      ...existing,
      ...updates,
      id: safeId,
    };

    await docClient.send(
      new PutCommand({
        TableName: DATA_TABLE_NAME,
        Item: {
          partition: dataPartitionKey(entity),
          timestamp_id: dataSortKey(safeId),
          entityType: `dataset_${entity}`,
          payload: next,
          updatedAt: Date.now(),
        },
      })
    );

    return NextResponse.json({ success: true, item: next });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to patch item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await params;
    if (!isDataEntity(entity)) {
      return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
    }
    const safeId = String(id || "").trim();
    if (!safeId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: DATA_TABLE_NAME,
        Key: {
          partition: dataPartitionKey(entity),
          timestamp_id: dataSortKey(safeId),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
