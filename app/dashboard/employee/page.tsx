"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, Timestamp, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { UserRole } from "../../context/AuthContext";

interface Task {
  id: string; title: string; description: string;
  assignedTo: string; assignedToName: string; assignedToRole: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  completedAt?: Timestamp; createdAt: Timestamp;
}

const roleBg: Record<string, string> = { admin: "linear-gradient(135deg,#ef4444,#f97316)", manager: "linear-gradient(135deg,#f59e0b,#fbbf24)", employee: "linear-gradient(135deg,#10b981,#34d399)", user: "linear-gradient(135deg,#3b82f6,#60a5fa)" };
const priorityColors: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  "in-progress": { label: "In Progress", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  completed: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

export default function EmployeePage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && (userData.role !== "employee" && userData.role !== "manager")) {
      if (userData.role === "admin") router.replace("/dashboard/admin");
      else router.replace("/dashboard/user");
    }
  }, [loading, user, userData, router]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setFetchingTasks(true);
    try { 
      const q = query(collection(db, "tasks"), where("assignedTo", "==", user.uid));
      const s = await getDocs(q); 
      const l: Task[] = []; 
      s.forEach(d => l.push({ id: d.id, ...d.data() } as Task)); 
      l.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 
      setTasks(l); 
    }
    catch (e) { console.error(e); } finally { setFetchingTasks(false); }
  }, [user]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (loading || !user || !userData) return null;
  if (userData.role !== "employee" && userData.role !== "manager") return null;

  const currentName = userData.name || "Employee";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const handleTaskStatus = async (id: string, status: Task["status"]) => {
    const upd: Record<string, unknown> = { status }; if (status === "completed") upd.completedAt = Timestamp.now();
    try { await updateDoc(doc(db, "tasks", id), upd); setTasks(tasks.map(t => t.id === id ? { ...t, status, ...(status === "completed" ? { completedAt: Timestamp.now() } : {}) } : t)); } catch (e) { console.error(e); }
  };

  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter(t => t.status === taskFilter);
  const taskStats = { total: tasks.length, pending: tasks.filter(t => t.status === "pending").length, inProgress: tasks.filter(t => t.status === "in-progress").length, completed: tasks.filter(t => t.status === "completed").length };
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  // === Inline Styles ===
  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc" } as React.CSSProperties,
    sidebar: { width: 260, background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", display: "flex", flexDirection: "column" as const, padding: "24px 16px", position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 100, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)" } as React.CSSProperties,
    sidebarMobileOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99, backdropFilter: "blur(4px)" } as React.CSSProperties,
    main: { flex: 1, marginLeft: 260, padding: "28px 32px 32px", minHeight: "100vh" } as React.CSSProperties,

    // Cards
    statCard: (gradient: string) => ({
      background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.25s ease", cursor: "default", position: "relative" as const, overflow: "hidden" as const,
    }),
    statStripe: (gradient: string) => ({
      position: "absolute" as const, top: 0, left: 0, right: 0, height: 4, background: gradient, borderRadius: "16px 16px 0 0",
    }),

    // Table
    tableContainer: { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" as const } as React.CSSProperties,
    th: { padding: "14px 20px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#94a3b8", borderBottom: "1px solid #e2e8f0", background: "#fafbfc" } as React.CSSProperties,
    td: { padding: "16px 20px", fontSize: 14, color: "#475569", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,

    // Buttons
    btnSecondary: { padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,

    // Badge
    badge: (color: string, bg: string) => ({
      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${color}20`,
    }),
  };

  return (
    <div style={S.page}>
      {/* Mobile overlay */}
      {sidebarOpen && <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* =================== SIDEBAR =================== */}
      <aside style={{ ...S.sidebar, ...(typeof window !== "undefined" && window.innerWidth < 768 && !sidebarOpen ? { transform: "translateX(-100%)" } : {}) }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
            <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Employee Portal</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Dashboard
          </button>
          
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(16,185,129,0.15)", color: "#6ee7b7", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #34d399", paddingLeft: 11 }}>
            My Tasks
            {taskStats.pending > 0 && <span style={{ marginLeft: "auto", background: "rgba(52,211,153,0.2)", color: "#a7f3d0", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, minWidth: 24, textAlign: "center" }}>{taskStats.pending}</span>}
          </button>

          {(userData?.role === "manager" || userData?.role === "employee") && (
            <button onClick={() => router.push("/dashboard/advanced-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Dispatch
            </button>
          )}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleBg[userData.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff", textTransform: "uppercase" }}>{currentName[0] || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#34d399", fontWeight: 600, textTransform: "capitalize" }}>{userData.role}</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* =================== MAIN =================== */}
      <main style={S.main}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ ...S.btnIcon, display: "none" }}>☰</button>
          </div>
        </div>

        {/* ========== TASKS TAB ========== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "My Tasks", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
            { label: "Pending", value: taskStats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
            { label: "In Progress", value: taskStats.inProgress, gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
            { label: "Completed", value: taskStats.completed, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
          ].map(s => (
            <div key={s.label} style={S.statCard(s.gradient)}>
              <div style={S.statStripe(s.gradient)} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: s.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Assigned to Me</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {(["all", "pending", "in-progress", "completed"] as const).map(f => (
              <button key={f} onClick={() => setTaskFilter(f)}
                style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${taskFilter === f ? "#10b981" : "#e2e8f0"}`, background: taskFilter === f ? "rgba(16,185,129,0.08)" : "#fff", color: taskFilter === f ? "#10b981" : "#94a3b8", transition: "all 0.2s" }}>
                {f === "all" ? "All" : statusConfig[f]?.label}
              </button>
            ))}
            <button onClick={loadTasks} style={S.btnSecondary}>↻ Refresh</button>
          </div>
        </div>

        {/* Tasks Table */}
        <div style={S.tableContainer}>
          {fetchingTasks ? (
            <div style={{ textAlign: "center", padding: "52px 0" }}>
              <div style={{ width: 32, height: 32, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "52px 0", color: "#94a3b8" }}>
              <p style={{ fontSize: 15, fontWeight: 500 }}>No tasks assigned to you right now!</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead><tr><th style={S.th}>Task Description</th><th style={S.th}>Priority</th><th style={S.th}>Status</th><th style={{ ...S.th, textAlign: "right" }}>Update Progress</th></tr></thead>
                <tbody>
                  {filteredTasks.map((t, i) => (
                    <tr key={t.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.03}s`, transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{t.title}</div>
                        {t.description && <div style={{ fontSize: 13, color: "#64748b", maxWidth: 400, lineHeight: 1.5 }}>{t.description}</div>}
                      </td>
                      <td style={S.td}><span style={S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`)}>{t.priority}</span></td>
                      <td style={S.td}>
                        <span style={S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent")}>
                          {statusConfig[t.status]?.label}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
                            style={{ padding: "8px 32px 8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", transition: "all 0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "#94a3b8"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
                          >
                            <option value="pending">Mark Pending</option>
                            <option value="in-progress">Start Progress</option>
                            <option value="completed">Mark Completed</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
