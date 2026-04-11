import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Fetch the image from the remote source (e.g. S3)
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image data with original content type and caching
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      },
    });
  } catch (error: any) {
    console.error("Image Proxy Error:", error);
    return NextResponse.json({ error: "Failed to load image through proxy" }, { status: 500 });
  }
}
