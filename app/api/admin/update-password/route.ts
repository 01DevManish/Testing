import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


export async function POST(req: Request) {
  try {
    const { uid, newPassword, newPin, adminUid } = await req.json();

    if (!uid || !newPassword || !adminUid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (newPin !== undefined && newPin !== null && !/^\d{4}$/.test(String(newPin))) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
    }

    // 1. Verify that the requester is an admin
    const adminRef = adminDb.ref(`users/${adminUid}`);
    const adminSnap = await adminRef.once("value");
    const adminData = adminSnap.val();

    if (!adminData || adminData.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    // 2. Update the user's password in Firebase Auth
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    // 3. Update RTDB metadata (and PIN if provided)
    const updatePayload: Record<string, unknown> = {
      requiresPasswordChange: false,
      passwordUpdatedAt: Date.now(),
      passwordUpdatedBy: adminUid,
    };
    if (newPin !== undefined && newPin !== null) {
      updatePayload.dispatchPin = String(newPin);
    }
    await adminDb.ref(`users/${uid}`).update(updatePayload);

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: unknown) {
    console.error("Admin Password Update Error:", error);
    const message = error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
