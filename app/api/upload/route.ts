import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dd4hmahlm";
    const apiKey = process.env.CLOUDINARY_API_KEY || "253667214247696";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "nlLGSypdD6J5dXjUZ0RRItDtf5Y";

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Cloudinary signature: parameters in alphabetical order, then api_secret
    const stringToSign = `timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const cloudinaryFormData = new FormData();
    cloudinaryFormData.append('file', file as any);
    cloudinaryFormData.append('api_key', apiKey);
    cloudinaryFormData.append('timestamp', timestamp.toString());
    cloudinaryFormData.append('signature', signature);

    console.log("Attempting Cloudinary upload for cloud:", cloudName);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: cloudinaryFormData,
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("Cloudinary API Error Details:", data);
        throw new Error(data.error?.message || "Cloudinary upload rejected. Please check your credentials or image size.");
    }

    return NextResponse.json({ secure_url: data.secure_url });
  } catch (error: any) {
    console.error("Server-side upload error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error during upload" }, { status: 500 });
  }
}

