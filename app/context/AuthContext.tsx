"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth as fbAuth, db, googleProvider } from "../lib/firebase";
import {
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, getDocs, query, where, updateDoc } from "firebase/firestore";

export type UserRole = "admin" | "manager" | "employee" | "user";

interface UserData {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
}

interface AuthContextType {
  user: UserData | null;
  userData: UserData | null;
  loading: boolean;
  loginWithZoho: () => void;
  loginWithGoogle: () => Promise<void>;
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

    // Listen for Firebase Auth state
    const unsubscribe = onAuthStateChanged(fbAuth, () => {
      // Just mark loading as done — session is already handled by localStorage
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
    const redirectUri = process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI || `${window.location.origin}/api/callback`;
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
      else if (quickData.role === "employee" || quickData.role === "manager") window.location.href = "/dashboard/employee";
      else window.location.href = "/dashboard/user";

      // Firestore sync in background (don't await, don't block redirect)
      (async () => {
        try {
          const userRef = doc(db, "users", gUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, quickData);
          } else {
            // Force update Firestore if this is the admin email but Firestore says otherwise
            const freshData = snap.data() as UserData;
            if (isAdminEmail && freshData.role !== "admin") {
              await updateDoc(userRef, { role: "admin" });
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

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    fbAuth.signOut().catch(() => {});
    setUser(null);
  };

  const clearError = () => setError(null);

  const fetchAllUsers = async (): Promise<UserData[]> => {
    const snapshot = await getDocs(collection(db, "users"));
    const list: UserData[] = [];
    snapshot.forEach((d) => list.push(d.data() as UserData));
    return list;
  };

  const fetchEmployees = async (): Promise<UserData[]> => {
    const q = query(collection(db, "users"), where("role", "==", "employee"));
    const snapshot = await getDocs(q);
    const list: UserData[] = [];
    snapshot.forEach((d) => list.push(d.data() as UserData));
    return list;
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    await updateDoc(doc(db, "users", uid), { role: newRole });
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData: user,
      loading,
      loginWithZoho,
      loginWithGoogle,
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
