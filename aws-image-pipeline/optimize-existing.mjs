import { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  PutObjectCommand,
  HeadObjectCommand 
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load config
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} else {
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const config = {
  region: process.env.AWS_REGION || "ap-south-1",
  bucket: process.env.AWS_S3_BUCKET_NAME || "epanelimages",
  concurrency: 10,
  webpQuality: 80,
  avifQuality: 50,
  reprocessAll: process.argv.includes("--all"), // Pass --all to overwrite existing optimized images
};

const s3 = new S3Client({
  region: config.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function checkExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch (e) {
    return false;
  }
}

async function processImage(key) {
  const ext = path.extname(key).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) return;

  const baseKey = key.substring(0, key.lastIndexOf("."));
  const webpKey = `${baseKey}.webp`;
  const avifKey = `${baseKey}.avif`;

  // Check if we already have optimized versions
  if (!config.reprocessAll) {
    const [webpExists, avifExists] = await Promise.all([
      checkExists(webpKey),
      checkExists(avifKey)
    ]);
    if (webpExists && avifExists) {
      console.log(`- Skipping ${key} (already optimized)`);
      return;
    }
  }

  console.log(`🚀 Processing: ${key}`);

  try {
    // 1. Download original
    const { Body, ContentType } = await s3.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }));

    const buffer = await streamToBuffer(Body);

    // 2. Convert to WebP
    const webpBuffer = await sharp(buffer)
      .webp({ quality: config.webpQuality })
      .toBuffer();

    // 3. Convert to AVIF
    const avifBuffer = await sharp(buffer)
      .avif({ quality: config.avifQuality })
      .toBuffer();

    // 4. Upload WebP
    await s3.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: webpKey,
      Body: webpBuffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));

    // 5. Upload AVIF
    await s3.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: avifKey,
      Body: avifBuffer,
      ContentType: "image/avif",
      CacheControl: "public, max-age=31536000, immutable",
    }));

    console.log(`✅ Success: ${key}`);
  } catch (err) {
    console.error(`❌ Error processing ${key}:`, err.message);
  }
}

async function bulkOptimize() {
  console.log("🛠 Starting Bulk Optimization...");
  console.log(`Bucket: ${config.bucket}`);
  console.log(`Reprocess All: ${config.reprocessAll}`);

  let isTruncated = true;
  let nextContinuationToken = null;
  let totalProcessed = 0;

  while (isTruncated) {
    const listParams = {
      Bucket: config.bucket,
      ContinuationToken: nextContinuationToken,
    };

    const data = await s3.send(new ListObjectsV2Command(listParams));
    const items = data.Contents || [];

    // Process in batches (limited concurrency)
    for (let i = 0; i < items.length; i += config.concurrency) {
      const batch = items.slice(i, i + config.concurrency);
      await Promise.all(batch.map(item => processImage(item.Key)));
      totalProcessed += batch.length;
      console.log(`--- Progress: ${totalProcessed} objects scanned ---`);
    }

    isTruncated = data.IsTruncated;
    nextContinuationToken = data.NextContinuationToken;
  }

  console.log("\n✨ Bulk Optimization Complete!");
  console.log(`Total Objects Scanned: ${totalProcessed}`);
}

bulkOptimize().catch(console.error);
