import { NextResponse } from "next/server";
import { getSessionUserFromRequest, setUserPasswordByUid } from "@/app/lib/serverAuth";
import { getUserMetadataByUid, upsertUserMetadata } from "@/app/lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const newPassword = String(body?.newPassword || "");
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    await setUserPasswordByUid(sessionUser.uid, newPassword);
    const metadata = await getUserMetadataByUid(sessionUser.uid);
    if (metadata) {
      await upsertUserMetadata({
        ...metadata,
        requiresPasswordChange: false,
        passwordUpdatedAt: Date.now(),
        passwordUpdatedBy: sessionUser.uid,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
