import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { CloutItem } from "@/app/lib/cloutTypes";
import { getCloutItemById, putCloutItem } from "@/app/lib/serverClout";

export const runtime = "nodejs";

const sanitizeName = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);

export async function POST(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = sanitizeName(String(body?.name || ""));
    const parentId = typeof body?.parentId === "string" && body.parentId.trim() ? String(body.parentId).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    if (parentId) {
      const parent = await getCloutItemById(parentId);
      if (!parent || parent.kind !== "folder") {
        return NextResponse.json({ error: "Invalid parent folder" }, { status: 400 });
      }
    }

    const now = Date.now();
    const item: CloutItem = {
      id: `fld_${randomUUID()}`,
      kind: "folder",
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
      createdByUid: user.uid,
      createdByName: user.name,
    };

    await putCloutItem(item);
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
