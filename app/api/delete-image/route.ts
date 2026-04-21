import { NextResponse } from 'next/server';
import { deleteFile } from '../../lib/s3';

const CLOUDFRONT_DOMAIN = (process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "").trim();
const cloudfrontHost = CLOUDFRONT_DOMAIN.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

const parseStorageKey = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const direct = trimmed.replace(/^\/+/, "").split("?")[0];
    return direct || null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.host.toLowerCase();
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

    if (!key) return null;
    if (host.includes("amazonaws.com")) return key;
    if (cloudfrontHost && host === cloudfrontHost) return key;

    return null;
  } catch {
    return null;
  }
};

export async function POST(req: Request) {
  try {
    const { key, public_id, imageUrl } = await req.json();
    
    // Support both 'key' and 'public_id' for easier migration
    const s3Key = parseStorageKey(key) || parseStorageKey(public_id) || parseStorageKey(imageUrl);

    if (!s3Key) {
        return NextResponse.json({ error: "No valid image key provided" }, { status: 400 });
    }

    console.log("Attempting S3 deletion:", s3Key);

    await deleteFile(s3Key);

    return NextResponse.json({ result: "ok" });
  } catch (error: unknown) {
    console.error("S3 delete error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

