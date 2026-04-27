import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { getCloutItemById, listCloutItems, putCloutItem } from "@/app/lib/serverClout";
import { CloutItem } from "@/app/lib/cloutTypes";

export const runtime = "nodejs";

const isDescendant = (
  allItems: Map<string, CloutItem>,
  maybeDescendantId: string | null,
  ancestorId: string
): boolean => {
  let cursor = maybeDescendantId;
  let guard = 0;

  while (cursor && guard < 500) {
    if (cursor === ancestorId) return true;
    const parent = allItems.get(cursor);
    if (!parent) return false;
    cursor = parent.parentId;
    guard += 1;
  }

  return false;
};

export async function POST(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const itemIds = Array.isArray(body?.itemIds)
      ? body.itemIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];
    const targetParentId = typeof body?.targetParentId === "string" && body.targetParentId.trim()
      ? body.targetParentId.trim()
      : null;

    if (!itemIds.length) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    if (targetParentId) {
      const target = await getCloutItemById(targetParentId);
      if (!target || target.kind !== "folder") {
        return NextResponse.json({ error: "Invalid target folder" }, { status: 400 });
      }
    }

    const allItems = await listCloutItems();
    const byId = new Map<string, CloutItem>(allItems.map((item) => [item.id, item]));

    const nextItems: CloutItem[] = [];

    for (const id of itemIds) {
      const item = byId.get(id);
      if (!item) continue;

      if (targetParentId === item.id) {
        return NextResponse.json({ error: "Cannot move item into itself" }, { status: 400 });
      }

      if (item.kind === "folder" && isDescendant(byId, targetParentId, item.id)) {
        return NextResponse.json({ error: "Cannot move folder into its own child folder" }, { status: 400 });
      }

      const updated: CloutItem = {
        ...item,
        parentId: targetParentId,
        updatedAt: Date.now(),
      };

      await putCloutItem(updated);
      nextItems.push(updated);
    }

    return NextResponse.json({ items: nextItems });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to move items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
