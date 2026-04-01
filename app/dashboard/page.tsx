"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ref, get, update, remove, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../lib/firebase";
import type { UserRole } from "../context/AuthContext";
import PartyRateTab from "./admin/PartyRateTab";
import { PartyRate } from "./admin/types";
import { Product } from "./inventory/types";
import { getStyles } from "./admin/styles";
import ProfileTab from "./admin/ProfileTab";

interface UserRecord { uid: string; email: string; name: string; role: UserRole; }

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  createdAt: number;
  expiresAt?: number;
  completedAt?: number;
  createdBy?: string;
  createdByName?: string;
  attachments?: { name: string; url: string }[];
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
  const [view, setView] = useState<"dashboard" | "party-rates" | "profile">("dashboard");
  const [partyRates, setPartyRates] = useState<PartyRate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchingPartyRates, setFetchingPartyRates] = useState(false);

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

  // Load tasks assigned to me real-time
  useEffect(() => {
    if (!currentUid) return;
    setFetchingTasks(true);
    const unsubscribe = onValue(ref(db, "tasks"), (snapshot) => {
      const list: Task[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((d) => { 
          const val = d.val();
          if (val && val.assignedTo === currentUid) {
            list.push({ id: d.key as string, ...val } as Task); 
          }
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTasks(list);
      setFetchingTasks(false);
    }, (err) => {
      console.error(err);
      setFetchingTasks(false);
    });
    return () => unsubscribe();
  }, [currentUid]);

  // Manager: load employees
  const loadEmployees = useCallback(async () => {
    if (currentRole !== "manager") { setFetchingEmployees(false); return; }
    setFetchingEmployees(true);
    try {
      const q = query(ref(db, "users"), orderByChild("role"), equalTo("employee"));
      const snapshot = await get(q);
      const list: UserRecord[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((d) => { list.push(d.val() as UserRecord); });
      }
      setEmployees(list);
    } catch (err) { console.error(err); }
    finally { setFetchingEmployees(false); }
  }, [currentRole]);

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
    loadEmployees(); 
    loadPartyRates();
  }, [loadEmployees, loadPartyRates]);

  // Mark task as done
  const markDone = async (taskId: string) => {
    try {
      await update(ref(db, `tasks/${taskId}`), { status: "completed", completedAt: Date.now() });
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: "completed" } : t));
    } catch (err) { console.error(err); }
  };

  // Start working on task
  const markInProgress = async (taskId: string) => {
    try {
      await update(ref(db, `tasks/${taskId}`), { status: "in-progress" });
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

  const adminStyles = getStyles(isMobile, isTablet, isDesktop, sidebarOpen);


  return (
    <div style={S.page}>
      {/* Sidebar Overlay */}
      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

      <aside style={S.sidebar}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 400, color: "#fff", letterSpacing: "-0.01em" }}>EURUS LIFESTYLE</div>
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.15em" }}>{currentRole === "manager" ? "Manager Panel" : "Employee Portal"}</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 400, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setView("dashboard")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: view === "dashboard" ? "rgba(99,102,241,0.15)" : "transparent", color: view === "dashboard" ? "#a5b4fc" : "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: view === "dashboard" ? "3px solid #818cf8" : "none", paddingLeft: view === "dashboard" ? 11 : 14 }}>
            Dashboard
          </button>

          {userData?.permissions?.includes("party-rates") && (
            <button onClick={() => setView("party-rates")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: view === "party-rates" ? "rgba(99,102,241,0.15)" : "transparent", color: view === "party-rates" ? "#a5b4fc" : "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: view === "party-rates" ? "3px solid #818cf8" : "none", paddingLeft: view === "party-rates" ? 11 : 14 }}>
              Party Rates
            </button>
          )}
          
          {((userData?.role as string) === "admin" || userData?.permissions?.includes("dispatch")) && (
            <>
              <button onClick={() => router.push("/dashboard/retail-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
                Retail Dispatch
              </button>
              <button onClick={() => router.push("/dashboard/ecom-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
                Ecommerce Dispatch
              </button>
            </>
          )}
          {((userData?.role as string) === "admin" || userData?.permissions?.includes("inventory")) && (
            <button onClick={() => router.push("/dashboard/inventory")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Inventory
            </button>
          )}
          
          <button onClick={() => setView("profile")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: view === "profile" ? "rgba(99,102,241,0.15)" : "transparent", color: view === "profile" ? "#a5b4fc" : "#94a3b8", fontSize: 14, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: view === "profile" ? "3px solid #818cf8" : "none", paddingLeft: view === "profile" ? 11 : 14 }}>
            My Profile
          </button>
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {userData?.profilePic ? (
              <img src={userData.profilePic} alt="DP" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: roleColors[currentRole] || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 15, color: "#fff" }}>{currentName[0]?.toUpperCase() || "U"}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 400, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 400, textTransform: "capitalize" }}>{currentRole}</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="animate-fade-in-up" style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}!</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 400 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!isDesktop && (
              <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>☰</button>
            )}
          </div>
        </div>

        {view === "dashboard" ? (
          <>
            {/* Stats Grid */}
            <div className="dash-stats-grid" style={{ 
              display: "grid", 
              gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)", 
              gap: 16, 
              marginBottom: 24 
            }}>
              <div className="dash-stat-card" style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="dash-stat-icon" style={{ background: `${roleColors[currentRole]}12`, color: roleColors[currentRole], width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{currentRole[0].toUpperCase()}</div>
                <div className="dash-stat-value" style={{ fontSize: 16, fontWeight: 400, color: "#0f172a" }}>{currentName}</div>
                <div className="dash-stat-label" style={{ fontSize: 12, color: "#94a3b8" }}>{currentEmail}</div>
              </div>
              {[
                { label: "Pending", value: pendingTasks.length, color: "#f59e0b" },
                { label: "In Progress", value: inProgressTasks.length, color: "#6366f1" },
                { label: "Completed", value: completedTasks.length, color: "#22c55e" },
              ].map((s) => (
                <div key={s.label} className="dash-stat-card" style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="dash-stat-icon" style={{ background: `${s.color}12`, color: s.color, width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{s.label[0]}</div>
                  <div className="dash-stat-value" style={{ fontSize: 24, fontWeight: 400, color: "#0f172a" }}>{s.value}</div>
                  <div className="dash-stat-label" style={{ fontSize: 12, color: "#94a3b8" }}>{s.label} Tasks</div>
                </div>
              ))}
            </div>

            {/* My Tasks */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 18, fontWeight: 400, margin: 0, color: "#0f172a" }}>My Assigned Tasks</h2>
                <span style={{ fontSize: 12, fontWeight: 400, padding: "4px 10px", background: "#f1f5f9", color: "#64748b", borderRadius: 20 }}>{tasks.length} Total</span>
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
                    <p style={{ fontSize: 15, fontWeight: 400 }}>All caught up! No tasks assigned.</p>
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
                              fontWeight: 400, 
                              textTransform: "uppercase",
                              background: `${priorityColors[t.priority]}15`, 
                              color: priorityColors[t.priority] 
                            }}>{t.priority}</span>
                            <h3 style={{ 
                              fontSize: 15, 
                              fontWeight: 400, 
                              color: t.status === "completed" ? "#94a3b8" : "#1e293b",
                              textDecoration: t.status === "completed" ? "line-through" : "none",
                              margin: 0
                            }}>{t.title}</h3>
                          </div>
                          {t.description && <p style={{ fontSize: 13, color: "#64748b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap", marginBottom: 6 }}>{t.description}</p>}
                          {t.attachments && t.attachments.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                              {t.attachments.map((at, idx) => (
                                <a key={idx} href={at.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", background: "#f1f5f9", borderRadius: 6, fontSize: 11, color: "#6366f1", textDecoration: "none", border: "1px solid #e2e8f0" }}>
                                  📎 {at.name.length > 15 ? at.name.slice(0, 12) + "..." : at.name}
                                </a>
                              ))}
                            </div>
                          )}
                          {t.createdByName && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Assigned by: <span style={{ fontWeight: 400, color: "#64748b" }}>{t.createdByName}</span></div>}
                        </div>

                        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "flex-end" : "center" }}>
                          {t.status === "pending" && (
                            <button onClick={() => markInProgress(t.id)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 400, cursor: "pointer", flex: isMobile ? 1 : "none" }}>Start Task</button>
                          )}
                          {t.status === "in-progress" && (
                            <button onClick={() => markDone(t.id)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 400, cursor: "pointer", flex: isMobile ? 1 : "none" }}>Complete</button>
                          )}
                          {t.status === "completed" && (
                            <div style={{ padding: "8px 16px", borderRadius: 10, background: "#f1f5f9", color: "#22c55e", fontSize: 13, fontWeight: 400 }}>✓ Done</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : view === "profile" ? (
          <ProfileTab 
            S={adminStyles}
            isMobile={isMobile}
            isTablet={isTablet}
          />
        ) : (
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
        )}

      </main>
      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
