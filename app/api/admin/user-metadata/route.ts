import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "../../../lib/serverAuth";
import { deleteUserMetadataByUid, getUserMetadataByUid, sanitizeUserMetadata, upsertUserMetadata } from "../../../lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

const ensureAdmin = async (req: Request): Promise<string> => {
  const user = await getSessionUserFromRequest(req);
  if (!user) throw new Error("Missing authorization");
  if ((user.email || "").toLowerCase() === HIDDEN_ADMIN_EMAIL) {
    return user.uid;
  }
  const adminMeta = await getUserMetadataByUid(user.uid);
  if (!adminMeta || adminMeta.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user.uid;
};

export async function POST(req: Request) {
  try {
    const adminUid = await ensureAdmin(req);
    void adminUid;
    const body = await req.json();
    const uid = String(body?.uid || "").trim();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const existing = await getUserMetadataByUid(uid);
    const merged = sanitizeUserMetadata({
      ...(existing || {}),
      ...(body?.data || {}),
      uid,
      email: body?.data?.email || existing?.email,
      name: body?.data?.name || existing?.name,
    });
    if (!merged) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    await upsertUserMetadata(merged);
    return NextResponse.json({ success: true, user: merged });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upsert user metadata";
    const status = message === "Forbidden" ? 403 : message === "Missing authorization" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const adminUid = await ensureAdmin(req);
    void adminUid;
    const body = await req.json().catch(() => ({}));
    const uid = String(body?.uid || "").trim();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    await deleteUserMetadataByUid(uid);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user metadata";
    const status = message === "Forbidden" ? 403 : message === "Missing authorization" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
