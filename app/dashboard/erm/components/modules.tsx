"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CatalogTab from "../../inventory/components/Catalog/CatalogTab";
import ProductList from "../../inventory/components/Products/ProductList";
import { useData } from "../../../context/DataContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";

type DispatchLike = Record<string, any>;

type EmployeeSummary = {
  uid: string;
  name: string;
  role: string;
  orders: number;
  sales: number;
};

type LeadRecord = {
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
  status: "new" | "contacted" | "interested" | "not_interested" | "scheduled" | "won" | "lost" | "follow_up" | "scheduled_meeting" | "ordered" | "onboarding_scheduled";
  assignedToUid?: string;
  assignedToName?: string;
  nextFollowUpAt?: number;
  createdAt: number;
  updatedAt: number;
  lastOutcome?: string;
  notes?: string;
  priority?: "hot" | "warm" | "cold";
  callAttemptCount?: number;
};

type LeadCallRecord = {
  id: string;
  leadId?: string;
  outcome: "interested" | "not_interested" | "follow_up" | "no_response";
  notes?: string;
  scheduledAt?: number;
  callType?: "voice" | "whatsapp" | "meeting" | "video";
  durationMinutes?: number;
  followUpMode?: "call" | "whatsapp" | "meeting" | "none";
  priority?: "hot" | "warm" | "cold";
  nextAction?: string;
  calledAt: number;
  calledByUid?: string;
  calledByName?: string;
};

type LeadFormState = {
  name: string;
  phone: string;
  address: string;
  email: string;
  company: string;
  city: string;
  state: string;
  pincode: string;
  source: string;
  status: LeadRecord["status"];
  nextFollowUpAt: string;
  assignedToUid: string;
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: 10,
  fontSize: 13,
  outline: "none",
  background: "#fff",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #1d4ed8, #4f46e5)",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const subtleButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const ERM_LEADS_CACHE_KEY = "eurus_cache_erm_leads";
const ERM_LEAD_CALLS_CACHE_KEY = "eurus_cache_erm_lead_calls";
type ErmEntity = "ermLeads" | "ermLeadCalls";

const sortByUpdatedAtDesc = <T extends { updatedAt?: number }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));

const sortByCalledAtDesc = <T extends { calledAt?: number }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => (Number(b.calledAt) || 0) - (Number(a.calledAt) || 0));

const parseCachedArray = <T,>(key: string): T[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const saveCachedArray = (key: string, value: unknown[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
};

const generateEntityId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const formatMoney = (amount: number) => `Rs. ${Math.round(amount || 0).toLocaleString("en-IN")}`;
const safeNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const extractItems = (record: DispatchLike): DispatchLike[] => {
  if (Array.isArray(record?.items) && record.items.length) return record.items;
  if (Array.isArray(record?.products) && record.products.length) return record.products;
  return [];
};

const computeSales = (record: DispatchLike): number => {
  return extractItems(record).reduce((sum, item) => {
    const qty = safeNumber(item?.quantity || 1);
    const rate = safeNumber(item?.rate ?? item?.price ?? item?.wholesalePrice ?? 0);
    return sum + qty * rate;
  }, 0);
};

const normalizeEmployeeKey = (record: DispatchLike): { uid: string; name: string } => {
  const uid = String(record?.assignedTo || record?.dispatchedBy || record?.createdBy || record?.userId || "").trim();
  const name = String(record?.assignedToName || record?.dispatchedByName || record?.createdByName || record?.employeeName || "Unassigned").trim() || "Unassigned";
  return { uid, name };
};

const isDispatchLike = (record: DispatchLike): boolean => {
  const status = String(record?.status || "").trim().toLowerCase();
  if (["packed", "completed", "dispatched", "in transit", "delivered"].includes(status)) return true;
  return Boolean(record?.dispatchedAt);
};

const parseCsvRows = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ""; });
    return row;
  });
};

const normalizeHeader = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pickFromRow = (row: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const val = row[normalizeHeader(key)] ?? row[key] ?? "";
    if (String(val || "").trim()) return String(val).trim();
  }
  return "";
};

function useErmOrderSummaries() {
  const { orders, packingLists } = useData();

  const records = useMemo(() => {
    const retail = (packingLists || []).filter((x: DispatchLike) => isDispatchLike(x));
    const dispatches = (orders || []) as DispatchLike[];
    return [...retail, ...dispatches];
  }, [orders, packingLists]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();

    for (const record of records) {
      const { uid, name } = normalizeEmployeeKey(record);
      const key = uid || name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          uid: uid || key,
          name,
          role: "employee",
          orders: 0,
          sales: 0,
        });
      }
      const row = map.get(key)!;
      row.orders += 1;
      row.sales += computeSales(record);
    }

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [records]);

  return { records, employeeMap };
}

