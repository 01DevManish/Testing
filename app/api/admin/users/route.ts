import { getSessionUserFromRequest, listAuthCredentials } from "@/app/lib/serverAuth";
import { listAllUserMetadata } from "@/app/lib/serverUserMetadata";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";


export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.email !== HIDDEN_ADMIN_EMAIL && sessionUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Fetch Users from Dynamo Auth (Source of Truth)
    const authUsers = await listAuthCredentials();

    // 2. Fetch Metadata (Roles/Permissions) from Dynamo
    const metadataRows = await listAllUserMetadata();
    const dbUsers = Object.fromEntries(metadataRows.map((row) => [row.uid, row]));

    // 3. Merge Data
    const mergedUsers = authUsers.map((u) => {
      const dbInfo = dbUsers[u.uid] || {};
      return {
        uid: u.uid,
        id: u.uid, // Compatibility
        email: u.email,
        name: dbInfo.name || u.email.split("@")[0] || "Unknown User",
        role: dbInfo.role || (dbInfo.role as string) || "user",
        permissions: (dbInfo.permissions as string[]) || [],
        crmWorkspaceCreated: Boolean((dbInfo as { crmWorkspaceCreated?: boolean }).crmWorkspaceCreated),
        dispatchPin: (dbInfo.dispatchPin as string) || "",
        createdAt: u.createdAt,
        lastSignIn: null,
        profilePic: dbInfo.profilePic || null,
        requiresPasswordChange: Boolean(dbInfo.requiresPasswordChange),
      };
    }).filter((u) => String(u.email || "").trim().toLowerCase() !== HIDDEN_ADMIN_EMAIL)
      .sort((a, b) => {
        // Sort admins first, then by email
        const aRole = a.role || "";
        const bRole = b.role || "";
        if (aRole === "admin" && bRole !== "admin") return -1;
        if (aRole !== "admin" && bRole === "admin") return 1;
        return (a.email || "").localeCompare(b.email || "");
    });

    return NextResponse.json({ users: mergedUsers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list users";
    console.error("[API-Users] Error listing users:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
