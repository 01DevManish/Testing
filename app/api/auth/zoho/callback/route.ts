import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, issueSessionToken } from "@/app/lib/serverAuth";
import { getUserMetadataByUid, sanitizeUserMetadata, upsertUserMetadata } from "@/app/lib/serverUserMetadata";

const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";
const OFFICIAL_EMAIL_DOMAIN = "euruslifestyle.in";

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const isAllowedLoginEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  return !!email && (email === HIDDEN_ADMIN_EMAIL || email.endsWith(`@${OFFICIAL_EMAIL_DOMAIN}`));
};

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error");
  const origin = req.nextUrl.origin;

  if (errorParam || !code) {
    const errorMsg = errorParam || "no_code";
    return NextResponse.redirect(new URL(`/?login_error=${encodeURIComponent(errorMsg)}`, origin));
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI || `${origin}/api/auth/zoho/callback`;
  const zohoDomain = process.env.ZOHO_DOMAIN || "accounts.zoho.in";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?login_error=server_not_configured", origin));
  }

  try {
    const tokenRes = await fetch(`https://${zohoDomain}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(new URL(`/?login_error=${encodeURIComponent(tokenData.error || "token_failed")}`, origin));
    }

    const userRes = await fetch(`https://${zohoDomain}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
    });
    const zohoUser = await userRes.json();

    if (!zohoUser || (!zohoUser.Email && !zohoUser.ZUID)) {
      return NextResponse.redirect(new URL("/?login_error=profile_fetch_failed", origin));
    }

    const email = normalizeEmail(zohoUser.Email || "");
    if (!isAllowedLoginEmail(email)) {
      return NextResponse.redirect(new URL("/?login_error=email_domain_not_allowed", origin));
    }

    const name = String(zohoUser.Display_Name || zohoUser.First_Name || "User").trim();
    const zohoId = String(zohoUser.ZUID || "").trim();
    const zohoUid = `zoho_${zohoId || email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const existing = await getUserMetadataByUid(zohoUid);

    const merged = sanitizeUserMetadata({
      ...(existing || {}),
      uid: zohoUid,
      email,
      name,
      role: email === HIDDEN_ADMIN_EMAIL ? "admin" : (existing?.role || "employee"),
      permissions: existing?.permissions || [],
      profilePic: String(zohoUser.Photo_URL || existing?.profilePic || ""),
    });
    if (!merged) {
      return NextResponse.redirect(new URL("/?login_error=auth_failed", origin));
    }
    await upsertUserMetadata(merged);

    const token = issueSessionToken({
      uid: merged.uid,
      email: merged.email,
      role: merged.role,
      name: merged.name,
      permissions: merged.permissions || [],
    });

    let dashboardRoute = "/dashboard";
    if (merged.role === "admin") dashboardRoute = "/dashboard/admin";
    else if (merged.role === "user") dashboardRoute = "/dashboard/employee";

    const response = NextResponse.redirect(new URL(dashboardRoute, origin));
    response.cookies.set(SESSION_COOKIE, encodeURIComponent(token), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set(AUTH_COOKIE, "1", {
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?login_error=auth_failed", origin));
  }
}
