import { NextRequest, NextResponse } from "next/server";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../../lib/dynamodb";

const PARTITION = "BOX#MANAGED";

interface ManagedBoxItem {
  id: string;
  createdAt?: number;
  [key: string]: unknown;
}

export async function GET() {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :sk)",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": PARTITION,
          ":sk": "BOX#",
        },
      })
    );

    const boxes = (result.Items || [])
      .map((item) => item.box as ManagedBoxItem)
      .filter(Boolean)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    return NextResponse.json({ boxes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load managed boxes";
    console.error("Managed boxes GET error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const box = body?.box as ManagedBoxItem | undefined;

    if (!box?.id) {
      return NextResponse.json({ error: "Box id is required" }, { status: 400 });
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          partition: PARTITION,
          timestamp_id: `BOX#${box.id}`,
          entityType: "managed_box",
          box,
          createdAt: box.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save managed box";
    console.error("Managed boxes POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Box id is required" }, { status: 400 });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          partition: PARTITION,
          timestamp_id: `BOX#${id}`,
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete managed box";
    console.error("Managed boxes DELETE error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
