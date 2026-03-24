import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI || "http://localhost:3000/api/auth/zoho/callback";
  const zohoDomain = process.env.ZOHO_DOMAIN || "accounts.zoho.in";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Zoho OAuth not configured. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env.local" },
      { status: 500 }
    );
  }

  try {
    // Step 1: Exchange authorization code for access token
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
      console.error("Zoho token error:", tokenData);
      return NextResponse.json({ error: `Zoho token error: ${tokenData.error}` }, { status: 400 });
    }

    if (!tokenData.access_token) {
      console.error("No access_token in Zoho response:", tokenData);
      return NextResponse.json({ error: "No access token received from Zoho" }, { status: 400 });
    }

    // Step 2: Fetch user profile from Zoho
    const userRes = await fetch(`https://${zohoDomain}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
    });

    const zohoUser = await userRes.json();

    if (!zohoUser || (!zohoUser.Email && !zohoUser.ZUID)) {
      console.error("Invalid Zoho user info:", zohoUser);
      return NextResponse.json({ error: "Failed to fetch Zoho user profile" }, { status: 400 });
    }

    // Return all available Zoho profile data
    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expiry: tokenData.expires_in || null,
      user: {
        email: zohoUser.Email || "",
        name: zohoUser.Display_Name || zohoUser.First_Name || "User",
        firstName: zohoUser.First_Name || "",
        lastName: zohoUser.Last_Name || "",
        zohoId: zohoUser.ZUID || "",
        gender: zohoUser.Gender || "",
        mobile: zohoUser.Mobile || "",
        phone: zohoUser.Phone_Number || "",
        country: zohoUser.Country_Code || "",
        timeZone: zohoUser.Time_Zone || "",
        language: zohoUser.Language || "",
        photoUrl: zohoUser.Photo_URL || "",
      },
    });
  } catch (err) {
    console.error("Zoho auth error:", err);
    return NextResponse.json({ error: "Authentication failed. Please try again." }, { status: 500 });
  }
}
