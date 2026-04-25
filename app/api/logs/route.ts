import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "../../lib/dynamodb";
import { QueryCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getSessionUserFromRequest } from "../../lib/serverAuth";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

const isHiddenAdminEmail = (value: unknown): boolean =>
  String(value || "").trim().toLowerCase() === HIDDEN_ADMIN_EMAIL;
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, action, title, description, userId, userName, userRole, userEmail, metadata } = body;
    const effectiveUserId = String(userId || sessionUser.uid);
    const effectiveUserName = String(userName || sessionUser.name || "System");
    const effectiveUserRole = String(userRole || sessionUser.role || "employee");
    const effectiveUserEmail = String(userEmail || sessionUser.email || "").trim().toLowerCase();

    // Hidden admin is fully excluded from activity logs.
    if (isHiddenAdminEmail(sessionUser.email) || isHiddenAdminEmail(effectiveUserEmail)) {
      return NextResponse.json({ success: true, message: "Restricted user: Logging skipped" });
    }

    const timestamp = Date.now();
    const id = crypto.randomUUID();

    const item = {
      partition: "ACTIVITY#LOGS",
      timestamp_id: `${timestamp}#${id}`,
      id,
      type,
      action,
      title,
      description,
      timestamp,
      userId: effectiveUserId,
      userName: effectiveUserName,
      userEmail: effectiveUserEmail,
      userRole: effectiveUserRole,
      metadata: metadata || {},
      // GSI1 for user filtering
      GSI1PK: `USER#${effectiveUserId}`,
      GSI1SK: `${timestamp}#${id}`,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }));

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DynamoDB POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = sessionUser.role === "admin";

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");
    const userId = !isAdmin ? sessionUser.uid : requestedUserId;
    const type = searchParams.get("type");
    const period = searchParams.get("period"); // day, week, month
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const lastKey = searchParams.get("lastKey"); // For pagination

    const limit = 100;
    let exclusiveStartKey = lastKey ? JSON.parse(Buffer.from(lastKey, "base64").toString()) : undefined;

    let queryParams: any = {
      TableName: TABLE_NAME,
      Limit: limit,
      ScanIndexForward: false, // Descending order (latest first)
      ExclusiveStartKey: exclusiveStartKey,
    };

    // Calculate time range
    let startTimestamp = 0;
    const now = Date.now();
    if (period === "day") startTimestamp = now - 24 * 60 * 60 * 1000;
    else if (period === "week") startTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    else if (period === "month") startTimestamp = now - 30 * 24 * 60 * 60 * 1000;
    
    if (startDate) startTimestamp = new Date(startDate).getTime();
    let endTimestamp = endDate ? new Date(endDate).getTime() : now;

    // Build Query
    const expressionAttributeNames: any = {};
    if (userId) {
      // Use GSI1 for user filtering
      queryParams.IndexName = "GSI1";
      queryParams.KeyConditionExpression = "GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end";
      queryParams.ExpressionAttributeValues = {
        ":pk": `USER#${userId}`,
        ":start": `${startTimestamp}#`,
        ":end": `${endTimestamp}#\uffff`,
      };
    } else {
      // Basic query on main table
      expressionAttributeNames["#p"] = "partition";
      queryParams.KeyConditionExpression = "#p = :pk AND timestamp_id BETWEEN :start AND :end";
      queryParams.ExpressionAttributeValues = {
        ":pk": "ACTIVITY#LOGS",
        ":start": `${startTimestamp}#`,
        ":end": `${endTimestamp}#\uffff`,
      };
    }

    // Filter by type if provided
    if (type && type !== "all") {
      queryParams.FilterExpression = "#t = :type";
      expressionAttributeNames["#t"] = "type";
      queryParams.ExpressionAttributeValues[":type"] = type;
    }

    if (Object.keys(expressionAttributeNames).length > 0) {
      queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Encode last key for next page
    const nextKey = result.LastEvaluatedKey 
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") 
      : null;

    const sanitizedLogs = (result.Items || []).filter((row) => {
      const item = row as Record<string, unknown>;
      if (isHiddenAdminEmail(item.userEmail)) return false;
      if (isHiddenAdminEmail(item.email)) return false;
      return true;
    });

    return NextResponse.json({
      logs: sanitizedLogs,
      nextKey,
    });
  } catch (error: any) {
    console.error("DynamoDB GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    let lastKey: Record<string, unknown> | undefined;
    let targetSk: string | null = null;

    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "#p = :pk AND #s BETWEEN :start AND :end",
          ExpressionAttributeNames: { "#p": "partition", "#s": "timestamp_id" },
          ExpressionAttributeValues: { ":pk": "ACTIVITY#LOGS", ":start": "0#", ":end": "9999999999999#\uffff" },
          ProjectionExpression: "timestamp_id, id",
          ExclusiveStartKey: lastKey,
        })
      );

      for (const row of result.Items || []) {
        if (String(row?.id || "") === id) {
          targetSk = String(row.timestamp_id || "");
          break;
        }
      }
      if (targetSk) break;
      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    if (!targetSk) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          partition: "ACTIVITY#LOGS",
          timestamp_id: targetSk,
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DynamoDB DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete log" }, { status: 500 });
  }
}
