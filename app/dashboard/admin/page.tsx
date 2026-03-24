"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../../lib/firebase";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { initializeApp, getApps, getApp } from "firebase/app";
import type { UserRole } from "../../context/AuthContext";

interface UserRecord { uid: string; email: string; name: string; role: UserRole; permissions?: string[]; }
interface Task {
  id: string; title: string; description: string;
  assignedTo: string; assignedToName: string; assignedToRole: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  completedAt?: Timestamp; createdAt: Timestamp;
}

const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#10b981" };
const roleBg: Record<string, string> = { admin: "linear-gradient(135deg,#ef4444,#f97316)", manager: "linear-gradient(135deg,#f59e0b,#fbbf24)", employee: "linear-gradient(135deg,#10b981,#34d399)" };
const roleIcons: Record<string, string> = { admin: "Admin", manager: "Mgr", employee: "Emp" };
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

export default function AdminPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const [tab, setTab] = useState<"users" | "tasks">("users");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | UserRole>("all");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("employee");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", password: "", role: "employee" as UserRole, permissions: [] as string[] });
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [addError, setAddError] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", assignedTo: "", priority: "medium" as "low" | "medium" | "high" });
  const [savingTask, setSavingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "admin") router.replace("/dashboard");
  }, [loading, user, userData, router]);

  // Close sidebar on desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const loadUsers = useCallback(async () => {
    setFetchingUsers(true);
    try { const s = await getDocs(collection(db, "users")); const l: UserRecord[] = []; s.forEach(d => l.push(d.data() as UserRecord)); setUsers(l); }
    catch (e) { console.error(e); } finally { setFetchingUsers(false); }
  }, []);

  const loadTasks = useCallback(async () => {
    setFetchingTasks(true);
    try { const s = await getDocs(collection(db, "tasks")); const l: Task[] = []; s.forEach(d => l.push({ id: d.id, ...d.data() } as Task)); l.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); setTasks(l); }
    catch (e) { console.error(e); } finally { setFetchingTasks(false); }
  }, []);

  useEffect(() => { loadUsers(); loadTasks(); }, [loadUsers, loadTasks]);

  if (loading || !user) return null;
  if (userData && userData.role !== "admin") return null;

  const currentName = userData?.name || user.name || "Admin";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const handleRoleUpdate = async () => {
    if (!editingUser) return; setSavingRole(true);
    try { await updateDoc(doc(db, "users", editingUser.uid), { role: editRole, permissions: editPermissions }); setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, role: editRole, permissions: editPermissions } : u)); setEditingUser(null); }
    catch { alert("Failed to update role."); } finally { setSavingRole(false); }
  };
  const handleDeleteUser = async (uid: string) => {
    if (!confirm("Delete this user permanently?")) return;
    try { await deleteDoc(doc(db, "users", uid)); setUsers(users.filter(u => u.uid !== uid)); } catch (e) { console.error(e); }
  };
  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password) return;
    setAddingEmployee(true); setAddError("");
    try {
      const secondaryApp = getApps().find(app => app.name === "Secondary") || initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const result = await createUserWithEmailAndPassword(secondaryAuth, newEmployee.email, newEmployee.password);
      await signOut(secondaryAuth);
      const nu: UserRecord = { uid: result.user.uid, email: newEmployee.email, name: newEmployee.name, role: newEmployee.role, permissions: newEmployee.permissions };
      await setDoc(doc(db, "users", result.user.uid), nu);
      setUsers([{ ...nu }, ...users]); setNewEmployee({ name: "", email: "", password: "", role: "employee", permissions: [] }); setShowAddForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add";
      if (msg.includes("email-already-in-use")) setAddError("Email already in use.");
      else if (msg.includes("weak-password")) setAddError("Password must be 6+ characters.");
      else setAddError(msg);
    } finally { setAddingEmployee(false); }
  };
  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !taskForm.assignedTo) return; setSavingTask(true);
    const au = users.find(u => u.uid === taskForm.assignedTo);
    const td = { title: taskForm.title.trim(), description: taskForm.description.trim(), assignedTo: taskForm.assignedTo, assignedToName: au?.name || "Unknown", assignedToRole: au?.role || "employee", priority: taskForm.priority, status: "pending" as const, createdAt: Timestamp.now() };
    try { const ref = await addDoc(collection(db, "tasks"), td); setTasks([{ id: ref.id, ...td }, ...tasks]); setTaskForm({ title: "", description: "", assignedTo: "", priority: "medium" }); setShowTaskForm(false); }
    catch { alert("Failed to create task."); } finally { setSavingTask(false); }
  };
  const handleDeleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try { await deleteDoc(doc(db, "tasks", id)); setTasks(tasks.filter(t => t.id !== id)); } catch (e) { console.error(e); }
  };
  const handleTaskStatus = async (id: string, status: Task["status"]) => {
    const upd: Record<string, unknown> = { status }; if (status === "completed") upd.completedAt = Timestamp.now();
    try { await updateDoc(doc(db, "tasks", id), upd); setTasks(tasks.map(t => t.id === id ? { ...t, status, ...(status === "completed" ? { completedAt: Timestamp.now() } : {}) } : t)); } catch (e) { console.error(e); }
  };

  const filteredUsers = users.filter(u => {
    const ms = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const mr = filterRole === "all" || u.role === filterRole;
    return ms && mr;
  });
  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter(t => t.status === taskFilter);
  const stats = { total: users.length, admins: users.filter(u => u.role === "admin").length, managers: users.filter(u => u.role === "manager").length, employees: users.filter(u => u.role === "employee").length };
  const taskStats = { total: tasks.length, pending: tasks.filter(t => t.status === "pending").length, inProgress: tasks.filter(t => t.status === "in-progress").length, completed: tasks.filter(t => t.status === "completed").length };
  const assignableUsers = users.filter(u => u.role === "manager" || u.role === "employee");
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  const SIDEBAR_WIDTH = 240;

  const S = {
    page: {
      display: "flex",
      minHeight: "100vh",
      fontFamily: "inherit",
      background: "#f8fafc",
    } as React.CSSProperties,

    sidebar: {
      width: SIDEBAR_WIDTH,
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      display: "flex",
      flexDirection: "column" as const,
      padding: "20px 14px",
      position: "fixed" as const,
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 200,
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      overflowY: "auto" as const,
      // On mobile/tablet, slide in/out
      transform: (!isDesktop && !sidebarOpen) ? "translateX(-100%)" : "translateX(0)",
    } as React.CSSProperties,

    overlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 199,
      backdropFilter: "blur(4px)",
      display: (!isDesktop && sidebarOpen) ? "block" : "none",
    } as React.CSSProperties,

    main: {
      flex: 1,
      marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
      padding: isMobile ? "16px 14px 24px" : isTablet ? "20px 20px 28px" : "28px 32px 32px",
      minHeight: "100vh",
      maxWidth: "100%",
      overflow: "hidden",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    // Top bar
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: isMobile ? 18 : 24,
      gap: 12,
    } as React.CSSProperties,

    // Stats grid: 2 cols on mobile, 4 on tablet+
    statsGrid: {
      display: "grid",
      gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
      gap: isMobile ? 10 : 14,
      marginBottom: isMobile ? 18 : 22,
    } as React.CSSProperties,

    statCard: {
      background: "#fff",
      borderRadius: 14,
      padding: isMobile ? "14px 12px" : "20px 18px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      position: "relative" as const,
      overflow: "hidden" as const,
    } as React.CSSProperties,

    statStripe: (gradient: string) => ({
      position: "absolute" as const,
      top: 0, left: 0, right: 0,
      height: 3,
      background: gradient,
      borderRadius: "14px 14px 0 0",
    }),

    tableContainer: {
      background: "#fff",
      borderRadius: 14,
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      overflow: "hidden" as const,
    } as React.CSSProperties,

    th: {
      padding: isMobile ? "10px 12px" : "13px 18px",
      textAlign: "left" as const,
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      color: "#94a3b8",
      borderBottom: "1px solid #e2e8f0",
      background: "#fafbfc",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    td: {
      padding: isMobile ? "12px 12px" : "14px 18px",
      fontSize: isMobile ? 13 : 14,
      color: "#475569",
      borderBottom: "1px solid #f1f5f9",
      verticalAlign: "middle" as const,
    } as React.CSSProperties,

    btnPrimary: {
      padding: isMobile ? "9px 14px" : "10px 20px",
      background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      fontSize: isMobile ? 13 : 14,
      fontWeight: 600,
      fontFamily: "inherit",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      transition: "all 0.2s",
      boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnSecondary: {
      padding: isMobile ? "9px 12px" : "10px 16px",
      background: "#fff",
      color: "#475569",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      fontSize: isMobile ? 13 : 14,
      fontWeight: 600,
      fontFamily: "inherit",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      transition: "all 0.2s",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnIcon: {
      minWidth: 36,
      height: 36,
      borderRadius: 9,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      color: "#64748b",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: 600,
      padding: "0 10px",
    } as React.CSSProperties,

    badge: (color: string, bg: string) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      color,
      background: bg,
      border: `1px solid ${color}20`,
      whiteSpace: "nowrap" as const,
    }),

    modalOverlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(15,23,42,0.6)",
      backdropFilter: "blur(8px)",
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? 12 : 24,
    } as React.CSSProperties,

    modalCard: {
      background: "#fff",
      borderRadius: 18,
      padding: isMobile ? "24px 18px" : "30px 26px",
      maxWidth: 480,
      width: "100%",
      boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
      position: "relative" as const,
      maxHeight: "90vh",
      overflowY: "auto" as const,
    } as React.CSSProperties,

    input: {
      width: "100%",
      padding: isMobile ? "10px 12px" : "11px 14px",
      background: "#f8fafc",
      border: "1.5px solid #e2e8f0",
      borderRadius: 10,
      color: "#1e293b",
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      transition: "all 0.2s",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    label: {
      display: "block",
      fontSize: 12,
      fontWeight: 600,
      color: "#64748b",
      marginBottom: 5,
    } as React.CSSProperties,
  };

  const navItems = [
    { key: "users" as const, label: "Users", count: stats.total },
    { key: "tasks" as const, label: "Tasks", count: taskStats.pending > 0 ? taskStats.pending : undefined },
  ];

  // Mobile card view for users table
  const UserCard = ({ u }: { u: UserRecord }) => (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: roleBg[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff", flexShrink: 0 }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14, marginBottom: 2 }}>{u.name}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={S.badge(roleColors[u.role], `${roleColors[u.role]}12`)}>{u.role}</span>
          {u.permissions?.map(p => <span key={p} style={S.badge("#6366f1", "rgba(99,102,241,0.08)")}>{p.slice(0, 4)}..</span>)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button style={{ ...S.btnIcon, fontSize: 12 }} onClick={() => { setEditingUser(u); setEditRole(u.role); setEditPermissions(u.permissions || []); }}>Edit</button>
        <button style={{ ...S.btnIcon, color: "#ef4444", fontSize: 12 }} onClick={() => handleDeleteUser(u.uid)}>Del</button>
      </div>
    </div>
  );

  // Mobile card view for tasks
  const TaskCard = ({ t }: { t: Task }) => (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{t.title}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <span style={S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`)}>{t.priority}</span>
        </div>
      </div>
      {t.description && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, lineHeight: 1.5 }}>{t.description}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: roleBg[t.assignedToRole] || roleBg.employee, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: "#fff" }}>{t.assignedToName?.[0]?.toUpperCase() || "U"}</div>
        <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>{t.assignedToName}</span>
        <span style={S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent")}>{statusConfig[t.status]?.label}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
          style={{ flex: 1, padding: "7px 10px", fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
          <option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option>
        </select>
        <button style={{ ...S.btnIcon, color: "#ef4444" }} onClick={() => handleDeleteTask(t.id)}>Del</button>
      </div>
    </div>
  );

  return (
    <>
      {/* Responsive CSS injected globally */}
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .tr-hover:hover { background: #f8fafc !important; }
      `}</style>

      <div style={S.page}>
        {/* Overlay */}
        <div style={S.overlay} onClick={() => setSidebarOpen(false)} />

        {/* =================== SIDEBAR =================== */}
        <aside style={S.sidebar}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px", marginBottom: 28 }}>
            <img src="/logo.png" alt="Logo" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
              <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Admin Console</div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 10px", marginBottom: 6 }}>Navigation</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              { label: "Dashboard", path: "/dashboard" },
              { label: "Dispatch", path: "/dashboard/advanced-dispatch" },
              { label: "Inventory", path: "/dashboard/inventory" },
            ].map(item => (
              <button key={item.path} onClick={() => { router.push(item.path); if (!isDesktop) setSidebarOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" as const }}>
                {item.label}
              </button>
            ))}
            {navItems.map(item => (
              <button key={item.key} onClick={() => { setTab(item.key); if (!isDesktop) setSidebarOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none",
                  background: tab === item.key ? "rgba(99,102,241,0.15)" : "transparent",
                  color: tab === item.key ? "#a5b4fc" : "#94a3b8",
                  fontSize: 14, fontWeight: tab === item.key ? 600 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" as const,
                  ...(tab === item.key ? { borderLeft: "3px solid #818cf8", paddingLeft: 9 } : {}),
                }}>
                {item.label}
                {item.count !== undefined && (
                  <span style={{ marginLeft: "auto", background: tab === item.key ? "rgba(129,140,248,0.2)" : "rgba(148,163,184,0.15)", color: tab === item.key ? "#c7d2fe" : "#94a3b8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, minWidth: 24, textAlign: "center" as const }}>{item.count}</span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          {/* User */}
          <div style={{ padding: "14px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 11, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: roleBg.admin, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 }}>{currentName[0]?.toUpperCase() || "A"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 600 }}>Administrator</div>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
            ⎋ Sign Out
          </button>
        </aside>

        {/* =================== MAIN =================== */}
        <main style={S.main}>

          {/* ── Top Bar ── */}
          <div style={S.topBar}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: isMobile ? 20 : isTablet ? 22 : 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>{greeting}, {currentName.split(" ")[0]}</h1>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0", fontWeight: 500 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            {/* Hamburger on non-desktop */}
            {!isDesktop && (
              <button onClick={() => setSidebarOpen(true)}
                style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                ☰
              </button>
            )}
          </div>

          {/* ========== USERS TAB ========== */}
          {tab === "users" ? (
            <>
              {/* Stats */}
              <div style={S.statsGrid}>
                {[
                  { label: "Total Users", value: stats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
                  { label: "Admins", value: stats.admins, gradient: "linear-gradient(135deg,#ef4444,#f97316)" },
                  { label: "Managers", value: stats.managers, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
                  { label: "Employees", value: stats.employees, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
                ].map(s => (
                  <div key={s.label} style={S.statCard}>
                    <div style={S.statStripe(s.gradient)} />
                    <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: s.gradient, marginBottom: isMobile ? 10 : 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Action bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: "#0f172a", margin: 0 }}>All Users</h2>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => setShowAddForm(!showAddForm)} style={S.btnPrimary}>
                      <span style={{ fontSize: 15 }}>{showAddForm ? "✕" : "+"}</span>
                      {!isMobile && (showAddForm ? " Cancel" : " Add User")}
                    </button>
                    <button onClick={loadUsers} style={S.btnSecondary}>↻{!isMobile && " Refresh"}</button>
                  </div>
                </div>

                {/* Search + filter row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, flex: 1, minWidth: 160 }}>
                    <span style={{ color: "#94a3b8", fontSize: 14, flexShrink: 0 }}>🔍</span>
                    <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 13, width: "100%", fontFamily: "inherit" }} />
                  </div>
                  <select value={filterRole} onChange={e => setFilterRole(e.target.value as "all" | UserRole)}
                    style={{ padding: "9px 32px 9px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none" as const, minWidth: 130 }}>
                    <option value="all">All Roles</option><option value="admin">Admins</option><option value="manager">Managers</option><option value="employee">Employees</option>
                  </select>
                </div>
              </div>

              {/* Add Employee Form */}
              {showAddForm && (
                <div style={{ ...S.tableContainer, padding: isMobile ? 16 : 22, marginBottom: 18, animation: "fadeInUp 0.3s ease" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#0f172a" }}>Add New User</h3>
                  {addError && (
                    <div style={{ padding: "9px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9, color: "#ef4444", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>⚠️</span> {addError}
                      <button onClick={() => setAddError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
                    <div><label style={S.label}>Full Name</label><input style={S.input} placeholder="John Doe" value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} /></div>
                    <div><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="email@company.com" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} /></div>
                    <div><label style={S.label}>Password</label><input style={S.input} type="text" placeholder="Min 6 chars" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} /></div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <label style={{ ...S.label, marginBottom: 8 }}>Permissions</label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {["dispatch", "inventory", "reports", "settings"].map(p => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569", cursor: "pointer" }}>
                          <input type="checkbox" checked={newEmployee.permissions?.includes(p)} onChange={e => {
                            const perms = e.target.checked ? [...(newEmployee.permissions || []), p] : (newEmployee.permissions || []).filter(x => x !== p);
                            setNewEmployee({ ...newEmployee, permissions: perms });
                          }} style={{ cursor: "pointer", width: 15, height: 15, accentColor: "#6366f1" }} />
                          <span style={{ textTransform: "capitalize" }}>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <label style={{ ...S.label, margin: 0, flexShrink: 0 }}>Role:</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["employee", "manager", "admin"] as UserRole[]).map(r => (
                        <button key={r} onClick={() => setNewEmployee({ ...newEmployee, role: r })}
                          style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${newEmployee.role === r ? roleColors[r] : "#e2e8f0"}`, background: newEmployee.role === r ? `${roleColors[r]}15` : "transparent", color: newEmployee.role === r ? roleColors[r] : "#94a3b8" }}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <button onClick={handleAddEmployee} disabled={addingEmployee || !newEmployee.name || !newEmployee.email || !newEmployee.password}
                      style={{ ...S.btnPrimary, opacity: addingEmployee || !newEmployee.name || !newEmployee.email || !newEmployee.password ? 0.5 : 1 }}>
                      {addingEmployee ? <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : "Add User"}
                    </button>
                  </div>
                </div>
              )}

              {/* Users — table on tablet+, cards on mobile */}
              <div style={S.tableContainer}>
                {fetchingUsers ? (
                  <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <div style={{ width: 30, height: 30, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading users...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                    <p style={{ fontSize: 36, marginBottom: 6 }}>👥</p>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>No users found</p>
                  </div>
                ) : isMobile ? (
                  filteredUsers.map(u => <UserCard key={u.uid} u={u} />)
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: isTablet ? 560 : "auto" }}>
                      <thead>
                        <tr>
                          <th style={S.th}>User</th>
                          {!isTablet && <th style={S.th}>Email</th>}
                          <th style={S.th}>Role</th>
                          {!isTablet && <th style={S.th}>Permissions</th>}
                          <th style={{ ...S.th, textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.uid} className="tr-hover">
                            <td style={S.td}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 9, background: roleBg[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
                                <div>
                                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{u.name}</div>
                                  {isTablet && <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</div>}
                                </div>
                              </div>
                            </td>
                            {!isTablet && <td style={S.td}>{u.email}</td>}
                            <td style={S.td}><span style={S.badge(roleColors[u.role], `${roleColors[u.role]}12`)}>{u.role}</span></td>
                            {!isTablet && (
                              <td style={S.td}>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                  {u.permissions?.map(p => <span key={p} style={S.badge("#6366f1", "rgba(99,102,241,0.08)")}>{p.slice(0, 4)}..</span>)}
                                </div>
                              </td>
                            )}
                            <td style={{ ...S.td, textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                <button style={S.btnIcon} onClick={() => { setEditingUser(u); setEditRole(u.role); setEditPermissions(u.permissions || []); }}>Edit</button>
                                <button style={{ ...S.btnIcon, color: "#ef4444" }} onClick={() => handleDeleteUser(u.uid)}>Del</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ========== TASKS TAB ========== */}
              <div style={S.statsGrid}>
                {[
                  { label: "Total", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
                  { label: "Pending", value: taskStats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
                  { label: "In Progress", value: taskStats.inProgress, gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
                  { label: "Completed", value: taskStats.completed, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
                ].map(s => (
                  <div key={s.label} style={S.statCard}>
                    <div style={S.statStripe(s.gradient)} />
                    <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: s.gradient, marginBottom: isMobile ? 10 : 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Action bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: "#0f172a", margin: 0 }}>All Tasks</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowTaskForm(!showTaskForm)} style={S.btnPrimary}>
                      <span style={{ fontSize: 15 }}>{showTaskForm ? "✕" : "+"}</span>
                      {!isMobile && (showTaskForm ? " Cancel" : " New Task")}
                    </button>
                    <button onClick={loadTasks} style={S.btnSecondary}>↻{!isMobile && " Refresh"}</button>
                  </div>
                </div>

                {/* Filter pills — scrollable row on mobile */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" as const }}>
                  {(["all", "pending", "in-progress", "completed"] as const).map(f => (
                    <button key={f} onClick={() => setTaskFilter(f)}
                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", border: `1.5px solid ${taskFilter === f ? "#6366f1" : "#e2e8f0"}`, background: taskFilter === f ? "rgba(99,102,241,0.08)" : "#fff", color: taskFilter === f ? "#6366f1" : "#94a3b8", flexShrink: 0 }}>
                      {f === "all" ? "All" : statusConfig[f]?.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* New Task Form */}
              {showTaskForm && (
                <div style={{ ...S.tableContainer, padding: isMobile ? 16 : 22, marginBottom: 18, animation: "fadeInUp 0.3s ease" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#0f172a" }}>Create New Task</h3>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    <div><label style={S.label}>Task Title</label><input style={S.input} placeholder="Enter task title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
                    <div>
                      <label style={S.label}>Assign To</label>
                      <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })} style={{ ...S.input, cursor: "pointer", appearance: "none" as const }}>
                        <option value="">Select user...</option>
                        {assignableUsers.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}><label style={S.label}>Description</label><textarea placeholder="Describe the task..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" as const }} /></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <label style={{ ...S.label, margin: 0, flexShrink: 0 }}>Priority:</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["low", "medium", "high"] as const).map(p => (
                        <button key={p} onClick={() => setTaskForm({ ...taskForm, priority: p })}
                          style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${taskForm.priority === p ? priorityColors[p] : "#e2e8f0"}`, background: taskForm.priority === p ? `${priorityColors[p]}15` : "transparent", color: taskForm.priority === p ? priorityColors[p] : "#94a3b8" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <button onClick={handleCreateTask} disabled={savingTask || !taskForm.title.trim() || !taskForm.assignedTo}
                      style={{ ...S.btnPrimary, opacity: savingTask || !taskForm.title.trim() || !taskForm.assignedTo ? 0.5 : 1 }}>
                      {savingTask ? <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : "Assign Task"}
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks — table on tablet+, cards on mobile */}
              <div style={S.tableContainer}>
                {fetchingTasks ? (
                  <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <div style={{ width: 30, height: 30, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading tasks...</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                    <p style={{ fontSize: 36, marginBottom: 6 }}>📋</p>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>No tasks found</p>
                  </div>
                ) : isMobile ? (
                  filteredTasks.map(t => <TaskCard key={t.id} t={t} />)
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: isTablet ? 520 : "auto" }}>
                      <thead>
                        <tr>
                          <th style={S.th}>Task</th>
                          <th style={S.th}>Assigned To</th>
                          <th style={S.th}>Priority</th>
                          {!isTablet && <th style={S.th}>Status</th>}
                          <th style={{ ...S.th, textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map(t => (
                          <tr key={t.id} className="tr-hover">
                            <td style={S.td}>
                              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 2, fontSize: 13 }}>{t.title}</div>
                              {t.description && <div style={{ fontSize: 11, color: "#94a3b8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
                              {isTablet && <span style={{ ...S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent"), marginTop: 4, display: "inline-flex" }}>{statusConfig[t.status]?.label}</span>}
                            </td>
                            <td style={S.td}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, background: roleBg[t.assignedToRole] || roleBg.employee, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff", flexShrink: 0 }}>{t.assignedToName?.[0]?.toUpperCase() || "U"}</div>
                                <div>
                                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 12 }}>{t.assignedToName}</div>
                                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "capitalize" }}>{t.assignedToRole}</div>
                                </div>
                              </div>
                            </td>
                            <td style={S.td}><span style={S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`)}>{t.priority}</span></td>
                            {!isTablet && (
                              <td style={S.td}><span style={S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent")}>{statusConfig[t.status]?.label}</span></td>
                            )}
                            <td style={{ ...S.td, textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                                <select value={t.status} onChange={e => handleTaskStatus(t.id, e.target.value as Task["status"])}
                                  style={{ padding: "5px 8px", fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontFamily: "inherit", cursor: "pointer", outline: "none", maxWidth: isTablet ? 90 : 120 }}>
                                  <option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option>
                                </select>
                                <button style={{ ...S.btnIcon, color: "#ef4444" }} onClick={() => handleDeleteTask(t.id)}>Del</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* =================== EDIT ROLE MODAL =================== */}
        {editingUser && (
          <div style={S.modalOverlay} onClick={() => setEditingUser(null)}>
            <div style={S.modalCard} onClick={e => e.stopPropagation()}>
              <button onClick={() => setEditingUser(null)} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}>✕</button>
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ width: 58, height: 58, borderRadius: 15, background: roleBg[editingUser.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, color: "#fff", margin: "0 auto 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>{editingUser.name?.[0]?.toUpperCase() || "U"}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 3px", color: "#0f172a" }}>{editingUser.name}</h3>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{editingUser.email}</p>
              </div>
              <label style={{ ...S.label, marginBottom: 10 }}>Change Role</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
                {(["admin", "manager", "employee"] as UserRole[]).map(r => (
                  <button key={r} onClick={() => setEditRole(r)}
                    style={{ flex: 1, padding: "10px 6px", borderRadius: 11, cursor: "pointer", textAlign: "center", fontFamily: "inherit", border: editRole === r ? `2px solid ${roleColors[r]}` : "2px solid #e2e8f0", background: editRole === r ? `${roleColors[r]}08` : "#fff" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: editRole === r ? roleColors[r] : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{r}</div>
                  </button>
                ))}
              </div>
              <label style={{ ...S.label, marginBottom: 10 }}>Permissions</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22, padding: "12px 12px", background: "#f8fafc", borderRadius: 11, border: "1px solid #e2e8f0" }}>
                {["dispatch", "inventory", "reports", "settings"].map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569", cursor: "pointer" }}>
                    <input type="checkbox" checked={editPermissions?.includes(p)} onChange={e => {
                      const perms = e.target.checked ? [...(editPermissions || []), p] : (editPermissions || []).filter(x => x !== p);
                      setEditPermissions(perms);
                    }} style={{ cursor: "pointer", width: 15, height: 15, accentColor: "#6366f1" }} />
                    <span style={{ textTransform: "capitalize" }}>{p}</span>
                  </label>
                ))}
              </div>
              <button onClick={handleRoleUpdate} disabled={savingRole}
                style={{ ...S.btnPrimary, width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 14, opacity: savingRole ? 0.5 : 1 }}>
                {savingRole ? <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : "Update Role"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}