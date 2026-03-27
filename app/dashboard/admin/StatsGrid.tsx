"use client";

import React from "react";
import type { AdminStyles } from "./styles";

interface StatItem {
  label: string;
  value: number;
  gradient: string;
}

interface StatsGridProps {
  S: AdminStyles;
  isMobile: boolean;
  items: StatItem[];
}

export default function StatsGrid({ S, isMobile, items }: StatsGridProps) {
  return (
    <div style={S.statsGrid}>
      {items.map(s => (
        <div key={s.label} style={S.statCard}>
          <div style={S.statStripe(s.gradient)} />
          <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: s.gradient, marginBottom: isMobile ? 10 : 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 400, color: "#0f172a", lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", fontWeight: 400 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
