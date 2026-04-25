"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { logActivity } from "../lib/activityLogger";
import { ToastItem } from "../components/NotificationToast";

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
  logout: () => Promise<void>;
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
const AUTH_COOKIE_NAME = "eurus_auth";

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizeRole = (role: unknown): UserRole => {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "employee";
};
const normalizeDispatchPin = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const digits = String(value).trim().replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 4) return digits;
  if (digits.length < 4) return digits.padStart(4, "0");
  return undefined;
};

const setAuthCookie = () => {
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
};

const clearAuthCookie = () => {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
};

const sanitizeUserRecord = (raw: unknown, fallbackUid: string): UserData | null => {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<UserData>;
  const uid = (typeof input.uid === "string" && input.uid.trim()) ? input.uid.trim() : fallbackUid;
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!uid || !email || !name) return null;

  return {
    uid,
    email,
    name,
    role: normalizeRole(input.role),
    permissions: Array.isArray(input.permissions) ? input.permissions.filter((p): p is string => typeof p === "string") : [],
    dispatchPin: normalizeDispatchPin(input.dispatchPin),
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
    const hydrate = async () => {
      try {
        const cachedRaw = localStorage.getItem(SESSION_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as UserData;
          cached.role = normalizeRole(cached.role);
          setUser(cached);
          setAuthCookie();
        }

        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) {
          localStorage.removeItem(SESSION_KEY);
          clearAuthCookie();
          setUser(null);
          return;
        }

        const json = await response.json().catch(() => ({}));
        const fresh = sanitizeUserRecord(json?.user, json?.user?.uid || "");
        if (!fresh) {
          localStorage.removeItem(SESSION_KEY);
          clearAuthCookie();
          setUser(null);
          return;
        }

        localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
        setAuthCookie();
        setUser(fresh);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        clearAuthCookie();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, []);

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
    setError("Google login is disabled. Please login with email/password.");
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const normalizedEmail = normalizeEmail(email);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Login failed");

      const userData = sanitizeUserRecord(json?.user, json?.user?.uid || "");
      if (!userData) throw new Error("Invalid user profile");

      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      setAuthCookie();
      setUser(userData);

      if (!userData.requiresPasswordChange) {
        await logActivity({
          type: "system",
          action: "login",
          title: "User Login (Email)",
          description: `User ${userData.name} logged in via Email.`,
          userId: userData.uid,
          userName: userData.name,
          userRole: userData.role,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      throw err;
    }
  };

  const logout = async () => {
    if (user) {
      try {
        await logActivity({
          type: "system",
          action: "logout",
          title: "User Logout",
          description: `User ${user.name} logged out.`,
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
        });
      } catch {
        // Non-blocking
      }
    }

    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    clearAuthCookie();
    sessionStorage.clear();
    document.cookie = "zoho_session=; path=/; max-age=0";
    setUser(null);
  };

  const clearError = () => setError(null);

  const fetchAllUsers = async (): Promise<UserData[]> => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json?.users) ? json.users : [];
    return rows
      .map((row: unknown) => sanitizeUserRecord(row, (row as { uid?: string })?.uid || ""))
      .filter((row: UserData | null): row is UserData => Boolean(row));
  };

  const fetchEmployees = async (): Promise<UserData[]> => {
    const all = await fetchAllUsers();
    return all.filter((u) => u.role === "employee");
  };

  const updateUserData = async (uid: string, data: Partial<UserData>) => {
    const res = await fetch("/api/user-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid, data }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || "Failed to update user data");
    }

    if (user && user.uid === uid) {
      const updated = { ...user, ...data };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      setUser(updated);
    }

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
    if (!user) throw new Error("No authenticated user");

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Failed to update password");

    await updateUserData(user.uid, { requiresPasswordChange: false });

    await logActivity({
      type: "user",
      action: "update",
      title: "Password Changed (Forced)",
      description: `User ${user?.name} successfully changed their required password.`,
      userId: user.uid,
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
