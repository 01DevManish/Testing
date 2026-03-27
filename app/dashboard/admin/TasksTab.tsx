"use client";

import React from "react";
import { Task, UserRecord, priorityColors, statusConfig, roleBg } from "./types";
import StatsGrid from "./StatsGrid";
import type { AdminStyles } from "./styles";

interface TasksTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  tasks: Task[];
  filteredTasks: Task[];
  fetchingTasks: boolean;
  taskFilter: "all" | "pending" | "in-progress" | "completed";
  setTaskFilter: (v: "all" | "pending" | "in-progress" | "completed") => void;
  showTaskForm: boolean;
  setShowTaskForm: (v: boolean) => void;
  taskForm: { title: string; description: string; assignedTo: string; priority: "low" | "medium" | "high" };
  setTaskForm: (v: { title: string; description: string; assignedTo: string; priority: "low" | "medium" | "high" }) => void;
  savingTask: boolean;
  handleCreateTask: (attachments: { name: string; url: string }[]) => void;
  handleDeleteTask: (id: string) => void;
  handleTaskStatus: (id: string, status: Task["status"]) => void;
  assignableUsers: UserRecord[];
  loadTasks: () => void;
}

export default function TasksTab({
  S, isMobile, isTablet, tasks, filteredTasks, fetchingTasks,
  taskFilter, setTaskFilter, showTaskForm, setShowTaskForm,
  taskForm, setTaskForm, savingTask, handleCreateTask, handleDeleteTask,
  handleTaskStatus, assignableUsers, loadTasks,
}: TasksTabProps) {
  const [uploading, setUploading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
  };

  const TaskCard = ({ t }: { t: Task }) => (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 14 }}>{t.title}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <span style={S.badge(priorityColors[t.priority], `${priorityColors[t.priority]}12`)}>{t.priority}</span>
        </div>
      </div>
      {t.description && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, lineHeight: 1.5 }}>{t.description}</div>}
      
      {t.attachments && t.attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {t.attachments.map((at, idx) => (
            <a key={idx} href={at.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: "#f1f5f9", borderRadius: 6, fontSize: 10, color: "#6366f1", textDecoration: "none", border: "1px solid #e2e8f0" }}>
              📎 {at.name.length > 15 ? at.name.slice(0, 12) + "..." : at.name}
            </a>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: roleBg[t.assignedToRole] || roleBg.employee, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 11, color: "#fff" }}>{t.assignedToName?.[0]?.toUpperCase() || "U"}</div>
        <span style={{ fontSize: 13, color: "#475569", fontWeight: 400 }}>{t.assignedToName}</span>
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
      {/* Stats */}
      <StatsGrid S={S} isMobile={isMobile} items={[
        { label: "Total", value: taskStats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
        { label: "Pending", value: taskStats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
        { label: "In Progress", value: taskStats.inProgress, gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
        { label: "Completed", value: taskStats.completed, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
      ]} />

      {/* Action bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 400, color: "#0f172a", margin: 0 }}>All Tasks</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowTaskForm(!showTaskForm)} style={S.btnPrimary}>
              <span style={{ fontSize: 15 }}>{showTaskForm ? "✕" : "+"}</span>
              {!isMobile && (showTaskForm ? " Cancel" : " New Task")}
            </button>
            <button onClick={loadTasks} style={S.btnSecondary}>↻{!isMobile && " Refresh"}</button>
            {tasks.some(t => t.status === "completed") && (
              <button 
                onClick={async () => {
                  if (!confirm("Delete all completed tasks? This will remove them from the database permanently.")) return;
                  const completed = tasks.filter(t => t.status === "completed");
                  for (const t of completed) {
                    await handleDeleteTask(t.id);
                  }
                }} 
                style={{ ...S.btnSecondary, color: "#ef4444", borderColor: "#fecaca" }}>
                🗑{!isMobile && " Clear Completed"}
              </button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" as unknown as undefined }}>
          {(["all", "pending", "in-progress", "completed"] as const).map(f => (
            <button key={f} onClick={() => setTaskFilter(f)}
              style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", border: `1.5px solid ${taskFilter === f ? "#6366f1" : "#e2e8f0"}`, background: taskFilter === f ? "rgba(99,102,241,0.08)" : "#fff", color: taskFilter === f ? "#6366f1" : "#94a3b8", flexShrink: 0 }}>
              {f === "all" ? "All" : statusConfig[f]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* New Task Form */}
      {showTaskForm && (
        <div style={{ ...S.tableContainer, padding: isMobile ? 16 : 22, marginBottom: 18, animation: "fadeInUp 0.3s ease" }}>
          <h3 style={{ fontSize: 16, fontWeight: 400, margin: "0 0 16px", color: "#0f172a" }}>Create New Task</h3>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Task Title</label><input style={S.input} value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
            <div>
              <label style={S.label}>Assign To</label>
              <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })} style={{ ...S.input, cursor: "pointer", appearance: "none" as const }}>
                <option value="">Select user...</option>
                {assignableUsers.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><label style={S.label}>Description</label><textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" as const }} /></div>
          
          {/* Attachments UI */}
          <div style={{ marginTop: 12 }}>
            <label style={S.label}>Attachments (Optional)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {selectedFiles.map((f, i) => (
                    <div key={i} style={{ padding: "6px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>📄 {f.name}</span>
                        <button onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontWeight: 400 }}>✕</button>
                    </div>
                ))}
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#f1f5f9", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 400, color: "#475569", border: "1px solid #e2e8f0" }}>
                <span>📁 Choose Files</span>
                <input type="file" multiple onChange={(e) => e.target.files && setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)])} style={{ display: "none" }} />
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ ...S.label, margin: 0, flexShrink: 0 }}>Priority:</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["low", "medium", "high"] as const).map(p => (
                <button key={p} onClick={() => setTaskForm({ ...taskForm, priority: p })}
                  style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${taskForm.priority === p ? priorityColors[p] : "#e2e8f0"}`, background: taskForm.priority === p ? `${priorityColors[p]}15` : "transparent", color: taskForm.priority === p ? priorityColors[p] : "#94a3b8" }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button 
              onClick={async () => {
                if (selectedFiles.length > 0) setUploading(true);
                const attachments: { name: string; url: string }[] = [];
                try {
                  const { uploadToCloudinary } = await import("../inventory/cloudinary");
                  
                  for (const file of selectedFiles) {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve) => {
                      reader.onload = () => resolve(reader.result as string);
                      reader.readAsDataURL(file);
                    });
                    const base64 = await base64Promise;
                    const url = await uploadToCloudinary(base64);
                    attachments.push({ name: file.name, url });
                  }
                  handleCreateTask(attachments);
                  setSelectedFiles([]);
                } catch (e: any) {
                  console.error("Upload Error:", e);
                  alert(`Upload failed: ${e.message || "Check connection"}`);
                } finally {
                  setUploading(false);
                }
              }} 
              disabled={savingTask || uploading || !taskForm.title.trim() || !taskForm.assignedTo}
              style={{ ...S.btnPrimary, opacity: savingTask || uploading || !taskForm.title.trim() || !taskForm.assignedTo ? 0.5 : 1 }}>
              {savingTask || uploading ? <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : "Assign Task"}
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
            <p style={{ fontSize: 14, fontWeight: 400 }}>No tasks found</p>
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
                      <div style={{ fontWeight: 400, color: "#1e293b", marginBottom: 2, fontSize: 13 }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11, color: "#94a3b8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
                      {t.attachments && t.attachments.length > 0 && <div style={{ fontSize: 10, color: "#6366f1", marginTop: 4 }}>📎 {t.attachments.length} files attached</div>}
                      {isTablet && <span style={{ ...S.badge(statusConfig[t.status]?.color || "#94a3b8", statusConfig[t.status]?.bg || "transparent"), marginTop: 4, display: "inline-flex" }}>{statusConfig[t.status]?.label}</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: roleBg[t.assignedToRole] || roleBg.employee, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 10, color: "#fff", flexShrink: 0 }}>{t.assignedToName?.[0]?.toUpperCase() || "U"}</div>
                        <div>
                          <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 12 }}>{t.assignedToName}</div>
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
  );
}
