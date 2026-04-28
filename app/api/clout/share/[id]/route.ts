import { NextResponse } from "next/server";
import { getCloutItemById } from "@/app/lib/serverClout";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = String(id || "").trim();
    if (!safeId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

    const item = await getCloutItemById(safeId);
    if (!item || item.kind !== "file" || !item.s3Url) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.redirect(item.s3Url, { status: 302 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve share link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

