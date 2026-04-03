import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

try {
  const resp = await client.send(new PutObjectCommand({
    Bucket: "eurusimages",
    Key: "images/test-new-keys.txt",
    Body: "Testing with new credentials",
    ContentType: "text/plain",
  }));
  console.log("✅ Credentials Valid! Status:", resp.$metadata.httpStatusCode);
} catch (e) {
  console.error("❌ Credential Error:", e.name, e.message?.substring(0, 200));
}
