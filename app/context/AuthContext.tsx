"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth as fbAuth, db, googleProvider } from "../lib/firebase";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { ref, set, get, update, query, orderByChild, equalTo } from "firebase/database";

export type UserRole = "admin" | "manager" | "employee" | "user";

interface UserData {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  dispatchPin?: string;
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
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = "eurus_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    // Listen for Firebase Auth state — sync fresh permissions from Firestore once on load
    let hasSynced = false;
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
            logout();
          }
        } catch (err) {
          console.warn("Firestore sync on auth state change failed:", err);
        }
      }
      setLoading(false);
    });

    // If no auth state fires in 2s, stop loading anyway
    const timeout = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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
        list.push(child.val() as UserData);
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
        list.push(child.val() as UserData);
      });
    }
    return list;
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    await update(ref(db, `users/${uid}`), { role: newRole });
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
