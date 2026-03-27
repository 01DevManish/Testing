"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { uploadToCloudinary } from "../inventory/cloudinary";
import type { AdminStyles } from "./styles";

interface ProfileTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
}

export default function ProfileTab({ S, isMobile, isTablet }: ProfileTabProps) {
  const { userData, updateUserData } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!userData) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const imageUrl = await uploadToCloudinary(base64);
        await updateUserData(userData.uid, { profilePic: imageUrl });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload DP:", err);
      alert("Failed to update profile picture.");
      setUploading(false);
    }
  };

  const roleColors: Record<string, string> = { 
    admin: "#ef4444", 
    manager: "#f59e0b", 
    employee: "#10b981",
    user: "#6366f1"
  };

  return (
    <div style={{ padding: isMobile ? "0 4px" : "0 10px", animation: "fadeInUp 0.5s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: 0 }}>My Profile</h2>
      </div>

      <div style={{ 
        background: "#fff", 
        borderRadius: 20, 
        border: "1px solid #e2e8f0", 
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
        overflow: "hidden",
        maxWidth: 700,
        margin: "0 auto"
      }}>
        {/* Header/Cover aspect */}
        <div style={{ height: 100, background: "linear-gradient(90deg, #6366f1 0%, #a855f7 100%)", position: "relative" }} />
        
        <div style={{ padding: isMobile ? "20px" : "0 40px 40px", position: "relative", marginTop: -50 }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "center" : "flex-end", gap: 24, marginBottom: 32 }}>
            {/* DP Section */}
            <div style={{ position: "relative" }}>
              <div style={{ 
                width: 120, height: 120, borderRadius: 30, border: "4px solid #fff", background: "#f8fafc", 
                overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {userData.profilePic ? (
                  <img src={userData.profilePic} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 40, color: "#cbd5e1" }}>{userData.name[0]?.toUpperCase()}</span>
                )}
                {uploading && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 24, height: 24, border: "2px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.8s linear infinite" }} />
                  </div>
                )}
              </div>
              <button 
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ 
                  position: "absolute", bottom: 0, right: 0, width: 36, height: 36, borderRadius: 12, 
                  background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16
                }}
              >
                📷
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            </div>

            <div style={{ textAlign: isMobile ? "center" : "left", flex: 1 }}>
              <h1 style={{ fontSize: 24, fontWeight: 400, color: "#0f172a", margin: "0 0 4px" }}>{userData.name}</h1>
              <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: 8 }}>
                <span style={{ 
                  fontSize: 12, fontWeight: 400, padding: "2px 10px", borderRadius: 20, 
                  background: `${roleColors[userData.role]}15`, color: roleColors[userData.role], textTransform: "capitalize"
                }}>{userData.role}</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>• {userData.email}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, paddingTop: 24, borderTop: "1px solid #f1f5f9" }}>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Account Name</label>
              <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", color: "#334155", fontSize: 14 }}>{userData.name}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Email Address</label>
              <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", color: "#334155", fontSize: 14 }}>{userData.email}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>User Role</label>
              <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", color: "#334155", fontSize: 14, textTransform: "capitalize" }}>{userData.role}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>User ID</label>
              <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{userData.uid}</div>
            </div>
          </div>
          
          <div style={{ marginTop: 32, padding: "16px", borderRadius: 12, background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 400, color: "#0369a1", marginBottom: 4 }}>Profile Tip</div>
              <div style={{ fontSize: 12, color: "#0c4a6e", lineHeight: 1.5 }}>Your role and email are managed by an administrator. To change these details, please contact your system administrator.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
