import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const region = process.env.AWS_REGION || "ap-south-1";
const bucket = process.env.AWS_S3_BUCKET_NAME || "epanelimages";
const prefix = "Cloudinary_Archive_2026-04-10_10_27_479_Originals/";

const client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listFiles() {
  try {
    const data = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 10
    }));

    if (data.Contents) {
      console.log("📂 Files found in Archive folder:");
      data.Contents.forEach(obj => {
        console.log(`- ${obj.Key}`);
      });
    } else {
      console.log("❌ No files found in that prefix.");
    }
  } catch (err) {
    console.error("❌ Error listing S3 files:", err.name, err.message);
  }
}

listFiles();
