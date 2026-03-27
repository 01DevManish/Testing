"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "./context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const { loginWithZoho, loginWithGoogle, loginWithEmail, error, clearError, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Show Zoho login error from redirect
  useEffect(() => {
    const loginError = searchParams.get("login_error");
    if (loginError) {
      const messages: Record<string, string> = {
        zoho_denied: "Zoho login was denied. Please try again.",
        no_code: "No authorization code received.",
        server_not_configured: "Server not configured for Zoho login.",
        token_failed: "Failed to get Zoho access token.",
        profile_fetch_failed: "Failed to fetch Zoho profile.",
        auth_failed: "Authentication failed. Please try again.",
      };
      clearError();
      alert(messages[loginError] || `Login error: ${loginError}`);
      router.replace("/");
    }
  }, [searchParams, router, clearError]);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") router.push("/dashboard/admin");
      else if (user.role === "employee" || user.role === "manager") router.push("/dashboard");
      else router.push("/dashboard/user");
    }
  }, [loading, user, router]);

  if (!loading && user) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setEmailLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } finally {
      setEmailLoading(true); // Keep loading state until redirect
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "#f8fafc",
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#1e293b",
    outline: "none",
    transition: "all 0.2s ease",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#ffffff",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      {/* Card */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 420,
        background: "#ffffff",
        borderRadius: 24,
        padding: "50px 40px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        border: "1px solid #f1f5f9",
        textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 12 }}>
          <img
            src="/logo.png"
            alt="EURUS LIFESTYLE"
            style={{
              width: 80,
              height: 80,
              objectFit: "contain",
              borderRadius: 18,
              margin: "0 auto",
              display: "block",
              background: "#fff",
              border: "4px solid #f8fafc",
              padding: 4,
            }}
          />
        </div>

        {/* Company Name */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 400,
          color: "#0f172a",
          margin: "0 0 4px",
          letterSpacing: "0.08em",
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}>
          EURUS LIFESTYLE
        </h1>
        <p style={{ fontSize: 13, color: "#6366f1", fontWeight: 400, marginBottom: 32, textTransform: "uppercase", letterSpacing: "0.05em" }}>ERP Control Panel</p>

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px 14px",
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.1)",
            borderRadius: 12,
            color: "#dc2626",
            fontSize: 13,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            textAlign: "left",
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ flex: 1, fontWeight: 400 }}>{error}</span>
            <button onClick={clearError} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "left" }}>
            <label style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>Official Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
              required
            />
          </div>
          <div style={{ textAlign: "left" }}>
            <label style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>Security Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 10, fontWeight: 400, textTransform: "uppercase" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={emailLoading}
            style={{
              width: "100%",
              padding: "15px 20px",
              background: "#0f172a",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 400,
              color: "#fff",
              cursor: emailLoading ? "wait" : "pointer",
              transition: "all 0.2s ease",
              opacity: emailLoading ? 0.7 : 1,
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 10px 20px rgba(15, 23, 42, 0.15)",
              letterSpacing: "0.05em",
            }}
          >
            {emailLoading ? (
              <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            ) : "SIGN IN TO ERP"}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
