"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const roleBg: Record<string, string> = { admin: "linear-gradient(135deg,#ef4444,#f97316)", manager: "linear-gradient(135deg,#f59e0b,#fbbf24)", employee: "linear-gradient(135deg,#10b981,#34d399)", user: "linear-gradient(135deg,#3b82f6,#60a5fa)" };

export default function UserPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "user") {
      if (userData.role === "admin") router.replace("/dashboard/admin");
      else router.replace("/dashboard/employee");
    }
  }, [loading, user, userData, router]);

  if (loading || !user || !userData) return null;
  if (userData.role !== "user") return null;

  const currentName = userData.name || "User";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  // === Inline Styles ===
  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8fafc" } as React.CSSProperties,
    sidebar: { width: 260, background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", display: "flex", flexDirection: "column" as const, padding: "24px 16px", position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 100, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)" } as React.CSSProperties,
    sidebarMobileOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99, backdropFilter: "blur(4px)" } as React.CSSProperties,
    main: { flex: 1, marginLeft: 260, padding: "28px 32px 32px", minHeight: "100vh" } as React.CSSProperties,

    // Cards
    statCard: (gradient: string) => ({
      background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.25s ease", cursor: "default", position: "relative" as const, overflow: "hidden" as const,
    }),
    statStripe: (gradient: string) => ({
      position: "absolute" as const, top: 0, left: 0, right: 0, height: 4, background: gradient, borderRadius: "16px 16px 0 0",
    }),

    // Buttons
    btnPrimary: { padding: "10px 22px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" } as React.CSSProperties,
    btnSecondary: { padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      {/* Mobile overlay */}
      {sidebarOpen && <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* =================== SIDEBAR =================== */}
      <aside style={{ ...S.sidebar, ...(typeof window !== "undefined" && window.innerWidth < 768 && !sidebarOpen ? { transform: "translateX(-100%)" } : {}) }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
            <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>User Hub</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(59,130,246,0.15)", color: "#93c5fd", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #60a5fa", paddingLeft: 11 }}>
            <span style={{ fontSize: 18 }}>🏠</span> Home
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            <span style={{ fontSize: 18 }}>⚙️</span> Settings
          </button>
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleBg.user, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff", textTransform: "uppercase" }}>{currentName[0] || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, textTransform: "capitalize" }}>{userData.role}</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          ⎋ Sign Out
        </button>
      </aside>

      {/* =================== MAIN =================== */}
      <main style={S.main}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 4 }}>
              <span style={{ color: "#3b82f6", fontWeight: 600 }}>User</span>
              <span style={{ margin: "0 8px" }}>/</span>
              <span>Home</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]} 👋</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ ...S.btnIcon, display: "none" }}>☰</button>
          </div>
        </div>

        {/* ========== WELCOME CARD ========== */}
        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: 20, padding: 32, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
          <div style={{ color: "#fff", maxWidth: 500 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>Welcome to Eurus Lifestyle</h2>
            <p style={{ fontSize: 15, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>Your personal hub for managing your preferences, viewing updates, and exploring our latest lifestyle offerings. Everything you need is right here.</p>
          </div>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, border: "1px solid rgba(255,255,255,0.1)" }}>✨</div>
        </div>

        {/* ========== STATS ========== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Profile Completion", value: "100%", icon: "⭐", gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
            { label: "Active Services", value: "1", icon: "🚀", gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
            { label: "Messages", value: "0", icon: "💬", gradient: "linear-gradient(135deg,#10b981,#34d399)" },
          ].map(s => (
            <div key={s.label} style={S.statCard(s.gradient)}>
              <div style={S.statStripe(s.gradient)} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: s.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>{s.icon}</div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Profile Card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", padding: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" }}>Your Account Details</h3>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: roleBg.user, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 32, color: "#fff", boxShadow: "0 8px 24px rgba(59,130,246,0.2)" }}>
              {currentName[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{currentName}</div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                ✉️ {userData.email}
              </div>
              <div style={{ display: "inline-block", padding: "4px 12px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid rgba(59,130,246,0.2)", textTransform: "capitalize" }}>
                {userData.role} Status Verified ✅
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
