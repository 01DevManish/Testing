import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { listCloutItems } from "@/app/lib/serverClout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getSessionUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await listCloutItems();
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch Clout items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
