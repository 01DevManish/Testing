const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = "eurus-logs";

async function setup() {
  try {
    console.log(`Checking if table "${TABLE_NAME}" exists...`);
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      console.log("Table already exists. Skipping creation.");
      return;
    } catch (e) {
      if (e.name !== "ResourceNotFoundException") throw e;
    }

    console.log("Creating table...");
    const command = new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: "partition", AttributeType: "S" },
        { AttributeName: "timestamp_id", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "partition", KeyType: "HASH" },
        { AttributeName: "timestamp_id", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });

    await client.send(command);
    console.log(`Table "${TABLE_NAME}" created successfully with GSI1!`);
  } catch (err) {
    console.error("Error setting up DynamoDB:", err);
  }
}

setup();
