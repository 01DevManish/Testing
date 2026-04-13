import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";


export async function POST(req: Request) {
  try {
    const { uid, newPassword, adminUid } = await req.json();

    if (!uid || !newPassword || !adminUid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    // 3. Set the requiresPasswordChange flag in RTDB
    await adminDb.ref(`users/${uid}`).update({
      requiresPasswordChange: true,
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Admin Password Update Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update password" }, { status: 500 });
  }
}
