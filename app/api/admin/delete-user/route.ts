import { NextResponse } from "next/server";
import { deleteAuthUserByUid, getSessionUserFromRequest } from "../../../lib/serverAuth";
import { deleteUserMetadataByUid, getUserMetadataByUid } from "../../../lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";


export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify that the requester is an admin
    const isHiddenAdmin = (sessionUser.email || "").toLowerCase() === HIDDEN_ADMIN_EMAIL;
    const adminData = await getUserMetadataByUid(sessionUser.uid);
    if (!isHiddenAdmin && (!adminData || adminData.role !== "admin")) {
      console.error(`[Admin-Auth] Unauthorized delete attempt by UID: ${sessionUser.uid}. Role: ${adminData?.role}`);
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    console.log(`[Admin-Auth] Admin ${sessionUser.uid} is deleting user ${uid}`);

    // 2. Prevent self-deletion via this API for safety (though normally handled in UI)
    if (uid === sessionUser.uid) {
      return NextResponse.json({ error: "Cannot delete yourself through this API." }, { status: 400 });
    }

    // 3. Delete user from Dynamo auth
    await deleteAuthUserByUid(uid);

    // 4. Remove user metadata from Dynamo
    await deleteUserMetadataByUid(uid);

    return NextResponse.json({ success: true, message: "User deleted from Dynamo auth and DB successfully" });
  } catch (error: any) {
    console.error("Admin User Deletion Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
