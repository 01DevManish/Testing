import { ref, push, set } from "firebase/database";
import { db } from "./firebase";

export interface NotificationData {
  title: string;
  message: string;
  type: "task" | "inventory" | "system" | "order";
  link?: string;
  actorId?: string;
  actorName?: string;
}

/**
 * Sends a notification to one or more user IDs in Realtime Database.
 * Path: notifications/{uid}/{notificationId}
 */
export async function sendNotification(uids: string[], data: NotificationData) {
  if (!uids || uids.length === 0) return;

  const timestamp = Date.now();
  const notificationId = `notif_${timestamp}_${Math.random().toString(36).substr(2, 5)}`;

  const promises = uids.map(async (uid) => {
    try {
      const notifRef = ref(db, `notifications/${uid}/${notificationId}`);
      await set(notifRef, {
        ...data,
        id: notificationId,
        timestamp,
        read: false,
      });

      // 🔥 Trigger Web Push (only in browser context)
      if (typeof window !== "undefined") {
        fetch(`${window.location.origin}/api/notifications/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            title: data.title,
            body: data.message,
            link: data.link || "/",
            data: {
              type: data.type,
              notificationId
            }
          })
        }).catch(err => console.error("FCM Push trigger failed:", err));
      }

    } catch (err) {
      console.error(`Failed to send notification to user ${uid}:`, err);
    }
  });

  return Promise.all(promises);
}
