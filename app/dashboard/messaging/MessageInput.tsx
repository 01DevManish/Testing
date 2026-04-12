"use client";

import React, { useState, useRef } from "react";
import { FONT } from "./types";
import { uploadImage } from "../inventory/imageService"; // Reusing the S3 upload logic

interface InputProps {
  onSend: (text: string, attachment?: { url: string; type: string; name: string; size: number }) => void;
  onTyping: (text: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, onTyping, disabled }: InputProps) {
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!text.trim() && !isUploading) || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Max size is 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      // Create FormData to pass to our existing upload API with custom folder
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "messaging");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const attachment = {
        url: data.secure_url,
        type: file.type.startsWith("image/") ? "image" : (file.type === "application/pdf" ? "pdf" : "file"),
        name: file.name,
        size: file.size
      };

      onSend("", attachment);
    } catch (err: any) {
      console.error("Upload Error:", err);
      alert("Failed to upload attachment: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ 
      padding: "16px 24px", background: "#fff", borderTop: "1px solid #f1f5f9",
      display: "flex", alignItems: "center", gap: 14 
    }}>
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: "none" }} 
      />

      {/* Attachment Button */}
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || disabled}
        style={{ 
          background: "none", border: "none", cursor: "pointer", 
          padding: 8, borderRadius: "50%", color: "#64748b",
          transition: "all 0.2s", display: "flex", alignItems: "center"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        {isUploading ? (
          <div style={{ width: 22, height: 22, border: "2px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        )}
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Form Area */}
      <form onSubmit={handleSubmit} style={{ flex: 1 }}>
        <input 
          type="text" 
          placeholder={isUploading ? "Uploading file..." : "Type a message..."}
          value={text}
          disabled={isUploading || disabled}
          onChange={(e) => {
            setText(e.target.value);
            onTyping(e.target.value);
          }}
          style={{ 
            width: "100%", padding: "12px 18px", borderRadius: 14, 
            border: "1.5px solid #e2e8f0", fontSize: 15, outline: "none", 
            background: "#f8fafc", color: "#1e293b", fontFamily: FONT,
            transition: "all 0.2s"
          }}
          onFocus={(e) => e.target.style.borderColor = "#6366f1"}
          onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
        />
      </form>

      {/* Send Button */}
      <button 
        onClick={handleSubmit}
        disabled={(!text.trim() && !isUploading) || disabled}
        style={{ 
          background: text.trim() ? "#6366f1" : "#f1f5f9", 
          color: text.trim() ? "#fff" : "#94a3b8",
          border: "none", borderRadius: 12, padding: "10px 18px", 
          fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
          display: "flex", alignItems: "center", gap: 8
        }}
      >
        <span>Send</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  );
}
