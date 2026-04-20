import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "ap-south-1";

const client = new DynamoDBClient({
  region,
  credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export { docClient };
export const TABLE_NAME = process.env.DYNAMO_LOGS_TABLE || "eurus-logs";
export const DATA_TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";
