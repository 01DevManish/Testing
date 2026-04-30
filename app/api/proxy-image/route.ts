import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { s3Client } from "@/app/lib/s3";

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const parseS3Location = (rawUrl: string): { bucket: string; key: string } | null => {
  try {
    const u = new URL(rawUrl);
    const host = u.host.toLowerCase();
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));

    // Virtual-hosted-style: <bucket>.s3.<region>.amazonaws.com/<key>
    if (host.includes(".s3.") && host.endsWith(".amazonaws.com")) {
      const bucket = host.split(".s3.")[0];
      if (!bucket || !path) return null;
      return { bucket, key: path };
    }

    // Path-style: s3.<region>.amazonaws.com/<bucket>/<key>
    if (host.startsWith("s3.") && host.endsWith(".amazonaws.com")) {
      const [bucket, ...rest] = path.split("/");
      const key = rest.join("/");
      if (!bucket || !key) return null;
      return { bucket, key };
    }

    return null;
  } catch {
    return null;
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const s3Location = parseS3Location(imageUrl);
    if (s3Location) {
      try {
        const object = await s3Client.send(
          new GetObjectCommand({
            Bucket: s3Location.bucket,
            Key: s3Location.key,
          })
        );

        if (!object.Body) {
          return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }

        const bytes = await object.Body.transformToByteArray();
        return new NextResponse(toArrayBuffer(bytes), {
          headers: {
            "Content-Type": object.ContentType || "image/jpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (s3Err) {
        // If AWS SDK access is restricted for this bucket, fallback to public HTTP fetch.
        console.warn("Proxy S3 SDK fetch failed; falling back to HTTP fetch:", s3Err);
      }
    }

    // Fallback for non-S3 sources or S3 SDK permission failures.
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const blob = await response.blob();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image data with original content type and caching
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      },
    });
  } catch (error: unknown) {
    console.error("Image Proxy Error:", error);
    return NextResponse.json({ error: "Failed to load image through proxy" }, { status: 500 });
  }
}
