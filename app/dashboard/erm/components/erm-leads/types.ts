/* ── ERM Leads – Types & Constants ── */

export type LeadStatus =
  | "new"
  | "contacted"
  | "not_connected"
  | "interested"
  | "not_interested"
  | "scheduled"
  | "follow_up"
  | "scheduled_meeting"
  | "ordered"
  | "onboarding_scheduled"
  | "won"
  | "lost";

export type LeadPriority = "hot" | "warm" | "cold";

export interface LeadRecord {
  id: string;
  name: string;
  phone: string;
  address?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  pincode?: string;
  source?: string;
  status: LeadStatus;
  assignedToUid?: string;
  assignedToName?: string;
  nextFollowUpAt?: number;
  createdAt: number;
  updatedAt: number;
  lastOutcome?: string;
  notes?: string;
  priority?: LeadPriority;
  callAttemptCount?: number;
}

export interface LeadCallRecord {
  id: string;
  leadId?: string;
  outcome: "interested" | "not_interested" | "follow_up" | "no_response";
  notes?: string;
  scheduledAt?: number;
  callType?: "voice" | "whatsapp" | "meeting" | "video";
  durationMinutes?: number;
  followUpMode?: "call" | "whatsapp" | "meeting" | "none";
  priority?: LeadPriority;
  nextAction?: string;
  calledAt: number;
  calledByUid?: string;
  calledByName?: string;
}

export interface LeadActivityRecord {
  id: string;
  leadId: string;
  leadName: string;
  company?: string;
  type: "status" | "note" | "call";
  text: string;
  status?: LeadStatus | LeadCallRecord["outcome"];
  notes?: string;
  employeeUid: string;
  employeeName: string;
  activityAt: number;
  createdAt: number;
}

export interface LeadFormState {
  name: string;
  phone: string;
  address: string;
  email: string;
  company: string;
  city: string;
  state: string;
  pincode: string;
  source: string;
  status: LeadStatus;
  nextFollowUpAt: string;
  assignedToUid: string;
}

export type ErmEntity = "ermLeads" | "ermLeadCalls" | "ermLeadActivities";

/* ── Status visual config ── */

export interface StatusCfg {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "not_connected", label: "Not Connected" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "follow_up", label: "Follow Up" },
  { value: "scheduled", label: "Scheduled" },
  { value: "scheduled_meeting", label: "Meeting Set" },
  { value: "ordered", label: "Ordered" },
  { value: "onboarding_scheduled", label: "Onboarding" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const STATUS_MAP: Record<string, StatusCfg> = {
  new:                  { label: "New",                color: "#ea580c", bg: "#fff7ed", icon: "IconFlame" },
  contacted:            { label: "Contacted",          color: "#2563eb", bg: "#eff6ff", icon: "IconPhone" },
  not_connected:        { label: "Not Connected",      color: "#9333ea", bg: "#faf5ff", icon: "IconPhone" },
  interested:           { label: "Interested",         color: "#059669", bg: "#ecfdf5", icon: "IconCheck" },
  not_interested:       { label: "Not Interested",     color: "#64748b", bg: "#f1f5f9", icon: "IconX" },
  follow_up:            { label: "Follow Up",          color: "#d97706", bg: "#fffbeb", icon: "IconRefresh" },
  scheduled:            { label: "Scheduled",          color: "#7c3aed", bg: "#f5f3ff", icon: "IconCalendar" },
  scheduled_meeting:    { label: "Meeting Set",        color: "#6366f1", bg: "#eef2ff", icon: "IconHandshake" },
  ordered:              { label: "Ordered",            color: "#0d9488", bg: "#f0fdfa", icon: "IconPackage" },
  onboarding_scheduled: { label: "Onboarding",        color: "#0891b2", bg: "#ecfeff", icon: "IconZap" },
  won:                  { label: "Won",                color: "#16a34a", bg: "#f0fdf4", icon: "IconTrophy" },
  lost:                 { label: "Lost",               color: "#dc2626", bg: "#fef2f2", icon: "IconHeart" },
};

export const getStatusCfg = (s?: string): StatusCfg =>
  STATUS_MAP[s || ""] || { label: s || "—", color: "#64748b", bg: "#f1f5f9", icon: "•" };
