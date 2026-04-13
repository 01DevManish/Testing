import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";


export async function POST(request: Request) {
  try {
    const { targetUid, title, body, url } = await request.json();

    if (!targetUid || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Get user's FCM token from RTDB
    const userRef = adminDb.ref(`users/${targetUid}/fcmToken`);
    const snapshot = await userRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "User has no notification token registered" }, { status: 404 });
    }

    const token = snapshot.val();

    // 2. Send the message
    const message = {
      notification: {
        title,
        body,
      },
      webpush: {
        fcmOptions: {
          link: url || "https://eurus-lifestyle.vercel.app/dashboard",
        },
      },
      token: token,
    };

    const response = await adminMessaging.send(message);
    console.log("Successfully sent message:", response);

    return NextResponse.json({ success: true, messageId: response });

  } catch (error: any) {
    console.error("Error sending notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
