import { NextResponse } from 'next/server';
import { deleteFile } from '../../lib/s3';

export async function POST(req: Request) {
  try {
    const { key, public_id } = await req.json();
    
    // Support both 'key' and 'public_id' for easier migration
    const s3Key = key || public_id;

    if (!s3Key) {
        return NextResponse.json({ error: "No image key or public_id provided" }, { status: 400 });
    }

    console.log("Attempting S3 deletion:", s3Key);

    await deleteFile(s3Key);

    return NextResponse.json({ result: "ok" });
  } catch (error: any) {
    console.error("S3 delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

