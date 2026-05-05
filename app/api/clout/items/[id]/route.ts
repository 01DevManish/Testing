import { NextResponse } from "next/server";
import { deleteFile } from "@/app/lib/s3";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { deleteCloutItemById, getCloutItemById, putCloutItem } from "@/app/lib/serverClout";

export const runtime = "nodejs";

const sanitizeName = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 160);

const ensureWebpFileName = (name: string): string => {
  const base = sanitizeName(name).replace(/\.[^.]+$/, "").trim();
  return `${base || "image"}.webp`;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const safeId = String(id || "").trim();
    if (!safeId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const existing = await getCloutItemById(safeId);
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const rawName = sanitizeName(String(body?.name || ""));
    if (!rawName) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const next = {
      ...existing,
      name: existing.kind === "file" ? ensureWebpFileName(rawName) : rawName,
      updatedAt: Date.now(),
    };

    await putCloutItem(next);
    return NextResponse.json({ item: next });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to rename item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const safeId = String(id || "").trim();
    if (!safeId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

    const existing = await getCloutItemById(safeId);
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (existing.kind === "file" && existing.s3Key) {
      await deleteFile(existing.s3Key);
    }

    await deleteCloutItemById(safeId);
    return NextResponse.json({ success: true, id: safeId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
