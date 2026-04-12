"use client";

import React, { useRef, useEffect } from "react";
import { UserRecord } from "../admin/types";
import { ChatMessage } from "../../lib/chatHelper";
import { ROLE_BG, S, FONT } from "./types";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
  selectedUser: UserRecord;
  messages: ChatMessage[];
  currentUserId: string;
  isMobile: boolean;
  onBack: () => void;
  otherUserTyping: boolean;
  otherUserPresence: { online: boolean; lastSeen: number } | null;
  receiverLastRead: number;
}

export default function ChatWindow({
  selectedUser,
  messages,
  currentUserId,
  isMobile,
  onBack,
  otherUserTyping,
  otherUserPresence,
  receiverLastRead
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherUserTyping]);

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return "Offline";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return (isToday ? "last seen today at " : "last seen ") + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={S.chatWindow(false)}>
      {/* Header */}
      <div style={{ 
        padding: "14px 24px", background: "#fff", borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: 14, zIndex: 10
      }}>
        {isMobile && (
          <button onClick={onBack} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#64748b" }}>
            ←
          </button>
        )}
        <div style={{ 
          width: 44, height: 44, borderRadius: 16, 
          background: ROLE_BG[selectedUser.role || "user"], 
          display: "flex", alignItems: "center", justifyContent: "center", 
          color: "#fff", fontWeight: 700, fontSize: 16 
        }}>
          {selectedUser.name?.[0]?.toUpperCase() || "U"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", fontFamily: FONT }}>{selectedUser.name}</div>
          <div style={{ fontSize: 12, color: otherUserTyping ? "#6366f1" : "#94a3b8", fontFamily: FONT, fontWeight: 500 }}>
            {otherUserTyping ? "typing..." : (otherUserPresence?.online ? "Online" : formatLastSeen(otherUserPresence?.lastSeen || 0))}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ 
        flex: 1, padding: "24px", overflowY: "auto", 
        display: "flex", flexDirection: "column", gap: 4 
      }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ padding: "8px 16px", background: "rgba(0,0,0,0.05)", borderRadius: 12, fontSize: 12, color: "#64748b", fontFamily: FONT }}>
              🔒 Messages are secured and encrypted.
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <MessageBubble 
              key={m.id || idx} 
              message={m} 
              isMine={m.senderId === currentUserId}
              isSeen={m.senderId === currentUserId && (m.timestamp <= receiverLastRead)}
            />
          ))
        )}
        {otherUserTyping && (
          <div style={S.bubbleContainer(false)}>
             <div style={{ ...S.bubble(false), fontStyle: "italic", opacity: 0.8, color: "#6366f1" }}>
                Typing...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
