"use client";

import React, { useState } from "react";
import type { UserRole } from "../../context/AuthContext";
import { UserRecord, roleColors, roleBg } from "./types";
import StatsGrid from "./StatsGrid";
import type { AdminStyles } from "./styles";
import { PermissionSelector } from "./EditRoleModal";
import { getAllGranularPermissions } from "../../lib/permissions";

const OFFICIAL_EMAIL_DOMAIN = "euruslifestyle.in";

interface UsersTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  filteredUsers: UserRecord[];
  fetchingUsers: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterRole: "all" | UserRole;
  setFilterRole: (v: "all" | UserRole) => void;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  newEmployee: { name: string; email: string; password: string; pin: string; role: UserRole; permissions: string[] };
  setNewEmployee: React.Dispatch<React.SetStateAction<{ name: string; email: string; password: string; pin: string; role: UserRole; permissions: string[] }>>;
  addingEmployee: boolean;
  addError: string;
  setAddError: (v: string) => void;
  handleAddEmployee: () => void;
  handleDeleteUser: (uid: string) => void;
  onEditUser: (u: UserRecord) => void;
}

const PermissionPreview = ({ u, S }: { u: UserRecord; S: AdminStyles }) => {
  if (u.role === "admin") {
    return <span style={{ ...S.badge("#f59e0b", "rgba(245,158,11,0.08)"), fontWeight: 600 }}>🛡️ Super Admin</span>;
  }

  const perms = u.permissions || [];
  if (perms.length === 0) return <span style={{ color: "#94a3b8", fontSize: 11, fontStyle: "italic" }}>No specific access</span>;

  // Grouping logic for clean UI
  const groups = [
    { label: "Inv", icon: "📦", count: perms.filter(p => p.startsWith("inv_") || p === "inventory").length },
    { label: "Retail", icon: "🚚", count: perms.filter(p => p.startsWith("retail_")).length },
    { label: "Ecom", icon: "🛒", count: perms.filter(p => p.startsWith("ecom_")).length },
    { label: "Rates", icon: "💰", count: perms.filter(p => p.startsWith("party_rate") || p === "party-rates").length },
    { label: "ERM", icon: "ERM", count: perms.filter(p => p.startsWith("erm_") || p.startsWith("crm_") || p === "erm" || p === "crm").length },
    { label: "Core", icon: "⚙️", count: perms.filter(p => ["settings", "reports"].includes(p)).length },
  ];

  const activeGroups = groups.filter(g => g.count > 0);

  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
      {activeGroups.map(g => (
        <div key={g.label} style={{ 
          ...S.badge("#6366f1", "rgba(99,102,241,0.06)"), 
          padding: "2px 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          border: "1px solid rgba(99,102,241,0.12)"
        }} title={`${g.count} permissions in ${g.label}`}>
          <span style={{ fontSize: 13 }}>{g.icon}</span>
          <span style={{ fontWeight: 600 }}>{g.count}</span>
        </div>
      ))}
      {activeGroups.length === 0 && perms.length > 0 && (
         <span style={S.badge("#94a3b8", "#f1f5f9")}>{perms.length} Permissions</span>
      )}
    </div>
  );
};

