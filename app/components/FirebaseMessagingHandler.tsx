"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { ref, update } from "firebase/database";
import { db, messaging } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const VAPID_KEY = "BO9vD_K1aixuDhhq90h9yIIEX4ndkXVMg-uiokGe3hekhZT8jFYlCkdN2PIsv90cxEe9DZjlb49f2LGgIiYtWG0";

export default function FirebaseMessagingHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined" || !user?.uid) return;

    const setupMessaging = async () => {
      try {
        const msg = await messaging();
        if (!msg) return;

        // 1. Request Permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("Notification permission NOT granted.");
          return;
        }

        // 2. Get Token
        const token = await getToken(msg, { vapidKey: VAPID_KEY });
        if (token) {
          console.log("FCM Token obtained:", token);
          // Save to RTDB
          await update(ref(db, `users/${user.uid}`), { fcmToken: token });
        } else {
          console.warn("No registration token available. Request permission to generate one.");
        }

        // 3. Listen for Foreground Messages
        onMessage(msg, (payload) => {
          console.log("Foreground Message received:", payload);
          if (payload.notification) {
            // Using browser notification as a simple foreground alert
            new Notification(payload.notification.title || "New Message", {
              body: payload.notification.body,
              icon: "/logo.png"
            });
          }
        });

      } catch (err) {
        console.error("Error setting up Firebase Messaging:", err);
      }
    };

    setupMessaging();
  }, [user]);

  return null;
}
