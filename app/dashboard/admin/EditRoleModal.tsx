"use client";

import React from "react";
import type { UserRole } from "../../context/AuthContext";
import { UserRecord, roleColors, roleBg } from "./types";
import type { AdminStyles } from "./styles";
import { PERMISSION_GROUPS, getAllGranularPermissions } from "../../lib/permissions";

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

// ── Reusable Permission Selector Component ────────────────────
export function PermissionSelector({
  permissions,
  setPermissions,
  isMobile = false,
}: {
  permissions: string[];
  setPermissions: (p: string[]) => void;
  isMobile?: boolean;
}) {
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);
  const [expandedSub, setExpandedSub] = React.useState<string | null>(null);

  const togglePerm = (key: string, checked: boolean) => {
    if (checked) setPermissions([...new Set([...permissions, key])]);
    else setPermissions(permissions.filter(p => p !== key));
  };

  const getGroupPerms = (group: typeof PERMISSION_GROUPS[number]) => {
    const perms: string[] = [];
    group.subModules.forEach(sub => sub.actions.forEach(a => perms.push(`${sub.id}_${a}`)));
    return perms;
  };

  const getSubPerms = (sub: typeof PERMISSION_GROUPS[number]["subModules"][number]) => {
    return sub.actions.map(a => `${sub.id}_${a}`);
  };

  return (
    <div style={{ background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      {PERMISSION_GROUPS.map(group => {
        const groupPerms = getGroupPerms(group);
        const selectedCount = groupPerms.filter(p => permissions.includes(p)).length;
        const allSelected = selectedCount === groupPerms.length;
        const isExpanded = expandedGroup === group.id;

        return (
          <div key={group.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
            {/* Group Header */}
            <div
              onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              style={{
                padding: "14px 18px", display: "flex", alignItems: "center",
                justifyContent: "space-between", cursor: "pointer",
                background: isExpanded ? "#fff" : "transparent",
                transition: "background 0.2s"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{group.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{group.name}</div>
                  <div style={{ fontSize: 11, color: selectedCount > 0 ? "#6366f1" : "#94a3b8" }}>
                    {selectedCount} of {groupPerms.length} permissions assigned
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (allSelected) setPermissions(permissions.filter(p => !groupPerms.includes(p)));
                    else setPermissions([...new Set([...permissions, ...groupPerms])]);
                  }}
                  style={{
                    background: allSelected ? "#6366f1" : "#e2e8f0",
                    color: allSelected ? "#fff" : "#64748b",
                    border: "none", borderRadius: 6, padding: "4px 10px",
                    fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "uppercase"
                  }}
                >
                  {allSelected ? "Clear" : "All"}
                </button>
                <span style={{
                  transition: "0.2s", transform: isExpanded ? "rotate(180deg)" : "none",
                  color: "#94a3b8", fontSize: 12
                }}>▼</span>
              </div>
            </div>

            {/* Sub-modules */}
            {isExpanded && (
              <div style={{ padding: "0 18px 16px", background: "#fff" }}>
                {group.subModules.map(sub => {
                  const subPerms = getSubPerms(sub);
                  const subSelected = subPerms.filter(p => permissions.includes(p)).length;
                  const subAllSelected = subSelected === subPerms.length;
                  const isSubExpanded = expandedSub === sub.id;

                  return (
                    <div key={sub.id} style={{
                      marginTop: 8, borderRadius: 12, border: "1px solid #f1f5f9",
                      background: isSubExpanded ? "#fafbff" : "#f8fafc",
                      overflow: "hidden"
                    }}>
                      <div
                        onClick={() => setExpandedSub(isSubExpanded ? null : sub.id)}
                        style={{
                          padding: "10px 14px", display: "flex", alignItems: "center",
                          justifyContent: "space-between", cursor: "pointer"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: subSelected === 0 ? "#e2e8f0" : subAllSelected ? "#22c55e" : "#f59e0b"
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>{sub.name}</span>
                          <span style={{
                            fontSize: 10, padding: "2px 6px", borderRadius: 4,
                            background: subSelected > 0 ? "#eff6ff" : "#f1f5f9",
                            color: subSelected > 0 ? "#3b82f6" : "#94a3b8", fontWeight: 600
                          }}>
                            {subSelected}/{subPerms.length}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (subAllSelected) setPermissions(permissions.filter(p => !subPerms.includes(p)));
                              else setPermissions([...new Set([...permissions, ...subPerms])]);
                            }}
                            style={{
                              background: "none", border: "none", fontSize: 10,
                              color: "#6366f1", cursor: "pointer", fontWeight: 600
                            }}
                          >
                            {subAllSelected ? "Clear" : "Select All"}
                          </button>
                          <span style={{
                            transition: "0.2s", transform: isSubExpanded ? "rotate(180deg)" : "none",
                            color: "#cbd5e1", fontSize: 10
                          }}>▼</span>
                        </div>
                      </div>

                      {isSubExpanded && (
                        <div style={{
                          padding: "8px 14px 14px", borderTop: "1px solid #f1f5f9",
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${Math.min(sub.actions.length, 3)}, 1fr)`,
                          gap: 8
                        }}>
                          {sub.actions.map(action => {
                            const key = `${sub.id}_${action}`;
                            const checked = permissions.includes(key);
                            const actionColors: Record<string, { bg: string; color: string; activeBg: string }> = {
                              view: { bg: "#f0fdf4", color: "#15803d", activeBg: "#dcfce7" },
                              create: { bg: "#eff6ff", color: "#1d4ed8", activeBg: "#dbeafe" },
                              edit: { bg: "#fef9c3", color: "#a16207", activeBg: "#fef08a" },
                            };
                            const colors = actionColors[action] || actionColors.view;

                            return (
                              <label key={key} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                                background: checked ? colors.activeBg : "#fff",
                                border: `1.5px solid ${checked ? colors.color + "40" : "#e2e8f0"}`,
                                transition: "all 0.15s ease"
                              }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => togglePerm(key, e.target.checked)}
                                  style={{ width: 15, height: 15, accentColor: colors.color, cursor: "pointer" }}
                                />
                                <span style={{
                                  fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                                  color: checked ? colors.color : "#94a3b8"
                                }}>{action}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* General Access */}
      <div style={{ padding: "14px 18px", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          General Access
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["reports", "settings"].map(p => {
            const checked = permissions.includes(p);
            return (
              <label key={p} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                background: checked ? "rgba(99,102,241,0.08)" : "#fff",
                border: `1.5px solid ${checked ? "#6366f1" : "#e2e8f0"}`,
                fontSize: 12, color: checked ? "#6366f1" : "#64748b",
                fontWeight: checked ? 600 : 400, transition: "all 0.15s"
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => togglePerm(p, e.target.checked)}
                  style={{ position: "absolute", opacity: 0 }}
                />
                <span>{p.replace("-", " ").toUpperCase()}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Edit Role Modal ───────────────────────────────────────────
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
    <div style={S.modalOverlay}>
      <div style={{ ...S.modalCard, maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
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
              if (r === "admin") setEditPermissions(getAllGranularPermissions());
            }}
              style={{ flex: 1, padding: "10px 6px", borderRadius: 11, cursor: "pointer", textAlign: "center", fontFamily: "inherit", border: editRole === r ? `2px solid ${roleColors[r]}` : "2px solid #e2e8f0", background: editRole === r ? `${roleColors[r]}08` : "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 400, color: editRole === r ? roleColors[r] : "#94a3b8", textTransform: "capitalize", letterSpacing: "0.05em" }}>{r}</div>
            </button>
          ))}
        </div>

        <label style={{ ...S.label, marginBottom: 12 }}>Permissions</label>
        <div style={{ marginBottom: 22 }}>
          <PermissionSelector
            permissions={editPermissions}
            setPermissions={setEditPermissions}
          />
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
