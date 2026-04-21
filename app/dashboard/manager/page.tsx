"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ref, get, update, onValue } from "firebase/database";
import { db } from "../../lib/firebase";
import { sendNotification } from "../../lib/notificationHelper";
import ProfileTab from "../admin/ProfileTab";
import PartyRateModule from "../party-rate";
import MessagingTab from "../../components/MessagingTab";
import NotificationBell from "../../components/NotificationBell";
import MobileTopBar from "../../components/MobileTopBar";
import { useData } from "../../context/DataContext";
import CatalogTab from "../inventory/components/Catalog/CatalogTab";
import { getStyles } from "../admin/styles";
import EmployeeSidebar from "../employee/EmployeeSidebar";
import TeamTab from "./TeamTab";
import { hasPermission } from "@/app/lib/permissions";
import type { PartyRate } from "../admin/types";

interface Task {
  id: string; title: string; description: string; assignedTo: string;
  priority: "low" | "medium" | "high"; status: "pending" | "in-progress" | "completed";
  createdAt: number; createdByName?: string; attachments?: { name: string; url: string }[];
  completionRequested?: boolean;
  completionRequestedAt?: number;
  completionRequestedBy?: string;
  completionApprovalStatus?: "none" | "requested" | "approved" | "rejected";
  lastWorkingStatus?: "pending" | "in-progress";
}

