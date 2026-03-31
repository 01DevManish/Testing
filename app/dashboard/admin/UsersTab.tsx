"use client";

import React from "react";
import type { UserRole } from "../../context/AuthContext";
import { UserRecord, roleColors, roleBg } from "./types";
import StatsGrid from "./StatsGrid";
import type { AdminStyles } from "./styles";

interface UsersTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  users: UserRecord[];
  filteredUsers: UserRecord[];
  fetchingUsers: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterRole: "all" | UserRole;
  setFilterRole: (v: "all" | UserRole) => void;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  newEmployee: { name: string; email: string; password: string; role: UserRole; permissions: string[] };
  setNewEmployee: (v: { name: string; email: string; password: string; role: UserRole; permissions: string[] }) => void;
  addingEmployee: boolean;
  addError: string;
  setAddError: (v: string) => void;
  handleAddEmployee: () => void;
  handleDeleteUser: (uid: string) => void;
  onEditUser: (u: UserRecord) => void;
  loadUsers: () => void;
}

export default function UsersTab({
  S, isMobile, isTablet, users, filteredUsers, fetchingUsers,
  searchTerm, setSearchTerm, filterRole, setFilterRole,
  showAddForm, setShowAddForm, newEmployee, setNewEmployee,
  addingEmployee, addError, setAddError, handleAddEmployee,
  handleDeleteUser, onEditUser, loadUsers,
}: UsersTabProps) {
  const [expandedMod, setExpandedMod] = React.useState<string | null>(null);
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === "admin").length,
    managers: users.filter(u => u.role === "manager").length,
    employees: users.filter(u => u.role === "employee").length,
    users: users.filter(u => u.role === "user").length,
  };

  const UserCard = ({ u }: { u: UserRecord }) => (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: roleBg[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 16, color: "#fff", flexShrink: 0 }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 14, marginBottom: 2 }}>{u.name}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ ...S.badge(roleColors[u.role], `${roleColors[u.role]}12`), textTransform: "capitalize" }}>{u.role}</span>
          {u.permissions?.map(p => <span key={p} style={{ ...S.badge("#6366f1", "rgba(99,102,241,0.08)"), textTransform: "capitalize" }}>{p}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button style={{ ...S.btnIcon, fontSize: 12 }} onClick={() => onEditUser(u)}>Edit</button>
        <button style={{ ...S.btnIcon, color: "#ef4444", fontSize: 12 }} onClick={() => handleDeleteUser(u.uid)}>Del</button>
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
            <button onClick={loadUsers} style={S.btnSecondary}>↻{!isMobile && " Refresh"}</button>
          </div>
        </div>

        {/* Search + filter row */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, flex: 1, minWidth: 160 }}>
            <span style={{ color: "#94a3b8", fontSize: 14, flexShrink: 0 }}>🔍</span>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 13, width: "100%", fontFamily: "inherit" }} />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value as "all" | UserRole)}
            style={{ padding: "9px 32px 9px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none" as const, minWidth: 130 }}>
            <option value="all">All Roles</option><option value="admin">Admins</option><option value="manager">Managers</option><option value="employee">Employees</option>
          </select>
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Full Name</label><input style={S.input} value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} /></div>
            <div><label style={S.label}>Email</label><input style={S.input} type="email" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} /></div>
            <div><label style={S.label}>Password</label><input style={S.input} type="text" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 18 }}>
            <label style={{ ...S.label, marginBottom: 12 }}>Permissions</label>
            <div style={{ padding: "8px", background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0", marginBottom: 22 }}>
              {[
                { id: "inv", name: "Inventory", prefix: "inventory" },
                { id: "retail", name: "Retail Dispatch", prefix: "retail" },
                { id: "ecom", name: "Ecommerce Dispatch", prefix: "ecom" }
              ].map(mod => {
                const actions = ["view", "create", "edit", "delete"];
                const modPerms = actions.map(act => `${mod.prefix}_${act}`);
                const selectedCount = (newEmployee.permissions || []).filter(p => modPerms.includes(p)).length;
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
                              const allSelected = modPerms.every(i => (newEmployee.permissions || []).includes(i));
                              const newPerms = allSelected 
                                ? (newEmployee.permissions || []).filter(p => !modPerms.includes(p)) 
                                : [...new Set([...(newEmployee.permissions || []), ...modPerms])];
                              setNewEmployee({ ...newEmployee, permissions: newPerms });
                            }}
                            style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", fontWeight: 500 }}
                          >
                            { modPerms.every(i => (newEmployee.permissions || []).includes(i)) ? "Clear All" : "Select All" }
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                          {actions.map(action => (
                            <label key={`new_${mod.id}_${action}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 13, color: "#475569" }}>
                              <input 
                                type="checkbox" 
                                checked={newEmployee.permissions?.includes(`${mod.prefix}_${action}`)} 
                                onChange={e => {
                                  const p = `${mod.prefix}_${action}`;
                                  const perms = e.target.checked ? [...(newEmployee.permissions || []), p] : (newEmployee.permissions || []).filter(x => x !== p);
                                  setNewEmployee({ ...newEmployee, permissions: perms });
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
                    <label key={`new_${p}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 20, background: newEmployee.permissions?.includes(p) ? "rgba(99,102,241,0.06)" : "#fff", border: newEmployee.permissions?.includes(p) ? "1.5px solid #6366f1" : "1.5px solid #e2e8f0", fontSize: 12, color: newEmployee.permissions?.includes(p) ? "#6366f1" : "#64748b", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={newEmployee.permissions?.includes(p)} 
                        onChange={e => {
                          const perms = e.target.checked ? [...(newEmployee.permissions || []), p] : (newEmployee.permissions || []).filter(x => x !== p);
                          setNewEmployee({ ...newEmployee, permissions: perms });
                        }} 
                        style={{ position: "absolute", opacity: 0 }} 
                      />
                      <span>{p.replace("-", " ").toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ ...S.label, margin: 0, flexShrink: 0 }}>Role:</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["employee", "manager", "admin"] as UserRole[]).map(r => (
                <button key={r} onClick={() => {
                  let perms = newEmployee.permissions || [];
                  if (r === "admin") {
                    perms = [
                      "inventory_view", "inventory_create", "inventory_edit", "inventory_delete",
                      "retail_view", "retail_create", "retail_edit", "retail_delete",
                      "ecom_view", "ecom_create", "ecom_edit", "ecom_delete",
                      "reports", "settings", "party-rates"
                    ];
                  }
                  setNewEmployee({ ...newEmployee, role: r, permissions: perms });
                }}
                  style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${newEmployee.role === r ? roleColors[r] : "#e2e8f0"}`, background: newEmployee.role === r ? `${roleColors[r]}15` : "transparent", color: newEmployee.role === r ? roleColors[r] : "#94a3b8" }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleAddEmployee} disabled={addingEmployee || !newEmployee.name || !newEmployee.email || !newEmployee.password}
              style={{ ...S.btnPrimary, opacity: addingEmployee || !newEmployee.name || !newEmployee.email || !newEmployee.password ? 0.5 : 1 }}>
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
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {u.permissions?.map(p => <span key={p} style={{ ...S.badge("#6366f1", "rgba(99,102,241,0.08)"), textTransform: "capitalize" }}>{p.slice(0, 4)}..</span>)}
                        </div>
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
