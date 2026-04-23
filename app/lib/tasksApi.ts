export interface TaskAttachment {
  name: string;
  url: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  assignedToRole: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  createdAt: number;
  expiresAt?: number;
  completedAt?: number | null;
  completionRequested?: boolean;
  completionRequestedAt?: number | null;
  completionRequestedBy?: string | null;
  completionApprovalStatus?: "none" | "requested" | "approved" | "rejected";
  completionReviewedAt?: number;
  completionReviewedBy?: string;
  lastWorkingStatus?: "pending" | "in-progress";
  createdBy: string;
  createdByName: string;
  attachments?: TaskAttachment[];
}

const ensureOk = async (res: Response, context: string) => {
  if (res.ok) return;
  const json = await res.json().catch(() => ({}));
  throw new Error(String(json?.error || `${context} failed`));
};

const normalize = (value: unknown): string => String(value || "").trim().toLowerCase();

export const fetchAllTasks = async (): Promise<TaskRecord[]> => {
  const res = await fetch("/api/data/tasks", { cache: "no-store" });
  await ensureOk(res, "Fetch tasks");
  const json = await res.json().catch(() => ({}));
  const rows = Array.isArray(json?.items) ? (json.items as TaskRecord[]) : [];
  return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const fetchTasksForAssignee = async (
  assignedTo: string,
  aliases?: { email?: string; name?: string }
): Promise<TaskRecord[]> => {
  const uid = String(assignedTo || "").trim();
  if (!uid) return [];
  const res = await fetch(`/api/data/tasks?assignedTo=${encodeURIComponent(uid)}`, { cache: "no-store" });
  await ensureOk(res, "Fetch assigned tasks");
  const json = await res.json().catch(() => ({}));
  const directRows = Array.isArray(json?.items) ? (json.items as TaskRecord[]) : [];
  if (directRows.length > 0) {
    return directRows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // Backward compatibility for legacy task assignments where assignedTo was saved
  // as email/name instead of UID in older data.
  const all = await fetchAllTasks();
  const keys = new Set<string>([
    normalize(uid),
    normalize(aliases?.email),
    normalize(aliases?.name),
  ]);
  keys.delete("");

  const matched = all.filter((row) => {
    const assignedToKey = normalize(row.assignedTo);
    const assignedToNameKey = normalize(row.assignedToName);
    return keys.has(assignedToKey) || keys.has(assignedToNameKey);
  });
  return matched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const replaceAllTasks = async (tasks: TaskRecord[]): Promise<void> => {
  const res = await fetch("/api/data/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "replace", items: tasks }),
  });
  await ensureOk(res, "Replace tasks");
};

export const upsertTask = async (task: TaskRecord): Promise<void> => {
  const res = await fetch("/api/data/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "upsert", items: [task] }),
  });
  await ensureOk(res, "Upsert task");
};

export const deleteTaskById = async (id: string): Promise<void> => {
  const taskId = String(id || "").trim();
  if (!taskId) return;
  const res = await fetch(`/api/data/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
  await ensureOk(res, "Delete task");
};

export const patchTaskById = async (id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> => {
  const taskId = String(id || "").trim();
  if (!taskId) return null;
  const res = await fetch(`/api/data/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  await ensureOk(res, "Patch task");
  const json = await res.json().catch(() => ({}));
  return (json?.item as TaskRecord | null) || null;
};
