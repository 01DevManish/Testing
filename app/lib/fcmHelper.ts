import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import app from "./firebase";

// Provided VAPID Key: BO9vD_K1aixuDhhq90h9yIIEX4ndkXVMg-uiokGe3hekhZT8jFYlCkdN2PIsv90cxEe9DZjlb49f2LGgIiYtWG0
const VAPID_KEY = "BO9vD_K1aixuDhhq90h9yIIEX4ndkXVMg-uiokGe3hekhZT8jFYlCkdN2PIsv90cxEe9DZjlb49f2LGgIiYtWG0";

/**
 * Requests notification permission and returns the FCM token.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM is not supported in this browser.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      return token;
    } else {
      console.warn("Notification permission denied.");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Sets up a listener for messages received while the app is in the foreground.
 */
export async function onForegroundMessage(callback: (payload: any) => void) {
  const supported = await isSupported();
  if (!supported) return;

  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => {
    console.log("Foreground message received:", payload);
    callback(payload);
  });
}
