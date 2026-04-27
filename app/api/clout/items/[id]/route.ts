import { NextResponse } from "next/server";
import { deleteFile } from "@/app/lib/s3";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { deleteCloutItemById, getCloutItemById } from "@/app/lib/serverClout";

export const runtime = "nodejs";

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
