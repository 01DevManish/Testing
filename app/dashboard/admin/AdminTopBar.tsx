"use client";

import React from "react";
import type { AdminStyles } from "./styles";
import NotificationBell from "../../components/NotificationBell";
import MobileTopBar from "../../components/MobileTopBar";

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

  if (!isDesktop) {
    return (
      <MobileTopBar
        title={`${greeting}, ${currentName.split(" ")[0]}!`}
        subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        onMenuClick={() => setSidebarOpen(true)}
        rightSlot={<NotificationBell />}
      />
    );
  }

  return (
    <div style={S.topBar}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: isMobile ? 20 : isTablet ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}!</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontWeight: 400 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <NotificationBell />
      </div>
    </div>
  );
}
