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

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setEmailLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } finally {
      setEmailLoading(false);
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
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      {/* Subtle background orbs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "rgba(99,102,241,0.06)", filter: "blur(100px)", top: "-10%", right: "-10%" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(139,92,246,0.05)", filter: "blur(100px)", bottom: "-10%", left: "-5%" }} />
      </div>

      {/* Card */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 400,
        background: "#ffffff",
        borderRadius: 24,
        padding: "48px 36px 40px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.04)",
        textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 8 }}>
          <img
            src="/logo.png"
            alt="Eurus Lifestyle"
            style={{
              width: 80,
              height: 80,
              objectFit: "contain",
              borderRadius: 16,
              margin: "0 auto",
              display: "block",
            }}
          />
        </div>

        {/* Company Name */}
        <h1 style={{
          fontSize: typeof window !== "undefined" && window.innerWidth < 480 ? 20 : 24,
          fontWeight: 400,
          color: "#0f172a",
          margin: "0 0 28px",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}>
          Eurus Lifestyle
        </h1>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.12)",
            borderRadius: 12,
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
          }}>
            <span>⚠️</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{error}</span>
            <button onClick={clearError} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 0 }}>✕</button>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div style={{ textAlign: "left" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 5, display: "block", letterSpacing: "0.02em" }}>Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; e.currentTarget.style.background = "#fff"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "#f8fafc"; }}
              required
              autoComplete="email"
            />
          </div>
          <div style={{ textAlign: "left" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 5, display: "block", letterSpacing: "0.02em" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; e.currentTarget.style.background = "#fff"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "#f8fafc"; }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={emailLoading || !email.trim() || !password.trim()}
            style={{
              width: "100%",
              padding: "13px 20px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              border: "none",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "inherit",
              color: "#fff",
              cursor: emailLoading ? "wait" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
              opacity: emailLoading || !email.trim() || !password.trim() ? 0.6 : 1,
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {emailLoading ? (
              <div style={{ width: 20, height: 20, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            ) : null}
            {emailLoading ? "Signing in..." : "Login"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        {/* Social Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "13px 20px",
              background: "#fff",
              border: "1.5px solid #e2e8f0",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "#1e293b",
              cursor: googleLoading ? "wait" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              opacity: googleLoading ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {googleLoading ? (
              <div style={{ width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.86 16.81 15.65 17.61V20.4H19.22C21.3 18.48 22.56 15.63 22.56 12.25Z" fill="#4285F4" />
                <path d="M12 23C14.97 23 17.46 22.02 19.22 20.4L15.65 17.61C14.7 18.25 13.45 18.63 12 18.63C9.19 18.63 6.81 16.73 5.96 14.24H2.28V17.06C4.07 20.62 7.74 23 12 23Z" fill="#34A853" />
                <path d="M5.96 14.24C5.74 13.59 5.61 12.89 5.61 12.2C5.61 11.5 5.74 10.81 5.96 10.15V7.33H2.28C1.54 8.79 1.12 10.42 1.12 12.2C1.12 13.98 1.54 15.61 2.28 17.06L5.96 14.24Z" fill="#FBBC05" />
                <path d="M12 5.38C13.62 5.38 15.06 5.93 16.2 7.02L19.3 3.92C17.46 2.2 14.97 1.2 12 1.2C7.74 1.2 4.07 3.58 2.28 7.33L5.96 10.15C6.81 7.66 9.19 5.38 12 5.38Z" fill="#EA4335" />
              </svg>
            )}
            {googleLoading ? "Signing in..." : "Google"}
          </button>

          {/* Zoho */}
          <button
            onClick={loginWithZoho}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "13px 20px",
              background: "#fff",
              border: "1.5px solid #e2e8f0",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "#1e293b",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <svg viewBox="0 0 120 40" width="20" height="20" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="10" y="8" width="24" height="24" rx="4" stroke="#d52027" transform="rotate(-8 22 20)" />
              <rect x="36" y="8" width="24" height="24" rx="4" stroke="#009639" transform="rotate(8 48 20)" />
              <rect x="62" y="8" width="24" height="24" rx="4" stroke="#0060a9" transform="rotate(-4 74 20)" />
              <rect x="88" y="8" width="24" height="24" rx="4" stroke="#f39200" transform="rotate(2 100 20)" />
            </svg>
            Zoho
          </button>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
