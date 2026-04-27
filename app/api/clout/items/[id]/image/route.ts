import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { s3Client } from "@/app/lib/s3";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { getCloutItemById } from "@/app/lib/serverClout";

const bucketName = process.env.AWS_S3_BUCKET_NAME || "eurusimages";

export const runtime = "nodejs";

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const safeId = String(id || "").trim();
    if (!safeId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

    const item = await getCloutItemById(safeId);
    if (!item || item.kind !== "file" || !item.s3Key) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: item.s3Key,
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Image body missing" }, { status: 404 });
    }

    const bytes = await result.Body.transformToByteArray();
    return new NextResponse(toArrayBuffer(bytes), {
      headers: {
        "Content-Type": result.ContentType || item.mimeType || "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
