"use client";

import React from "react";
import type { AdminStyles } from "./styles";
import NotificationBell from "../../components/NotificationBell";

interface AdminTopBarProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentName: string;
  setSidebarOpen: (open: boolean) => void;
}

export default function AdminTopBar({ S, isMobile, isTablet, isDesktop, currentName, setSidebarOpen }: AdminTopBarProps) {
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div style={S.topBar}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: isMobile ? 20 : isTablet ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}!</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontWeight: 400 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <NotificationBell />
        {!isDesktop && (
          <button onClick={() => setSidebarOpen(true)}
            style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#6366f1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}
      </div>
    </div>
  );
}
