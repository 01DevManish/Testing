import { NextRequest, NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../../lib/dynamodb";

const PARTITION = "BOX#DISPATCH";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.id || crypto.randomUUID());
    const createdAt = body?.createdAt ? new Date(String(body.createdAt)).getTime() : Date.now();

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          partition: PARTITION,
          timestamp_id: `${createdAt}#${id}`,
          entityType: "box_dispatch",
          payload: body,
          createdAt,
        },
      })
    );

    return NextResponse.json({ success: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save box dispatch";
    console.error("Box dispatch POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
