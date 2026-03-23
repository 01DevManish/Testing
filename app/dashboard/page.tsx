"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { UserRole } from "../context/AuthContext";

interface UserRecord { uid: string; email: string; name: string; role: UserRole; }

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  createdAt: Timestamp;
}

const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };
const roleIcons: Record<string, string> = { admin: "", manager: "", employee: "" };
const priorityColors: Record<string, string> = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };

export default function DashboardPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [employees, setEmployees] = useState<UserRecord[]>([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth guard + admin redirect
  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData?.role === "admin") router.replace("/dashboard/admin");
  }, [loading, user, userData, router]);

  const currentRole = userData?.role || "employee";
  const currentName = userData?.name || user?.name || "User";
  const currentEmail = userData?.email || user?.email || "";
  const currentUid = userData?.uid || user?.uid || "";

  // Load tasks assigned to me
  const loadTasks = useCallback(async () => {
    if (!currentUid) return;
    setFetchingTasks(true);
    try {
      const q = query(collection(db, "tasks"), where("assignedTo", "==", currentUid));
      const snapshot = await getDocs(q);
      const list: Task[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Task));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTasks(list);
    } catch (err) { console.error(err); }
    finally { setFetchingTasks(false); }
  }, [currentUid]);

  // Manager: load employees
  const loadEmployees = useCallback(async () => {
    if (currentRole !== "manager") { setFetchingEmployees(false); return; }
    setFetchingEmployees(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "employee"));
      const snapshot = await getDocs(q);
      const list: UserRecord[] = [];
      snapshot.forEach((d) => list.push(d.data() as UserRecord));
      setEmployees(list);
    } catch (err) { console.error(err); }
    finally { setFetchingEmployees(false); }
  }, [currentRole]);

  useEffect(() => { loadTasks(); loadEmployees(); }, [loadTasks, loadEmployees]);

  // Mark task as done
  const markDone = async (taskId: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: "completed", completedAt: Timestamp.now() });
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: "completed" } : t));
    } catch (err) { console.error(err); }
  };

  // Start working on task
  const markInProgress = async (taskId: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: "in-progress" });
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: "in-progress" } : t));
    } catch (err) { console.error(err); }
  };

  if (loading) return null;
  if (!user) return null;
  if (userData?.role === "admin") return null;

  const handleLogout = async () => { await logout(); router.replace("/"); };

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };
  const greeting = getGreeting();

  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc" } as React.CSSProperties,
    sidebar: { width: 260, background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", display: "flex", flexDirection: "column" as const, padding: "24px 16px", position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 100, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)" } as React.CSSProperties,
    sidebarMobileOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99, backdropFilter: "blur(4px)" } as React.CSSProperties,
    main: { flex: 1, marginLeft: 260, padding: "28px 32px 32px", minHeight: "100vh", transition: "margin-left 0.3s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      {sidebarOpen && <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />}

      <aside style={{ ...S.sidebar, ...(typeof window !== "undefined" && window.innerWidth < 768 && !sidebarOpen ? { transform: "translateX(-100%)" } : {}) }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>{currentRole === "manager" ? "Manager Panel" : "Employee Portal"}</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #818cf8", paddingLeft: 11 }}>
            Dashboard
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
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleColors[currentRole] || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>{currentName[0]?.toUpperCase() || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, textTransform: "capitalize" }}>{currentRole}</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="animate-fade-in-up" style={{ ...S.main, ...(typeof window !== "undefined" && window.innerWidth < 768 ? { marginLeft: 0, padding: "80px 16px 24px" } : {}) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ ...S.btnIcon, display: typeof window !== "undefined" && window.innerWidth < 768 ? "flex" : "none" }}>☰</button>
          </div>
        </div>

        {/* Profile + Task Stats */}
        <div className="dash-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="dash-stat-card" style={{ gridColumn: "span 1" }}>
            <div className="dash-stat-icon" style={{ background: `${roleColors[currentRole]}12`, color: roleColors[currentRole] }}>{roleIcons[currentRole]}</div>
            <div className="dash-stat-value" style={{ fontSize: 16 }}>{currentName}</div>
            <div className="dash-stat-label">{currentEmail}</div>
          </div>
          {[
            { label: "Pending", value: pendingTasks.length, color: "#f59e0b", icon: "" },
            { label: "In Progress", value: inProgressTasks.length, color: "#6366f1", icon: "" },
            { label: "Completed", value: completedTasks.length, color: "#22c55e", icon: "" },
          ].map((s) => (
            <div key={s.label} className="dash-stat-card">
              <div className="dash-stat-icon" style={{ background: `${s.color}12`, color: s.color }}>{s.icon}</div>
              <div className="dash-stat-value">{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Manager: Employees */}
        {currentRole === "manager" && (
          <div className="dash-card" style={{ marginBottom: 24 }}>
            <div className="dash-card-header">
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>My Team</h2>
              <button onClick={loadEmployees} className="dash-action-btn" style={{ width: "auto", padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>↻</button>
            </div>
            {fetchingEmployees ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}><div className="spinner" style={{ width: 24, height: 24, margin: "0 auto", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} /></div>
            ) : employees.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 14 }}>No employees found</div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead><tr><th>Employee</th><th>Email</th></tr></thead>
                  <tbody>
                    {employees.map((u) => (
                      <tr key={u.uid}>
                        <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="dash-avatar-sm" style={{ background: `linear-gradient(135deg, ${roleColors.employee}, ${roleColors.employee}80)` }}>{u.name?.[0]?.toUpperCase() || "U"}</div><span style={{ fontWeight: 600 }}>{u.name}</span></div></td>
                        <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* My Tasks */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>My Tasks</h2>
            <button onClick={loadTasks} className="dash-action-btn" style={{ width: "auto", padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>↻</button>
          </div>

          {fetchingTasks ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}><div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 12px", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} /><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading tasks...</p></div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}><p style={{ fontSize: 14 }}>No tasks assigned yet</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px" }}>
              {tasks.map((t, i) => (
                <div key={t.id} className="animate-fade-in-up" style={{
                  animationDelay: `${i * 0.05}s`,
                  padding: "16px 20px",
                  borderRadius: "var(--radius-sm)",
                  background: t.status === "completed" ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${t.status === "completed" ? "rgba(34,197,94,0.15)" : "var(--border-color)"}`,
                  display: "flex", alignItems: "center", gap: 16, transition: "all 0.2s",
                }}>
                  {/* Status indicator */}
                  <div style={{ width: 36, height: 36, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: t.status === "completed" ? "rgba(34,197,94,0.12)" : t.status === "in-progress" ? "rgba(99,102,241,0.12)" : "rgba(245,158,11,0.12)", fontSize: 18 }}>
                    {t.status === "completed" ? "" : t.status === "in-progress" ? "" : ""}
                  </div>

                  {/* Task info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: t.status === "completed" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: t.status === "completed" ? "line-through" : "none", marginBottom: 2 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
                  </div>

                  {/* Priority */}
                  <span style={{ padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: `${priorityColors[t.priority]}15`, color: priorityColors[t.priority], border: `1px solid ${priorityColors[t.priority]}25`, textTransform: "capitalize", flexShrink: 0 }}>{t.priority}</span>

                  {/* Action buttons */}
                  {t.status === "pending" && (
                    <button onClick={() => markInProgress(t.id)} style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "var(--accent-primary-light)", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                      Start
                    </button>
                  )}
                  {t.status === "in-progress" && (
                    <button onClick={() => markDone(t.id)} style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                      Mark Done
                    </button>
                  )}
                  {t.status === "completed" && (
                    <span style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Done</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
