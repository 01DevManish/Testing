"use client";

import React from "react";
import type { UserRole } from "../../context/AuthContext";
import { UserRecord, roleColors, roleBg } from "./types";
import type { AdminStyles } from "./styles";

interface EditRoleModalProps {
  S: AdminStyles;
  editingUser: UserRecord;
  editRole: UserRole;
  setEditRole: (r: UserRole) => void;
  editPermissions: string[];
  setEditPermissions: (p: string[]) => void;
  savingRole: boolean;
  editPin: string;
  setEditPin: (p: string) => void;
  handleRoleUpdate: () => void;
  handlePasswordReset: (newPass: string) => Promise<void>;
  onClose: () => void;
}

export default function EditRoleModal({
  S, editingUser, editRole, setEditRole, editPermissions, setEditPermissions,
  savingRole, editPin, setEditPin, handleRoleUpdate, handlePasswordReset, onClose,
}: EditRoleModalProps) {
  const [newPass, setNewPass] = React.useState("");
  const [resetting, setResetting] = React.useState(false);

  const onReset = async () => {
    if (!newPass.trim() || newPass.length < 6) return alert("Password must be 6+ characters.");
    setResetting(true);
    try {
      await handlePasswordReset(newPass);
      setNewPass("");
      alert("Password updated! The user will be forced to change it on their next login.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}>✕</button>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 58, height: 58, borderRadius: 15, background: roleBg[editingUser.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 24, color: "#fff", margin: "0 auto 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>{editingUser.name?.[0]?.toUpperCase() || "U"}</div>
          <h3 style={{ fontSize: 18, fontWeight: 400, margin: "0 0 3px", color: "#0f172a" }}>{editingUser.name}</h3>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{editingUser.email}</p>
        </div>
        <label style={{ ...S.label, marginBottom: 10 }}>Change Role</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          {(["admin", "manager", "employee"] as UserRole[]).map(r => (
            <button key={r} onClick={() => {
              setEditRole(r);
              if (r === "admin") setEditPermissions(["dispatch", "inventory", "reports", "settings", "party-rates"]);
            }}
              style={{ flex: 1, padding: "10px 6px", borderRadius: 11, cursor: "pointer", textAlign: "center", fontFamily: "inherit", border: editRole === r ? `2px solid ${roleColors[r]}` : "2px solid #e2e8f0", background: editRole === r ? `${roleColors[r]}08` : "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 400, color: editRole === r ? roleColors[r] : "#94a3b8", textTransform: "capitalize", letterSpacing: "0.05em" }}>{r}</div>
            </button>
          ))}
        </div>
        <label style={{ ...S.label, marginBottom: 10 }}>Permissions</label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22, padding: "12px 12px", background: "#f8fafc", borderRadius: 11, border: "1px solid #e2e8f0" }}>
          {["dispatch", "inventory", "reports", "settings", "party-rates"].map(p => (
            <label key={p} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={editPermissions?.includes(p)} onChange={e => {
                const perms = e.target.checked ? [...(editPermissions || []), p] : (editPermissions || []).filter(x => x !== p);
                setEditPermissions(perms);
              }} style={{ cursor: "pointer", width: 15, height: 15, accentColor: "#6366f1" }} />
              <span style={{ textTransform: "capitalize" }}>{p}</span>
            </label>
          ))}
        </div>

        <label style={{ ...S.label, marginBottom: 10 }}>Dispatch PIN (4 Digits)</label>
        <div style={{ marginBottom: 22 }}>
          <input 
            type="text" 
            maxLength={4}
            value={editPin || ""}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, "");
              if (val.length <= 4) setEditPin(val);
            }}
            style={{ ...S.input, letterSpacing: "0.5em", textAlign: "center", fontWeight: 400, fontSize: 18 }}
          />
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Administrators can reset user PINs if they are forgotten.</p>
        </div>

        <label style={{ ...S.label, marginBottom: 10 }}>Update Password (Min 6 chars)</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          <input 
            type="text" 
            placeholder="New temporary password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            style={{ ...S.input, flex: 1, margin: 0 }}
          />
          <button 
            disabled={resetting || !newPass} 
            onClick={onReset}
            style={{ ...S.btnSecondary, background: "#0f172a", color: "#fff", border: "none" }}
          >
            {resetting ? "..." : "Reset"}
          </button>
        </div>

        <button onClick={handleRoleUpdate} disabled={savingRole}
          style={{ ...S.btnPrimary, width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 14, opacity: savingRole ? 0.5 : 1 }}>
          {savingRole ? <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : "Update Role"}
        </button>
      </div>
    </div>
  );
}
