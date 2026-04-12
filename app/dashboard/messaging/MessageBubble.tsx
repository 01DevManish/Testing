"use client";

import React from "react";
import { ChatMessage } from "../../lib/chatHelper";
import { S, FONT } from "./types";
import SmartImage from "../../components/SmartImage";

interface BubbleProps {
  message: ChatMessage;
  isMine: boolean;
  isSeen: boolean;
}

export default function MessageBubble({ message, isMine, isSeen }: BubbleProps) {
  const formatTime = (ts: number) => {
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(ts);
  };

  const renderAttachment = () => {
    if (!message.attachment) return null;

    const { url, type, name } = message.attachment;

    if (type === "image") {
      return (
        <div style={{ marginTop: 4, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.1)" }}>
          <SmartImage src={url} alt={name} style={{ maxWidth: "100%", maxHeight: 300, display: "block" }} />
        </div>
      );
    }

    // PDF or Generic File
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: isMine ? "rgba(255,255,255,0.1)" : "#f8fafc",
          borderRadius: 12,
          textDecoration: "none",
          border: "1px solid rgba(0,0,0,0.05)",
          color: isMine ? "#fff" : "#1e293b",
          transition: "all 0.2s"
        }}
      >
        <div style={{ fontSize: 24 }}>
          {type === "pdf" ? "📄" : "📁"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7 }}>
            Click to Download
          </div>
        </div>
        <div style={{ fontSize: 14 }}>↓</div>
      </a>
    );
  };

  return (
    <div style={S.bubbleContainer(isMine)}>
      <div style={S.bubble(isMine)}>
        {/* Attachment First */}
        {renderAttachment()}
        
        {/* Text Body */}
        {message.text && (
          <div style={{ marginTop: message.attachment ? 8 : 0 }}>
            {message.text}
          </div>
        )}

        {/* Footer: Time + Status Ticks */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "flex-end", 
          gap: 4, 
          marginTop: 4,
          opacity: 0.7 
        }}>
          <span style={{ fontSize: 10, fontFamily: FONT }}>
            {formatTime(message.timestamp)}
          </span>
          {isMine && (
            <span style={{ fontSize: 13, color: isSeen ? (isMine ? "#fff" : "#53bdeb") : (isMine ? "rgba(255,255,255,0.6)" : "#94a3b8") }}>
              {isSeen ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
