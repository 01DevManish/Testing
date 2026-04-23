import { NextResponse } from "next/server";
import { createFullUserInDynamo, getSessionUserFromRequest } from "@/app/lib/serverAuth";
import { getUserMetadataByUid, UserRole } from "@/app/lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

const normalizeRole = (role: unknown): UserRole => {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminMeta = await getUserMetadataByUid(sessionUser.uid);
    const isHiddenAdmin = sessionUser.email.toLowerCase() === HIDDEN_ADMIN_EMAIL;
    if (!isHiddenAdmin && adminMeta?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const password = String(body?.password || "");
    const role = normalizeRole(body?.role);
    const permissions = Array.isArray(body?.permissions)
      ? body.permissions.filter((p: unknown): p is string => typeof p === "string")
      : [];
    const dispatchPin = body?.dispatchPin == null ? undefined : String(body.dispatchPin);

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (dispatchPin && !/^\d{4}$/.test(dispatchPin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
    }

    const created = await createFullUserInDynamo({
      email,
      name,
      password,
      role,
      permissions,
      dispatchPin,
      requiresPasswordChange: true,
    });

    return NextResponse.json({ success: true, user: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = message.includes("already in use") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
