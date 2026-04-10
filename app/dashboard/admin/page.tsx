"use client";

import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ref, get, push, remove, update, set } from "firebase/database";
import { db, firebaseConfig } from "../../lib/firebase";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

import { UserRecord, Task, UserRole } from "./types";
import { useWindowSize } from "./hooks";
import { getStyles } from "./styles";
import { logActivity } from "../../lib/activityLogger";
import { sendNotification } from "../../lib/notificationHelper";

import AdminSidebar from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";
import UsersTab from "./UsersTab";
import TasksTab from "./TasksTab";
import EditRoleModal from "./EditRoleModal";
import DashboardTab from "./DashboardTab";
import LogsTab from "./LogsTab";
import CatalogTab from "../inventory/CatalogTab";
import MessagingTab from "../../components/MessagingTab";
import { Product, Category, Collection } from "../inventory/types";
import PartyRateTab from "./PartyRateTab";
import { PartyRate, Brand } from "./types";
import BrandsTab from "./BrandsTab";
import ProfileTab from "./ProfileTab";

export default function AdminPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const { 
    users: allUsers, setUsers,
    products, partyRates, setPartyRates,
    brands, setBrands,
    categories, collections,
    loading: fetchingGlobal, refreshData 
  } = useData();

  // ── UI State ──────────────────────────────────────────────
  const [tab, setTab] = useState<"dashboard" | "users" | "tasks" | "logs" | "brands" | "catalog" | "party-rates" | "profile" | "messages">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | UserRole>("all");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("employee");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editPin, setEditPin] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);

  const [adminToDelete, setAdminToDelete] = useState<UserRecord | null>(null);
  const [replacementAdminId, setReplacementAdminId] = useState<string>("");
  const [replacingAdmin, setReplacingAdmin] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", password: "", role: "employee" as UserRole, permissions: [] as string[] });
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [addError, setAddError] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", assignedTo: [] as string[], priority: "medium" as "low" | "medium" | "high" });
  const [savingTask, setSavingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");

  // Global fetching aliases
  const users = useMemo(() => allUsers.filter(u => u.email !== "01devmanish@gmail.com"), [allUsers]);
  const fetchingUsers = fetchingGlobal;
  const fetchingPartyRates = fetchingGlobal;
  const fetchingBrands = fetchingGlobal;
  const fetchingCatalog = fetchingGlobal;


  const S = useMemo(() => getStyles(isMobile, isTablet, isDesktop, sidebarOpen), [isMobile, isTablet, isDesktop, sidebarOpen]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "admin") router.replace("/dashboard");
  }, [loading, user, userData, router]);

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const loadTasks = useCallback(async () => {
    setFetchingTasks(true);
    try { 
      const s = await get(ref(db, "tasks")); 
      const l: Task[] = []; 
      if (s.exists()) {
        s.forEach(d => { l.push({ id: d.key as string, ...d.val() } as Task); });
      }
      l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); 
      setTasks(l); 
    } catch (e) { 
      console.error("Failed to load tasks:", e); 
    } finally { 
      setFetchingTasks(false); 
    }
  }, []);

  useEffect(() => { 
    loadTasks(); 
  }, [loadTasks]);


  if (loading || !user) return null;
  if (userData && userData.role !== "admin") return null;

  const currentName = userData?.name || user.name || "Admin";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const handleRoleUpdate = async () => {
    if (!editingUser) return; 
    setSavingRole(true);
    try { 
      await update(ref(db, `users/${editingUser.uid}`), { role: editRole, permissions: editPermissions, dispatchPin: editPin }); 
      
      // Log activity
      await logActivity({
        type: "user",
        action: "update",
        title: "User Role Updated",
        description: `User "${editingUser.name}" role changed to ${editRole} by ${currentName}.`,
        userId: user.uid,
        userName: currentName,
        userRole: "admin"
      });

      setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, role: editRole, permissions: editPermissions, dispatchPin: editPin } : u)); 
      setEditingUser(null); 
    } catch (e) { 
      console.error(e);
      alert("Failed to update role."); 
    } finally { 
      setSavingRole(false); 
    }
  };

  const handlePasswordReset = async (newPassword: string) => {
    if (!editingUser) return;
    try {
      const res = await fetch("/api/admin/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editingUser.uid,
          newPassword,
          adminUid: user.uid
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const userToDelete = users.find(u => u.uid === uid);
    if (!userToDelete) return;

    if (userToDelete.role === "admin") {
      setAdminToDelete(userToDelete);
      setReplacementAdminId("");
      return;
    }
    if (!confirm("Permanently DEACTIVATE this user? They will be logged out immediately and lose all access.")) return;
    try { 
      await remove(ref(db, `users/${uid}`)); 
      
      // Log activity
      await logActivity({
        type: "user",
        action: "delete",
        title: "User Deactivated",
        description: `User "${userToDelete.name}" (${userToDelete.email}) was deactivated by ${currentName}.`,
        userId: user.uid,
        userName: currentName,
        userRole: "admin"
      });

      setUsers(users.filter(u => u.uid !== uid)); 
    } catch (e) { console.error(e); }
  };

  const handleAdminReplacement = async () => {
    if (!adminToDelete || !replacementAdminId) return;
    setReplacingAdmin(true);
    try {
      await update(ref(db, `users/${replacementAdminId}`), { 
        role: "admin", 
        permissions: ["dispatch", "inventory", "reports", "settings"] 
      });
      await remove(ref(db, `users/${adminToDelete.uid}`));

      // Log activity
      await logActivity({
        type: "user",
        action: "update",
        title: "Admin Reassigned & Deleted",
        description: `Admin rights transferred from "${adminToDelete.name}" to another user. Original admin deleted by ${currentName}.`,
        userId: user.uid,
        userName: currentName,
        userRole: "admin"
      });

      setUsers(users.map(u => u.uid === replacementAdminId ? { ...u, role: "admin" as UserRole, permissions: ["dispatch", "inventory", "reports", "settings"] } : u).filter(u => u.uid !== adminToDelete.uid));
      setAdminToDelete(null);
    } catch (e) {
      console.error(e);
      alert("Failed to reassign admin and delete.");
    } finally {
      setReplacingAdmin(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password) return;
    setAddingEmployee(true); setAddError("");
    try {
      const secondaryApp = getApps().find(a => a.name === "Secondary") || initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const result = await createUserWithEmailAndPassword(secondaryAuth, newEmployee.email, newEmployee.password);
      const nu: UserRecord = { 
        uid: result.user.uid, 
        email: newEmployee.email, 
        name: newEmployee.name, 
        role: newEmployee.role, 
        permissions: newEmployee.permissions,
        requiresPasswordChange: true 
      };
      // Fire both concurrently — don't wait for signOut before Firestore write
      await Promise.all([
        signOut(secondaryAuth).catch(() => {}),
        set(ref(db, `users/${result.user.uid}`), nu),
      ]);
      // Only add to state if it's not the hidden email
      if (nu.email !== "01devmanish@gmail.com") {
        setUsers([{ ...nu }, ...users]); 
      }
      setNewEmployee({ name: "", email: "", password: "", role: "employee", permissions: [] }); 
      setShowAddForm(false);
      alert(`User "${nu.name}" added successfully!`);
    } catch (err: unknown) {
      console.error("Add user error:", err);
      const msg = err instanceof Error ? err.message : "Failed to add";
      if (msg.includes("email-already-in-use")) setAddError("Email already in use.");
      else if (msg.includes("weak-password")) setAddError("Password must be 6+ characters.");
      else setAddError(msg);
    } finally { setAddingEmployee(false); }
  };

  const handleCreateTask = async (attachments: { name: string; url: string }[] = []) => {
    if (!taskForm.title.trim() || !taskForm.assignedTo || taskForm.assignedTo.length === 0) return; 
    setSavingTask(true);
    
    try { 
      const now = Date.now();
      const expiresAt = now + 72 * 60 * 60 * 1000;
      const createdByName = userData?.name || user?.name || "Admin";
      
      const creationPromises = taskForm.assignedTo.map(async (uid) => {
        const au = users.find(u => u.uid === uid);
        const td: any = { 
          title: taskForm.title.trim(), 
          description: taskForm.description.trim(), 
          assignedTo: uid, 
          assignedToName: au?.name || "Unknown", 
          assignedToRole: au?.role || "employee", 
          priority: taskForm.priority, 
          status: "pending", 
          createdAt: now,
          expiresAt: expiresAt, 
          createdBy: user?.uid || "",
          createdByName: createdByName,
        };

        if (attachments && attachments.length > 0) {
          const validAttachments = attachments.filter(at => at.name && at.url);
          if (validAttachments.length > 0) td.attachments = validAttachments;
        }

        const newTaskRef = push(ref(db, "tasks")); 
        await set(newTaskRef, td);

        await logActivity({
          type: "task",
          action: "create",
          title: "New Task Assigned",
          description: `Task "${td.title}" assigned to ${td.assignedToName} by ${td.createdByName}.`,
          userId: user?.uid || "unknown",
          userName: td.createdByName,
          userRole: "admin",
          metadata: { taskId: newTaskRef.key }
        });

        return { id: newTaskRef.key as string, ...td };
      });

      const newTasks = await Promise.all(creationPromises);
      
      // Push in-app notifications
      const allAssignedUids = taskForm.assignedTo;
      const notificationUids = [user?.uid, ...allAssignedUids].filter((v, i, a) => v && a.indexOf(v) === i) as string[];
      
      sendNotification(notificationUids, {
        title: "New Administrative Task",
        message: `Task "${taskForm.title}" has been assigned to ${allAssignedUids.length} users by ${createdByName}.`,
        type: "task",
        actorId: user?.uid,
        actorName: createdByName,
        link: "/dashboard/admin"
      });

      setTasks([...newTasks, ...tasks]); 
      setTaskForm({ title: "", description: "", assignedTo: [], priority: "medium" }); 
      setShowTaskForm(false); 
      alert(`Success! Task assigned to ${taskForm.assignedTo.length} users.`);
    } catch (err: any) { 
      console.error("Task Creation Error:", err);
      alert(`Failed to create task: ${err.message || "Unknown error"}`); 
    } finally { 
      setSavingTask(false); 
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try { await remove(ref(db, `tasks/${id}`)); setTasks(tasks.filter(t => t.id !== id)); } catch (e) { console.error(e); }
  };

  const handleTaskStatus = async (id: string, status: Task["status"]) => {
    const upd: Record<string, unknown> = { status }; 
    if (status === "completed") upd.completedAt = Date.now();
    try { 
      await update(ref(db, `tasks/${id}`), upd); 
      
      // Log activity
      const task = tasks.find(t => t.id === id);
      await logActivity({
        type: "task",
        action: "status_change",
        title: "Task Status Updated",
        description: `Task "${task?.title || "Unknown"}" marked as ${status} by ${currentName}.`,
        userId: user?.uid || "unknown",
        userName: currentName,
        userRole: "admin",
        metadata: { taskId: id, status }
      });

      setTasks(tasks.map(t => t.id === id ? { ...t, status, ...(status === "completed" ? { completedAt: Date.now() } : {}) } : t)); 
    } catch (e) { 
      console.error(e); 
    }
  };

  const filteredUsers = users.filter(u => {
    // Permanent hidden filter
    if (u.email === "01devmanish@gmail.com") return false;
    
    const ms = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const mr = filterRole === "all" || u.role === filterRole;
    return ms && mr;
  });

  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter(t => t.status === taskFilter);
  const taskPendingCount = tasks.filter(t => t.status === "pending").length;

  return (
    <>
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
        <AdminSidebar 
          S={S} 
          tab={tab} 
          setTab={setTab} 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
          isDesktop={isDesktop} 
          currentName={currentName} 
          userData={userData}
          handleLogout={handleLogout}
          navItems={[
            { key: "dashboard", label: "Dashboard" },
            { key: "party-rates", label: "Party Wise Rate" },
            { key: "brands", label: "Brand Manager" },
            { key: "catalog", label: "Catalog Sharing" },
          ]}
          settingsItems={[
            { key: "profile", label: "Profile" },
            { key: "users", label: "Users", count: users.length },
            { key: "tasks", label: "Tasks", count: taskPendingCount > 0 ? taskPendingCount : undefined },
            { key: "logs", label: "Logs" },
          ]}
        />

        <main style={{ 
          ...S.main, 
          padding: tab === "messages" ? 0 : S.main.padding,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden"
        }}>
          {tab !== "messages" && (
            <AdminTopBar 
              S={S} 
              isMobile={isMobile} 
              isTablet={isTablet} 
              isDesktop={isDesktop} 
              currentName={currentName} 
              setSidebarOpen={setSidebarOpen} 
            />
          )}

          <div style={{ flex: 1, overflowY: "auto", display: tab === "messages" ? "flex" : "block", flexDirection: "column" }}>
            {tab === "dashboard" ? (
              <DashboardTab 
                S={S} 
                isMobile={isMobile} 
                isTablet={isTablet} 
                users={users} 
                tasks={tasks} 
              />
            ) : tab === "messages" ? (
              <MessagingTab users={users} isMobile={isMobile} />
            ) : tab === "users" ? (
              <UsersTab 
                S={S} 
                isMobile={isMobile} 
                isTablet={isTablet} 
                users={users} 
                filteredUsers={filteredUsers} 
                fetchingUsers={fetchingUsers}
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                filterRole={filterRole} 
                setFilterRole={setFilterRole}
                showAddForm={showAddForm} 
                setShowAddForm={setShowAddForm} 
                newEmployee={newEmployee} 
                setNewEmployee={setNewEmployee}
                addingEmployee={addingEmployee} 
                addError={addError} 
                setAddError={setAddError} 
                handleAddEmployee={handleAddEmployee}
                handleDeleteUser={handleDeleteUser} 
                onEditUser={(u) => { 
                  setEditingUser(u); 
                  setEditRole(u.role); 
                  setEditPermissions(u.permissions || []); 
                  setEditPin(u.dispatchPin || "");
                }} 
                loadUsers={refreshData} 
              />
            ) : tab === "tasks" ? (
              <TasksTab 
                S={S} 
                isMobile={isMobile} 
                isTablet={isTablet} 
                tasks={tasks} 
                filteredTasks={filteredTasks} 
                fetchingTasks={fetchingTasks}
                taskFilter={taskFilter} 
                setTaskFilter={setTaskFilter} 
                showTaskForm={showTaskForm} 
                setShowTaskForm={setShowTaskForm}
                taskForm={taskForm} 
                setTaskForm={setTaskForm} 
                savingTask={savingTask} 
                handleCreateTask={handleCreateTask} 
                handleDeleteTask={handleDeleteTask}
                handleTaskStatus={handleTaskStatus} 
                assignableUsers={users.filter(u => u.role === "admin" || u.role === "manager" || u.role === "employee")} 
                loadTasks={loadTasks} 
              />
            ) : tab === "logs" ? (
              <LogsTab 
                S={S} 
                isMobile={isMobile} 
                isTablet={isTablet} 
              />
            ) : tab === "party-rates" ? (
              <PartyRateTab 
                S={S}
                isMobile={isMobile}
                isTablet={isTablet}
                partyRates={partyRates}
                products={products}
                fetching={fetchingPartyRates}
                isAdmin={true}
                loadData={refreshData}
              />
            ) : tab === "brands" ? (
              <BrandsTab 
                S={S}
                isMobile={isMobile}
                isTablet={isTablet}
                brands={brands}
                fetching={fetchingBrands}
                loadData={refreshData}
              />
            ) : tab === "catalog" ? (
              <CatalogTab 
                products={products}
                categories={categories}
                collections={collections}
                brands={brands}
                loading={fetchingCatalog}
                isMobile={isMobile}
                isDesktop={!isMobile}
              />
            ) : tab === "profile" ? (
              <ProfileTab 
                S={S}
                isMobile={isMobile}
                isTablet={isTablet}
              />
            ) : (
              <div style={{ padding: 20, color: "#94a3b8" }}>Select a tab</div>
            )}
          </div>
        </main>






        {editingUser && (
          <EditRoleModal 
            S={S} 
            editingUser={editingUser} 
            editRole={editRole} 
            setEditRole={setEditRole} 
            editPermissions={editPermissions} 
            setEditPermissions={setEditPermissions}
            editPin={editPin}
            setEditPin={setEditPin}
            savingRole={savingRole} 
            handleRoleUpdate={handleRoleUpdate} 
            handlePasswordReset={handlePasswordReset}
            onClose={() => setEditingUser(null)} 
          />
        )}

        {adminToDelete && (
          <div style={S.modalOverlay}>
            <div style={{ ...S.modalCard, maxWidth: 400, position: "relative" }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setAdminToDelete(null)} 
                disabled={replacingAdmin}
                style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}
              >✕</button>
              <h3 style={{ fontSize: 18, fontWeight: 400, color: "#1e293b", marginBottom: 12 }}>Reassign Admin Rights</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                You must assign another user as Admin before deleting <strong>{adminToDelete.name}</strong>.
              </p>
              <select 
                value={replacementAdminId} 
                onChange={(e) => setReplacementAdminId(e.target.value)}
                style={{ ...S.input, marginBottom: 20 }}
              >
                <option value="">Select a user...</option>
                {users.filter(u => u.uid !== adminToDelete.uid && u.role !== "admin").map(u => (
                  <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button 
                  onClick={() => setAdminToDelete(null)} 
                  disabled={replacingAdmin}
                  style={S.btnSecondary}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdminReplacement} 
                  disabled={!replacementAdminId || replacingAdmin}
                  style={{ ...S.btnPrimary, background: "#ef4444", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" }}
                >
                  {replacingAdmin ? "Processing..." : "Assign & Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}