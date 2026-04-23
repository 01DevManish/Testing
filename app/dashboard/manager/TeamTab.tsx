"use client";

import React, { useState, useEffect } from "react";
import { ref, get } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../lib/firebase";

interface Employee {
  uid: string;
  name: string;
  email: string;
  role: string;
  profilePic?: string;
  lastLogin?: number;
  phone?: string;
}

interface TeamTabProps {
  isMobile: boolean;
  managerUid: string;
}

export default function TeamTab({ isMobile, managerUid }: TeamTabProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadTeam() {
      setLoading(true);
      try {
        const [usersSnap, tasksSnap] = await Promise.all([
          get(ref(db, "users")),
          get(ref(db, "tasks")),
        ]);

        const list: Employee[] = [];

        const assignedEmployeeUids = new Set<string>();
        if (tasksSnap.exists()) {
          tasksSnap.forEach((task) => {
            const t = task.val();
            if (
              t?.createdBy === managerUid &&
              t?.assignedToRole === "employee" &&
              typeof t?.assignedTo === "string" &&
              t.assignedTo.trim()
            ) {
              assignedEmployeeUids.add(t.assignedTo);
            }
          });
        }

        if (usersSnap.exists()) {
          usersSnap.forEach((child) => {
            const user = child.val() || {};
            const uid = String(child.key || "");
            if (!uid) return;
            if (user.role !== "employee") return;
            if (!assignedEmployeeUids.has(uid)) return;
            if (!user.name || !user.email) return;
            list.push({ uid, ...user } as Employee);
          });
        }
        setEmployees(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Error loading team:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, [managerUid]);

  const filteredTeam = employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: 0 }}>My Team</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Manage and monitor your assigned employees</p>
        </div>
        
        <div style={{ position: "relative", width: isMobile ? "100%" : 280 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search team..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 14,
              outline: "none",
              background: "#fff",
              transition: "all 0.2s"
            }}
          />
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 32, height: 32, margin: "0 auto 12px", border: "3px solid #f1f5f9", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading team members...</p>
          </div>
        ) : filteredTeam.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <p style={{ fontSize: 15 }}>No team members found.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Contact</th>
                  <th style={styles.th}>Last Active</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.map((emp) => (
                  <tr key={emp.uid} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {emp.profilePic ? (
                          <img src={emp.profilePic} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#10b981,#34d399)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 14 }}>
                            {emp.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>{emp.name}</div>
                          <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{emp.role}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: 13, color: "#475569" }}>{emp.email}</div>
                      {emp.phone && <div style={{ fontSize: 12, color: "#94a3b8" }}>{emp.phone}</div>}
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        {emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <span style={{ 
                        padding: "4px 10px", 
                        borderRadius: 20, 
                        fontSize: 11, 
                        fontWeight: 500, 
                        background: "rgba(16,185,129,0.1)", 
                        color: "#10b981",
                        border: "1px solid rgba(16,185,129,0.2)"
                      }}>Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const styles = {
  th: {
    padding: "14px 20px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "left" as const,
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em"
  },
  td: {
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    color: "#1e293b"
  },
  tr: {
    transition: "background 0.2s"
  }
};

