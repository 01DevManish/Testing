import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { public_id } = await req.json();
    
    if (!public_id) {
        return NextResponse.json({ error: "No public_id provided" }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dd4hmahlm";
    const apiKey = process.env.CLOUDINARY_API_KEY || "253667214247696";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "nlLGSypdD6J5dXjUZ0RRItDtf5Y";

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Create signature: public_id=${public_id}&timestamp=${timestamp}${apiSecret}
    const stringToSign = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const formData = new FormData();
    formData.set('public_id', public_id);
    formData.set('api_key', apiKey);
    formData.set('timestamp', timestamp.toString());
    formData.set('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || "Failed to delete from Cloudinary");
    }

    return NextResponse.json({ result: data.result });
  } catch (error: any) {
    console.error("Cloudinary delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
