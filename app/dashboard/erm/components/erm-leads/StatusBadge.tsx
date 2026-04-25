"use client";
import React from "react";
import { getStatusCfg } from "./types";
import * as Icons from "./Icons";

export default function StatusBadge({ status }: { status?: string }) {
  const cfg = getStatusCfg(status);
  
  // Dynamically get the icon component
  const IconComponent = (Icons as any)[cfg.icon] || Icons.IconZap;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}20`,
        borderRadius: 999,
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      <IconComponent size={14} strokeWidth={2.5} style={{ opacity: 0.9 }} />
      {cfg.label}
    </span>
  );
}
