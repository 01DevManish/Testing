"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { roleBg } from "./types";
import type { AdminStyles } from "./styles";

interface AdminSidebarProps {
  S: AdminStyles;
  tab: string;
  setTab: (tab: any) => void;
  // ... rest of props but I'll replace the full interface for clarity
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isDesktop: boolean;
  currentName: string;
  userData?: { profilePic?: string } | null;
  handleLogout: () => void;
  navItems: { key: string; label: string; count?: number }[];
  settingsItems?: { key: string; label: string; count?: number }[];
}

export default function AdminSidebar({
  S, tab, setTab, sidebarOpen, setSidebarOpen, isDesktop, currentName, userData, handleLogout, navItems, settingsItems
}: AdminSidebarProps) {
  const router = useRouter();

  return (
    <>
      {/* Overlay */}
      <div style={S.overlay} onClick={() => setSidebarOpen(false)} />

      <aside style={S.sidebar}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px", marginBottom: 28 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 400, color: "#fff", letterSpacing: "-0.01em" }}>EURUS LIFESTYLE</div>
            <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 400, textTransform: "capitalize", letterSpacing: "0.15em" }}>Admin Console</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 9, fontWeight: 400, color: "#475569", textTransform: "capitalize", letterSpacing: "0.12em", padding: "0 10px", marginBottom: 6 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[
            { label: "Dashboard", key: "dashboard", isTab: true },
            { label: "Inventory", path: "/dashboard/inventory" },
            { label: "Retail Dispatch", path: "/dashboard/retail-dispatch" },
            { label: "Ecommerce Dispatch", path: "/dashboard/ecom-dispatch" },
          ].map(item => (
            <button key={item.key || item.path} 
              onClick={() => { 
                if (item.isTab) setTab(item.key); 
                else router.push(item.path!); 
                if (!isDesktop) setSidebarOpen(false); 
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none",
                background: (item.isTab && tab === item.key) ? "rgba(99,102,241,0.15)" : "transparent",
                color: (item.isTab && tab === item.key) ? "#a5b4fc" : "#94a3b8",
                fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" as const,
                ...((item.isTab && tab === item.key) ? { borderLeft: "3px solid #818cf8", paddingLeft: 9 } : {}),
              }}>
              {item.label}
            </button>
          ))}
          {navItems.filter(i => i.key !== "dashboard").map(item => (
            <button key={item.key} onClick={() => { setTab(item.key); if (!isDesktop) setSidebarOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none",
                background: tab === item.key ? "rgba(99,102,241,0.15)" : "transparent",
                color: tab === item.key ? "#a5b4fc" : "#94a3b8",
                fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" as const,
                ...(tab === item.key ? { borderLeft: "3px solid #818cf8", paddingLeft: 9 } : {}),
              }}>
              {item.label}
              {item.count !== undefined && (
                <span style={{ marginLeft: "auto", background: tab === item.key ? "rgba(129,140,248,0.2)" : "rgba(148,163,184,0.15)", color: tab === item.key ? "#c7d2fe" : "#94a3b8", fontSize: 11, fontWeight: 400, padding: "2px 8px", borderRadius: 12, minWidth: 24, textAlign: "center" as const }}>{item.count}</span>
              )}
            </button>
          ))}
        </nav>

        {settingsItems && settingsItems.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 400, color: "#475569", textTransform: "capitalize", letterSpacing: "0.12em", padding: "0 10px", marginBottom: 6 }}>Settings</div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {settingsItems.map(item => (
                <button key={item.key} onClick={() => { setTab(item.key); if (!isDesktop) setSidebarOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none",
                    background: tab === item.key ? "rgba(99,102,241,0.15)" : "transparent",
                    color: tab === item.key ? "#a5b4fc" : "#94a3b8",
                    fontSize: 14, fontWeight: tab === item.key ? 500 : 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" as const,
                    ...(tab === item.key ? { borderLeft: "3px solid #818cf8", paddingLeft: 9 } : {}),
                  }}>
                  {item.label}
                  {item.count !== undefined && (
                    <span style={{ marginLeft: "auto", background: tab === item.key ? "rgba(129,140,248,0.2)" : "rgba(148,163,184,0.15)", color: tab === item.key ? "#c7d2fe" : "#94a3b8", fontSize: 11, fontWeight: 400, padding: "2px 8px", borderRadius: 12, minWidth: 24, textAlign: "center" as const }}>{item.count}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "14px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 11, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {userData?.profilePic ? (
              <img src={userData.profilePic} alt="DP" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 9, background: roleBg.admin, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 14, color: "#fff", flexShrink: 0 }}>{currentName[0]?.toUpperCase() || "A"}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 400, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}!</div>
              <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 400 }}>Administrator</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          ⎋ Sign Out
        </button>
      </aside>
    </>
  );
}
