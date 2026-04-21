/* eslint-disable no-console */
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");

const REGION = process.env.AWS_REGION || "ap-south-1";
const TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";

const client = new DynamoDBClient({
  region: REGION,
  credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

async function run() {
  try {
    console.log(`Checking if table "${TABLE_NAME}" exists...`);
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`Table "${TABLE_NAME}" already exists.`);
    return;
  } catch (err) {
    const message = err?.name || err?.message || "";
    if (!String(message).includes("ResourceNotFoundException")) {
      throw err;
    }
  }

  console.log(`Creating table "${TABLE_NAME}"...`);
  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "partition", AttributeType: "S" },
        { AttributeName: "timestamp_id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "partition", KeyType: "HASH" },
        { AttributeName: "timestamp_id", KeyType: "RANGE" },
      ],
    })
  );

  console.log(`Table "${TABLE_NAME}" created successfully.`);
}

run().catch((err) => {
  console.error("Failed to setup data table:", err);
  process.exit(1);
});
