"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ref, onValue, remove, query, orderByChild, endAt, get, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { LoggedActivity } from "./types";

interface LogsTabProps {
  S: any;
  isMobile: boolean;
  isTablet: boolean;
}

export default function LogsTab({ S, isMobile, isTablet }: LogsTabProps) {
  const [logs, setLogs] = useState<LoggedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  const cleanupOldLogs = useCallback(async () => {
    // 72 hours = 259,200,000 ms
    const CUTOFF_MS = 72 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - CUTOFF_MS;

    const logsQuery = query(ref(db, "activities"), orderByChild("timestamp"), endAt(cutoffTime));
    
    // Get keys once and then delete them in bulk
    const snapshot = await get(logsQuery);
    if (snapshot.exists()) {
      const updates: any = {};
      snapshot.forEach((child) => {
        updates[child.key!] = null;
      });
      await update(ref(db, "activities"), updates);
      console.log(`Cleaned up ${Object.keys(updates).length} old logs.`);
    }
  }, []);

  const handleDeleteLog = async (id: string) => {
    if (confirm("Permanently delete this log entry?")) {
      try {
        await remove(ref(db, `activities/${id}`));
      } catch (e) {
        console.error("Failed to delete log:", e);
        alert("Failed to delete log.");
      }
    }
  };

  const handleClearAllLogs = async () => {
    if (confirm("DANGER: Permanently clear ALL system logs? This cannot be undone.")) {
      try {
        await remove(ref(db, "activities"));
      } catch (e) {
        console.error("Failed to clear logs:", e);
        alert("Failed to clear logs.");
      }
    }
  };

  useEffect(() => {
    cleanupOldLogs();
    const logsRef = ref(db, "activities");
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const l: LoggedActivity[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          l.push(child.val() as LoggedActivity);
        });
      }
      l.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(l);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cleanupOldLogs]);

  const filteredLogs = filterType === "all" ? logs : logs.filter(l => l.type === filterType);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "inventory": return "#10b981";
      case "dispatch": return "#6366f1";
      case "user": return "#f59e0b";
      case "task": return "#ec4899";
      default: return "#64748b";
    }
  };

  return (
    <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 400, color: "#0f172a", margin: 0 }}>System Logs</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Track all actions across the platform. Logs clear after 72 hours.</p>
        </div>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none" }}
        >
          <option value="all">All Activities</option>
          <option value="inventory">Inventory</option>
          <option value="dispatch">Dispatch</option>
          <option value="user">User Management</option>
          <option value="task">Tasks</option>
          <option value="system">System</option>
        </select>
        <button 
          onClick={handleClearAllLogs}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", fontSize: 13, fontWeight: 400, cursor: "pointer" }}
        >
          Clear All
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 400, color: "#1e293b" }}>No logs found</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Activity will appear here as users interact with the system.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Time</th>
                  <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>User</th>
                  <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Action</th>
                  <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Details</th>
                  <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 400, color: "#64748b", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }} className="tr-hover">
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(log.timestamp).toLocaleString("en-IN", { 
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
                      })}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ 
                          width: 24, height: 24, borderRadius: 12, 
                          background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 400, color: "#6366f1"
                        }}>
                          {log.userName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b" }}>{log.userName}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{log.userRole}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ 
                        display: "inline-flex", padding: "4px 8px", borderRadius: 4,
                        fontSize: 11, fontWeight: 400, background: `${getTypeColor(log.type)}15`, color: getTypeColor(log.type),
                        textTransform: "uppercase"
                      }}>
                        {log.type}: {log.action.replace("_", " ")}
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 400, color: "#334155" }}>{log.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{log.description}</div>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "center" }}>
                        <button 
                          onClick={() => handleDeleteLog(log.id)}
                          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 6, borderRadius: 6, transition: "all 0.2s" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                        >
                          <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M5.5 1V1.5H3.5V2.5H11.5V1.5H9.5V1H5.5ZM2.5 3.5V13.5C2.5 14.0523 2.94772 14.5 3.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V3.5H2.5ZM4.5 5.5H5.5V12.5H4.5V5.5ZM7 5.5H8V12.5H7V5.5ZM9.5 5.5H10.5V12.5H10.5V5.5H9.5V5.5Z" fill="currentColor"/></svg>
                        </button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
