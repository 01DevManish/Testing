"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CatalogTab from "../../inventory/components/Catalog/CatalogTab";
import ProductList from "../../inventory/components/Products/ProductList";
import { useData } from "../../../context/DataContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";
import ErmLeadsModule from "./erm-leads/ErmLeadsModule";
import LeadStatCards from "./erm-leads/LeadStatCards";
import ErmOrdersModuleComponent from "./erm-orders/ErmOrdersModule";
import { LeadRecord } from "./erm-leads/types";
import { ErmOrder } from "./erm-orders/ErmOrdersModule";


type DispatchLike = Record<string, any>;

type EmployeeSummary = {
  uid: string;
  name: string;
  role: string;
  orders: number;
  sales: number;
};

const hasCrmPermissionAccess = (user: { role?: string; permissions?: string[]; email?: string } | null | undefined) => {
  if (!user) return false;
  return (
    hasPermission(user, "erm_dashboard_view")
    || hasPermission(user, "erm_inventory_view")
    || hasPermission(user, "erm_leads_view")
    || hasPermission(user, "erm_orders_view")
    || hasPermission(user, "erm_catalog_view")
    || hasPermission(user, "erm_view")
    || hasPermission(user, "crm_view")
    || hasPermission(user, "erm")
    || hasPermission(user, "crm")
  );
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

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadCalls, setLeadCalls] = useState<Record<string, any>[]>([]);
  const [orders, setOrders] = useState<ErmOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceCreatingUid, setWorkspaceCreatingUid] = useState<string>("");
  const [workspaceReadyByUid, setWorkspaceReadyByUid] = useState<Record<string, boolean>>({});
  const [activityPage, setActivityPage] = useState(1);

  const isAdmin = userData?.role === "admin";
  const [selectedUid, setSelectedUid] = useState<string>(forcedEmployeeUid || "all");

  useEffect(() => {
    if (forcedEmployeeUid) setSelectedUid(forcedEmployeeUid);
  }, [forcedEmployeeUid]);

  useEffect(() => {
    const fetchErmData = async () => {
      setLoading(true);
      try {
        const [resLeads, resOrders, resLeadCalls] = await Promise.all([
          fetch("/api/data/ermLeads"),
          fetch("/api/data/ermOrders"),
          fetch("/api/data/ermLeadCalls"),
        ]);
        const dataLeads = resLeads.ok ? await resLeads.json() : { items: [] };
        const dataOrders = resOrders.ok ? await resOrders.json() : { items: [] };
        const dataLeadCalls = resLeadCalls.ok ? await resLeadCalls.json() : { items: [] };
        setLeads(Array.isArray(dataLeads.items) ? dataLeads.items : []);
        setOrders(Array.isArray(dataOrders.items) ? dataOrders.items : []);
        setLeadCalls(Array.isArray(dataLeadCalls.items) ? dataLeadCalls.items : []);
      } catch (err) {
        console.error("Failed to fetch ERM dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchErmData();
  }, []);

  const allowedUserKey = useMemo(() => {
    if (isAdmin) return selectedUid;
    return userData?.uid || "";
  }, [isAdmin, selectedUid, userData]);

  const visibleLeads = useMemo(() => {
    if (isAdmin && allowedUserKey === "all") return leads;
    return leads.filter((l) => l.assignedToUid === allowedUserKey);
  }, [leads, isAdmin, allowedUserKey]);

  const visibleOrders = useMemo(() => {
    if (isAdmin && allowedUserKey === "all") return orders;
    return orders.filter((o) => o.employeeUid === allowedUserKey);
  }, [orders, isAdmin, allowedUserKey]);

  const visibleLeadCalls = useMemo(() => {
    if (isAdmin && allowedUserKey === "all") return leadCalls;
    return leadCalls.filter((c) => String(c?.calledByUid || "") === allowedUserKey);
  }, [leadCalls, isAdmin, allowedUserKey]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let dailySales = 0;
    let saleItemsCount = 0;
    let pendingPoCount = 0;

    visibleOrders.forEach(o => {
      if (o.status === "pending_po") pendingPoCount++;
      if (o.createdAt >= todayStart.getTime()) {
        dailySales += o.totalAmount;
      }
      saleItemsCount += o.items.reduce((acc, item) => acc + item.quantity, 0);
    });

    return {
      totalLeads: visibleLeads.length,
      dailySales,
      saleItemsCount,
      pendingPoCount,
      statusChangedLeads: visibleLeads.filter((l) => String(l.status || "").toLowerCase() !== "new").length,
      notesUpdatedLeads: visibleLeads.filter((l) => Boolean(String(l.notes || "").trim())).length,
      callsDone: visibleLeadCalls.length,
    };
  }, [visibleOrders, visibleLeads, visibleLeadCalls]);

  const recentLeadUpdates = useMemo(() => {
    const leadActivities = visibleLeads.flatMap((lead) => {
      const rows: Array<{
        id: string;
        leadId: string;
        leadName: string;
        company: string;
        type: "status" | "note";
        text: string;
        timestamp: number;
      }> = [];

      if (String(lead.status || "").toLowerCase() !== "new" || String(lead.lastOutcome || "").trim()) {
        rows.push({
          id: `${lead.id}_status`,
          leadId: lead.id,
          leadName: lead.name || "Unnamed Lead",
          company: lead.company || "",
          type: "status",
          text: `Status: ${String(lead.status || "new").replace(/_/g, " ")}${lead.lastOutcome ? ` | Outcome: ${String(lead.lastOutcome).replace(/_/g, " ")}` : ""}`,
          timestamp: Number(lead.updatedAt) || 0,
        });
      }

      if (String(lead.notes || "").trim()) {
        rows.push({
          id: `${lead.id}_note`,
          leadId: lead.id,
          leadName: lead.name || "Unnamed Lead",
          company: lead.company || "",
          type: "note",
          text: `Note: ${String(lead.notes)}`,
          timestamp: Number(lead.updatedAt) || 0,
        });
      }

      return rows;
    });

    const leadNameById = new Map<string, { leadName: string; company: string }>();
    visibleLeads.forEach((lead) => {
      leadNameById.set(String(lead.id), {
        leadName: lead.name || "Unnamed Lead",
        company: lead.company || "",
      });
    });

    const callActivities = visibleLeadCalls.map((call, idx) => {
      const leadId = String(call?.leadId || "");
      const leadMeta = leadNameById.get(leadId);
      return {
        id: `${String(call?.id || "call")}_${idx}`,
        leadId,
        leadName: leadMeta?.leadName || "Unknown Lead",
        company: leadMeta?.company || "",
        type: "call" as const,
        text: `Call: ${String(call?.outcome || "updated").replace(/_/g, " ")}${call?.notes ? ` | ${String(call.notes)}` : ""}`,
        timestamp: Number(call?.calledAt) || 0,
      };
    });

    return [...leadActivities, ...callActivities]
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [visibleLeads, visibleLeadCalls]);

  const ACTIVITY_PAGE_SIZE = 10;
  const activityTotalPages = Math.max(1, Math.ceil(recentLeadUpdates.length / ACTIVITY_PAGE_SIZE));
  const paginatedActivities = useMemo(
    () => recentLeadUpdates.slice((activityPage - 1) * ACTIVITY_PAGE_SIZE, activityPage * ACTIVITY_PAGE_SIZE),
    [recentLeadUpdates, activityPage],
  );

  useEffect(() => {
    setActivityPage(1);
  }, [allowedUserKey]);

  useEffect(() => {
    if (activityPage > activityTotalPages) setActivityPage(activityTotalPages);
  }, [activityPage, activityTotalPages]);

  const crmUsers = useMemo(
    () => users.filter((u) => u.role !== "admin" && u.email !== "01devmanish@gmail.com" && hasCrmPermissionAccess(u)),
    [users],
  );

  const employeeRows = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map<string, { uid: string; name: string; role: string; orders: number; sales: number; workspaceReady: boolean }>();
    crmUsers.forEach(u => map.set(u.uid, {
      uid: u.uid,
      name: u.name,
      role: u.role || "employee",
      orders: 0,
      sales: 0,
      workspaceReady: workspaceReadyByUid[u.uid] ?? Boolean(u.crmWorkspaceCreated),
    }));
    
    orders.forEach(o => {
      const emp = map.get(o.employeeUid);
      if (emp) {
        emp.orders += 1;
        emp.sales += o.totalAmount;
      }
    });
    
    return Array.from(map.values()).sort((a,b) => b.sales - a.sales);
  }, [isAdmin, crmUsers, orders, workspaceReadyByUid]);

  const setWorkspaceForUser = useCallback(async (uid: string, workspaceReady: boolean) => {
    if (!uid) return;
    setWorkspaceCreatingUid(uid);
    try {
      const res = await fetch("/api/admin/user-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, data: { crmWorkspaceCreated: workspaceReady } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update workspace");
      setWorkspaceReadyByUid((prev) => ({ ...prev, [uid]: workspaceReady }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update workspace";
      alert(message);
    } finally {
      setWorkspaceCreatingUid("");
    }
  }, []);

  const formatMoney = (amount: number) => `Rs. ${Math.round(amount || 0).toLocaleString("en-IN")}`;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {isAdmin && (
        <div style={{ ...cardStyle, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Filter By Employee:</div>
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "6px 10px", fontSize: 12 }}
          >
            <option value="all">All Employees</option>
            {crmUsers.map((row) => (
              <option key={row.uid} value={row.uid}>{row.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Leads", value: stats.totalLeads, color: "#4f46e5" },
          { label: "Daily Sales", value: formatMoney(stats.dailySales), color: "#16a34a" },
          { label: "Sale Items", value: stats.saleItemsCount, color: "#ea580c" },
          { label: "Pending PO", value: stats.pendingPoCount, color: "#d97706" },
          { label: "Status Changed", value: stats.statusChangedLeads, color: "#7c3aed" },
          { label: "Notes Updated", value: stats.notesUpdatedLeads, color: "#0f766e" },
          { label: "Calls Done", value: stats.callsDone, color: "#be123c" }
        ].map(stat => (
          <div key={stat.label} style={{ ...cardStyle, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{loading ? "..." : stat.value}</div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Admin Employee Analytics</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px" }}>Employee</th>
                  <th style={{ textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px" }}>Orders</th>
                  <th style={{ textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px" }}>Sales</th>
                  <th style={{ textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", padding: "8px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((row) => (
                  <tr key={row.uid}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#0f172a", fontWeight: 500 }}>
                      {row.name} <span style={{ color: "#94a3b8", fontSize: 11 }}>({row.role})</span>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: 13 }}>{row.orders}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: 13, fontWeight: 600 }}>{formatMoney(row.sales)}</td>
                    <td style={{ padding: "14px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span
                          style={{
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                            border: row.workspaceReady ? "1px solid #bbf7d0" : "1px solid #fed7aa",
                            background: row.workspaceReady ? "#f0fdf4" : "#fff7ed",
                            color: row.workspaceReady ? "#166534" : "#9a3412",
                          }}
                        >
                          {row.workspaceReady ? "Workspace Ready" : "Workspace Pending"}
                        </span>
                        {row.workspaceReady ? (
                          <button
                            onClick={() => setWorkspaceForUser(row.uid, false)}
                            disabled={workspaceCreatingUid === row.uid}
                            style={{
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#b91c1c",
                              borderRadius: 8,
                              fontSize: 13,
                              padding: "8px 10px",
                              cursor: workspaceCreatingUid === row.uid ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              opacity: workspaceCreatingUid === row.uid ? 0.7 : 1,
                            }}
                          >
                            {workspaceCreatingUid === row.uid ? "Updating..." : "Close Workspace"}
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await setWorkspaceForUser(row.uid, true);
                              router.push(`/dashboard/erm/employee/${row.uid}/dashboard?employeeName=${encodeURIComponent(row.name)}`);
                            }}
                            disabled={workspaceCreatingUid === row.uid}
                            style={{
                              border: "1px solid #fdba74",
                              background: "#fff7ed",
                              color: "#9a3412",
                              borderRadius: 8,
                              fontSize: 14,
                              padding: "8px 12px",
                              cursor: workspaceCreatingUid === row.uid ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              opacity: workspaceCreatingUid === row.uid ? 0.7 : 1,
                            }}
                          >
                            {workspaceCreatingUid === row.uid ? "Opening..." : "Open Workspace"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadStatCards leads={visibleLeads} loading={loading} />

      <div style={cardStyle}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
          Recent Lead Status & Notes
        </div>
        {recentLeadUpdates.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>
            No status changes or notes yet.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10 }}>
              {paginatedActivities.map((activity) => {
                const updatedOn = activity.timestamp
                  ? new Date(activity.timestamp).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "-";
                return (
                  <div
                    key={activity.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                        {activity.leadName} {activity.company ? `(${activity.company})` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{updatedOn}</div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>
                      {activity.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Page {activityPage} of {activityTotalPages}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  disabled={activityPage === 1}
                  style={{ ...subtleButtonStyle, padding: "6px 10px", opacity: activityPage === 1 ? 0.5 : 1, cursor: activityPage === 1 ? "not-allowed" : "pointer" }}
                >
                  Prev
                </button>
                <button
                  onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}
                  disabled={activityPage === activityTotalPages}
                  style={{ ...subtleButtonStyle, padding: "6px 10px", opacity: activityPage === activityTotalPages ? 0.5 : 1, cursor: activityPage === activityTotalPages ? "not-allowed" : "pointer" }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ErmOrdersModule() {
  return <ErmOrdersModuleComponent />;
}


export function ErmInventoryModule() {
  const router = useRouter();
  const { userData } = useAuth();
  const { products, categories, collections, loading, setProducts, refreshData } = useData();
  
  useEffect(() => {
    if (products.length === 0) {
      refreshData("inventory");
      refreshData("categories");
      refreshData("collections");
    }
  }, [products.length, refreshData]);

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
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <ProductList
        products={products}
        categories={categories}
        collections={collections}
        loading={loading}
        isAdminOrManager={isAdminOrManager}
        canCreate={false}
        canEdit={false}
        canDelete={false}
        hideBulkExport={true}
        hideActions={true}
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
  const { products, categories, collections, brands, loading, refreshData } = useData();
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 640 : false;

  useEffect(() => {
    if (products.length === 0) refreshData("inventory");
  }, [products.length, refreshData]);

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