export default function UsersTab({
  S, isMobile, isTablet, filteredUsers, fetchingUsers,
  searchTerm, setSearchTerm, filterRole, setFilterRole,
  showAddForm, setShowAddForm, newEmployee, setNewEmployee,
  addingEmployee, addError, setAddError, handleAddEmployee,
  handleDeleteUser, onEditUser,
}: UsersTabProps) {
  const [showPassword, setShowPassword] = useState(false);
  const emailValue = String(newEmployee.email || "").trim().toLowerCase();
  const emailPrefix = emailValue.replace(/@.*$/, "");
  const canAddUser =
    !addingEmployee &&
    newEmployee.name.trim().length > 0 &&
    newEmployee.password.trim().length > 0 &&
    emailPrefix.length > 0 &&
    newEmployee.pin.length === 4;

  const visibleUsers = filteredUsers;
  const stats = {
    total: visibleUsers.length,
    admins: visibleUsers.filter(u => u.role === "admin").length,
    managers: visibleUsers.filter(u => u.role === "manager").length,
    employees: visibleUsers.filter(u => u.role === "employee").length,
    users: visibleUsers.filter(u => u.role === "user").length,
  };

  const UserCard = ({ u }: { u: UserRecord }) => (
    <div style={{ padding: "16px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: roleBg[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 18, color: "#fff", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 15, marginBottom: 2 }}>{u.name}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...S.badge(roleColors[u.role], `${roleColors[u.role]}12`), textTransform: "capitalize", fontWeight: 600, padding: "2px 10px" }}>{u.role}</span>
          </div>
          <PermissionPreview u={u} S={S} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button style={{ ...S.btnIcon, width: 32, height: 32 }} onClick={() => onEditUser(u)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button style={{ ...S.btnIcon, width: 32, height: 32, color: "#ef4444", background: "rgba(239,68,68,0.05)" }} onClick={() => handleDeleteUser(u.uid)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Stats */}
      <StatsGrid S={S} isMobile={isMobile} items={[
        { label: "Total Users", value: stats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
        { label: "Admins", value: stats.admins, gradient: "linear-gradient(135deg,#ef4444,#f97316)" },
        { label: "Managers", value: stats.managers, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
        { label: "Employees", value: stats.employees, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
      ]} />

      {/* Action bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 400, color: "#0f172a", margin: 0 }}>All Users</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowAddForm(!showAddForm)} style={S.btnPrimary}>
              <span style={{ fontSize: 15 }}>{showAddForm ? "✕" : "+"}</span>
              {!isMobile && (showAddForm ? " Cancel" : " Add User")}
            </button>
          </div>
        </div>

        {/* Search + filter row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 10, 
            padding: "10px 16px", 
            background: "#f1f5f9", 
            borderRadius: 24, 
            flex: 1, 
            minWidth: 200,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            border: "1.5px solid transparent",
            boxShadow: "none",
            outline: "none"
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.borderColor = "#6366f1";
            e.currentTarget.style.boxShadow = "0 8px 24px -8px rgba(99,102,241,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "#f1f5f9";
            e.currentTarget.style.borderColor = "transparent";
            e.currentTarget.style.boxShadow = "none";
          }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search User " 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ 
                background: "transparent", 
                border: "none", 
                outline: "none", 
                boxShadow: "none",
                color: "#1e293b", 
                fontSize: 14, 
                width: "100%", 
                fontFamily: "inherit",
                fontWeight: 400,
                WebkitAppearance: "none",
                padding: 0,
                margin: 0
              }} 
            />
          </div>
          <div style={{ position: "relative", minWidth: 140 }}>
            <select 
              value={filterRole} 
              onChange={e => setFilterRole(e.target.value as "all" | UserRole)}
              style={{ 
                width: "100%",
                padding: "10px 36px 10px 16px", 
                background: "#f1f5f9", 
                border: "1.5px solid transparent", 
                borderRadius: 24, 
                color: "#475569", 
                fontSize: 14, 
                fontFamily: "inherit", 
                cursor: "pointer", 
                outline: "none", 
                boxShadow: "none",
                appearance: "none",
                fontWeight: 400,
                transition: "all 0.2s"
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.boxShadow = "0 8px 24px -8px rgba(99,102,241,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="employee">Employees</option>
            </select>
            <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8", fontSize: 10 }}>▼</div>
          </div>
        </div>
      </div>

      {/* Add Employee Form */}
      {showAddForm && (
        <div style={{ ...S.tableContainer, padding: isMobile ? 16 : 22, marginBottom: 18, animation: "fadeInUp 0.3s ease" }}>
          <h3 style={{ fontSize: 16, fontWeight: 400, margin: "0 0 16px", color: "#0f172a" }}>Add New User</h3>
          {addError && (
            <div style={{ padding: "9px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9, color: "#ef4444", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span> {addError}
              <button onClick={() => setAddError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Full Name</label><input style={S.input} value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} /></div>
            <div>
              <label style={S.label}>Official Email</label>
              <div style={{ ...S.input, display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
                <input
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 14,
                    color: "#1e293b",
                    fontFamily: "inherit",
                    padding: "11px 0",
                  }}
                  type="text"
                  placeholder="username"
                  value={newEmployee.email}
                  onChange={e => {
                    const usernameOnly = e.target.value.toLowerCase().replace(/\s+/g, "").replace(/@.*$/, "");
                    setNewEmployee({ ...newEmployee, email: usernameOnly });
                  }}
                />
                <span style={{ fontSize: 14, color: "#64748b", whiteSpace: "nowrap" }}>@{OFFICIAL_EMAIL_DOMAIN}</span>
              </div>
            </div>
            <div>
              <label style={S.label}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...S.input, paddingRight: 42 }}
                  type={showPassword ? "text" : "password"}
                  value={newEmployee.password}
                  onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  title={showPassword ? "Hide Password" : "Show Password"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 2,
                  }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.92-2.19 2.47-4.08 4.46-5.41"></path>
                      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83"></path>
                      <path d="M1 1l22 22"></path>
                      <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8-1 2.38-2.8 4.44-5.06 5.94"></path>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label style={S.label}>PIN (4 Digits)</label>
              <input
                style={{ ...S.input, letterSpacing: "0.3em", textAlign: "center" }}
                type="text"
                maxLength={4}
                value={newEmployee.pin}
                onChange={e => setNewEmployee({ ...newEmployee, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <label style={{ ...S.label, marginBottom: 12 }}>Permissions</label>
            <PermissionSelector
              permissions={newEmployee.permissions || []}
              setPermissions={(perms) => setNewEmployee(prev => ({ ...prev, permissions: typeof perms === "function" ? perms(prev.permissions || []) : perms }))}
              isMobile={isMobile}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ ...S.label, margin: 0, flexShrink: 0 }}>Role:</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["employee", "manager", "admin"] as UserRole[]).map(r => (
                <button key={r} onClick={() => {
                  setNewEmployee(prev => {
                    let perms = prev.permissions || [];
                    if (r === "admin") perms = getAllGranularPermissions();
                    return { ...prev, role: r, permissions: perms };
                  });
                }}
                  style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${newEmployee.role === r ? roleColors[r] : "#e2e8f0"}`, background: newEmployee.role === r ? `${roleColors[r]}15` : "transparent", color: newEmployee.role === r ? roleColors[r] : "#94a3b8" }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleAddEmployee} disabled={!canAddUser}
              style={{ ...S.btnPrimary, opacity: canAddUser ? 1 : 0.5 }}>
              {addingEmployee ? <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : "Add User"}
            </button>
          </div>
        </div>
      )}

      {/* Users — table on tablet+, cards on mobile */}
      <div style={S.tableContainer}>
        {fetchingUsers ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ width: 30, height: 30, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
            <p style={{ fontSize: 36, marginBottom: 6 }}>👥</p>
            <p style={{ fontSize: 14, fontWeight: 400 }}>No users found</p>
          </div>
        ) : isMobile ? (
          filteredUsers.map(u => <UserCard key={u.uid} u={u} />)
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: isTablet ? 560 : "auto" }}>
              <thead>
                <tr>
                  <th style={S.th}>User</th>
                  {!isTablet && <th style={S.th}>Email</th>}
                  <th style={S.th}>Role</th>
                  {!isTablet && <th style={S.th}>Permissions</th>}
                  <th style={{ ...S.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.uid} className="tr-hover">
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: roleBg[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 13, color: "#fff", flexShrink: 0 }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
                        <div>
                          <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 13 }}>{u.name}</div>
                          {isTablet && <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</div>}
                        </div>
                      </div>
                    </td>
                    {!isTablet && <td style={S.td}>{u.email}</td>}
                    <td style={S.td}><span style={{ ...S.badge(roleColors[u.role], `${roleColors[u.role]}12`), textTransform: "capitalize" }}>{u.role}</span></td>
                    {!isTablet && (
                      <td style={S.td}>
                        <PermissionPreview u={u} S={S} />
                      </td>
                    )}
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        <button style={S.btnIcon} onClick={() => onEditUser(u)}>Edit</button>
                        <button style={{ ...S.btnIcon, color: "#ef4444" }} onClick={() => handleDeleteUser(u.uid)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
