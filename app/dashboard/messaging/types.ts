"use client";

import { UserRecord } from "../admin/types";
import { ChatMessage } from "../../lib/chatHelper";

export interface MessagingProps {
  users: UserRecord[];
  isMobile?: boolean;
}

export const FONT = "'Inter', system-ui, -apple-system, sans-serif";

export const ROLE_BG: Record<string, string> = {
  admin: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  manager: "linear-gradient(135deg,#f59e0b,#fbbf24)",
  employee: "linear-gradient(135deg,#10b981,#34d399)",
  user: "linear-gradient(135deg,#3b82f6,#60a5fa)",
};

export const S = {
  container: (isMobile?: boolean) => ({ 
    display: "flex", 
    height: "100%", 
    background: "#fff", 
    border: isMobile ? "none" : "1px solid #e2e8f0", 
    overflow: "hidden", 
    position: "relative",
    borderRadius: isMobile ? 0 : 24,
    boxShadow: isMobile ? "none" : "0 10px 25px rgba(0,0,0,0.05)"
  } as React.CSSProperties),
  
  sidebar: (collapsed: boolean) => ({ 
    width: collapsed ? 0 : 350, 
    borderRight: "1px solid #f1f5f9", 
    display: "flex", 
    flexDirection: "column", 
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
    background: "#fff",
    overflow: "hidden",
    opacity: collapsed ? 0 : 1
  }) as React.CSSProperties,

  chatWindow: (hidden: boolean) => ({ 
    flex: 1, 
    display: hidden ? "none" : "flex", 
    flexDirection: "column", 
    background: "#f0f2f5", 
    position: "relative"
  }) as React.CSSProperties,

  bubbleContainer: (isMine: boolean) => ({
    display: "flex", 
    flexDirection: "column", 
    alignSelf: isMine ? "flex-end" : "flex-start", 
    maxWidth: "80%", 
    marginBottom: 8
  }) as React.CSSProperties,

  bubble: (isMine: boolean) => ({
    padding: "10px 14px", 
    borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px", 
    fontSize: 14.5, 
    lineHeight: 1.5,
    background: isMine ? "#6366f1" : "#fff",
    color: isMine ? "#fff" : "#1e293b",
    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
    position: "relative",
    wordBreak: "break-word",
    fontFamily: FONT
  }) as React.CSSProperties,
};
