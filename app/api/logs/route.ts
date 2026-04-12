import { NextRequest, NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "../../lib/dynamodb";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, action, title, description, userId, userName, userRole, metadata } = body;

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
      userId,
      userName,
      userRole,
      metadata: metadata || {},
      // GSI1 for user filtering
      GSI1PK: `USER#${userId}`,
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
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
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

    return NextResponse.json({
      logs: result.Items,
      nextKey,
    });
  } catch (error: any) {
    console.error("DynamoDB GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
