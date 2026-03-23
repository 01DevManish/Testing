import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI || "http://localhost:3000/api/callback";

  const zohoDomain = process.env.ZOHO_DOMAIN || "accounts.zoho.in";

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Zoho OAuth not configured. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env.local" }, { status: 500 });
  }

  try {
    // Exchange code for tokens
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
    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error }, { status: 400 });
    }

    // Get user info from Zoho
    const userRes = await fetch(`https://${zohoDomain}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
    });

    const zohoUser = await userRes.json();

    return NextResponse.json({
      access_token: tokenData.access_token,
      user: {
        email: zohoUser.Email || "",
        name: zohoUser.Display_Name || zohoUser.First_Name || "User",
        zohoId: zohoUser.ZUID || "",
      },
    });
  } catch (err) {
    console.error("Zoho auth error:", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
