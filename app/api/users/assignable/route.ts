import { NextResponse } from "next/server";
import { getSessionUserFromRequest, listAuthCredentials } from "@/app/lib/serverAuth";
import { listAllUserMetadata } from "@/app/lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

const normalizeRole = (value: unknown): string => {
  if (typeof value !== "string") return "employee";
  const role = value.trim().toLowerCase();
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};

export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [authUsers, metadataRows] = await Promise.all([
      listAuthCredentials(),
      listAllUserMetadata(),
    ]);

    const metadataByUid = new Map(
      metadataRows.map((row) => [String(row.uid || "").trim(), row])
    );

    const users = authUsers
      .map((u) => {
        const uid = String(u.uid || "").trim();
        if (!uid) return null;

        const metadata = metadataByUid.get(uid) || {};
        const email = String(u.email || "").trim();
        const fallbackName = email ? email.split("@")[0] : "";
        const name = String((metadata as Record<string, unknown>).name || "").trim() || fallbackName || `User ${uid.slice(0, 6)}`;
        const role = normalizeRole((metadata as Record<string, unknown>).role);

        return {
          id: uid,
          uid,
          email,
          name,
          role,
        };
      })
      .filter((row): row is { id: string; uid: string; email: string; name: string; role: string } => Boolean(row))
      .filter((row) => String(row.email || "").trim().toLowerCase() !== HIDDEN_ADMIN_EMAIL)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load assignable users";
    console.error("[API-AssignableUsers] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

