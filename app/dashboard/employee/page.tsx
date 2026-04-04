"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ref, get, update, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../lib/firebase";
import PartyRateTab from "../admin/PartyRateTab";
import { PartyRate } from "../admin/types";
import { Product } from "../inventory/types";
import { getStyles } from "../admin/styles";
import { useData } from "../../context/DataContext";
import MessagingTab from "../../components/MessagingTab";
import NotificationBell from "../../components/NotificationBell";

interface Task {
  id: string; title: string; description: string;
  assignedTo: string; assignedToName: string; assignedToRole: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  completedAt?: number; createdAt: number;
  createdBy?: string; createdByName?: string;
  attachments?: { name: string; url: string }[];
}

const roleBg: Record<string, string> = { admin: "linear-gradient(135deg,#ef4444,#f97316)", manager: "linear-gradient(135deg,#f59e0b,#fbbf24)", employee: "linear-gradient(135deg,#10b981,#34d399)", user: "linear-gradient(135deg,#3b82f6,#60a5fa)" };
const priorityColors: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  "in-progress": { label: "In Progress", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  completed: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

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

export default function EmployeePage() {
  const { user, userData, logout, loading } = useAuth();
  const { users } = useData();
  const router = useRouter();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");
  const [view, setView] = useState<"tasks" | "party-rates" | "messages">("tasks");
  const [partyRates, setPartyRates] = useState<PartyRate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchingPartyRates, setFetchingPartyRates] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && (userData.role !== "employee" && userData.role !== "manager")) {
      if (userData.role === "admin") router.replace("/dashboard/admin");
      else router.replace("/dashboard/user");
    }
  }, [loading, user, userData, router]);

  // Close sidebar on desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const loadPartyRates = useCallback(async () => {
    if (!userData?.permissions?.includes("party-rates")) return;
    setFetchingPartyRates(true);
    try {
      const [rateSnap, prodSnap] = await Promise.all([
        get(ref(db, "partyRates")),
        get(ref(db, "inventory"))
      ]);
      const rates: PartyRate[] = [];
      if (rateSnap.exists()) rateSnap.forEach(d => { rates.push({ id: d.key!, ...d.val() }); });
      setPartyRates(rates);

      const prods: Product[] = [];
      if (prodSnap.exists()) prodSnap.forEach(d => { prods.push({ id: d.key!, ...d.val() }); });
      setProducts(prods);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingPartyRates(false);
    }
  }, [userData]);

  useEffect(() => {
    if (!user) return;
    setFetchingTasks(true);
    const unsubscribe = onValue(ref(db, "tasks"), (s) => {
      const l: Task[] = []; 
      if (s.exists()) {
        s.forEach(d => { 
          const val = d.val();
          if (val && val.assignedTo === user.uid) {
            l.push({ id: d.key as string, ...val } as Task); 
          }
        });
      }
      l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); 
      setTasks(l);
      setFetchingTasks(false);
    }, (err) => {
      console.error(err);
      setFetchingTasks(false);
    });

    const chatsRef = ref(db, `user_chats/${user.uid}`);
    const unsubscribeChats = onValue(chatsRef, (snapshot) => {
      let total = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          total += (child.val().unreadCount || 0);
        });
      }
      setUnreadCount(total);
    });

    loadPartyRates();
    return () => {
      unsubscribe();
      unsubscribeChats();
    };
  }, [user, loadPartyRates]);

  if (loading || !user || !userData) return null;
  if (userData.role !== "employee" && userData.role !== "manager") return null;

  const currentName = userData.name || "Employee";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const handleTaskStatus = async (id: string, status: Task["status"]) => {
    const upd: Record<string, unknown> = { status }; if (status === "completed") upd.completedAt = Date.now();
    try { await update(ref(db, `tasks/${id}`), upd); setTasks(tasks.map(t => t.id === id ? { ...t, status, ...(status === "completed" ? { completedAt: Date.now() } : {}) } : t)); } catch (e) { console.error(e); }
  };

  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter(t => t.status === taskFilter);
  const taskStats = { total: tasks.length, pending: tasks.filter(t => t.status === "pending").length, inProgress: tasks.filter(t => t.status === "in-progress").length, completed: tasks.filter(t => t.status === "completed").length };
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

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
      padding: isMobile ? "70px 16px 32px" : "28px 32px 32px", 
      minHeight: "100vh", 
      transition: "margin-left 0.3s" 
    } as React.CSSProperties,
    btnSecondary: { padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,
    statCard: (gradient: string) => ({
      background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.25s ease", position: "relative" as const, overflow: "hidden" as const,
    }),
    statStripe: (gradient: string) => ({
      position: "absolute" as const, top: 0, left: 0, right: 0, height: 4, background: gradient, borderRadius: "16px 16px 0 0",
    }),
    badge: (color: string, bg: string) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 400, color, background: bg, border: `1px solid ${color}20` }),
    th: { padding: "12px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 400, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" } as React.CSSProperties,
    td: { padding: "16px", fontSize: 14, color: "#1e293b", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,
  };

  const adminStyles = getStyles(isMobile, isTablet, isDesktop, sidebarOpen);


  return (
    <div style={S.page}>
      {/* Mobile overlay */}
      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

      {/* =================== SIDEBAR =================== */}
      <aside style={S.sidebar}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 400, color: "#fff", letterSpacing: "-0.01em" }}>EURUS LIFESTYLE</div>
            <div style={{ fontSize: 10, color: "#34d399", fontWeight: 400, textTransform: "capitalize", letterSpacing: "0.15em" }}>Employee Portal</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 400, color: "#475569", textTransform: "capitalize", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Dashboard
          </button>
          
          <button onClick={() => setView("tasks")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: view === "tasks" ? "rgba(16,185,129,0.15)" : "transparent", color: view === "tasks" ? "#6ee7b7" : "#94a3b8", fontSize: 14, fontWeight: view === "tasks" ? 600 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: view === "tasks" ? "3px solid #34d399" : "none", paddingLeft: view === "tasks" ? 11 : 14 }}>
            My Tasks
            {taskStats.pending > 0 && <span style={{ marginLeft: "auto", background: "rgba(52,211,153,0.2)", color: "#a7f3d0", fontSize: 11, fontWeight: 400, padding: "2px 8px", borderRadius: 12, minWidth: 24, textAlign: "center" }}>{taskStats.pending}</span>}
          </button>

          {userData?.permissions?.includes("party-rates") && (
            <button onClick={() => setView("party-rates")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: view === "party-rates" ? "rgba(16,185,129,0.15)" : "transparent", color: view === "party-rates" ? "#6ee7b7" : "#94a3b8", fontSize: 14, fontWeight: view === "party-rates" ? 600 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: view === "party-rates" ? "3px solid #34d399" : "none", paddingLeft: view === "party-rates" ? 11 : 14 }}>
              Party Rates
            </button>
          )}

          <button onClick={() => setView("messages")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: view === "messages" ? "rgba(16,185,129,0.15)" : "transparent", color: view === "messages" ? "#6ee7b7" : "#94a3b8", fontSize: 14, fontWeight: view === "messages" ? 600 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: view === "messages" ? "3px solid #34d399" : "none", paddingLeft: view === "messages" ? 11 : 14 }}>
            Messages
            {unreadCount > 0 && (
              <span style={{ 
                marginLeft: "auto", background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, 
                padding: "2px 6px", borderRadius: 10, minWidth: 18, textAlign: "center", border: "1px solid #0f172a" 
              }}>{unreadCount}</span>
            )}
          </button>

          {userData?.permissions?.includes("retail_view") && (
            <button onClick={() => router.push("/dashboard/retail-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Retail Dispatch
            </button>
          )}

          {userData?.permissions?.includes("ecom_view") && (
            <button onClick={() => router.push("/dashboard/ecom-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Ecommerce Dispatch
            </button>
          )}

          {userData?.permissions?.includes("inventory_view") && (
            <button onClick={() => router.push("/dashboard/inventory")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Inventory
            </button>
          )}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleBg[userData.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 15, color: "#fff", textTransform: "uppercase" }}>{currentName[0] || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 400, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#34d399", fontWeight: 400, textTransform: "capitalize" }}>{userData.role}</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* =================== MAIN =================== */}
      <main style={S.main}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}!</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 400 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <NotificationBell />
            {!isDesktop && <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>☰</button>}
          </div>
        </div>

        {/* ========== STATS ========== */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "My Tasks", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
            { label: "Pending", value: taskStats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
            { label: "In Progress", value: taskStats.inProgress, gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
            { label: "Completed", value: taskStats.completed, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
          ].map(s => (
            <div key={s.label} style={S.statCard(s.gradient)}>
              <div style={S.statStripe(s.gradient)} />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: 14 }} />
              <div style={{ fontSize: 30, fontWeight: 400, color: "#0f172a", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {view === "tasks" ? (
          <>
            {/* Action bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: 0 }}>Assigned to Me</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {!isMobile && (["all", "pending", "in-progress", "completed"] as const).map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${taskFilter === f ? "#10b981" : "#e2e8f0"}`, background: taskFilter === f ? "rgba(16,185,129,0.08)" : "#fff", color: taskFilter === f ? "#10b981" : "#94a3b8", transition: "all 0.2s" }}>
                    {f === "all" ? "All" : statusConfig[f]?.label}
                  </button>
                ))}
                {isMobile && (
                  <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as any)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                )}
              </div>
            </div>

            {/* Tasks List/Table */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              {fetchingTasks ? (
                <div style={{ textAlign: "center", padding: "52px 0" }}>
                  <div style={{ width: 32, height: 32, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading tasks...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 0", color: "#94a3b8" }}>
                  <p style={{ fontSize: 15, fontWeight: 400 }}>No tasks assigned to you right now!</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  {isMobile ? (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {filteredTasks.map((t) => (
                        <div key={t.id} style={{ padding: "16px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ ...S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`), textTransform: "capitalize" }}>{t.priority}</span>
                            <span style={S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent")}>{statusConfig[t.status]?.label}</span>
                          </div>
                          <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 15, marginBottom: 4 }}>{t.title}</div>
                          {t.description && <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 12 }}>{t.description}</div>}
                          {t.attachments && t.attachments.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                              {t.attachments.map((at, idx) => (
                                <a key={idx} href={at.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: "#f1f5f9", borderRadius: 6, fontSize: 10, color: "#6366f1", textDecoration: "none", border: "1px solid #e2e8f0" }}>
                                  📎 {at.name.length > 15 ? at.name.slice(0, 12) + "..." : at.name}
                                </a>
                              ))}
                            </div>
                          )}
                          {t.createdByName && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>Assigned by: <span style={{ fontWeight: 400, color: "#64748b" }}>{t.createdByName}</span></div>}
                          <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
                            style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, fontWeight: 400, background: "#f8fafc" }}>
                            <option value="pending">Mark Pending</option>
                            <option value="in-progress">Start Progress</option>
                            <option value="completed">Mark Completed</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead><tr><th style={S.th}>Task Description</th><th style={S.th}>Priority</th><th style={S.th}>Status</th><th style={{ ...S.th, textAlign: "right" }}>Update Progress</th></tr></thead>
                      <tbody>
                        {filteredTasks.map((t) => (
                          <tr key={t.id} style={{ transition: "background 0.15s" }}>
                            <td style={S.td}>
                              <div style={{ fontWeight: 400, color: "#1e293b", marginBottom: 2 }}>{t.title}</div>
                              {t.description && <div style={{ fontSize: 13, color: "#64748b", maxWidth: 400, lineHeight: 1.5 }}>{t.description}</div>}
                              {t.attachments && t.attachments.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                  {t.attachments.map((at, idx) => (
                                    <a key={idx} href={at.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", background: "#f8fafc", borderRadius: 6, fontSize: 10, color: "#6366f1", textDecoration: "none", border: "1px solid #e2e8f0" }}>
                                      📎 {at.name.length > 15 ? at.name.slice(0, 12) + "..." : at.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                              {t.createdByName && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Assigned by: {t.createdByName}</div>}
                            </td>
                            <td style={S.td}><span style={{ ...S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`), textTransform: "capitalize" }}>{t.priority}</span></td>
                            <td style={S.td}>
                              <span style={S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent")}>
                                {statusConfig[t.status]?.label}
                              </span>
                            </td>
                            <td style={{ ...S.td, textAlign: "right" }}>
                              <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
                                style={{ padding: "8px 12px", fontSize: 13, fontWeight: 400, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>
                                <option value="pending">Mark Pending</option>
                                <option value="in-progress">Start Progress</option>
                                <option value="completed">Mark Completed</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        ) : view === "party-rates" ? (
          <PartyRateTab 
            S={adminStyles}
            isMobile={isMobile}
            isTablet={isTablet}
            partyRates={partyRates}
            products={products}
            fetching={fetchingPartyRates}
            isAdmin={false}
            loadData={loadPartyRates}
          />
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "2px" }}>
            <MessagingTab users={users} isMobile={isMobile} />
          </div>
        )}

      </main>
      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
