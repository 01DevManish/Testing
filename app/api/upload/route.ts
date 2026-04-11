import { NextResponse } from 'next/server';
import { uploadFile } from '../../lib/s3';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    // Verify S3 credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error("S3 Error: AWS credentials are not configured in environment variables.");
      return NextResponse.json({ error: "Storage configuration error: Missing AWS credentials." }, { status: 500 });
    }
    
    if (!file) {

        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let buffer: Buffer;
    let fileType: string;
    let originalName: string;

    if (typeof file === "string") {
        // Handle base64 string
        const base64Data = file.split(',')[1] || file;
        buffer = Buffer.from(base64Data, 'base64');
        
        // Try to detect content type from base64 if present
        const match = file.match(/^data:(.*);base64,/);
        fileType = match ? match[1] : 'image/jpeg';
        originalName = "upload.jpg";
    } else {
        // Handle File object
        const bytes = await file.arrayBuffer();
        buffer = Buffer.from(bytes);
        fileType = file.type;
        originalName = file.name;
    }

    // Determine the subfolder based on file type (images/ or pdf/)
    const subFolder = fileType.includes('pdf') ? 'pdf/' : 'images/';
    
    // Create a unique filename with timestamp and correct folder hierarchy
    const prefix = process.env.AWS_S3_PATH_PREFIX || "";
    const fileName = `${prefix}${subFolder}${Date.now()}-${originalName.replace(/\s+/g, '_')}`;

    
    console.log("Attempting S3 upload:", fileName);


    const publicUrl = await uploadFile(buffer, fileName, fileType);


    return NextResponse.json({ secure_url: publicUrl });
  } catch (error: any) {
    console.error("Server-side upload error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error during upload" }, { status: 500 });
  }
}


