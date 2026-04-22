"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onValue, push, ref, set, update } from "firebase/database";
import CatalogTab from "../../inventory/components/Catalog/CatalogTab";
import ProductList from "../../inventory/components/Products/ProductList";
import { useData } from "../../../context/DataContext";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/firebase";
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
  email?: string;
  company?: string;
  city?: string;
  source?: string;
  status: "new" | "contacted" | "interested" | "not_interested" | "scheduled" | "won" | "lost";
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

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
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

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [callLogs, setCallLogs] = useState<LeadCallRecord[]>([]);

  const [leadForm, setLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    city: "",
    source: "",
    assignedToUid: "",
  });

  const [callForm, setCallForm] = useState({
    outcome: "follow_up" as LeadCallRecord["outcome"],
    notes: "",
    scheduledAt: "",
    callType: "voice" as LeadCallRecord["callType"],
    durationMinutes: "",
    followUpMode: "call" as LeadCallRecord["followUpMode"],
    priority: "warm" as LeadCallRecord["priority"],
    nextAction: "",
  });
  const [leadMetaForm, setLeadMetaForm] = useState({
    status: "new" as LeadRecord["status"],
    assignedToUid: "",
    notes: "",
  });

  useEffect(() => {
    const unsub = onValue(ref(db, "ermLeads"), (snap) => {
      const list: LeadRecord[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key || "", ...child.val() });
        });
      }
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setLeads(list);
      if (!selectedLeadId && list[0]?.id) setSelectedLeadId(list[0].id);
    });
    return () => unsub();
  }, [selectedLeadId]);

  useEffect(() => {
    if (!selectedLeadId) {
      setCallLogs([]);
      return;
    }
    const unsub = onValue(ref(db, `ermLeadCalls/${selectedLeadId}`), (snap) => {
      const list: LeadCallRecord[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key || "", ...child.val() } as LeadCallRecord);
        });
      }
      list.sort((a, b) => (b.calledAt || 0) - (a.calledAt || 0));
      setCallLogs(list);
    });
    return () => unsub();
  }, [selectedLeadId]);

  const staff = useMemo(
    () => users.filter((u) => u.role === "employee" || u.role === "manager" || u.role === "admin"),
    [users],
  );

  const visibleLeads = useMemo(() => {
    if (isAdmin) return leads;
    return leads.filter((lead) => lead.assignedToUid === userData?.uid);
  }, [isAdmin, leads, userData]);

  const selectedLead = visibleLeads.find((x) => x.id === selectedLeadId) || null;

  useEffect(() => {
    if (!selectedLead) return;
    setLeadMetaForm({
      status: selectedLead.status || "new",
      assignedToUid: selectedLead.assignedToUid || "",
      notes: selectedLead.notes || "",
    });
  }, [selectedLead]);

  const createLead = async () => {
    if (!canAdminUpload) return;
    if (!leadForm.name.trim() || !leadForm.phone.trim()) return;

    const assignee = staff.find((s) => s.uid === leadForm.assignedToUid);
    const newRef = push(ref(db, "ermLeads"));
    const now = Date.now();
    await set(newRef, {
      name: leadForm.name.trim(),
      phone: leadForm.phone.trim(),
      email: leadForm.email.trim(),
      company: leadForm.company.trim(),
      city: leadForm.city.trim(),
      source: leadForm.source.trim() || "manual",
      status: "new",
      assignedToUid: assignee?.uid || userData?.uid || "",
      assignedToName: assignee?.name || userData?.name || "",
      createdAt: now,
      updatedAt: now,
    });

    setLeadForm({ name: "", phone: "", email: "", company: "", city: "", source: "", assignedToUid: "" });
  };

  const saveCallRecord = async () => {
    if (!canEdit || !selectedLead) return;
    const now = Date.now();
    const scheduledTs = callForm.scheduledAt ? new Date(callForm.scheduledAt).getTime() : undefined;
    const duration = Number(callForm.durationMinutes || 0);

    const callRef = push(ref(db, `ermLeadCalls/${selectedLead.id}`));
    await set(callRef, {
      outcome: callForm.outcome,
      notes: callForm.notes.trim(),
      scheduledAt: scheduledTs,
      callType: callForm.callType,
      durationMinutes: duration > 0 ? duration : null,
      followUpMode: callForm.followUpMode,
      priority: callForm.priority,
      nextAction: callForm.nextAction.trim(),
      calledAt: now,
      calledByUid: userData?.uid || "",
      calledByName: userData?.name || "",
    });

    await update(ref(db, `ermLeads/${selectedLead.id}`), {
      status: callForm.outcome === "interested" ? "interested" : callForm.outcome === "not_interested" ? "not_interested" : (scheduledTs ? "scheduled" : "contacted"),
      nextFollowUpAt: scheduledTs || null,
      lastOutcome: callForm.outcome,
      notes: callForm.notes.trim() || selectedLead.notes || "",
      priority: callForm.priority || selectedLead.priority || "warm",
      callAttemptCount: Number(selectedLead.callAttemptCount || 0) + 1,
      updatedAt: now,
    });

    setCallForm({
      outcome: "follow_up",
      notes: "",
      scheduledAt: "",
      callType: "voice",
      durationMinutes: "",
      followUpMode: "call",
      priority: "warm",
      nextAction: "",
    });
  };

  const saveLeadMeta = async () => {
    if (!canEdit || !selectedLead) return;
    const assignee = staff.find((s) => s.uid === leadMetaForm.assignedToUid);
    await update(ref(db, `ermLeads/${selectedLead.id}`), {
      status: leadMetaForm.status,
      assignedToUid: leadMetaForm.assignedToUid || selectedLead.assignedToUid || "",
      assignedToName: assignee?.name || selectedLead.assignedToName || "",
      notes: leadMetaForm.notes.trim(),
      updatedAt: Date.now(),
    });
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
    for (const row of rows) {
      const name = pickFromRow(row, ["name", "full_name", "customer_name", "lead_name"]);
      const phone = pickFromRow(row, ["phone", "mobile", "contact", "phone_number"]);
      if (!name || !phone) continue;

      const assignedUid = pickFromRow(row, ["assigned_uid", "assigned_to_uid", "assignedtouid", "owner_uid"]) || userData?.uid || "";
      const assigned = staff.find((s) => s.uid === assignedUid);

      const newRef = push(ref(db, "ermLeads"));
      await set(newRef, {
        name,
        phone,
        email: pickFromRow(row, ["email"]),
        company: pickFromRow(row, ["company", "organization"]),
        city: pickFromRow(row, ["city"]),
        source: pickFromRow(row, ["source"]) || (fileName.endsWith(".csv") ? "csv_upload" : "xlsx_upload"),
        status: "new",
        assignedToUid: assignedUid,
        assignedToName: assigned?.name || pickFromRow(row, ["assigned_to_name", "owner_name"]) || userData?.name || "",
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {isAdmin ? (
        <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <input placeholder="Lead name" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
          <input placeholder="Phone" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
          <input placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
          <input placeholder="Company" value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
          <input placeholder="Source" value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
          <select value={leadForm.assignedToUid} onChange={(e) => setLeadForm({ ...leadForm, assignedToUid: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
            <option value="">Assign to</option>
            {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createLead} disabled={!canAdminUpload} style={{ border: "none", background: "#4f46e5", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 13, cursor: "pointer", opacity: canAdminUpload ? 1 : 0.5 }}>Add Lead</button>
            <label style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: "pointer", background: "#fff" }}>
              Upload CSV/XLSX
              <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLeadsFile(f); }} />
            </label>
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, fontSize: 13, color: "#475569" }}>
          Leads are uploaded and assigned by Admin. You can manage calls and follow-up for your assigned leads only.
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)" }}>
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          {isAdmin ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Leads ({visibleLeads.length})</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 4px", borderBottom: "1px solid #e2e8f0" }}>Name</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 4px", borderBottom: "1px solid #e2e8f0" }}>Phone</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 4px", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 4px", borderBottom: "1px solid #e2e8f0" }}>Next Follow-Up</th>
                    <th style={{ textAlign: "left", fontSize: 11, color: "#64748b", padding: "8px 4px", borderBottom: "1px solid #e2e8f0" }}>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => (
                    <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} style={{ cursor: "pointer", background: selectedLeadId === lead.id ? "#eef2ff" : "transparent" }}>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>{lead.name}</td>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>{lead.phone}</td>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.status}</td>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9", fontSize: 11 }}>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("en-IN") : "-"}</td>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>{lead.assignedToName || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>My Assigned Leads ({visibleLeads.length})</div>
              <div style={{ display: "grid", gap: 10, maxHeight: 520, overflowY: "auto", paddingRight: 2 }}>
                {visibleLeads.map((lead) => (
                  <div key={lead.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: selectedLeadId === lead.id ? "#eef2ff" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{lead.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{lead.phone}</div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Status: {lead.status}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                          Next: {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("en-IN") : "Not scheduled"}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedLeadId(lead.id)}
                        style={{ border: "none", background: "#4f46e5", color: "#fff", borderRadius: 8, fontSize: 12, padding: "7px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Take Action
                      </button>
                    </div>
                  </div>
                ))}
                {visibleLeads.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>No leads assigned yet.</div>}
              </div>
            </>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Call Log & Follow Up</div>
          {selectedLead ? (
            <>
              <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
                <strong>{selectedLead.name}</strong> ({selectedLead.phone})
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 8 }}>
                <select value={leadMetaForm.status} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, status: e.target.value as LeadRecord["status"] })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
                <select value={leadMetaForm.assignedToUid} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, assignedToUid: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <option value="">Assigned User</option>
                  {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                </select>
                <button onClick={saveLeadMeta} disabled={!canEdit} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 13, cursor: "pointer", opacity: canEdit ? 1 : 0.5 }}>
                  Update Lead
                </button>
              </div>

              <textarea placeholder="Lead master notes" value={leadMetaForm.notes} onChange={(e) => setLeadMetaForm({ ...leadMetaForm, notes: e.target.value })} style={{ width: "100%", minHeight: 60, marginBottom: 8, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13, resize: "vertical" }} />

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
                <select value={callForm.outcome} onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value as LeadCallRecord["outcome"] })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <option value="follow_up">Follow Up</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="no_response">No Response</option>
                </select>
                <select value={callForm.callType} onChange={(e) => setCallForm({ ...callForm, callType: e.target.value as LeadCallRecord["callType"] })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <option value="voice">Voice Call</option>
                  <option value="whatsapp">WhatsApp Call</option>
                  <option value="meeting">Physical Meeting</option>
                  <option value="video">Video Call</option>
                </select>
                <select value={callForm.followUpMode} onChange={(e) => setCallForm({ ...callForm, followUpMode: e.target.value as LeadCallRecord["followUpMode"] })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <option value="call">Follow-up by Call</option>
                  <option value="whatsapp">Follow-up by WhatsApp</option>
                  <option value="meeting">Follow-up by Meeting</option>
                  <option value="none">No Follow-up</option>
                </select>
                <select value={callForm.priority} onChange={(e) => setCallForm({ ...callForm, priority: e.target.value as LeadCallRecord["priority"] })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }}>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
                <input placeholder="Duration (min)" type="number" min={0} value={callForm.durationMinutes} onChange={(e) => setCallForm({ ...callForm, durationMinutes: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
                <input type="datetime-local" value={callForm.scheduledAt} onChange={(e) => setCallForm({ ...callForm, scheduledAt: e.target.value })} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
              </div>
              <input placeholder="Next action" value={callForm.nextAction} onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })} style={{ width: "100%", marginTop: 8, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13 }} />
              <textarea placeholder="Call notes" value={callForm.notes} onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })} style={{ width: "100%", minHeight: 78, marginTop: 8, border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, fontSize: 13, resize: "vertical" }} />
              <button onClick={saveCallRecord} disabled={!canEdit} style={{ marginTop: 8, border: "none", background: "#4f46e5", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 13, cursor: "pointer", opacity: canEdit ? 1 : 0.5 }}>
                Save Call Record
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
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Select a lead to manage calls and schedule follow-up.</div>
          )}
        </div>
      </div>
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
