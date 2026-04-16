import { NextResponse } from 'next/server';
import { uploadFile } from '../../lib/s3';
import sharp from 'sharp';

const EXT_FROM_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

const sanitizeSku = (sku: string): string =>
  sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const inferExtFromName = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ext || "jpg";
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const skuRaw = (formData.get("sku") as string | null) || "";
    const safeSku = sanitizeSku(skuRaw);

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
        if (file.startsWith("http://") || file.startsWith("https://")) {
            // Handle remote URL: fetch bytes server-side.
            const remote = await fetch(file);
            if (!remote.ok) {
              throw new Error(`Failed to fetch image URL (${remote.status})`);
            }
            const arrBuf = await remote.arrayBuffer();
            buffer = Buffer.from(arrBuf);

            fileType = remote.headers.get("content-type") || "image/jpeg";
            const pathname = (() => {
              try { return new URL(file).pathname; } catch { return ""; }
            })();
            const fromUrl = pathname.split("/").pop() || "";
            const fallbackExt = EXT_FROM_TYPE[fileType] || "jpg";
            originalName = fromUrl || `upload.${fallbackExt}`;
        } else {
            // Handle base64 string
            const base64Data = file.split(',')[1] || file;
            buffer = Buffer.from(base64Data, 'base64');
            
            // Try to detect content type from base64 if present
            const match = file.match(/^data:(.*);base64,/);
            fileType = match ? match[1] : 'image/jpeg';
            originalName = "upload.jpg";
        }
    } else {
        // Handle File object
        const bytes = await file.arrayBuffer();
        buffer = Buffer.from(bytes);
        fileType = file.type;
        originalName = file.name;
    }

    // Determine the subfolder based on file type
    const customFolder = formData.get('folder') as string;
    const isPdf = fileType.includes('pdf') || originalName.toLowerCase().endsWith('.pdf');
    const subFolder = customFolder ? `${customFolder}/` : (isPdf ? 'pdf/' : 'images/');

    // IMAGE OPTIMIZATION: Convert all images to WebP using sharp
    let finalBuffer = buffer;
    let finalFileType = fileType;
    let finalFileName = originalName;

    if (!isPdf && fileType.startsWith('image/')) {
        try {
            console.log(`[Sharp] Optimizing ${originalName} (${fileType})...`);
            finalBuffer = await sharp(buffer)
                .webp({ quality: 80, effort: 4 })
                .toBuffer();
            
            finalFileType = 'image/webp';
            // Swap extension to .webp
            const nameParts = originalName.split('.');
            if (nameParts.length > 1) nameParts.pop();
            finalFileName = `${nameParts.join('.')}.webp`;
            
            console.log(`[Sharp] Optimized to WebP. Size: ${(buffer.length/1024).toFixed(1)}KB -> ${(finalBuffer.length/1024).toFixed(1)}KB`);
        } catch (sharpError) {
            console.error("Sharp optimization failed, falling back to original:", sharpError);
            // Fallback to original buffer if sharp fails
        }
    }
    
    const prefix = process.env.AWS_S3_PATH_PREFIX || "";
    const ext = inferExtFromName(finalFileName);
    const defaultName = `${Date.now()}-${finalFileName.replace(/\s+/g, "_")}`;
    const skuName = safeSku ? `${safeSku}-${Date.now()}.${ext}` : defaultName;
    const chosenName = !isPdf && safeSku ? skuName : defaultName;
    const fileName = `${prefix}${subFolder}${chosenName}`;

    console.log("Attempting S3 upload:", fileName);
    const publicUrl = await uploadFile(finalBuffer, fileName, finalFileType);

    return NextResponse.json({ secure_url: publicUrl });
  } catch (error: unknown) {
    console.error("Server-side upload error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error during upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


