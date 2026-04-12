"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LoggedActivity } from "../../dashboard/admin/types";

interface LogViewerProps {
  isMobile: boolean;
  users: { uid: string; name: string }[];
}

export default function LogViewer({ isMobile, users }: LogViewerProps) {
  const [logs, setLogs] = useState<LoggedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextKey, setNextKey] = useState<string | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchLogs = useCallback(async (lastKey: string | null = null) => {
    if (lastKey) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("type", filterType);
      if (filterPeriod !== "all") params.append("period", filterPeriod);
      if (filterUser !== "all") params.append("userId", filterUser);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (lastKey) params.append("lastKey", lastKey);

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();

      if (lastKey) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs || []);
      }
      setNextKey(data.nextKey);
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterType, filterPeriod, filterUser, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
      {/* Header & Filters */}
      <div style={{ 
        background: "#fff", 
        padding: isMobile ? "16px" : "24px", 
        borderRadius: 20, 
        border: "1px solid #e2e8f0", 
        marginBottom: 20,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 500, color: "#0f172a", margin: 0 }}>System Activity Logs</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Persistent audit trail of all platform operations.</p>
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              onClick={() => {
                setFilterType("all");
                setFilterPeriod("all");
                setFilterUser("all");
                setStartDate("");
                setEndDate("");
              }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, color: "#64748b", cursor: "pointer" }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", 
          gap: 12 
        }}>
          {/* Activity Type */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase" }}>Type</label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All Activities</option>
              <option value="inventory">Inventory</option>
              <option value="dispatch">Dispatch</option>
              <option value="user">User Management</option>
              <option value="task">Tasks</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* User Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase" }}>User</label>
            <select 
              value={filterUser} 
              onChange={(e) => setFilterUser(e.target.value)}
              style={selectStyle}
            >
              <option value="all">Any User</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase" }}>Period</label>
            <select 
              value={filterPeriod} 
              onChange={(e) => setFilterPeriod(e.target.value)}
              style={selectStyle}
            >
              <option value="all">Any Time</option>
              <option value="day">Past 24 Hours</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
            </select>
          </div>

          {/* Date Custom Range */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase" }}>From</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={selectStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase" }}>To</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={selectStyle}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
            <div className="spinner" style={spinnerStyle}></div>
            <div style={{ marginTop: 12 }}>Fetching records...</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#1e293b" }}>No activity logs found</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Try adjusting your filters to see more results.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={thStyle}>Date & Time</th>
                  <th style={thStyle}>Operator</th>
                  <th style={thStyle}>Activity</th>
                  <th style={thStyle}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id || `${log.timestamp}-${log.userId}`} style={{ borderBottom: "1px solid #f1f5f9" }} className="tr-hover">
                    <td style={{ padding: "16px 20px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
                      <div style={{ color: "#1e293b", fontWeight: 500 }}>
                        {new Date(log.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: 10, 
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 600, color: "#fff"
                        }}>
                          {log.userName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{log.userName}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{log.userRole}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ 
                        display: "inline-flex", padding: "4px 10px", borderRadius: 6,
                        fontSize: 11, fontWeight: 500, background: `${getTypeColor(log.type)}10`, color: getTypeColor(log.type),
                        textTransform: "capitalize", border: `1px solid ${getTypeColor(log.type)}20`
                      }}>
                        {log.action.replace("_", " ")}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>{log.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, maxWidth: 300, lineHeight: 1.4 }}>{log.description}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {nextKey && (
              <div style={{ padding: "20px", textAlign: "center", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                <button 
                  onClick={() => fetchLogs(nextKey)}
                  disabled={loadingMore}
                  style={{ 
                    padding: "10px 24px", borderRadius: 10, background: "#fff", 
                    border: "1px solid #e2e8f0", color: "#6366f1", fontSize: 13, 
                    fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#c7d2fe"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
                >
                  {loadingMore ? "Loading more..." : "Load More Activities"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <style>{`
        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #f1f5f9;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #edf2f7",
  fontSize: 13,
  outline: "none",
  background: "#fff",
  color: "#4a5568",
  cursor: "pointer",
  fontFamily: "inherit"
};

const thStyle: React.CSSProperties = {
  padding: "16px 20px",
  fontSize: 11,
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.025em"
};

const spinnerStyle: React.CSSProperties = {
  // Styles are handled by CSS in the style tag
};
