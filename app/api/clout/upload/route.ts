import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { uploadFile } from "@/app/lib/s3";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { getCloutItemById, putCloutItem } from "@/app/lib/serverClout";
import { CloutItem } from "@/app/lib/cloutTypes";

export const runtime = "nodejs";
const IMAGE_MIME_PREFIX = "image/";

const sanitizeName = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 160);

const extensionFromName = (name: string): string | undefined => {
  const ext = name.split(".").pop()?.toLowerCase().trim();
  if (!ext || ext === name.toLowerCase()) return undefined;
  return ext;
};

export async function POST(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file");
    const parentIdRaw = formData.get("parentId");
    const parentId = typeof parentIdRaw === "string" && parentIdRaw.trim() ? parentIdRaw.trim() : null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (parentId) {
      const parent = await getCloutItemById(parentId);
      if (!parent || parent.kind !== "folder") {
        return NextResponse.json({ error: "Invalid target folder" }, { status: 400 });
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const declaredMimeType = String(file.type || "").toLowerCase();
    const originalName = sanitizeName(file.name || "file");
    const ext = extensionFromName(originalName);
    const isImageMime = declaredMimeType.startsWith(IMAGE_MIME_PREFIX);
    const extSuggestsImage = Boolean(ext && ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "tiff", "tif", "heic", "heif"].includes(ext));
    if (!isImageMime && !extSuggestsImage) {
      return NextResponse.json(
        { error: "Only image uploads are allowed." },
        { status: 400 }
      );
    }
    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(buffer)
        .rotate()
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "Unsupported or corrupted image file. Please upload a valid image." },
        { status: 400 }
      );
    }

    const fileId = `fil_${randomUUID()}`;
    const s3Key = `clout/assets/${fileId}.webp`;
    const s3Url = await uploadFile(optimizedBuffer, s3Key, "image/webp");

    const now = Date.now();
    const item: CloutItem = {
      id: fileId,
      kind: "file",
      name: `${(originalName || `file-${now}`).replace(/\.[^.]+$/, "")}.webp`,
      parentId,
      createdAt: now,
      updatedAt: now,
      createdByUid: user.uid,
      createdByName: user.name,
      size: optimizedBuffer.byteLength,
      mimeType: "image/webp",
      extension: "webp",
      s3Key,
      s3Url,
    };

    await putCloutItem(item);
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
