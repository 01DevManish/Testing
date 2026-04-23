import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "../../lib/serverAuth";
import { getUserMetadataByUid, sanitizeUserMetadata, upsertUserMetadata } from "../../lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const requestedUid = (url.searchParams.get("uid") || sessionUser.uid).trim();

    if (requestedUid !== sessionUser.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await getUserMetadataByUid(requestedUid);

    return NextResponse.json({ user: user || null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load user metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();

    const uid = String(body?.uid || sessionUser.uid).trim();
    if (uid !== sessionUser.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextDispatchPin = body?.data?.dispatchPin;
    if (nextDispatchPin !== undefined && nextDispatchPin !== null && !/^\d{4}$/.test(String(nextDispatchPin))) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
    }

    const existing = await getUserMetadataByUid(uid);
    const merged = sanitizeUserMetadata({
      ...(existing || {}),
      ...(body?.data || {}),
      uid,
      email: body?.data?.email || existing?.email,
      name: body?.data?.name || existing?.name,
    });

    if (!merged) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await upsertUserMetadata(merged);
    return NextResponse.json({ success: true, user: merged });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update user metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
