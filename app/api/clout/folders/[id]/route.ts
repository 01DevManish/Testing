import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { getCloutItemById, putCloutItem } from "@/app/lib/serverClout";

export const runtime = "nodejs";

const sanitizeName = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const safeId = String(id || "").trim();
    if (!safeId) return NextResponse.json({ error: "Missing folder id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const name = sanitizeName(String(body?.name || ""));
    if (!name) return NextResponse.json({ error: "Folder name is required" }, { status: 400 });

    const existing = await getCloutItemById(safeId);
    if (!existing || existing.kind !== "folder") {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const next = {
      ...existing,
      name,
      updatedAt: Date.now(),
    };

    await putCloutItem(next);
    return NextResponse.json({ item: next });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to rename folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
