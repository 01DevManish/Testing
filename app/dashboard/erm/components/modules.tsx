"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CatalogTab from "../../inventory/components/Catalog/CatalogTab";
import ProductList from "../../inventory/components/Products/ProductList";
import { useData } from "../../../context/DataContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";
import ErmLeadsModule from "./erm-leads/ErmLeadsModule";
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
  if (user.role === "admin") return true;
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
  const [orders, setOrders] = useState<ErmOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceCreatingUid, setWorkspaceCreatingUid] = useState<string>("");
  const [workspaceReadyByUid, setWorkspaceReadyByUid] = useState<Record<string, boolean>>({});

  const isAdmin = userData?.role === "admin";
  const [selectedUid, setSelectedUid] = useState<string>(forcedEmployeeUid || "all");

  useEffect(() => {
    if (forcedEmployeeUid) setSelectedUid(forcedEmployeeUid);
  }, [forcedEmployeeUid]);

  useEffect(() => {
    const fetchErmData = async () => {
      setLoading(true);
      try {
        const [resLeads, resOrders] = await Promise.all([
          fetch("/api/data/ermLeads"),
          fetch("/api/data/ermOrders"),
        ]);
        const dataLeads = resLeads.ok ? await resLeads.json() : { items: [] };
        const dataOrders = resOrders.ok ? await resOrders.json() : { items: [] };
        setLeads(Array.isArray(dataLeads.items) ? dataLeads.items : []);
        setOrders(Array.isArray(dataOrders.items) ? dataOrders.items : []);
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
      pendingPoCount
    };
  }, [visibleOrders, visibleLeads]);

  const crmUsers = useMemo(
    () => users.filter((u) => u.email !== "01devmanish@gmail.com" && hasCrmPermissionAccess(u)),
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

  const createWorkspaceForUser = useCallback(async (uid: string) => {
    if (!uid) return;
    setWorkspaceCreatingUid(uid);
    try {
      const res = await fetch("/api/admin/user-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, data: { crmWorkspaceCreated: true } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create workspace");
      setWorkspaceReadyByUid((prev) => ({ ...prev, [uid]: true }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create workspace";
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
          { label: "Pending PO", value: stats.pendingPoCount, color: "#d97706" }
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
                      {row.workspaceReady ? (
                        <button
                          onClick={() => router.push(`/dashboard/erm/employee/${row.uid}/dashboard`)}
                          style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", borderRadius: 8, fontSize: 14, padding: "8px 12px", cursor: "pointer", fontWeight: 600 }}
                        >
                          Open Workspace
                        </button>
                      ) : (
                        <button
                          onClick={() => createWorkspaceForUser(row.uid)}
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
                          {workspaceCreatingUid === row.uid ? "Creating..." : "Create Workspace"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
