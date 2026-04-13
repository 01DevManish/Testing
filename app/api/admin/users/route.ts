import { adminAuth, adminDb } from "@/app/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    // 1. Fetch Users from Firebase Auth (Source of Truth)
    // This will return all 12 users even if they aren't in RTDB yet
    const authList = await adminAuth.listUsers(1000);
    const authUsers = authList.users;

    // 2. Fetch Metadata (Roles/Permissions) from RTDB
    const dbSnap = await adminDb.ref("users").once("value");
    const dbUsers = dbSnap.val() || {};

    // 3. Merge Data
    const mergedUsers = authUsers.map((u) => {
      const dbInfo = dbUsers[u.uid] || {};
      return {
        uid: u.uid,
        id: u.uid, // Compatibility
        email: u.email,
        name: u.displayName || dbInfo.name || "Unknown User",
        role: dbInfo.role || "user",
        permissions: dbInfo.permissions || [],
        dispatchPin: dbInfo.dispatchPin || "",
        createdAt: u.metadata.creationTime,
        lastSignIn: u.metadata.lastSignInTime,
        profilePic: u.photoURL || dbInfo.profilePic || null,
      };
    }).sort((a, b) => {
        // Sort admins first, then by email
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return (a.email || "").localeCompare(b.email || "");
    });

    return NextResponse.json({ users: mergedUsers });
  } catch (error: any) {
    console.error("[API-Users] Error listing users:", error.message);
    // Return specific error if key is the problem
    if (error.code?.includes("invalid-credential") || error.message?.includes("key")) {
        return NextResponse.json({ 
            error: "Admin SDK logic failed. Please verify FIREBASE_PRIVATE_KEY in .env",
            details: error.message 
        }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
