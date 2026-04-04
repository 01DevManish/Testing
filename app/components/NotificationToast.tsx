"use client";

import React, { useEffect, useState } from "react";

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: "task" | "inventory" | "system" | "order" | "message";
  link?: string;
  onClose: (id: string) => void;
}

const typeIcons: Record<string, string> = {
  task: "📝",
  inventory: "📦",
  system: "⚙️",
  order: "🛒",
  message: "💬",
};

const typeColors: Record<string, string> = {
  task: "#6366f1",
  inventory: "#f59e0b",
  system: "#64748b",
  order: "#10b981",
  message: "#8b5cf6",
};

export default function NotificationToast({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      top: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      pointerEvents: "none",
    }}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} {...toast} />
      ))}
    </div>
  );
}

function ToastCard({ id, title, message, type, link, onClose }: ToastItem) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(id), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const handleClick = () => {
    if (link) window.location.href = link;
    onClose(id);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        width: 320,
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: 16,
        padding: "16px 20px 16px 16px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        display: "flex",
        gap: 14,
        cursor: "pointer",
        position: "relative",
        transform: isExiting ? "translateX(120%) scale(0.9)" : "translateX(0) scale(1)",
        opacity: isExiting ? 0 : 1,
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: "auto",
        animation: "slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `${typeColors[type] || "#6366f1"}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        flexShrink: 0,
      }}>
        {typeIcons[type] || "🔔"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {message}
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(id); }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          border: "none",
          background: "none",
          color: "#94a3b8",
          fontSize: 18,
          cursor: "pointer",
          padding: 4,
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Progress Bar */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 12,
        right: 12,
        height: 3,
        background: "rgba(0,0,0,0.05)",
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: "100%",
          background: typeColors[type] || "#6366f1",
          borderRadius: 2,
          animation: "progress 5s linear forwards",
        }} />
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%) scale(0.8); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
