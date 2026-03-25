"use client";

import React from "react";
import type { AdminStyles } from "./styles";

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
        <h1 style={{ fontSize: isMobile ? 20 : isTablet ? 22 : 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontWeight: 500 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      {!isDesktop && (
        <button onClick={() => setSidebarOpen(true)}
          style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          ☰
        </button>
      )}
    </div>
  );
}
