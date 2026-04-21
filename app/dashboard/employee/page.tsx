"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ref, get, update, onValue } from "firebase/database";
import { db } from "../../lib/firebase";
import { sendNotification } from "../../lib/notificationHelper";
import PartyRateModule from "../party-rate";
import { PartyRate } from "../admin/types";
import { getStyles } from "../admin/styles";
import { useData } from "../../context/DataContext";
import MessagingTab from "../../components/MessagingTab";
import NotificationBell from "../../components/NotificationBell";
import MobileTopBar from "../../components/MobileTopBar";
import CatalogTab from "../inventory/components/Catalog/CatalogTab";
import EmployeeSidebar from "./EmployeeSidebar";
import { hasPermission } from "@/app/lib/permissions";

interface Task {
  id: string; title: string; description: string;
  assignedTo: string; assignedToName: string; assignedToRole: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  completedAt?: number; createdAt: number;
  completionRequested?: boolean;
  completionRequestedAt?: number;
  completionRequestedBy?: string;
  completionApprovalStatus?: "none" | "requested" | "approved" | "rejected";
  lastWorkingStatus?: "pending" | "in-progress";
  createdBy?: string; createdByName?: string;
  attachments?: { name: string; url: string }[];
}

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
  const [view, setView] = useState<"tasks" | "party-rates" | "messages" | "catalog">("tasks");
  const [partyRates, setPartyRates] = useState<PartyRate[]>([]);
  const { products, categories, collections, brands, loading: fetchingGlobal } = useData();
  const [fetchingPartyRates, setFetchingPartyRates] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("employeeSidebarCollapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("employeeSidebarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "employee") {
      if (userData.role === "admin") router.replace("/dashboard/admin");
      else if (userData.role === "manager") router.replace("/dashboard/manager");
      else router.replace("/dashboard/user");
    }
  }, [loading, user, userData, router]);

  // Close sidebar on desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const loadPartyRates = useCallback(async () => {
    if (!hasPermission(userData, "party_rate_view")) return;
    setFetchingPartyRates(true);
    try {
      const rateSnap = await get(ref(db, "partyRates"));
      const rates: PartyRate[] = [];
      if (rateSnap.exists()) rateSnap.forEach(d => { rates.push({ id: d.key!, ...d.val() }); });
      setPartyRates(rates);
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

    loadPartyRates();
    return () => {
      unsubscribe();
    };
  }, [user, loadPartyRates]);

  if (loading || !user || !userData) return null;
  if (userData.role !== "employee") return null;

  const currentName = userData.name || "Employee";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const handleTaskStatus = async (id: string, status: Task["status"]) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || !user) return;

    try {
      if (status === "completed") {
        const now = Date.now();
        const baseStatus: "pending" | "in-progress" =
          task.status === "in-progress" ? "in-progress" : "pending";

        await update(ref(db, `tasks/${id}`), {
          completionRequested: true,
          completionRequestedAt: now,
          completionRequestedBy: user.uid,
          completionApprovalStatus: "requested",
          lastWorkingStatus: baseStatus,
          completedAt: null,
        });

        setTasks((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  completionRequested: true,
                  completionRequestedAt: now,
                  completionRequestedBy: user.uid,
                  completionApprovalStatus: "requested",
                  lastWorkingStatus: baseStatus,
                  completedAt: undefined,
                }
              : item
          )
        );

        const adminUids = users.filter((u) => u.role === "admin").map((u) => u.uid);
        await sendNotification(adminUids, {
          title: "Task Completion Request",
          message: `${userData?.name || "Employee"} requested completion approval for "${task.title}".`,
          type: "task",
          actorId: user.uid,
          actorName: userData?.name || "Employee",
          link: "/dashboard/admin",
        });
        return;
      }

      await update(ref(db, `tasks/${id}`), {
        status,
        completionRequested: false,
        completionApprovalStatus: "none",
        completionRequestedAt: null,
        completionRequestedBy: null,
        completedAt: null,
      });

      setTasks((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                completionRequested: false,
                completionApprovalStatus: "none",
                completionRequestedAt: undefined,
                completionRequestedBy: undefined,
                completedAt: undefined,
              }
            : item
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter(t => t.status === taskFilter);
  const taskStats = { total: tasks.length, pending: tasks.filter(t => t.status === "pending").length, inProgress: tasks.filter(t => t.status === "in-progress").length, completed: tasks.filter(t => t.status === "completed").length };
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  const S = getStyles(isMobile, isTablet, isDesktop, sidebarOpen, isCollapsed);

  return (
    <div style={S.page}>
      {/* =================== SIDEBAR =================== */}
      <EmployeeSidebar 
        currentView={view}
        setView={setView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isDesktop={isDesktop}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        userData={userData}
        handleLogout={handleLogout}
        taskStats={taskStats}
      />

      {/* =================== MAIN =================== */}
      <main style={S.main}>
        {!isDesktop ? (
          <MobileTopBar
            title={`${greeting}, ${currentName.split(" ")[0]}!`}
            subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            onMenuClick={() => setSidebarOpen(true)}
            rightSlot={<NotificationBell />}
          />
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}!</h1>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 400 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <NotificationBell />
            </div>
          </div>
        )}

        {/* ========== STATS ========== */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "My Tasks", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
            { label: "Pending", value: taskStats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
            { label: "In Progress", value: taskStats.inProgress, gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
            { label: "Completed", value: taskStats.completed, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
          ].map(s => (
            <div key={s.label} style={S.statCard}>
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
                  <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as "all" | "pending" | "in-progress" | "completed")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }}>
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
                      {filteredTasks.map((t) => {
                        const completionRequested = Boolean(t.completionRequested || t.completionApprovalStatus === "requested");
                        return (
                        <div key={t.id} style={{ padding: "16px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ ...S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`), textTransform: "capitalize" }}>{t.priority}</span>
                            <span style={S.badge(completionRequested ? "#0ea5e9" : (statusConfig[t.status]?.color || "#94a3b8"), completionRequested ? "rgba(14,165,233,0.12)" : (statusConfig[t.status]?.bg || "transparent"))}>
                              {completionRequested ? "Completion Requested" : statusConfig[t.status]?.label}
                            </span>
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
                            <option value="completed">Request Completed</option>
                          </select>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead><tr><th style={S.th}>Task Description</th><th style={S.th}>Priority</th><th style={S.th}>Status</th><th style={{ ...S.th, textAlign: "right" }}>Update Progress</th></tr></thead>
                      <tbody>
                        {filteredTasks.map((t) => {
                          const completionRequested = Boolean(t.completionRequested || t.completionApprovalStatus === "requested");
                          return (
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
                              <span style={S.badge(completionRequested ? "#0ea5e9" : (statusConfig[t.status]?.color || "#94a3b8"), completionRequested ? "rgba(14,165,233,0.12)" : (statusConfig[t.status]?.bg || "transparent"))}>
                                {completionRequested ? "Completion Requested" : statusConfig[t.status]?.label}
                              </span>
                            </td>
                            <td style={{ ...S.td, textAlign: "right" }}>
                              <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
                                style={{ padding: "8px 12px", fontSize: 13, fontWeight: 400, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>
                                <option value="pending">Mark Pending</option>
                                <option value="in-progress">Start Progress</option>
                                <option value="completed">Request Completed</option>
                              </select>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        ) : view === "party-rates" ? (
          <PartyRateModule 
            isMobile={isMobile}
            isTablet={isTablet}
            partyRates={partyRates}
            products={products}
            fetching={fetchingPartyRates}
            isAdmin={false}
            loadData={loadPartyRates}
          />
        ) : view === "messages" ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "2px" }}>
            <MessagingTab users={users} isMobile={isMobile} />
          </div>
        ) : (
          <CatalogTab 
            products={products}
            categories={categories}
            collections={collections}
            brands={brands}
            loading={fetchingGlobal}
            isMobile={isMobile}
            isDesktop={isDesktop}
            isAdmin={false}
          />
        )}

      </main>
      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
