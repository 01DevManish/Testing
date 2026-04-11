import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "ap-south-1";
const bucketName = process.env.AWS_S3_BUCKET_NAME || "eurusimages";

const s3Client = new S3Client({
  region,
  credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

/**
 * Uploads a file to S3
 * @param buffer - File content as Buffer or Uint8Array
 * @param fileName - Target file path in the bucket
 * @param contentType - MIME type of the file
 */
export async function uploadFile(buffer: Buffer | Uint8Array, fileName: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  
  // Construct the public URL
  return `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
}

/**
 * Deletes a file from S3
 * @param fileName - File path in the bucket
 */
export async function deleteFile(fileName: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: fileName,
  });

  await s3Client.send(command);
  return true;
}

export { s3Client };
