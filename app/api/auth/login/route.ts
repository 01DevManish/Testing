import { NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, issueSessionToken, upsertAuthCredentialForUid, verifyEmailPassword } from "@/app/lib/serverAuth";
import { getUserMetadataByUid, sanitizeUserMetadata, upsertUserMetadata } from "@/app/lib/serverUserMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

const loginAgainstLegacyFirebase = async (email: string, password: string): Promise<{ uid: string; email: string } | null> => {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBZCDXLDGVCylL8mGCx6AAzp4Y2ngyd_zo";
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const uid = String(json?.localId || "").trim();
    const normalizedEmail = String(json?.email || email).trim().toLowerCase();
    if (!uid || !normalizedEmail) return null;
    return { uid, email: normalizedEmail };
  } catch {
    return null;
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    let credential = await verifyEmailPassword(email, password);
    if (!credential) {
      // Bridge path for legacy Firebase users:
      // Accept old password once, then persist password hash in Dynamo auth.
      const legacy = await loginAgainstLegacyFirebase(email, password);
      if (!legacy) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
      await upsertAuthCredentialForUid(legacy.uid, legacy.email, password);
      credential = await verifyEmailPassword(email, password);
      if (!credential) {
        return NextResponse.json({ error: "Login sync failed. Please try again." }, { status: 500 });
      }
    }

    let metadata = await getUserMetadataByUid(credential.uid);
    if (!metadata) {
      const bootstrap = sanitizeUserMetadata({
        uid: credential.uid,
        email: credential.email,
        name: credential.email.split("@")[0] || "User",
        role: credential.email === HIDDEN_ADMIN_EMAIL ? "admin" : "employee",
        permissions: [],
      });
      if (bootstrap) {
        await upsertUserMetadata(bootstrap);
        metadata = bootstrap;
      }
    }
    if (!metadata) {
      return NextResponse.json({ error: "User profile not found. Contact admin." }, { status: 403 });
    }

    const token = issueSessionToken({
      uid: metadata.uid,
      email: metadata.email,
      role: metadata.role,
      name: metadata.name,
      permissions: metadata.permissions || [],
    });

    const response = NextResponse.json({
      success: true,
      user: metadata,
    });
    response.cookies.set(SESSION_COOKIE, encodeURIComponent(token), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set(AUTH_COOKIE, "1", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
