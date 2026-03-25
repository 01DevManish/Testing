import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    
    if (!image) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dd4hmahlm";
    const apiKey = process.env.CLOUDINARY_API_KEY || "253667214247696";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "nlLGSypdD6J5dXjUZ0RRItDtf5Y";

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Create signature based on timestamp and secret
    const stringToSign = `timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const formData = new FormData();
    formData.append('file', image);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || "Failed to upload to Cloudinary");
    }

    return NextResponse.json({ secure_url: data.secure_url });
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
