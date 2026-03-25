"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../../lib/firebase";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

import { UserRecord, Task, UserRole } from "./types";
import { useWindowSize } from "./hooks";
import { getStyles } from "./styles";

import AdminSidebar from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";
import UsersTab from "./UsersTab";
import TasksTab from "./TasksTab";
import EditRoleModal from "./EditRoleModal";

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

  const S = useMemo(() => getStyles(isMobile, isTablet, isDesktop, sidebarOpen), [isMobile, isTablet, isDesktop, sidebarOpen]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && userData && userData.role !== "admin") router.replace("/dashboard");
  }, [loading, user, userData, router]);

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const loadUsers = useCallback(async () => {
    setFetchingUsers(true);
    try { 
      const s = await getDocs(collection(db, "users")); 
      const l: UserRecord[] = []; 
      s.forEach(d => l.push(d.data() as UserRecord)); 
      setUsers(l); 
    } catch (e) { 
      console.error(e); 
    } finally { 
      setFetchingUsers(false); 
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setFetchingTasks(true);
    try { 
      const s = await getDocs(collection(db, "tasks")); 
      const l: Task[] = []; 
      s.forEach(d => l.push({ id: d.id, ...d.data() } as Task)); 
      l.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 
      setTasks(l); 
    } catch (e) { 
      console.error(e); 
    } finally { 
      setFetchingTasks(false); 
    }
  }, []);

  useEffect(() => { 
    loadUsers(); 
    loadTasks(); 
  }, [loadUsers, loadTasks]);

  if (loading || !user) return null;
  if (userData && userData.role !== "admin") return null;

  const currentName = userData?.name || user.name || "Admin";
  const handleLogout = async () => { await logout(); router.replace("/"); };

  const handleRoleUpdate = async () => {
    if (!editingUser) return; setSavingRole(true);
    try { 
      await updateDoc(doc(db, "users", editingUser.uid), { role: editRole, permissions: editPermissions }); 
      setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, role: editRole, permissions: editPermissions } : u)); 
      setEditingUser(null); 
    } catch { 
      alert("Failed to update role."); 
    } finally { 
      setSavingRole(false); 
    }
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
      setUsers([{ ...nu }, ...users]); 
      setNewEmployee({ name: "", email: "", password: "", role: "employee", permissions: [] }); 
      setShowAddForm(false);
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
    const td = { 
      title: taskForm.title.trim(), 
      description: taskForm.description.trim(), 
      assignedTo: taskForm.assignedTo, 
      assignedToName: au?.name || "Unknown", 
      assignedToRole: au?.role || "employee", 
      priority: taskForm.priority, 
      status: "pending" as const, 
      createdAt: Timestamp.now() 
    };
    try { 
      const ref = await addDoc(collection(db, "tasks"), td); 
      setTasks([{ id: ref.id, ...td }, ...tasks]); 
      setTaskForm({ title: "", description: "", assignedTo: "", priority: "medium" }); 
      setShowTaskForm(false); 
    } catch { 
      alert("Failed to create task."); 
    } finally { 
      setSavingTask(false); 
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try { await deleteDoc(doc(db, "tasks", id)); setTasks(tasks.filter(t => t.id !== id)); } catch (e) { console.error(e); }
  };

  const handleTaskStatus = async (id: string, status: Task["status"]) => {
    const upd: Record<string, unknown> = { status }; 
    if (status === "completed") upd.completedAt = Timestamp.now();
    try { 
      await updateDoc(doc(db, "tasks", id), upd); 
      setTasks(tasks.map(t => t.id === id ? { ...t, status, ...(status === "completed" ? { completedAt: Timestamp.now() } : {}) } : t)); 
    } catch (e) { 
      console.error(e); 
    }
  };

  const filteredUsers = users.filter(u => {
    const ms = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
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
          handleLogout={handleLogout}
          navItems={[
            { key: "users", label: "Users", count: users.length },
            { key: "tasks", label: "Tasks", count: taskPendingCount > 0 ? taskPendingCount : undefined },
          ]}
        />

        <main style={S.main}>
          <AdminTopBar 
            S={S} 
            isMobile={isMobile} 
            isTablet={isTablet} 
            isDesktop={isDesktop} 
            currentName={currentName} 
            setSidebarOpen={setSidebarOpen} 
          />

          {tab === "users" ? (
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
              onEditUser={(u) => { setEditingUser(u); setEditRole(u.role); setEditPermissions(u.permissions || []); }} 
              loadUsers={loadUsers} 
            />
          ) : (
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
              assignableUsers={users.filter(u => u.role === "manager" || u.role === "employee")} 
              loadTasks={loadTasks} 
            />
          )}
        </main>

        {editingUser && (
          <EditRoleModal 
            S={S} 
            editingUser={editingUser} 
            editRole={editRole} 
            setEditRole={setEditRole} 
            editPermissions={editPermissions} 
            setEditPermissions={setEditPermissions}
            savingRole={savingRole} 
            handleRoleUpdate={handleRoleUpdate} 
            onClose={() => setEditingUser(null)} 
          />
        )}
      </div>
    </>
  );
}