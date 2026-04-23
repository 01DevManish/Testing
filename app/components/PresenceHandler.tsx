"use client";

import { useEffect } from "react";
import { ref, onValue, set, onDisconnect, serverTimestamp } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function PresenceHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const presenceRef = ref(db, `users/${user.uid}/presence`);
    const connectedRef = ref(db, ".info/connected");

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // When connected, set presence to online
        set(presenceRef, {
          online: true,
          lastSeen: serverTimestamp(),
        });

        // Use onDisconnect to clear presence or set offline
        onDisconnect(presenceRef).set({
          online: false,
          lastSeen: serverTimestamp(),
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  return null;
}

