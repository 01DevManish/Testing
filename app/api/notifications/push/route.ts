import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  // Dynamo-only mode: push bridge disabled.
  return NextResponse.json({ success: true, skipped: true });
}
