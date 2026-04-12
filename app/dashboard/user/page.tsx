"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const roleBg: Record<string, string> = { admin: "linear-gradient(135deg,#ef4444,#f97316)", manager: "linear-gradient(135deg,#f59e0b,#fbbf24)", employee: "linear-gradient(135deg,#10b981,#34d399)", user: "linear-gradient(135deg,#3b82f6,#60a5fa)" };

// Responsive hook
function useWindowSize() {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 1200 });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

export default function UserPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("userSidebarCollapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("userSidebarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "user") {
      if (userData.role === "admin") router.replace("/dashboard/admin");
      else router.replace("/dashboard/employee");
    }
  }, [loading, user, userData, router]);

  // Close sidebar on desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  if (loading || !user || !userData) return null;
  if (userData.role !== "user") return null;

  const currentName = userData.name || user.name || "User";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  const SIDEBAR_WIDTH = 260;

  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc" } as React.CSSProperties,
    sidebar: { 
      width: isCollapsed ? 78 : SIDEBAR_WIDTH, 
      background: "#0f172a", 
      display: "flex", 
      flexDirection: "column" as const, 
      padding: isCollapsed ? "24px 0" : "24px 16px", 
      position: "fixed" as const, 
      top: 0, 
      left: 0, 
      bottom: 0, 
      zIndex: 100, 
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: (!isDesktop && !sidebarOpen) ? "translateX(-100%)" : "translateX(0)",
      willChange: "width, transform",
      overflow: "visible"
    } as React.CSSProperties,
    sidebarMobileOverlay: { 
      position: "fixed" as const, 
      inset: 0, 
      background: "rgba(0,0,0,0.5)", 
      zIndex: 99, 
      backdropFilter: "blur(4px)",
      display: (!isDesktop && sidebarOpen) ? "block" : "none",
    } as React.CSSProperties,
    main: { 
      flex: 1, 
      marginLeft: isDesktop ? (isCollapsed ? 78 : SIDEBAR_WIDTH) : 0, 
      padding: isMobile ? "70px 16px 32px" : "28px 32px 32px", 
      minHeight: "100vh", 
      transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      willChange: "margin-left"
    } as React.CSSProperties,
    btnSecondary: { padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,
    statCard: (gradient: string) => ({
      background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.25s ease", position: "relative" as const, overflow: "hidden" as const,
    }),
    statStripe: (gradient: string) => ({
      position: "absolute" as const, top: 0, left: 0, right: 0, height: 4, background: gradient, borderRadius: "16px 16px 0 0",
    }),
  };

  return (
    <div style={S.page}>
      {/* Mobile overlay */}
      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

      {/* =================== SIDEBAR =================== */}
      <aside style={S.sidebar}>
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: isCollapsed ? "center" : "flex-start", padding: isCollapsed ? "0" : "4px 8px", marginBottom: isCollapsed ? 24 : 32, transition: "all 0.3s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: isCollapsed ? "center" : "flex-start", width: "100%" }}>
            <img src="/logo.png" alt="Logo" style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 10, background: "#fff", padding: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} />
            {!isCollapsed && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>EURUS LIFESTYLE</div>
                <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>User Hub</div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Toggle Button */}
        {isDesktop && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              position: "absolute",
              right: -12,
              top: 32,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#60a5fa",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              zIndex: 300,
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.background = "#334155";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "#1e293b";
            }}
          >
            {isCollapsed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
            )}
          </button>
        )}

        {/* Nav */}
        {!isCollapsed && <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8, animation: "fadeInUp 0.3s ease-out" }}>Navigation</div>}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: isCollapsed ? "0 8px" : "0" }}>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(59,130,246,0.15)", color: "#93c5fd", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #60a5fa", paddingLeft: 11 }}>
            Home
          </button>
          <button onClick={() => router.push("/dashboard/retail-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Retail Dispatch
          </button>
          <button onClick={() => router.push("/dashboard/ecom-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Ecommerce Dispatch
          </button>
          <button onClick={() => router.push("/dashboard/inventory")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Inventory
          </button>
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ 
          padding: isCollapsed ? "16px 0" : "16px 12px", 
          background: "rgba(255,255,255,0.04)", 
          borderRadius: 12, 
          border: "1px solid rgba(255,255,255,0.06)", 
          marginBottom: 12,
          display: "flex",
          justifyContent: isCollapsed ? "center" : "flex-start",
          transition: "all 0.3s"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleBg.user, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15, color: "#fff", textTransform: "uppercase", flexShrink: 0 }}>{currentName[0] || "U"}</div>
            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0, animation: "fadeInUp 0.3s ease-out" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
                <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, textTransform: "capitalize" }}>{userData.role}</div>
              </div>
            )}
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: isCollapsed ? "11px 0" : "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          {isCollapsed ? "🔓" : "Sign Out"}
        </button>
      </aside>

      {/* =================== MAIN =================== */}
      <main style={S.main}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 400 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!isDesktop && <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>☰</button>}
          </div>
        </div>

        {/* ========== WELCOME CARD ========== */}
        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: 20, padding: isMobile ? 20 : 32, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
          <div style={{ color: "#fff", maxWidth: 500 }}>
            <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 400, margin: "0 0 8px" }}>Welcome to Eurus Lifestyle</h2>
            <p style={{ fontSize: isMobile ? 13 : 15, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>Your personal hub for managing your preferences, viewing updates, and exploring our latest lifestyle offerings.</p>
          </div>
          {!isMobile && <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, border: "1px solid rgba(255,255,255,0.1)" }}>✨</div>}
        </div>

        {/* ========== STATS ========== */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Profile Completion", value: "100%", icon: "⭐", gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
            { label: "Active Services", value: "1", icon: "🚀", gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
            { label: "Messages", value: "0", icon: "💬", gradient: "linear-gradient(135deg,#10b981,#34d399)" },
          ].map(s => (
            <div key={s.label} style={S.statCard(s.gradient)}>
              <div style={S.statStripe(s.gradient)} />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: 14 }}>{s.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 400, color: "#0f172a", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Profile Card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", padding: isMobile ? 16 : 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 400, margin: "0 0 20px", color: "#0f172a" }}>Your Account Details</h3>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexDirection: isMobile ? "column" : "row", textAlign: isMobile ? "center" : "left" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: roleBg.user, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 32, color: "#fff", boxShadow: "0 8px 24px rgba(59,130,246,0.2)" }}>
              {currentName[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 400, color: "#1e293b", marginBottom: 4 }}>{currentName}</div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, justifyContent: isMobile ? "center" : "flex-start" }}>
                <span>✉️</span> {userData.email}
              </div>
              <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", borderRadius: 20, fontSize: 12, fontWeight: 400, border: "1px solid rgba(59,130,246,0.2)", textTransform: "capitalize" }}>
                {userData.role} Status Verified ✅
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
