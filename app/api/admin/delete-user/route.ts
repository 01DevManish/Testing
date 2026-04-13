import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";


export async function POST(req: Request) {
  try {
    const { uid, adminUid } = await req.json();

    if (!uid || !adminUid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify that the requester is an admin
    const adminRef = adminDb.ref(`users/${adminUid}`);
    const adminSnap = await adminRef.once("value");
    const adminData = adminSnap.val();

    if (!adminData || adminData.role !== "admin") {
      console.error(`[Admin-Auth] Unauthorized delete attempt by UID: ${adminUid}. Role: ${adminData?.role}`);
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    console.log(`[Admin-Auth] Admin ${adminUid} is deleting user ${uid}`);

    // 2. Prevent self-deletion via this API for safety (though normally handled in UI)
    if (uid === adminUid) {
      return NextResponse.json({ error: "Cannot delete yourself through this API." }, { status: 400 });
    }

    // 3. Delete the user from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
      console.log(`[Admin-Auth] User ${uid} deleted successfully.`);
    } catch (authErr: any) {
      // If user doesn't exist in Auth, we still consider it a success if they are gone from RTDB
      if (authErr.code === "auth/user-not-found") {
        console.warn(`[Admin-Auth] User ${uid} not found in Auth, skipping Auth deletion.`);
      } else {
        throw authErr;
      }
    }

    // 4. Double check RTDB (though usually removed by client before/after this call)
    // We do it here as well for robustness
    await adminDb.ref(`users/${uid}`).remove();

    return NextResponse.json({ success: true, message: "User deleted from Auth and DB successfully" });
  } catch (error: any) {
    console.error("Admin User Deletion Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
