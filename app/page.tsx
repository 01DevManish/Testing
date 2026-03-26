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
    background: "rgba(255, 255, 255, 0.05)",
    border: "1.5px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#e2e8f0",
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
      background: "#f1f5f9",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      {/* Card */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 420,
        background: "#0f172a",
        borderRadius: 24,
        padding: "50px 40px",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.06)",
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
              border: "4px solid rgba(255, 255, 255, 0.05)",
              padding: 4,
            }}
          />
        </div>

        {/* Company Name */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 500,
          color: "#fff",
          margin: "0 0 4px",
          letterSpacing: "0.1em",
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}>
          EURUS LIFESTYLE
        </h1>
        <p style={{ fontSize: 13, color: "#818cf8", fontWeight: 400, marginBottom: 32, textTransform: "uppercase", letterSpacing: "0.05em" }}>ERP Control Panel</p>

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 12,
            color: "#fca5a5",
            fontSize: 13,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            textAlign: "left",
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ flex: 1, fontWeight: 400 }}>{error}</span>
            <button onClick={clearError} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>✕</button>
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
              onFocus={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
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
                onFocus={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
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
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              cursor: emailLoading ? "wait" : "pointer",
              transition: "all 0.2s ease",
              opacity: emailLoading ? 0.7 : 1,
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
              letterSpacing: "0.05em",
            }}
          >
            {emailLoading ? "AUTHENTICATING..." : "SIGN IN TO ERP"}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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
