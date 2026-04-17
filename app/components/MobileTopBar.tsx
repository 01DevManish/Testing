"use client";

import React from "react";

interface MobileTopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  rightSlot?: React.ReactNode;
}

export default function MobileTopBar({ title, subtitle, onMenuClick, rightSlot }: MobileTopBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
        padding: "8px 0 4px",
      }}
    >
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          color: "#0f172a",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h12" />
        </svg>
      </button>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#0f172a",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 11,
              color: "#94a3b8",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div style={{ minWidth: 40, display: "flex", justifyContent: "flex-end", alignItems: "center", flexShrink: 0 }}>
        {rightSlot ?? <div style={{ width: 40, height: 40 }} />}
      </div>
    </div>
  );
}
