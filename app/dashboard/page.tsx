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

// Responsive hook
function useWindowSize() {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 1200 });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

export default function DashboardPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

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

  // Close sidebar on desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

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

  const SIDEBAR_WIDTH = 260;

  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc" } as React.CSSProperties,
    sidebar: { 
      width: SIDEBAR_WIDTH, 
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", 
      display: "flex", 
      flexDirection: "column" as const, 
      padding: "24px 16px", 
      position: "fixed" as const, 
      top: 0, 
      left: 0, 
      bottom: 0, 
      zIndex: 100, 
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      transform: (!isDesktop && !sidebarOpen) ? "translateX(-100%)" : "translateX(0)",
    } as React.CSSProperties,
    sidebarMobileOverlay: { 
      position: "fixed" as const, 
      inset: 0, 
      background: "rgba(0,0,0,0.5)", 
      zIndex: 99, 
      backdropFilter: "blur(4px)",
      display: (!isDesktop && sidebarOpen) ? "block" : "none",
    } as React.CSSProperties,
    main: { 
      flex: 1, 
      marginLeft: isDesktop ? SIDEBAR_WIDTH : 0, 
      padding: isMobile ? "80px 16px 32px" : "28px 32px 32px", 
      minHeight: "100vh", 
      transition: "margin-left 0.3s" 
    } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      {/* Sidebar Overlay */}
      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

      <aside style={S.sidebar}>
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
          {(userData?.role === "manager" || userData?.role === "employee") && (
            <button onClick={() => router.push("/dashboard/inventory")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Inventory
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
      <main className="animate-fade-in-up" style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!isDesktop && (
              <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>☰</button>
            )}
            <button onClick={loadTasks} style={S.btnIcon}>↻</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="dash-stats-grid" style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)", 
          gap: 16, 
          marginBottom: 24 
        }}>
          <div className="dash-stat-card" style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="dash-stat-icon" style={{ background: `${roleColors[currentRole]}12`, color: roleColors[currentRole], width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{currentRole[0].toUpperCase()}</div>
            <div className="dash-stat-value" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{currentName}</div>
            <div className="dash-stat-label" style={{ fontSize: 12, color: "#94a3b8" }}>{currentEmail}</div>
          </div>
          {[
            { label: "Pending", value: pendingTasks.length, color: "#f59e0b" },
            { label: "In Progress", value: inProgressTasks.length, color: "#6366f1" },
            { label: "Completed", value: completedTasks.length, color: "#22c55e" },
          ].map((s) => (
            <div key={s.label} className="dash-stat-card" style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="dash-stat-icon" style={{ background: `${s.color}12`, color: s.color, width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{s.label[0]}</div>
              <div className="dash-stat-value" style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{s.value}</div>
              <div className="dash-stat-label" style={{ fontSize: 12, color: "#94a3b8" }}>{s.label} Tasks</div>
            </div>
          ))}
        </div>

        {/* My Tasks */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>My Assigned Tasks</h2>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", background: "#f1f5f9", color: "#64748b", borderRadius: 20 }}>{tasks.length} Total</span>
          </div>

          <div style={{ padding: isMobile ? "12px" : "24px" }}>
            {fetchingTasks ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ width: 28, height: 28, margin: "0 auto 12px", border: "3px solid #f3f4f6", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading your tasks...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                <p style={{ fontSize: 40, marginBottom: 8 }}>✅</p>
                <p style={{ fontSize: 15, fontWeight: 500 }}>All caught up! No tasks assigned.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {tasks.map((t, i) => (
                  <div key={t.id} style={{
                    padding: isMobile ? "16px" : "18px 24px",
                    borderRadius: 12,
                    background: t.status === "completed" ? "#f8fafc" : "#fff",
                    border: "1px solid #f1f5f9",
                    display: "flex", 
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "flex-start" : "center", 
                    gap: 16,
                    transition: "all 0.2s",
                    opacity: t.status === "completed" ? 0.7 : 1
                  }}>
                    <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ 
                          padding: "3px 8px", 
                          borderRadius: 6, 
                          fontSize: 10, 
                          fontWeight: 700, 
                          textTransform: "uppercase",
                          background: `${priorityColors[t.priority]}15`, 
                          color: priorityColors[t.priority] 
                        }}>{t.priority}</span>
                        <h3 style={{ 
                          fontSize: 15, 
                          fontWeight: 600, 
                          color: t.status === "completed" ? "#94a3b8" : "#1e293b",
                          textDecoration: t.status === "completed" ? "line-through" : "none",
                          margin: 0
                        }}>{t.title}</h3>
                      </div>
                      {t.description && <p style={{ fontSize: 13, color: "#64748b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{t.description}</p>}
                    </div>

                    <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "flex-end" : "center" }}>
                      {t.status === "pending" && (
                        <button onClick={() => markInProgress(t.id)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: isMobile ? 1 : "none" }}>Start Task</button>
                      )}
                      {t.status === "in-progress" && (
                        <button onClick={() => markDone(t.id)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: isMobile ? 1 : "none" }}>Complete</button>
                      )}
                      {t.status === "completed" && (
                        <div style={{ padding: "8px 16px", borderRadius: 10, background: "#f1f5f9", color: "#22c55e", fontSize: 13, fontWeight: 700 }}>✓ Done</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