const statusConfig = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  "in-progress": { label: "In Progress", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  completed: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

export default function ManagerPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"dashboard" | "tasks" | "team" | "party-rates" | "messages" | "catalog" | "profile">("dashboard");
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("managerSidebarCollapsed") === "true";
    return false;
  });

  const { products, categories, collections, brands, loading: fetchingGlobal, users } = useData();
  const [partyRates, setPartyRates] = useState<PartyRate[]>([]);
  const [fetchingPartyRates, setFetchingPartyRates] = useState(false);

  useEffect(() => { localStorage.setItem("managerSidebarCollapsed", isCollapsed.toString()); }, [isCollapsed]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "manager" && userData.role !== "admin") {
       router.replace("/dashboard");
    }
  }, [loading, user, userData, router]);

  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 640;
  const isDesktop = windowWidth >= 1024;

  const currentName = userData?.name || "Manager";

  // Load tasks
  useEffect(() => {
    if (!user) return;
    setFetchingTasks(true);
    const unsubscribe = onValue(ref(db, "tasks"), (snapshot) => {
      const list: Task[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((d) => {
          const val = d.val();
          if (val.assignedTo === user.uid) list.push({ id: d.key!, ...val });
        });
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      setTasks(list);
      setFetchingTasks(false);
    });
    return () => unsubscribe();
  }, [user]);

  const loadPartyRates = useCallback(async () => {
    if (!hasPermission(userData, "party_rate_view")) return;
    setFetchingPartyRates(true);
    try {
      const snap = await get(ref(db, "partyRates"));
      const list: PartyRate[] = [];
      if (snap.exists()) snap.forEach(d => { list.push({ id: d.key, ...d.val() }); });
      setPartyRates(list);
    } catch (e) { console.error(e); } finally { setFetchingPartyRates(false); }
  }, [userData]);

  useEffect(() => { if (view === "party-rates") loadPartyRates(); }, [view, loadPartyRates]);

  const handleLogout = async () => { await logout(); router.replace("/"); };

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
  };

  const filteredTasks = tasks.filter(t => taskFilter === "all" || t.status === taskFilter);
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
                }
              : item
          )
        );

        const adminUids = users.filter((u) => u.role === "admin").map((u) => u.uid);
        await sendNotification(adminUids, {
          title: "Task Completion Request",
          message: `${userData?.name || "Manager"} requested completion approval for "${task.title}".`,
          type: "task",
          actorId: user.uid,
          actorName: userData?.name || "Manager",
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
              }
            : item
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const S = getStyles(isMobile, false, isDesktop, sidebarOpen, isCollapsed);

  if (loading || !user) return null;
  if (!userData) return null;
  if (userData.role !== "manager" && userData.role !== "admin") return null;

  return (
    <div style={S.page}>
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

      <main style={S.main}>
        {/* Top bar */}
        {!isDesktop ? (
          <MobileTopBar
            title={`Portal Dashboard, ${currentName.split(" ")[0]}!`}
            subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            onMenuClick={() => setSidebarOpen(true)}
            rightSlot={<NotificationBell />}
          />
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0 }}>Portal Dashboard, {currentName.split(" ")[0]}!</h1>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <NotificationBell />
            </div>
          </div>
        )}

        {view === "dashboard" && (
           <>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "My Tasks", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
                  { label: "Pending", value: taskStats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
                  { label: "Status", value: "Manager", gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
                  { label: "Role", value: "Privileged", gradient: "linear-gradient(135deg,#10b981,#34d399)" },
                ].map(s => (
                  <div key={s.label} style={S.statCard}>
                    <div style={S.statStripe(s.gradient)} />
                    <div style={{ fontSize: 28, fontWeight: 400, color: "#0f172a", marginBottom: 4 }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <TeamTab isMobile={isMobile} managerUid={user.uid} />
           </>
        )}

        {view === "tasks" && (
          <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
             <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 16 }}>Assigned to Me</h2>
             <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              {(["all", "pending", "in-progress", "completed"] as const).map(f => (
                <button key={f} onClick={() => setTaskFilter(f)}
                  style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${taskFilter === f ? "#f59e0b" : "#e2e8f0"}`, background: taskFilter === f ? "rgba(245,158,11,0.08)" : "#fff", color: taskFilter === f ? "#f59e0b" : "#94a3b8", transition: "all 0.2s" }}>
                  {f === "all" ? "All" : statusConfig[f]?.label}
                </button>
              ))}
             </div>
             <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
                {fetchingTasks ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>Loading tasks...</div>
                ) : filteredTasks.length === 0 ? (
                  "No tasks found"
                ) : filteredTasks.map(t => {
                  const completionRequested = Boolean(t.completionRequested || t.completionApprovalStatus === "requested");
                  return (
                  <div key={t.id} style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 15, color: "#1e293b" }}>{t.title}</div>
                      <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, color: completionRequested ? "#0ea5e9" : (statusConfig[t.status]?.color || "#94a3b8"), background: completionRequested ? "rgba(14,165,233,0.12)" : (statusConfig[t.status]?.bg || "transparent") }}>
                        {completionRequested ? "Completion Requested" : statusConfig[t.status]?.label}
                      </span>
                    </div>
                    {t.description ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{t.description}</div> : null}
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                      <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
                        style={{ padding: "8px 12px", fontSize: 13, fontWeight: 400, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>
                        <option value="pending">Mark Pending</option>
                        <option value="in-progress">Start Progress</option>
                        <option value="completed">Request Completed</option>
                      </select>
                    </div>
                  </div>
                )})}
             </div>
          </div>
        )}

        {view === "team" && <TeamTab isMobile={isMobile} managerUid={user.uid} />}

        {view === "party-rates" && (
            <PartyRateModule 
              isMobile={isMobile} isTablet={false} 
              partyRates={partyRates} products={products} fetching={fetchingPartyRates} 
              isAdmin={false} loadData={loadPartyRates}
            />
        )}

        {view === "messages" && <MessagingTab users={users} isMobile={isMobile} />}
        {view === "catalog" && <CatalogTab products={products} categories={categories} collections={collections} brands={brands} loading={fetchingGlobal} isMobile={isMobile} isDesktop={isDesktop} isAdmin={false} />}
        {view === "profile" && <ProfileTab S={S} isMobile={isMobile} isTablet={false} />}
      </main>

      <style jsx global>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
