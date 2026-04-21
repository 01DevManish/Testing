import type { UserRole } from "../../context/AuthContext";
export type { UserRole };



export interface UserRecord {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  dispatchPin?: string;
  requiresPasswordChange?: boolean;
}

export interface Task {
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
  completedAt?: number;
  completionRequested?: boolean;
  completionRequestedAt?: number;
  completionRequestedBy?: string;
  completionApprovalStatus?: "none" | "requested" | "approved" | "rejected";
  completionReviewedAt?: number;
  completionReviewedBy?: string;
  lastWorkingStatus?: "pending" | "in-progress";
  createdBy: string;
  createdByName: string;
  attachments?: { name: string; url: string }[];
}

export interface LoggedActivity {
  id: string;
  type: "dispatch" | "inventory" | "user" | "task" | "system";
  action: "create" | "update" | "delete" | "status_change" | "adjustment" | "login" | "logout";
  title: string;
  description: string;
  timestamp: number;
  userId: string;
  userName: string;
  userRole: string;
  metadata?: Record<string, any>;
}

export const roleColors: Record<string, string> = {
  admin: "#ef4444",
  manager: "#f59e0b",
  employee: "#10b981",
};

export const roleBg: Record<string, string> = {
  admin: "linear-gradient(135deg,#ef4444,#f97316)",
  manager: "linear-gradient(135deg,#f59e0b,#fbbf24)",
  employee: "linear-gradient(135deg,#10b981,#34d399)",
};

export const roleIcons: Record<string, string> = {
  admin: "Admin",
  manager: "Mgr",
  employee: "Emp",
};

export const priorityColors: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

export const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  "in-progress": { label: "In Progress", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  completed: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

import { PartyDetails, PartyRate } from "../party-rate/types";
export type { PartyDetails, PartyRate };

export interface Brand {
  id: string;
  name: string;
  logoUrl: string;
  createdAt: number;
}

