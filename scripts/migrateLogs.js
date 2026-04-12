const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const admin = require("firebase-admin");
require("dotenv").config();

// Use the service account details found in firebaseAdmin.ts
const serviceAccount = {
  type: "service_account",
  project_id: "eurus-lifestyle",
  private_key_id: "186c1ef5140cc8009ea19260c53d317fa3e021ef",
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCzorD58icDgIxx\ngXrBKefI3hxe9q6Dj61x1kA+1OxprHmbCcnrg4uBlRupARxyamtztUzoEymjS8fk\nW3jgZl0NeNiN9P7Ro/Ng0wjtmlldjvX7iW/6DZgz+LwejlDi4NoViJoDnMXNcC76\nuh50ZRejn0G3YwZf93AxEoUOI5YXGjHFi/01EFnpkJ6rUXPjzZQBkyahInI4kfMF\nnPcPiffpztP5pfxvcg+gFA7vtn+ydwLUsYXVPbloCMfPQesRTHFN2aCBaRN0qv+1\n69w8CEoxFcPSLNL23lRDxU5wiy+aDt+4MoezHHhbKjk8K31gxCYFCoaBSY91/PiJ\nqZlY38ExAgMBAAECggEACnIkfnRhZme8QwF3hPIN43VfCvqnTUk2mc8Or1isYry/\n2Y8pKcPdgeyMzjgdUl3z36ekUD6FBlTqy9Gx5sKtGJJ1bVPY2ZICHhhHhaGbHsCo\ndzcXxt+xgRwuvEwkUf0nUWc/JYShT//9C2F1UelrBX3GUYa1oTD/Wissh5T0LmWj\nm/WTYgrx3xowV2t/tjlbjFZzLFTygslSfUYk5cwVcm5WXl7Rmi/hQM8kIZZXFhgk\nwN04aKX0VqQKniTe4+lKTcYNGZVShlb5HhkPkewncnAVlm+aTR/LySG+1UeyxNgg\nKat7sM3xxB2so5Uw9Cuydw8tgH7KdMmivB30hCh2UQKBgQDZVUb7s7w9CfMUzXyX\nMbI1na+4lzHhJHzCUSqPa3CeghDXs1O4XrJXplL2yEZpn+jOnYbv1rDBgYZZV7Gk\nTtGbDmnx2+ZN4ifYhSorl3o7WKY490juAWHqj6VZA2MgDtTy8TZkwwirJWud75Qz\nJtT1ixoYwh5xhkhVIlaPsr31FQKBgQDTmG1avOPNvUkSMFT0OajJBAgBXbKTYVgT\ntnyakBUZ0vddj+5ye3S5Ej8Mr4ApqHjriGGmdfYp57FvmLb3X+xp5FMTGJ5ffZZ3\n7cWs8whbYk7k5n+fDJZZHdIscK5Wk9TlEOZqQdpDKdM+2bwh5cnuqYW3/vbKqz/J\npGgFRmkarQKBgAMVhLZZrJgpJfvrlpMGr4K3RCEYdCq/u81+HV5/pc96BQcqkkuR\nfHJl99NssCMbk9AqyBlrMILudZua9Phh7fOHVtWJy1Dbnrkh2qFXuvJQpbs1NyG5\nf0w20Z/bvnJcA4WXCrCPW/Yhx88r8SxwpqD9Yldrmcb+otQicpwDa1KpAoGAGbJe\nPXHJHJhLQnk6J/rEo7zol/ngEQP2ZVZ5JXAwD9XOEr/DDoYts7gijhDWOLjsDnae\nnU+gGJC5vLrIJZyxol6HND9+JEylNGVc51cQgcCbojLX9uHZdHMprhn1IjCL31HB\nGdBriFKRBAX/UgKNFn3h7ml5YT2Q3pUnyNQ3OXUCgYEAy92SgVKyyYMe1bFrQBoa\nwYQwlEqB9hUTMmPh/rmdA3L9ziqlgwN3RBYUV3biOh1yzhIcPF6eMv5tCQZKOskd\nVzci9ntJMIKlL3O5oKd11RiegivFEKv3S0PDzIomUmWP7draFOTQ27iR1/gzZSH+\ng8bA9VIVX6g7OwiHMGcqDdw=\n-----END PRIVATE KEY-----\n").replace(/\\n/g, "\n").trim(),
  client_email: "firebase-adminsdk-fbsvc@eurus-lifestyle.iam.gserviceaccount.com",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
}

const db = admin.database();

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = "eurus-logs";

async function migrate() {
  try {
    console.log("Checking 'activities' node in Firebase...");
    let snapshot = await db.ref("activities").once("value");
    
    // If empty, check singular 'activity' as per user suggestion
    if (!snapshot.exists()) {
      console.log("'activities' empty, checking 'activity'...");
      snapshot = await db.ref("activity").once("value");
    }

    if (!snapshot.exists()) {
      console.log("No logs found in either 'activities' or 'activity' nodes.");
      return;
    }

    const logs = [];
    snapshot.forEach(child => {
      logs.push({ id: child.key, ...child.val() });
    });

    console.log(`Found ${logs.length} logs. Migrating to DynamoDB table "${TABLE_NAME}"...`);

    let count = 0;
    for (const log of logs) {
      const timestamp = log.timestamp || Date.now();
      const id = log.id || Math.random().toString(36).substring(2);

      const item = {
        partition: "ACTIVITY#LOGS",
        timestamp_id: `${timestamp}#${id}`,
        id,
        type: log.type || "system",
        action: log.action || "unknown",
        title: log.title || "",
        description: log.description || "",
        timestamp,
        userId: log.userId || "unknown",
        userName: log.userName || "Unknown",
        userRole: log.userRole || "unknown",
        metadata: log.metadata || {},
        GSI1PK: `USER#${log.userId || "unknown"}`,
        GSI1SK: `${timestamp}#${id}`,
      };

      await dynamoClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(item, { removeUndefinedValues: true }),
      }));
      count++;
      if (count % 10 === 0) process.stdout.write(".");
    }

    console.log(`\nSuccessfully migrated ${count} logs to DynamoDB!`);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit();
  }
}

migrate();
