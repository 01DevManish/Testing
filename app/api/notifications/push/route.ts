import { NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDb } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { uid, title, body, link, data } = await req.json();

    if (!uid || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch user's FCM tokens from Realtime Database
    const tokensRef = adminDb.ref(`users/${uid}/fcmTokens`);
    const snapshot = await tokensRef.once("value");
    
    if (!snapshot.exists()) {
      return NextResponse.json({ success: true, message: "No tokens found for user" });
    }

    const tokensMap = snapshot.val();
    const tokens = Object.values(tokensMap).map((t: any) => t.token);

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: "No active tokens" });
    }

    // 2. Multicast message to all registered devices for this user
    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      webpush: {
        fcmOptions: {
          link: link || "/",
        },
        notification: {
          icon: "/logo.png",
          badge: "/logo.png",
          clickAction: link || "/",
        }
      },
      data: data || {},
    });

    // 3. Clean up invalid tokens (optional but recommended)
    if (response.failureCount > 0) {
      const tokensToRemove: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const error = resp.error?.code;
          if (error === 'messaging/invalid-registration-token' || error === 'messaging/registration-token-not-registered') {
            const tokenKey = Object.keys(tokensMap)[idx];
            tokensToRemove.push(tokenKey);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        const cleanupUpdates: Record<string, any> = {};
        tokensToRemove.forEach(key => {
          cleanupUpdates[`users/${uid}/fcmTokens/${key}`] = null;
        });
        await adminDb.ref().update(cleanupUpdates);
      }
    }

    return NextResponse.json({ 
      success: true, 
      sentCount: response.successCount, 
      failureCount: response.failureCount 
    });

  } catch (error: any) {
    console.error("Push Notification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
