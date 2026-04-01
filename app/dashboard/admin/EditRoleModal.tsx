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
  const [expandedMod, setExpandedMod] = React.useState<string | null>(null);

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
    <div style={S.modalOverlay}>
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
              if (r === "admin") {
                const all = [
                  "inventory_view", "inventory_create", "inventory_edit", "inventory_delete",
                  "retail_view", "retail_create", "retail_edit", "retail_delete",
                  "ecom_view", "ecom_create", "ecom_edit", "ecom_delete",
                  "reports", "settings", "party-rates"
                ];
                setEditPermissions(all);
              }
            }}
              style={{ flex: 1, padding: "10px 6px", borderRadius: 11, cursor: "pointer", textAlign: "center", fontFamily: "inherit", border: editRole === r ? `2px solid ${roleColors[r]}` : "2px solid #e2e8f0", background: editRole === r ? `${roleColors[r]}08` : "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 400, color: editRole === r ? roleColors[r] : "#94a3b8", textTransform: "capitalize", letterSpacing: "0.05em" }}>{r}</div>
            </button>
          ))}
        </div>
        <label style={{ ...S.label, marginBottom: 12 }}>Permissions</label>
        <div style={{ padding: "8px", background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0", marginBottom: 22 }}>
          {[
            { id: "inv", name: "Inventory", prefix: "inventory" },
            { id: "retail", name: "Retail Dispatch", prefix: "retail" },
            { id: "ecom", name: "Ecommerce Dispatch", prefix: "ecom" }
          ].map(mod => {
            const actions = ["view", "create", "edit", "delete"];
            const modPerms = actions.map(act => `${mod.prefix}_${act}`);
            const selectedCount = modPerms.filter(p => editPermissions.includes(p)).length;
            const isExpanded = expandedMod === mod.id;

            return (
              <div key={mod.id} style={{ 
                marginBottom: 4, 
                borderRadius: 10, 
                overflow: "hidden", 
                background: isExpanded ? "#fff" : "transparent",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isExpanded ? "#e2e8f0" : "transparent"
              }}>
                <div 
                  onClick={() => setExpandedMod(isExpanded ? null : mod.id)}
                  style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "0.2s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>{mod.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{selectedCount} of 4 rights assigned</div>
                    </div>
                  </div>
                  <div style={{ transition: "0.2s", transform: isExpanded ? "rotate(180deg)" : "none", color: "#94a3b8" }}>▼</div>
                </div>
                
                {isExpanded && (
                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0" }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const allSelected = modPerms.every(i => editPermissions.includes(i));
                          const newPerms = allSelected 
                            ? editPermissions.filter(p => !modPerms.includes(p)) 
                            : [...new Set([...editPermissions, ...modPerms])];
                          setEditPermissions(newPerms);
                        }}
                        style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", fontWeight: 500 }}
                      >
                        { modPerms.every(i => editPermissions.includes(i)) ? "Clear All" : "Select All" }
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {actions.map(action => (
                        <label key={`${mod.id}_${action}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 13, color: "#475569" }}>
                          <input 
                            type="checkbox" 
                            checked={editPermissions?.includes(`${mod.prefix}_${action}`)} 
                            onChange={e => {
                              const p = `${mod.prefix}_${action}`;
                              const perms = e.target.checked ? [...(editPermissions || []), p] : (editPermissions || []).filter(x => x !== p);
                              setEditPermissions(perms);
                            }} 
                            style={{ width: 16, height: 16, accentColor: "#6366f1" }} 
                          />
                          <span style={{ textTransform: "capitalize" }}>{action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Others Group */}
          <div style={{ marginTop: 8, padding: "12px 14px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Specialized Access</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["reports", "settings", "party-rates"].map(p => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 20, background: editPermissions?.includes(p) ? "rgba(99,102,241,0.06)" : "#fff", border: editPermissions?.includes(p) ? "1.5px solid #6366f1" : "1.5px solid #e2e8f0", fontSize: 12, color: editPermissions?.includes(p) ? "#6366f1" : "#64748b", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={editPermissions?.includes(p)} 
                    onChange={e => {
                      const perms = e.target.checked ? [...(editPermissions || []), p] : (editPermissions || []).filter(x => x !== p);
                      setEditPermissions(perms);
                    }} 
                    style={{ position: "absolute", opacity: 0 }} 
                  />
                  <span>{p.replace("-", " ").toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
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
