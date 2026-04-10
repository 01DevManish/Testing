import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const region = process.env.AWS_REGION || "ap-south-1";
const bucket = process.env.AWS_S3_BUCKET_NAME || "epanelimages";
const prefix = process.env.AWS_S3_PATH_PREFIX || "";

console.log(`🔍 Testing S3 Access...`);
console.log(`📍 Region: ${region}`);
console.log(`📦 Bucket: ${bucket}`);
console.log(`📂 Prefix: ${prefix}`);

const client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const testKey = `${prefix}debug-test-${Date.now()}.txt`;

try {
  const resp = await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: testKey,
    Body: "S3 Integration Diagnostic Test - SUCCESS",
    ContentType: "text/plain",
  }));
  console.log("✅ Credentials Valid! S3 Upload Status:", resp.$metadata.httpStatusCode);
  console.log(`🔗 Test File URL: https://${bucket}.s3.${region}.amazonaws.com/${testKey}`);
} catch (e) {
  console.error("❌ S3 Error:", e.name, e.message);
  console.log("\n💡 Tip: Check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local");
}
