import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { s3Client } from "@/app/lib/s3";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";

export const runtime = "nodejs";

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { path } = await params;
    if (!Array.isArray(path) || path.length < 2) {
      return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
    }

    const [bucket, ...keyParts] = path;
    const key = keyParts.join("/");
    if (!bucket || !key) {
      return NextResponse.json({ error: "Invalid bucket/key" }, { status: 400 });
    }

    const object = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!object.Body) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(toArrayBuffer(bytes), {
      headers: {
        "Content-Type": object.ContentType || "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inventory image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
