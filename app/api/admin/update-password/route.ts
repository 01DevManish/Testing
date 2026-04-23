import { NextResponse } from "next/server";
import { getSessionUserFromRequest, setUserPasswordByUid } from "../../../lib/serverAuth";
import { getUserMetadataByUid, upsertUserMetadata } from "../../../lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";


export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uid, newPassword, newPin } = await req.json();

    if (!uid || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (newPin !== undefined && newPin !== null && !/^\d{4}$/.test(String(newPin))) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
    }

    // 1. Verify that the requester is an admin
    const isHiddenAdmin = (sessionUser.email || "").toLowerCase() === HIDDEN_ADMIN_EMAIL;
    const adminData = await getUserMetadataByUid(sessionUser.uid);
    if (!isHiddenAdmin && (!adminData || adminData.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    // 2. Update the user's password in Dynamo Auth
    await setUserPasswordByUid(uid, newPassword);

    // 3. Update Dynamo user metadata (and PIN if provided)
    const existing = await getUserMetadataByUid(uid);
    if (!existing) {
      return NextResponse.json({ error: "User metadata not found." }, { status: 404 });
    }
    await upsertUserMetadata({
      ...existing,
      requiresPasswordChange: true,
      passwordUpdatedAt: Date.now(),
      passwordUpdatedBy: sessionUser.uid,
      dispatchPin: newPin !== undefined && newPin !== null ? String(newPin) : existing.dispatchPin,
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: unknown) {
    console.error("Admin Password Update Error:", error);
    const message = error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