export function ErmDashboardModule({ forcedEmployeeUid }: { forcedEmployeeUid?: string }) {
  const router = useRouter();
  const { userData } = useAuth();
  const { users = [] } = useData();
  const { records, employeeMap } = useErmOrderSummaries();
  const isAdmin = userData?.role === "admin";

  const [selectedUid, setSelectedUid] = useState<string>(forcedEmployeeUid || "all");

  useEffect(() => {
    if (forcedEmployeeUid) setSelectedUid(forcedEmployeeUid);
  }, [forcedEmployeeUid]);

  const allowedUserKey = useMemo(() => {
    if (isAdmin) return selectedUid;
    return userData?.uid || "";
  }, [isAdmin, selectedUid, userData]);

  const filteredRecords = useMemo(() => {
    if (isAdmin && allowedUserKey === "all") return records;
    return records.filter((record) => {
      const info = normalizeEmployeeKey(record);
      const key = info.uid || info.name.toLowerCase();
      return key === allowedUserKey;
    });
  }, [records, allowedUserKey, isAdmin]);

  const totalSales = filteredRecords.reduce((sum, row) => sum + computeSales(row), 0);
  const totalOrders = filteredRecords.length;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const employeeRows = useMemo(() => {
    const byUid = new Map(users.map((u) => [u.uid, u]));
    return employeeMap.map((row) => ({
      ...row,
      role: byUid.get(row.uid)?.role || row.role,
    }));
  }, [employeeMap, users]);

  const stat = (label: string, value: string) => (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {stat("Orders", `${totalOrders}`)}
        {stat("Sales", formatMoney(totalSales))}
        {stat("Average Order", formatMoney(avgOrderValue))}
        {stat("Active Employees", `${employeeRows.length}`)}
      </div>

      {isAdmin && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Admin Employee Analytics</div>
            <select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", fontSize: 12 }}
            >
              <option value="all">All Employees</option>
              {employeeRows.map((row) => (
                <option key={row.uid} value={row.uid}>{row.name}</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Employee</th>
                  <th style={{ textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Orders</th>
                  <th style={{ textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Sales</th>
                  <th style={{ textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Dashboard Link</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((row) => (
                  <tr key={row.uid}>
                    <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#0f172a" }}>
                      {row.name} <span style={{ color: "#94a3b8", fontSize: 11 }}>({row.role})</span>
                    </td>
                    <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: 13 }}>{row.orders}</td>
                    <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: 13 }}>{formatMoney(row.sales)}</td>
                    <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      <button
                        onClick={() => router.push(`/dashboard/erm/employee/${row.uid}/dashboard`)}
                        style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", borderRadius: 8, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>My Performance</div>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Your dashboard shows only your orders and your sales. Admin can view all employees and individual links.
          </div>
        </div>
      )}
    </div>
  );
}

export function ErmOrdersModule() {
  const { userData } = useAuth();
  const { records, employeeMap } = useErmOrderSummaries();
  const isAdmin = userData?.role === "admin";
  const [selectedUid, setSelectedUid] = useState<string>(isAdmin ? "all" : userData?.uid || "");

  const filtered = useMemo(() => {
    const key = isAdmin ? selectedUid : (userData?.uid || "");
    if (isAdmin && key === "all") return records;
    return records.filter((record) => {
      const owner = normalizeEmployeeKey(record);
      const ownerKey = owner.uid || owner.name.toLowerCase();
      return ownerKey === key;
    });
  }, [isAdmin, selectedUid, userData, records]);

  const totals = useMemo(() => {
    const orders = filtered.length;
    const sales = filtered.reduce((sum, x) => sum + computeSales(x), 0);
    return { orders, sales, avg: orders ? sales / orders : 0 };
  }, [filtered]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Orders & Sales</div>
        {isAdmin && (
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", fontSize: 12 }}
          >
            <option value="all">All Employees</option>
            {employeeMap.map((e) => (
              <option key={e.uid} value={e.uid}>{e.name}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>Orders</div><div style={{ fontSize: 22, fontWeight: 700 }}>{totals.orders}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>Sales</div><div style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(totals.sales)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>Average</div><div style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(totals.avg)}</div></div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: "#475569" }}>
          This module auto-aggregates dispatch/order records and calculates employee-level sales. Non-admin users only see their own data.
        </div>
      </div>
    </div>
  );
}

export function ErmLeadsModule() {
  const { userData } = useAuth();
  const { users = [] } = useData();
  const canCreate = hasPermission(userData, "erm_leads_create");
  const canEdit = hasPermission(userData, "erm_leads_edit");
  const isAdmin = userData?.role === "admin";
  const canAdminUpload = isAdmin && canCreate;

  const initialLeadForm = useMemo<LeadFormState>(() => ({
    name: "",
    phone: "",
    address: "",
    email: "",
    company: "",
    city: "",
    state: "",
    pincode: "",
    source: "",
    status: "new",
    nextFollowUpAt: "",
    assignedToUid: "",
  }), []);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [allLeadCalls, setAllLeadCalls] = useState<LeadCallRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [creatingLead, setCreatingLead] = useState(false);
  const [savingLeadMeta, setSavingLeadMeta] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadRecord["status"]>("all");

  const [leadForm, setLeadForm] = useState<LeadFormState>(initialLeadForm);

  const [callForm, setCallForm] = useState({
    outcome: "follow_up" as LeadCallRecord["outcome"],
    notes: "",
    scheduledAt: "",
    callType: "voice" as LeadCallRecord["callType"],
    durationMinutes: "",
    followUpMode: "call" as LeadCallRecord["followUpMode"],
    nextAction: "",
  });
  const [leadMetaForm, setLeadMetaForm] = useState({
    name: "",
    phone: "",
    address: "",
    status: "new" as LeadRecord["status"],
    assignedToUid: "",
    notes: "",
    email: "",
    company: "",
    city: "",
    state: "",
    pincode: "",
    nextFollowUpAt: "",
  });

  const fetchEntityItems = useCallback(async <T,>(entity: ErmEntity): Promise<T[]> => {
    const response = await fetch(`/api/data/${entity}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${entity}`);
    const json = await response.json();
    return Array.isArray(json?.items) ? (json.items as T[]) : [];
  }, []);

  const upsertEntityItems = useCallback(async <T extends { id: string }>(entity: ErmEntity, items: T[]) => {
    const validItems = items.filter((item) => String(item.id || "").trim());
    if (!validItems.length) return;
    const response = await fetch(`/api/data/${entity}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "upsert", items: validItems }),
    });
    if (!response.ok) throw new Error(`Failed to save ${entity}`);
  }, []);

  const syncLeadsFromApi = useCallback(async () => {
    const rows = await fetchEntityItems<LeadRecord>("ermLeads");
    const sorted = sortByUpdatedAtDesc(rows);
    setLeads(sorted);
    saveCachedArray(ERM_LEADS_CACHE_KEY, sorted);
  }, [fetchEntityItems]);

  const syncLeadCallsFromApi = useCallback(async () => {
    const rows = await fetchEntityItems<LeadCallRecord>("ermLeadCalls");
    const sorted = sortByCalledAtDesc(rows);
    setAllLeadCalls(sorted);
    saveCachedArray(ERM_LEAD_CALLS_CACHE_KEY, sorted);
  }, [fetchEntityItems]);

  useEffect(() => {
    const cachedLeads = sortByUpdatedAtDesc(parseCachedArray<LeadRecord>(ERM_LEADS_CACHE_KEY));
    if (cachedLeads.length) setLeads(cachedLeads);

    const cachedCalls = sortByCalledAtDesc(parseCachedArray<LeadCallRecord>(ERM_LEAD_CALLS_CACHE_KEY));
    if (cachedCalls.length) setAllLeadCalls(cachedCalls);

    let alive = true;
    Promise.all([syncLeadsFromApi(), syncLeadCallsFromApi()])
      .catch((error) => console.error("ERM Dynamo sync failed:", error))
      .finally(() => {
        if (alive) setLoadingLeads(false);
      });

    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      syncLeadsFromApi().catch(() => {});
      syncLeadCallsFromApi().catch(() => {});
    }, 15000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [syncLeadsFromApi, syncLeadCallsFromApi]);

  const staff = useMemo(
    () => users.filter((u) => hasPermission(u, "erm_leads_view") || u.role === "admin"),
    [users],
  );

  const visibleLeads = useMemo(() => {
    if (isAdmin) return leads;
    return leads.filter((lead) => lead.assignedToUid === userData?.uid);
  }, [isAdmin, leads, userData]);

  const filteredLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    return visibleLeads.filter((lead) => {
      const statusPass = statusFilter === "all" ? true : lead.status === statusFilter;
      if (!statusPass) return false;
      if (!query) return true;
      return (
        String(lead.name || "").toLowerCase().includes(query) ||
        String(lead.phone || "").toLowerCase().includes(query) ||
        String(lead.address || lead.city || "").toLowerCase().includes(query) ||
        String(lead.assignedToName || "").toLowerCase().includes(query)
      );
    });
  }, [visibleLeads, leadSearch, statusFilter]);

  const selectedLead = visibleLeads.find((x) => x.id === selectedLeadId) || null;
  const callLogs = useMemo(
    () => sortByCalledAtDesc(allLeadCalls.filter((log) => String((log as Record<string, unknown>).leadId || "") === selectedLeadId)),
    [allLeadCalls, selectedLeadId]
  );

  useEffect(() => {
    if (!selectedLead) return;
    setLeadMetaForm({
      name: selectedLead.name || "",
      phone: selectedLead.phone || "",
      address: selectedLead.address || "",
      status: selectedLead.status || "new",
      assignedToUid: selectedLead.assignedToUid || "",
      notes: selectedLead.notes || "",
      email: selectedLead.email || "",
      company: selectedLead.company || "",
      city: selectedLead.city || "",
      state: selectedLead.state || "",
      pincode: selectedLead.pincode || "",
      nextFollowUpAt: selectedLead.nextFollowUpAt ? new Date(selectedLead.nextFollowUpAt).toISOString().slice(0,16) : "",
    });
  }, [selectedLead]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreviewRows, setUploadPreviewRows] = useState<Record<string, string>[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [uploadPreviewLoading, setUploadPreviewLoading] = useState(false);

  const closeLeadModal = () => {
    setIsLeadModalOpen(false);
    setSelectedLeadId("");
  };

  const openLeadModal = (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsLeadModalOpen(true);
  };

  const createLead = async () => {
    if (!canAdminUpload) return;
    if (!leadForm.name.trim() || !leadForm.phone.trim()) return;

    setCreatingLead(true);
    try {
      const assignee = staff.find((s) => s.uid === leadForm.assignedToUid);
      const now = Date.now();
      const newLead: LeadRecord = {
        id: generateEntityId("lead"),
        name: leadForm.name.trim(),
        phone: leadForm.phone.trim(),
        address: leadForm.address.trim(),
        email: leadForm.email.trim(),
        company: leadForm.company.trim(),
        city: leadForm.city?.trim(),
        state: leadForm.state?.trim(),
        pincode: leadForm.pincode?.trim(),
        source: leadForm.source.trim() || "manual",
        status: leadForm.status || "new",
        nextFollowUpAt: leadForm.nextFollowUpAt ? new Date(leadForm.nextFollowUpAt).getTime() : undefined,
        assignedToUid: assignee?.uid || userData?.uid || "",
        assignedToName: assignee?.name || userData?.name || "",
        createdAt: now,
        updatedAt: now,
      };

      const next = sortByUpdatedAtDesc([newLead, ...leads.filter((lead) => lead.id !== newLead.id)]);
      setLeads(next);
      saveCachedArray(ERM_LEADS_CACHE_KEY, next);
      await upsertEntityItems("ermLeads", [newLead]);

      setLeadForm({ ...initialLeadForm });
    } finally {
      setCreatingLead(false);
    }
  };

  const canSubmitLead = Boolean(leadForm.name.trim() && leadForm.phone.trim() && canAdminUpload);

  const saveCallRecord = async () => {
    if (!canEdit || !selectedLead) return;
    setSavingCall(true);
    try {
      const now = Date.now();
      const scheduledTs = callForm.scheduledAt ? new Date(callForm.scheduledAt).getTime() : undefined;
      const duration = Number(callForm.durationMinutes || 0);
      const newCall: LeadCallRecord = {
        id: generateEntityId("call"),
        leadId: selectedLead.id,
        outcome: callForm.outcome,
        notes: callForm.notes.trim(),
        scheduledAt: scheduledTs,
        callType: callForm.callType,
        durationMinutes: duration > 0 ? duration : undefined,
        followUpMode: callForm.followUpMode,
        priority: selectedLead.priority || "cold",
        nextAction: callForm.nextAction.trim(),
        calledAt: now,
        calledByUid: userData?.uid || "",
        calledByName: userData?.name || "",
      };

      const patchedLead: LeadRecord = {
        ...selectedLead,
        status: callForm.outcome === "interested" ? "interested" : callForm.outcome === "not_interested" ? "not_interested" : (scheduledTs ? "scheduled" : "contacted"),
        nextFollowUpAt: scheduledTs,
        lastOutcome: callForm.outcome,
        notes: callForm.notes.trim() || selectedLead.notes || "",
        callAttemptCount: Number(selectedLead.callAttemptCount || 0) + 1,
        updatedAt: now,
      };

      const nextCalls = sortByCalledAtDesc([newCall, ...allLeadCalls.filter((log) => log.id !== newCall.id)]);
      const nextLeads = sortByUpdatedAtDesc(leads.map((lead) => (lead.id === selectedLead.id ? patchedLead : lead)));
      setAllLeadCalls(nextCalls);
      setLeads(nextLeads);
      saveCachedArray(ERM_LEAD_CALLS_CACHE_KEY, nextCalls);
      saveCachedArray(ERM_LEADS_CACHE_KEY, nextLeads);

      await Promise.all([
        upsertEntityItems("ermLeadCalls", [newCall]),
        upsertEntityItems("ermLeads", [patchedLead]),
      ]);

      setCallForm({
        outcome: "follow_up",
        notes: "",
        scheduledAt: "",
        callType: "voice",
        durationMinutes: "",
        followUpMode: "call",
        nextAction: "",
      });
      closeLeadModal();
    } finally {
      setSavingCall(false);
    }
  };

  const saveLeadMeta = async () => {
    if (!canEdit || !selectedLead) return;
    setSavingLeadMeta(true);
    try {
      const assignee = staff.find((s) => s.uid === leadMetaForm.assignedToUid);
      const updatedLead: LeadRecord = {
        ...selectedLead,
        name: leadMetaForm.name.trim() || selectedLead.name || "",
        phone: leadMetaForm.phone.trim() || selectedLead.phone || "",
        address: leadMetaForm.address.trim() || "",
        status: leadMetaForm.status,
        assignedToUid: leadMetaForm.assignedToUid || selectedLead.assignedToUid || "",
        assignedToName: assignee?.name || selectedLead.assignedToName || "",
        email: leadMetaForm.email?.trim() || selectedLead.email || "",
        company: leadMetaForm.company?.trim() || selectedLead.company || "",
        city: leadMetaForm.city?.trim() || selectedLead.city || "",
        state: leadMetaForm.state?.trim() || selectedLead.state || "",
        pincode: leadMetaForm.pincode?.trim() || selectedLead.pincode || "",
        notes: leadMetaForm.notes.trim(),
        nextFollowUpAt: leadMetaForm.nextFollowUpAt ? new Date(leadMetaForm.nextFollowUpAt).getTime() : undefined,
        updatedAt: Date.now(),
      };
      const nextLeads = sortByUpdatedAtDesc(leads.map((lead) => (lead.id === selectedLead.id ? updatedLead : lead)));
      setLeads(nextLeads);
      saveCachedArray(ERM_LEADS_CACHE_KEY, nextLeads);
      await upsertEntityItems("ermLeads", [updatedLead]);
      closeLeadModal();
    } finally {
      setSavingLeadMeta(false);
    }
  };

  const statusColor = (s?: LeadRecord["status"]) => {
    switch (s) {
      case "new": return "#f97316";
      case "contacted": return "#60a5fa";
      case "interested": return "#10b981";
      case "not_interested": return "#94a3b8";
      case "follow_up": return "#f59e0b";
      case "scheduled_meeting": return "#6366f1";
      case "ordered": return "#059669";
      case "onboarding_scheduled": return "#06b6d4";
      case "won": return "#0ea5a4";
      case "lost": return "#ef4444";
      default: return "#cbd5e1";
    }
  };

  const parseFileToRows = async (file: File) => {
    let rows: Record<string, string>[] = [];
    const fileName = (file.name || "").toLowerCase();
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheet = wb.SheetNames[0];
      if (firstSheet) {
        const sheet = wb.Sheets[firstSheet];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        rows = jsonRows.map((raw) => {
          const mapped: Record<string, string> = {};
          Object.entries(raw).forEach(([k, v]) => { mapped[normalizeHeader(k)] = String(v ?? "").trim(); });
          return mapped;
        });
      }
    } else {
      const text = await file.text();
      const csvRows = parseCsvRows(text);
      rows = csvRows.map((raw) => {
        const mapped: Record<string, string> = {};
        Object.entries(raw).forEach(([k, v]) => { mapped[normalizeHeader(k)] = String(v ?? "").trim(); });
        return mapped;
      });
    }
    return rows;
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setUploadPreviewLoading(true);
    try {
      const rows = await parseFileToRows(file);
      setUploadPreviewRows(rows.slice(0, 6));
      setShowUploadPreview(true);
    } catch (e) {
      console.error("Preview parse failed:", e);
      setUploadPreviewRows([]);
      setShowUploadPreview(false);
    } finally {
      setUploadPreviewLoading(false);
    }
  };

  const confirmUpload = async () => {
    if (!selectedFile) return;
    setShowUploadPreview(false);
    await uploadLeadsFile(selectedFile);
    setSelectedFile(null);
    setUploadPreviewRows([]);
  };

  const downloadTemplate = () => {
    const headers = ["name","phone","address","email","company","city","state","pincode","source","assigned_to_uid"];
    const sample = ["Example Name","9999999999","Example address","email@example.com","Example Co","Mumbai","Maharashtra","400001","web",""];
    const csv = [headers.join(","), sample.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erm_leads_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const uploadLeadsFile = async (file: File) => {
    if (!canAdminUpload) return;
    let rows: Record<string, string>[] = [];
    const fileName = (file.name || "").toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheet = wb.SheetNames[0];
      if (firstSheet) {
        const sheet = wb.Sheets[firstSheet];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        rows = jsonRows.map((raw) => {
          const mapped: Record<string, string> = {};
          Object.entries(raw).forEach(([k, v]) => {
            mapped[normalizeHeader(k)] = String(v ?? "").trim();
          });
          return mapped;
        });
      }
    } else {
      const text = await file.text();
      const csvRows = parseCsvRows(text);
      rows = csvRows.map((raw) => {
        const mapped: Record<string, string> = {};
        Object.entries(raw).forEach(([k, v]) => {
          mapped[normalizeHeader(k)] = String(v ?? "").trim();
        });
        return mapped;
      });
    }

    if (!rows.length) return;

    const now = Date.now();
    const toInsert: LeadRecord[] = [];
    for (const row of rows) {
      const name = pickFromRow(row, ["name", "full_name", "customer_name", "lead_name"]);
      const phone = pickFromRow(row, ["phone", "mobile", "contact", "phone_number"]);
      if (!name || !phone) continue;

      const assignedUid = pickFromRow(row, ["assigned_uid", "assigned_to_uid", "assignedtouid", "owner_uid"]) || userData?.uid || "";
      const assigned = staff.find((s) => s.uid === assignedUid);
      toInsert.push({
        id: generateEntityId("lead"),
        name,
        phone,
        address: pickFromRow(row, ["address", "full_address", "location"]),
        email: pickFromRow(row, ["email"]),
        company: pickFromRow(row, ["company", "organization"]),
        city: pickFromRow(row, ["city"]),
        state: pickFromRow(row, ["state", "region", "state_name"]),
        pincode: pickFromRow(row, ["pincode", "pin", "postal", "postal_code", "zip"]),
        source: pickFromRow(row, ["source"]) || (fileName.endsWith(".csv") ? "csv_upload" : "xlsx_upload"),
        status: "new",
        assignedToUid: assignedUid,
        assignedToName: assigned?.name || pickFromRow(row, ["assigned_to_name", "owner_name"]) || userData?.name || "",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!toInsert.length) return;
    const nextLeads = sortByUpdatedAtDesc([...toInsert, ...leads]);
    setLeads(nextLeads);
    saveCachedArray(ERM_LEADS_CACHE_KEY, nextLeads);
    await upsertEntityItems("ermLeads", toInsert);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {isAdmin ? (
        <div style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Create Lead</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>`Name` and `Phone` are required. Remaining fields are optional.</div>
            </div>
            {!canSubmitLead && (
              <div style={{ fontSize: 11, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", padding: "6px 8px", borderRadius: 8 }}>
                Fill required fields to enable Save.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <input placeholder="Lead name" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} style={inputStyle} />
          <input placeholder="Phone" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} style={inputStyle} />
          <input placeholder="Address" value={leadForm.address} onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })} style={inputStyle} />
          <input placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} style={inputStyle} />
          <input placeholder="Company" value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} style={inputStyle} />
          <input placeholder="City" value={leadForm.city} onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })} style={inputStyle} />
          <input placeholder="State" value={leadForm.state} onChange={(e) => setLeadForm({ ...leadForm, state: e.target.value })} style={inputStyle} />
          <input placeholder="Pin code" value={leadForm.pincode} onChange={(e) => setLeadForm({ ...leadForm, pincode: e.target.value })} style={inputStyle} />
          <input placeholder="Source" value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} style={inputStyle} />
          <select value={leadForm.status} onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as LeadRecord["status"] })} style={inputStyle}>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="follow_up">Follow Up</option>
            <option value="scheduled_meeting">Schedule Meeting</option>
            <option value="ordered">Ordered</option>
            <option value="onboarding_scheduled">Onboarding Scheduled</option>
          </select>
          {(leadForm.status === "follow_up" || leadForm.status === "scheduled_meeting" || leadForm.status === "onboarding_scheduled") && (
            <input type="datetime-local" value={leadForm.nextFollowUpAt} onChange={(e) => setLeadForm({ ...leadForm, nextFollowUpAt: e.target.value })} style={inputStyle} />
          )}
          <select value={leadForm.assignedToUid} onChange={(e) => setLeadForm({ ...leadForm, assignedToUid: e.target.value })} style={inputStyle}>
            <option value="">Assign to</option>
            {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
          </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={createLead} disabled={!canSubmitLead || creatingLead} style={{ ...primaryButtonStyle, opacity: canSubmitLead && !creatingLead ? 1 : 0.5 }}>
              {creatingLead ? "Saving..." : "Save Lead"}
            </button>
            <button onClick={downloadTemplate} style={subtleButtonStyle}>Download Template</button>
            <label style={subtleButtonStyle}>
              Upload CSV/XLSX
              <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />
            </label>
          </div>
          {showUploadPreview && (
            <div style={{ marginTop: 8, border: "1px dashed #cbd5e1", padding: 8, borderRadius: 8, background: "#fbfafe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Upload Preview ({uploadPreviewRows.length} rows)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={confirmUpload} style={{ ...primaryButtonStyle }}>Confirm Upload</button>
                  <button onClick={() => { setShowUploadPreview(false); setSelectedFile(null); setUploadPreviewRows([]); }} style={subtleButtonStyle}>Cancel</button>
                </div>
              </div>
              {uploadPreviewLoading ? <div style={{ fontSize: 12, color: "#64748b" }}>Parsing preview...</div> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {uploadPreviewRows[0] && Object.keys(uploadPreviewRows[0]).slice(0, 8).map((h) => (
                          <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "4px 6px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreviewRows.map((r, i) => (
                        <tr key={i}>
                          {Object.values(r).slice(0, 8).map((v, j) => (
                            <td key={j} style={{ padding: "6px", fontSize: 13 }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, fontSize: 13, color: "#475569" }}>
          Leads are uploaded and assigned by Admin. You can manage calls and follow-up for your assigned leads only.
        </div>
      )}

      <div style={{ ...cardStyle }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
            {isAdmin ? `All Leads (${filteredLeads.length})` : `My Assigned Leads (${filteredLeads.length})`}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Search lead"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              style={{ ...inputStyle, minWidth: 180, padding: "8px 10px" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | LeadRecord["status"])}
              style={{ ...inputStyle, padding: "8px 10px" }}
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="not_interested">Not Interested</option>
              <option value="scheduled">Scheduled</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Date / Time</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Source</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>POC Name</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Phone No.</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Address</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Email ID</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Company Name</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>City</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>State</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Pincode</th>
                <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Assign To</th>
                <th style={{ textAlign: "right", fontSize: 11, color: "#64748b", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} style={{ background: selectedLeadId === lead.id ? "#eef2ff" : "transparent" }}>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.createdAt ? new Date(lead.createdAt).toLocaleString("en-IN") : "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.source || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#0f172a", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{lead.name}</span>
                    <span style={{ background: statusColor(lead.status), color: "#fff", padding: "4px 8px", borderRadius: 999, fontSize: 11, textTransform: "capitalize" }}>{String(lead.status || "").replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>{lead.phone}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#475569" }}>{lead.address || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.email || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.company || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.city || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.state || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.pincode || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.assignedToName || "-"}</td>
                  <td style={{ padding: "10px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                    <button
                      onClick={() => openLeadModal(lead.id)}
                      style={{ border: "none", background: "#4f46e5", color: "#fff", borderRadius: 8, fontSize: 12, padding: "7px 12px", cursor: "pointer" }}
                    >
                      Action
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loadingLeads && filteredLeads.length === 0 && <div style={{ fontSize: 12, color: "#64748b", padding: "8px 0 2px" }}>Loading leads...</div>}
          {!loadingLeads && filteredLeads.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0 2px" }}>No leads available.</div>}
        </div>
      </div>

      {selectedLead && isLeadModalOpen && (
        <div
          onClick={closeLeadModal}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: 14 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(960px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Lead Action Form</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Employee yahan se name, phone, address aur call details update karega.</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
                  <div><strong>Date:</strong> {selectedLead?.createdAt ? new Date(selectedLead.createdAt).toLocaleString("en-IN") : "-"}</div>
                  <div><strong>Source:</strong> {selectedLead?.source || "-"}</div>
                </div>
              </div>
              <button onClick={closeLeadModal} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Close</button>
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", marginBottom: 8 }}>
              <input placeholder="Name" value={leadMetaForm.name} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, name: e.target.value })} style={inputStyle} />
              <input placeholder="Phone No." value={leadMetaForm.phone} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, phone: e.target.value })} style={inputStyle} />
              <input placeholder="Address" value={leadMetaForm.address} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, address: e.target.value })} style={inputStyle} />
              <input placeholder="Email" value={leadMetaForm.email} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, email: e.target.value })} style={inputStyle} />
              <input placeholder="Company" value={leadMetaForm.company} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, company: e.target.value })} style={inputStyle} />
              <input placeholder="City" value={leadMetaForm.city} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, city: e.target.value })} style={inputStyle} />
              <input placeholder="State" value={leadMetaForm.state} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, state: e.target.value })} style={inputStyle} />
              <input placeholder="Pin code" value={leadMetaForm.pincode} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, pincode: e.target.value })} style={inputStyle} />
              <select value={leadMetaForm.status} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, status: e.target.value as LeadRecord["status"] })} style={inputStyle}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="not_interested">Not Interested</option>
                <option value="follow_up">Follow Up</option>
                <option value="scheduled_meeting">Schedule Meeting</option>
                <option value="ordered">Ordered</option>
                <option value="onboarding_scheduled">Onboarding Scheduled</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              {(leadMetaForm.status === "follow_up" || leadMetaForm.status === "scheduled_meeting" || leadMetaForm.status === "onboarding_scheduled") && (
                <input type="datetime-local" value={leadMetaForm.nextFollowUpAt} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, nextFollowUpAt: e.target.value })} style={inputStyle} />
              )}
              <select value={leadMetaForm.assignedToUid} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, assignedToUid: e.target.value })} style={inputStyle}>
                <option value="">Assigned User</option>
                {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              </select>
              <button onClick={saveLeadMeta} disabled={!canEdit || savingLeadMeta} style={{ ...primaryButtonStyle, opacity: canEdit && !savingLeadMeta ? 1 : 0.5 }}>
                {savingLeadMeta ? "Saving..." : "Save Leads"}
              </button>
            </div>

            <textarea placeholder="Lead master notes" value={leadMetaForm.notes} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, notes: e.target.value })} style={{ width: "100%", minHeight: 60, marginBottom: 8, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13, resize: "vertical" }} />

            <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 8, paddingTop: 10, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Call Update</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginTop: 8 }}>
              <select value={callForm.outcome} onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value as LeadCallRecord["outcome"] })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                <option value="follow_up">Follow Up</option>
                <option value="interested">Interested</option>
                <option value="not_interested">Not Interested</option>
                <option value="no_response">No Response</option>
              </select>
              <select value={callForm.callType} onChange={(e) => setCallForm({ ...callForm, callType: e.target.value as LeadCallRecord["callType"] })} style={inputStyle}>
                <option value="voice">Voice Call</option>
                <option value="whatsapp">WhatsApp Call</option>
                <option value="meeting">Physical Meeting</option>
                <option value="video">Video Call</option>
              </select>
              <select value={callForm.followUpMode} onChange={(e) => setCallForm({ ...callForm, followUpMode: e.target.value as LeadCallRecord["followUpMode"] })} style={inputStyle}>
                <option value="call">Follow-up by Call</option>
                <option value="whatsapp">Follow-up by WhatsApp</option>
                <option value="meeting">Follow-up by Meeting</option>
                <option value="none">No Follow-up</option>
              </select>
              <input placeholder="Duration (min)" type="number" min={0} value={callForm.durationMinutes} onChange={(e) => setCallForm({ ...callForm, durationMinutes: e.target.value })} style={inputStyle} />
              <input type="datetime-local" value={callForm.scheduledAt} onChange={(e) => setCallForm({ ...callForm, scheduledAt: e.target.value })} style={inputStyle} />
            </div>
            <input placeholder="Next action" value={callForm.nextAction} onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })} style={{ ...inputStyle, width: "100%", marginTop: 8 }} />
            <textarea placeholder="Call notes" value={callForm.notes} onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })} style={{ width: "100%", minHeight: 78, marginTop: 8, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13, resize: "vertical" }} />
            <button onClick={saveCallRecord} disabled={!canEdit || savingCall} style={{ ...primaryButtonStyle, marginTop: 8, opacity: canEdit && !savingCall ? 1 : 0.5 }}>
              {savingCall ? "Saving..." : "Save Record"}
            </button>

            <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>History</div>
              <div style={{ display: "grid", gap: 8, maxHeight: 260, overflow: "auto" }}>
                {callLogs.map((log) => (
                  <div key={log.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>{log.outcome} {log.priority ? `| ${log.priority}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{new Date(log.calledAt).toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Type: {log.callType || "-"} | Duration: {log.durationMinutes || 0}m | Follow-up: {log.followUpMode || "-"}</div>
                    {log.nextAction ? <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>Next Action: {log.nextAction}</div> : null}
                    {log.notes ? <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>{log.notes}</div> : null}
                    {log.scheduledAt ? <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>Next: {new Date(log.scheduledAt).toLocaleString("en-IN")}</div> : null}
                  </div>
                ))}
                {callLogs.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>No call records yet.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErmInventoryModule() {
  const router = useRouter();
  const { userData } = useAuth();
  const { products, categories, collections, loading, setProducts, refreshData } = useData();

  const canCreate = hasPermission(userData, "inv_items_create");
  const canEdit = hasPermission(userData, "inv_items_edit");
  const canDelete = userData?.role === "admin";
  const isAdminOrManager = userData?.role === "admin" || userData?.role === "manager";

  const currentUser = {
    uid: userData?.uid || "",
    name: userData?.name || "User",
    role: userData?.role || "employee",
  };

  return (
    <div style={{ ...cardStyle, padding: 12 }}>
      <div style={{ padding: "4px 2px 12px", fontSize: 13, color: "#475569" }}>
        Showing only All Items content from Inventory module.
      </div>
      <ProductList
        products={products}
        categories={categories}
        collections={collections}
        loading={loading}
        isAdminOrManager={isAdminOrManager}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={() => router.push("/dashboard/inventory")}
        onRefresh={() => refreshData("inventory")}
        user={currentUser}
        onCreateNew={() => router.push("/dashboard/inventory")}
        onProductsChange={setProducts}
        onShareCatalog={() => router.push("/dashboard/erm/catalog-sharing")}
        isMobile={typeof window !== "undefined" ? window.innerWidth < 640 : false}
        isDesktop={typeof window !== "undefined" ? window.innerWidth >= 1024 : true}
      />
    </div>
  );
}

export function ErmCatalogModule() {
  const { products, categories, collections, brands, loading } = useData();
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 640 : false;

  return (
    <div style={cardStyle}>
      <CatalogTab
        products={products}
        categories={categories}
        collections={collections}
        brands={brands}
        loading={loading}
        isMobile={isMobile}
        isDesktop={!isMobile}
      />
    </div>
  );
}
