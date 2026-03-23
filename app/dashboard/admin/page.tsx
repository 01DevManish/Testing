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

export default function AdminPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
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

  // === Handlers ===
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
      await signOut(secondaryAuth); // immediately sign out secondary app
      
      const nu: UserRecord = { uid: result.user.uid, email: newEmployee.email, name: newEmployee.name, role: newEmployee.role, permissions: newEmployee.permissions };
      await setDoc(doc(db, "users", result.user.uid), nu);
      setUsers([{...nu}, ...users]); setNewEmployee({ name: "", email: "", password: "", role: "employee", permissions: [] }); setShowAddForm(false);
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
    btnPrimary: { padding: "10px 22px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" } as React.CSSProperties,
    btnSecondary: { padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s" } as React.CSSProperties,
    btnDanger: { padding: "8px 14px", background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.2s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,

    // Badge
    badge: (color: string, bg: string) => ({
      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${color}20`,
    }),

    // Modal
    modalOverlay: { position: "fixed" as const, inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } as React.CSSProperties,
    modalCard: { background: "#fff", borderRadius: 20, padding: "32px 28px", maxWidth: 480, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.15)", position: "relative" as const, animation: "fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1)" } as React.CSSProperties,

    // Input
    input: { width: "100%", padding: "11px 14px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 14, fontFamily: "inherit", outline: "none", transition: "all 0.2s" } as React.CSSProperties,
    label: { display: "block", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 6 } as React.CSSProperties,
  };

  const navItems = [
    { key: "users" as const, label: "Users", count: stats.total },
    { key: "tasks" as const, label: "Tasks", count: taskStats.pending > 0 ? taskStats.pending : undefined },
  ];

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
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Admin Console</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Dashboard
          </button>
          <button onClick={() => router.push("/dashboard/advanced-dispatch")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Dispatch
          </button>
          {navItems.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none",
                background: tab === item.key ? "rgba(99,102,241,0.15)" : "transparent",
                color: tab === item.key ? "#a5b4fc" : "#94a3b8",
                fontSize: 14, fontWeight: tab === item.key ? 600 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                ...(tab === item.key ? { borderLeft: "3px solid #818cf8", paddingLeft: 11 } : {})
              }}>
              {item.label}
              {item.count !== undefined && (
                <span style={{ marginLeft: "auto", background: tab === item.key ? "rgba(129,140,248,0.2)" : "rgba(148,163,184,0.15)", color: tab === item.key ? "#c7d2fe" : "#94a3b8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, minWidth: 24, textAlign: "center" }}>{item.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleBg.admin, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>{currentName[0]?.toUpperCase() || "A"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600 }}>Administrator</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          ⎋ Sign Out
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

        {/* ========== STATS ========== */}
        {tab === "users" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Users", value: stats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
                { label: "Admins", value: stats.admins, gradient: "linear-gradient(135deg,#ef4444,#f97316)" },
                { label: "Managers", value: stats.managers, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
                { label: "Employees", value: stats.employees, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>All Users</h2>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, minWidth: 220 }}>
                  <span style={{ color: "#94a3b8", fontSize: 16 }}>🔍</span>
                  <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 14, width: "100%", fontFamily: "inherit" }} />
                </div>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value as "all" | UserRole)} style={{ padding: "10px 32px 10px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 14, fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
                  <option value="all">All Roles</option><option value="admin">Admins</option><option value="manager">Managers</option><option value="employee">Employees</option>
                </select>
                <button onClick={() => setShowAddForm(!showAddForm)} style={S.btnPrimary}>
                  <span style={{ fontSize: 16 }}>{showAddForm ? "✕" : "+"}</span> {showAddForm ? "Cancel" : "Add User"}
                </button>
                <button onClick={loadUsers} style={S.btnSecondary}>↻ Refresh</button>
              </div>
            </div>

            {/* Add Employee Form */}
            {showAddForm && (
              <div style={{ ...S.tableContainer, padding: 24, marginBottom: 20, animation: "fadeInUp 0.3s ease" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px", color: "#0f172a" }}>Add New User</h3>
                {addError && (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>⚠️</span> {addError}
                    <button onClick={() => setAddError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>✕</button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div><label style={S.label}>Full Name</label><input style={S.input} placeholder="John Doe" value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} /></div>
                  <div><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="email@company.com" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} /></div>
                  <div><label style={S.label}>Password</label><input style={S.input} type="text" placeholder="Min 6 chars" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} /></div>
                </div>
                  <div style={{ marginTop: 16 }}>
                    <label style={{ ...S.label, marginBottom: 10 }}>Permissions:</label>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {["dispatch", "inventory", "reports", "settings"].map(p => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", cursor: "pointer" }}>
                          <input type="checkbox" checked={newEmployee.permissions?.includes(p)} onChange={e => {
                            const perms = e.target.checked ? [...(newEmployee.permissions||[]), p] : (newEmployee.permissions||[]).filter(x => x !== p);
                            setNewEmployee({ ...newEmployee, permissions: perms });
                          }} style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#6366f1" }} />
                          <span style={{ textTransform: "capitalize" }}>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
                    <label style={{ ...S.label, margin: 0 }}>Role:</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["employee", "manager", "admin"] as UserRole[]).map(r => (
                        <button key={r} onClick={() => setNewEmployee({ ...newEmployee, role: r })}
                          style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s", border: `1.5px solid ${newEmployee.role === r ? roleColors[r] : "#e2e8f0"}`, background: newEmployee.role === r ? `${roleColors[r]}15` : "transparent", color: newEmployee.role === r ? roleColors[r] : "#94a3b8" }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={handleAddEmployee} disabled={addingEmployee || !newEmployee.name || !newEmployee.email || !newEmployee.password} style={{ ...S.btnPrimary, opacity: addingEmployee || !newEmployee.name || !newEmployee.email || !newEmployee.password ? 0.5 : 1 }}>
                    {addingEmployee ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} /> : "Add User"}
                  </button>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div style={S.tableContainer}>
              {fetchingUsers ? (
                <div style={{ textAlign: "center", padding: "52px 0" }}>
                  <div style={{ width: 32, height: 32, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 0", color: "#94a3b8" }}>
                  <p style={{ fontSize: 40, marginBottom: 8 }}>👥</p>
                  <p style={{ fontSize: 15, fontWeight: 500 }}>No users found</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead><tr><th style={S.th}>User</th><th style={S.th}>Email</th><th style={S.th}>Role</th><th style={S.th}>Permissions</th><th style={{ ...S.th, textAlign: "right" }}>Actions</th></tr></thead>
                    <tbody>
                      {filteredUsers.map((u, i) => (
                        <tr key={u.uid} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.03}s`, transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: roleBg[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 }}>{u.name?.[0]?.toUpperCase() || "U"}</div>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={S.td}>{u.email}</td>
                          <td style={S.td}>
                            <span style={S.badge(roleColors[u.role], `${roleColors[u.role]}12`)}>{roleIcons[u.role]} {u.role}</span>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 200 }}>
                              {u.permissions?.map(p => <span key={p} style={S.badge(roleColors[u.role] || "#6366f1", (roleColors[u.role] || "#6366f1") + "12")} title={p}>{p.slice(0,4)}..</span>)}
                            </div>
                          </td>
                          <td style={{ ...S.td, textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                              <button style={{ ...S.btnIcon, fontSize: 14 }} title="Edit User" onClick={() => { setEditingUser(u); setEditRole(u.role); setEditPermissions(u.permissions || []); }}>Edit</button>
                              <button style={{ ...S.btnIcon, color: "#ef4444", fontSize: 14 }} title="Delete" onClick={() => handleDeleteUser(u.uid)}>Del</button>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Tasks", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>All Tasks</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {(["all", "pending", "in-progress", "completed"] as const).map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${taskFilter === f ? "#6366f1" : "#e2e8f0"}`, background: taskFilter === f ? "rgba(99,102,241,0.08)" : "#fff", color: taskFilter === f ? "#6366f1" : "#94a3b8", transition: "all 0.2s" }}>
                    {f === "all" ? "All" : statusConfig[f]?.label}
                  </button>
                ))}
                <button onClick={() => setShowTaskForm(!showTaskForm)} style={S.btnPrimary}>
                  <span style={{ fontSize: 16 }}>{showTaskForm ? "✕" : "+"}</span> {showTaskForm ? "Cancel" : "New Task"}
                </button>
                <button onClick={loadTasks} style={S.btnSecondary}>↻ Refresh</button>
              </div>
            </div>

            {/* New Task Form */}
            {showTaskForm && (
              <div style={{ ...S.tableContainer, padding: 24, marginBottom: 20, animation: "fadeInUp 0.3s ease" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px", color: "#0f172a" }}>Create New Task</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><label style={S.label}>Task Title</label><input style={S.input} placeholder="Enter task title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
                  <div>
                    <label style={S.label}>Assign To</label>
                    <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })} style={{ ...S.input, cursor: "pointer", appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}>
                      <option value="">Select user...</option>
                      {assignableUsers.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}><label style={S.label}>Description</label><textarea placeholder="Describe the task..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" }} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
                  <label style={{ ...S.label, margin: 0 }}>Priority:</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["low", "medium", "high"] as const).map(p => (
                      <button key={p} onClick={() => setTaskForm({ ...taskForm, priority: p })}
                        style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s", border: `1.5px solid ${taskForm.priority === p ? priorityColors[p] : "#e2e8f0"}`, background: taskForm.priority === p ? `${priorityColors[p]}15` : "transparent", color: taskForm.priority === p ? priorityColors[p] : "#94a3b8" }}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={handleCreateTask} disabled={savingTask || !taskForm.title.trim() || !taskForm.assignedTo} style={{ ...S.btnPrimary, opacity: savingTask || !taskForm.title.trim() || !taskForm.assignedTo ? 0.5 : 1 }}>
                    {savingTask ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} /> : "Assign Task"}
                  </button>
                </div>
              </div>
            )}

            {/* Tasks Table */}
            <div style={S.tableContainer}>
              {fetchingTasks ? (
                <div style={{ textAlign: "center", padding: "52px 0" }}>
                  <div style={{ width: 32, height: 32, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading tasks...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 0", color: "#94a3b8" }}>
                  <p style={{ fontSize: 40, marginBottom: 8 }}>📋</p>
                  <p style={{ fontSize: 15, fontWeight: 500 }}>No tasks found</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead><tr><th style={S.th}>Task</th><th style={S.th}>Assigned To</th><th style={S.th}>Priority</th><th style={S.th}>Status</th><th style={{ ...S.th, textAlign: "right" }}>Actions</th></tr></thead>
                    <tbody>
                      {filteredTasks.map((t, i) => (
                        <tr key={t.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.03}s`, transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{t.title}</div>
                            {t.description && <div style={{ fontSize: 12, color: "#94a3b8", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: roleBg[t.assignedToRole] || roleBg.employee, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: "#fff", flexShrink: 0 }}>{t.assignedToName?.[0]?.toUpperCase() || "U"}</div>
                              <div><div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{t.assignedToName}</div><div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{t.assignedToRole}</div></div>
                            </div>
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
                                style={{ padding: "5px 28px 5px 10px", fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
                                <option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option>
                              </select>
                              <button style={{ ...S.btnIcon, color: "#ef4444", fontSize: 14 }} title="Delete" onClick={() => handleDeleteTask(t.id)}>Del</button>
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
            <button onClick={() => setEditingUser(null)} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontFamily: "inherit" }}>✕</button>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: roleBg[editingUser.role], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26, color: "#fff", margin: "0 auto 16px", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>{editingUser.name?.[0]?.toUpperCase() || "U"}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>{editingUser.name}</h3>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>{editingUser.email}</p>
            </div>
            <label style={{ ...S.label, marginBottom: 12 }}>Change Role</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              {(["admin", "manager", "employee"] as UserRole[]).map(r => (
                <button key={r} onClick={() => setEditRole(r)}
                  style={{
                    flex: 1, padding: "12px 8px", borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "all 0.2s", fontFamily: "inherit",
                    border: editRole === r ? `2px solid ${roleColors[r]}` : "2px solid #e2e8f0",
                    background: editRole === r ? `${roleColors[r]}08` : "#fff",
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: editRole === r ? roleColors[r] : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{r}</div>
                </button>
              ))}
            </div>
            <label style={{ ...S.label, marginBottom: 12 }}>Permissions</label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24, padding: "12px 14px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              {["dispatch", "inventory", "reports", "settings"].map(p => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", cursor: "pointer" }}>
                  <input type="checkbox" checked={editPermissions?.includes(p)} onChange={e => {
                    const perms = e.target.checked ? [...(editPermissions||[]), p] : (editPermissions||[]).filter(x => x !== p);
                    setEditPermissions(perms);
                  }} style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#6366f1" }} />
                  <span style={{ textTransform: "capitalize" }}>{p}</span>
                </label>
              ))}
            </div>
            <button onClick={handleRoleUpdate} disabled={savingRole}
              style={{ ...S.btnPrimary, width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, opacity: savingRole ? 0.5 : 1 }}>
              {savingRole ? <span style={{ display: "inline-block", width: 20, height: 20, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} /> : "Update Role"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
