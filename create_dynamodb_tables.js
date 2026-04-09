const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB({
  region: 'ap-south-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_SECRET_ACCESS_KEY',
});

const tables = [
  {
    TableName: 'inventory',
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'users',
    AttributeDefinitions: [{ AttributeName: 'uid', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'uid', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'activities',
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function createTables() {
  for (const table of tables) {
    try {
      console.log(`Creating table: ${table.TableName}...`);
      await dynamoDB.createTable(table).promise();
      console.log(`✅ Table ${table.TableName} created successfully.`);
    } catch (err) {
      if (err.code === 'ResourceInUseException') {
        console.log(`ℹ️ Table ${table.TableName} already exists.`);
      } else {
        console.error(`❌ Error creating table ${table.TableName}:`, err.message);
      }
    }
  }
}

createTables();
