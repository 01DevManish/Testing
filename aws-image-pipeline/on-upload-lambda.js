const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const path = require("path");

const s3 = new S3Client(); // Shared client

async function streamToBuffer(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

exports.handler = async (event) => {
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const ext = path.extname(key).toLowerCase();

    // Only process original images, not our generated ones
    if (key.endsWith(".webp") || key.endsWith(".avif")) return;
    if (![".jpg", ".jpeg", ".png"].includes(ext)) return;

    console.log(`Optimizing: ${key} in ${bucket}`);

    try {
        const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const buffer = await streamToBuffer(Body);

        const baseKey = key.substring(0, key.lastIndexOf("."));

        // Generate optimized formats
        const [webpBuffer, avifBuffer] = await Promise.all([
            sharp(buffer).webp({ quality: 80 }).toBuffer(),
            sharp(buffer).avif({ quality: 50 }).toBuffer()
        ]);

        // Upload back to S3
        await Promise.all([
            s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: `${baseKey}.webp`,
                Body: webpBuffer,
                ContentType: "image/webp",
                CacheControl: "public, max-age=31536000, immutable"
            })),
            s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: `${baseKey}.avif`,
                Body: avifBuffer,
                ContentType: "image/avif",
                CacheControl: "public, max-age=31536000, immutable"
            }))
        ]);

        console.log(`✅ Successfully optimized ${key}`);
    } catch (err) {
        console.error(`❌ Error optimizing ${key}:`, err);
        throw err;
    }
};
