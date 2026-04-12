"use client";

import React from "react";
import { UserRecord } from "../admin/types";
import { ROLE_BG, S, FONT } from "./types";

interface SidebarProps {
  currentUser: { uid: string; role?: string; name?: string };
  users: UserRecord[];
  previews: Record<string, any>;
  selectedUserId?: string;
  onSelectUser: (user: UserRecord) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  collapsed: boolean;
}

export default function ChatSidebar({
  currentUser,
  users,
  previews,
  selectedUserId,
  onSelectUser,
  searchQuery,
  onSearchChange,
  collapsed
}: SidebarProps) {
  
  const sortedUsers = [...users]
    .filter(u => u.uid !== currentUser.uid)
    .sort((a, b) => {
      const prevA = previews[a.uid];
      const prevB = previews[b.uid];
      if (prevA && prevB) return prevB.timestamp - prevA.timestamp;
      if (prevA) return -1;
      if (prevB) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  const filteredUsers = sortedUsers.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={S.sidebar(collapsed)}>
      {/* Sidebar Header */}
      <div style={{ padding: "20px 24px", background: "#fff", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ 
            width: 40, height: 40, borderRadius: 12, 
            background: ROLE_BG[currentUser.role || "user"], 
            display: "flex", alignItems: "center", justifyContent: "center", 
            color: "#fff", fontWeight: 700, fontSize: 16 
          }}>
            {currentUser.name?.[0]?.toUpperCase() || "U"}
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", fontFamily: FONT }}>Messages</h3>
        </div>
        
        <div style={{ 
          background: "#f8fafc", borderRadius: 12, padding: "4px 12px", 
          display: "flex", alignItems: "center", border: "1.5px solid #e2e8f0",
          transition: "all 0.2s"
        }}
        onFocusCapture={(e) => e.currentTarget.style.borderColor = "#6366f1"}
        onBlurCapture={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Search User" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ 
              flex: 1, padding: "8px 0", border: "none", background: "transparent", 
              fontSize: 14, outline: "none", color: "#1e293b", fontFamily: FONT,
              boxShadow: "none"
            }}
          />
        </div>
      </div>

      {/* User List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredUsers.map(u => {
          const preview = previews[u.uid];
          const hasUnread = preview?.unreadCount > 0;
          const isSelected = selectedUserId === u.uid;

          return (
            <div 
              key={u.uid} 
              onClick={() => onSelectUser(u)}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", cursor: "pointer",
                background: isSelected ? "rgba(99,102,241,0.06)" : "transparent",
                borderLeft: isSelected ? "4px solid #6366f1" : "4px solid transparent",
                transition: "all 0.2s",
                borderBottom: "1px solid #f8fafc"
              }}
              onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = "#fcfdfe"; }}
              onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ 
                  width: 48, height: 48, borderRadius: 16, 
                  background: ROLE_BG[u.role || "user"], 
                  display: "flex", alignItems: "center", justifyContent: "center", 
                  color: "#fff", fontSize: 18, fontWeight: 700 
                }}>
                  {u.name?.[0]?.toUpperCase() || "U"}
                </div>
                {/* Status Indicator (Optional but nice) */}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ 
                    fontSize: 15, fontWeight: isSelected || hasUnread ? 600 : 500, 
                    color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", 
                    whiteSpace: "nowrap", fontFamily: FONT 
                  }}>
                    {u.name}
                  </div>
                  {preview?.timestamp && (
                    <div style={{ fontSize: 11, color: hasUnread ? "#6366f1" : "#94a3b8", fontFamily: FONT }}>
                      {new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(preview.timestamp)}
                    </div>
                  )}
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ 
                    fontSize: 13, color: hasUnread ? "#6366f1" : "#64748b", 
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", 
                    flex: 1, fontFamily: FONT, fontWeight: hasUnread ? 500 : 400
                  }}>
                    {preview?.lastMessage || u.role}
                  </div>
                  {hasUnread && (
                    <div style={{ 
                      background: "#6366f1", color: "#fff", fontSize: 10, fontWeight: 700, 
                      minWidth: 18, height: 18, borderRadius: 9, 
                      display: "flex", alignItems: "center", justifyContent: "center", 
                      marginLeft: 8, padding: "0 5px"
                    }}>
                      {preview.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
