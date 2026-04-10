import { S3Client, PutBucketPolicyCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const region = process.env.AWS_REGION || "ap-south-1";
const bucket = process.env.AWS_S3_BUCKET_NAME || "epanelimages";

console.log(`🚀 Applying S3 Visibility Configuration...`);
console.log(`📦 Bucket: ${bucket}`);

const client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function applyConfig() {
  try {
    // 1. Apply Bucket Policy for Public Read
    console.log("📄 Applying Public Read Policy...");
    const policyPath = path.resolve(__dirname, "s3-public-policy.json");
    const policy = fs.readFileSync(policyPath, "utf-8");
    
    await client.send(new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: policy,
    }));
    console.log("✅ Bucket Policy applied successfully.");

    // 2. Apply CORS Configuration
    console.log("🌐 Applying CORS Configuration...");
    const corsPath = path.resolve(__dirname, "s3-cors-policy.json");
    const corsRules = JSON.parse(fs.readFileSync(corsPath, "utf-8"));
    
    await client.send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: corsRules },
    }));
    console.log("✅ CORS Configuration applied successfully.");

    console.log("\n✨ S3 Visibility Fix Complete! Images should now be visible via their URLs.");
  } catch (e) {
    console.error("\n❌ Error applying configuration:", e.name);
    console.error(e.message);
    
    if (e.name === "AccessDenied") {
      console.log("\n💡 IMPORTANT: You must manually disable 'Block all public access' in the AWS S3 Console for this bucket first.");
    }
  }
}

applyConfig();
