import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, get, set, update } from "firebase/database";

// Initialize Firebase for server-side use
const firebaseConfig = {
  apiKey: "AIzaSyBZCDXLDGVCylL8mGCx6AAzp4Y2ngyd_zo",
  authDomain: "eurus-lifestyle.firebaseapp.com",
  projectId: "eurus-lifestyle",
  storageBucket: "eurus-lifestyle.firebasestorage.app",
  messagingSenderId: "678618926664",
  appId: "1:678618926664:web:b533b8985f7b96af02d27d",
  measurementId: "G-N9EYS3V4PQ",
  databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getDatabase(app);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error");
  const origin = req.nextUrl.origin;

  // Handle errors or missing code
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
    // ── Step 1: Exchange authorization code for access token ──
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
      console.error("Zoho token error:", tokenData);
      return NextResponse.redirect(
        new URL(`/?login_error=${encodeURIComponent(tokenData.error || "token_failed")}`, origin)
      );
    }

    // ── Step 2: Fetch user profile from Zoho ──
    const userRes = await fetch(`https://${zohoDomain}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
    });

    const zohoUser = await userRes.json();

    if (!zohoUser || (!zohoUser.Email && !zohoUser.ZUID)) {
      console.error("Invalid Zoho user info:", zohoUser);
      return NextResponse.redirect(new URL("/?login_error=profile_fetch_failed", origin));
    }

    // ── Step 3: Build user data ──
    const email = zohoUser.Email || "";
    const name = zohoUser.Display_Name || zohoUser.First_Name || "User";
    const zohoId = zohoUser.ZUID || "";
    const zohoUid = `zoho_${zohoId || email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const isAdminEmail = email === "01devmanish@gmail.com";
    const now = Date.now();

    const profileData = {
      uid: zohoUid,
      email,
      name,
      firstName: zohoUser.First_Name || "",
      lastName: zohoUser.Last_Name || "",
      zohoId,
      gender: zohoUser.Gender || "",
      mobile: zohoUser.Mobile || "",
      phone: zohoUser.Phone_Number || "",
      country: zohoUser.Country_Code || "",
      timeZone: zohoUser.Time_Zone || "",
      language: zohoUser.Language || "",
      photoUrl: zohoUser.Photo_URL || "",
      provider: "zoho",
    };

    // ── Step 4: Store in Database ──
    const db = getDb();
    const docRef = ref(db, `users/${zohoUid}`);
    const docSnap = await get(docRef);

    let userData: Record<string, any>;

    if (!docSnap.exists()) {
      // New user — create with all Zoho data
      userData = {
        ...profileData,
        role: isAdminEmail ? "admin" : "employee",
        permissions: isAdminEmail ? ["all"] : [],
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      await set(docRef, userData);
    } else {
      // Existing user — update profile, keep role
      const existing = docSnap.val();
      const updateFields: Record<string, any> = {
        name: name || existing.name,
        firstName: profileData.firstName || existing.firstName || "",
        lastName: profileData.lastName || existing.lastName || "",
        mobile: profileData.mobile || existing.mobile || "",
        phone: profileData.phone || existing.phone || "",
        country: profileData.country || existing.country || "",
        timeZone: profileData.timeZone || existing.timeZone || "",
        language: profileData.language || existing.language || "",
        photoUrl: profileData.photoUrl || existing.photoUrl || "",
        lastLoginAt: now,
        updatedAt: now,
      };

      if (isAdminEmail && existing.role !== "admin") {
        updateFields.role = "admin";
        updateFields.permissions = ["all"];
      }

      await update(docRef, updateFields);
      userData = { ...existing, ...updateFields };
    }

    // ── Step 5: Set session cookie and redirect ──
    // Store session data as a cookie so the client can pick it up
    const sessionData = {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      role: userData.role || "employee",
      permissions: userData.permissions || [],
      provider: "zoho",
      photoUrl: userData.photoUrl || "",
    };

    const encodedSession = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    // Determine dashboard route
    let dashboardRoute = "/dashboard/user";
    if (sessionData.role === "admin") dashboardRoute = "/dashboard/admin";
    else if (sessionData.role === "employee" || sessionData.role === "manager") dashboardRoute = "/dashboard";

    const response = NextResponse.redirect(new URL(dashboardRoute, origin));

    // Set a temporary cookie with session data (client JS will read it and save to localStorage)
    response.cookies.set("zoho_session", encodedSession, {
      path: "/",
      maxAge: 120, // 2 minutes — just needs to survive the redirect
      httpOnly: false, // client JS needs to read it
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("Zoho callback error:", err);
    return NextResponse.redirect(new URL("/?login_error=auth_failed", origin));
  }
}
