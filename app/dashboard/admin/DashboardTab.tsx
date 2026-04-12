"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserRecord, Task, LoggedActivity } from "./types";
import type { AdminStyles } from "./styles";
import { get, ref, query, limitToLast, onValue, off, remove } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";
import { useAuth } from "../../context/AuthContext";

interface Activity {
  id: string;
  type: "dispatch" | "inventory" | "user" | "task" | "system";
  title: string;
  description: string;
  timestamp: number;
  user: string;
  icon: string;
  color: string;
  metadata?: Record<string, any>;
}

interface Product {
  id: string;
  productName: string;
  sku: string;
  stock: number;
  minStock: number;
  costPrice?: number;
  unit: string;
  status: string;
  imageUrl?: string;
  createdByName?: string;
  updatedByName?: string;
}

interface PackingList {
  id: string;
  partyName: string;
  dispatchId?: string;
  status: string;
  dispatchedAt?: number;
  createdAt: number;
  dispatchedBy?: string;
  bails?: number;
}

interface DashboardTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  users: UserRecord[];
  tasks: Task[];
}

export default function DashboardTab({ S, isMobile, isTablet, users, tasks }: DashboardTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userData } = useAuth();

  // New states for activity feeds
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchFilter, setDispatchFilter] = useState("all"); 
  const [todayDispatchFilter, setTodayDispatchFilter] = useState("all"); 
  const [todayDispatchSearch, setTodayDispatchSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [criticalPage, setCriticalPage] = useState(1);

  // Reset pagination when searching
  useEffect(() => { setInventoryPage(1); }, [inventorySearch]);

  useEffect(() => {
    // 1. Listen for Activities (Live)
    const actRef = query(ref(db, "activities"), limitToLast(50));
    const unsubActivities = onValue(actRef, (snap) => {
      if (snap.exists()) {
        const acts: Activity[] = [];
        snap.forEach((d) => {
          const val = d.val() as LoggedActivity;
          acts.push({
            id: val.id,
            type: val.type,
            title: val.title,
            description: val.description,
            timestamp: val.timestamp,
            user: val.userName || "System",
            icon: val.type === "dispatch" ? (val.title.includes("Ecommerce") ? "🛒" : "🚛") : (val.type === "inventory" ? "📦" : "🔔"),
            color: val.type === "dispatch" ? (val.title.includes("Ecommerce") ? "#6366f1" : "linear-gradient(135deg,#3b82f6,#2dd4bf)") : (val.type === "inventory" ? "#10b981" : "#94a3b8"),
            metadata: val.metadata
          });
        });
        setActivities(acts.sort((a, b) => b.timestamp - a.timestamp));
      }
      setLoading(false);
    });

    // 2. Fetch Inventory (Live for stock status)
    const invRef = ref(db, "inventory");
    const unsubInv = onValue(invRef, (snap) => {
      if (snap.exists()) {
        const invList: Product[] = [];
        snap.forEach(d => {
          invList.push({ id: d.key!, ...d.val() });
        });
        setAllProducts(invList);
      }
    });

    // 3. Fetch Packing Lists (Retail Dispatches)
    const listsRef = ref(db, "packingLists");
    const unsubLists = onValue(listsRef, (snap) => {
      if (snap.exists()) {
        const data: PackingList[] = [];
        snap.forEach((child) => {
          const val = child.val();
          if (val.status === "Completed" || val.status === "Packed") {
            data.push({ id: child.key!, ...val });
          }
        });
        setPackingLists(data);
      }
    });

    return () => {
      off(actRef, "value", unsubActivities);
      off(invRef, "value", unsubInv);
      off(listsRef, "value", unsubLists);
    };
  }, []);

  const deleteActivity = async (a: Activity) => {
    const orderId = a.metadata?.orderId;
    let deleteOrderToo = false;

    if (orderId && confirm(`Delete activity log: "${a.title}"?\n\nWOULD YOU ALSO LIKE TO PERMANENTLY DELETE THE ACTUAL DISPATCH RECORD (${orderId})?`)) {
        deleteOrderToo = true;
    } else if (!confirm(`Delete activity log: "${a.title}"?`)) {
        return;
    }

    try {
      if (deleteOrderToo && orderId) {
        await remove(ref(db, `dispatches/${orderId}`));
        // Log deep deletion
        await logActivity({
          type: "dispatch",
          action: "delete",
          title: "Dispatch Record Removed (Deep Delete)",
          description: `Retail/Ecommerce dispatch ${orderId} was permanently deleted via dashboard log override by ${userData?.name || "Admin"}.`,
          userId: user?.uid || "",
          userName: userData?.name || user?.name || "Admin",
          userRole: "admin",
          metadata: { orderId }
        });
      }

      await remove(ref(db, `activities/${a.id}`));
    } catch (e) {
      console.error(e);
      alert("Something went wrong during deletion.");
    }
  };

  const deleteProduct = async (p: Product) => {
    if (confirm(`DANGER: Permanently delete product "${p.productName}" and its entire inventory?`)) {
      try {
        await remove(ref(db, `inventory/${p.id}`));
        
        // Log product deletion
        await logActivity({
          type: "inventory",
          action: "delete",
          title: "Product Deleted (Admin Dashboard)",
          description: `Product "${p.productName}" (SKU: ${p.sku}) was manually deleted by admin.`,
          userId: user?.uid || "",
          userName: userData?.name || user?.name || "Admin",
          userRole: "admin",
          metadata: { productId: p.id, sku: p.sku }
        });
      } catch (e) {
        console.error(e);
        alert("Failed to delete product.");
      }
    }
  };

  // NEW: Combined dispatch list helper
  const getCombinedDispatches = (search: string, filter: string) => {
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);

    // 1. Convert Retail Packing Lists to Activity Format
    const retailItems: Activity[] = packingLists.map(l => ({
      id: l.id,
      type: "dispatch",
      title: "Retail Dispatch Finalized",
      description: `Retail Dispatch ${l.dispatchId || l.id.slice(-6).toUpperCase()} for ${l.partyName} (Status: ${l.status})`,
      timestamp: l.dispatchedAt || l.createdAt,
      user: l.dispatchedBy || "Eurus Staff",
      icon: "🚛",
      color: "linear-gradient(135deg,#3b82f6,#2dd4bf)",
      metadata: { packingListId: l.id, dispatchId: l.dispatchId }
    }));

    // 2. Filter Existing Activities (Ecommerce)
    const ecommerceItems = activities.filter(a => a.type === "dispatch" && a.title.includes("Ecommerce"));

    // 3. Combine and Filter
    let merged = [...retailItems, ...ecommerceItems];

    if (filter === "Retail") {
      merged = retailItems;
    } else if (filter === "Ecommerce") {
      merged = ecommerceItems;
    }

    // Apply Search
    if (search) {
      const s = search.toLowerCase();
      merged = merged.filter(m => 
        m.title.toLowerCase().includes(s) || 
        m.description.toLowerCase().includes(s) || 
        m.user.toLowerCase().includes(s)
      );
    }

    // Sort by timestamp desc
    merged.sort((a, b) => b.timestamp - a.timestamp);

    // Grouping
    const groups: { [key: string]: Activity[] } = { Today: [], Yesterday: [], Earlier: [] };
    merged.slice(0, 25).forEach(a => {
      const d = new Date(a.timestamp).setHours(0, 0, 0, 0);
      if (d === today) groups.Today.push(a);
      else if (d === yesterday) groups.Yesterday.push(a);
      else groups.Earlier.push(a);
    });

    return groups;
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const ActivityGroup = ({ group, activities }: { group: string; activities: Activity[] }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        {group}
        <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
      </div>
      {activities.map((a) => (
        <div key={a.id} style={{ ...S.activityItem, padding: "12px 0", borderBottom: "1px solid #f8fafc" }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: a.color + "12", color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
            {a.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b" }}>{a.title}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{group === "Earlier" ? formatDate(a.timestamp) : formatTime(a.timestamp)}</div>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{a.description}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, fontWeight: 400, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Performed by: {a.user}</span>
              <button 
                onClick={() => deleteActivity(a)}
                style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", padding: "2px 4px", fontSize: 10 }}
              >
                Delete Log
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div style={{ padding: 100, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔄</div>
      <div style={{ fontWeight: 400 }}>Loading Management Data...</div>
    </div>
  );

  return (
    <div style={S.tabContent}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: isMobile ? 12 : 20, marginBottom: 20 }}>
         {/* PENDING TASKS CARD */}
         <div style={{ ...S.statCard, display: "flex", flexDirection: "column", maxHeight: 250 }}>
            <div style={S.statStripe("#f59e0b")} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 400, textTransform: "capitalize" }}>Pending Tasks</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#f59e0b", background: "#fef3c7", padding: "2px 8px", borderRadius: 12 }}>{tasks.filter(t => t.status !== "completed").length}</div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {tasks.filter(t => t.status !== "completed").map(t => (
                <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Assigned to: <span style={{ fontWeight: 400, color: "#475569" }}>{t.assignedToName}</span></div>
                </div>
              ))}
              {tasks.filter(t => t.status !== "completed").length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No pending tasks!</div>
              )}
            </div>
         </div>

         {/* TODAY'S DISPATCHES CARD */}
         <div style={{ ...S.statCard, display: "flex", flexDirection: "column", maxHeight: 280 }}>
            <div style={S.statStripe("#10b981")} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 400, textTransform: "capitalize", marginBottom: 4 }}>Today's Dispatches</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 400, color: "#10b981", background: "#d1fae5", padding: "2px 8px", borderRadius: 12 }}>
                    {(() => {
                        const groups = getCombinedDispatches(todayDispatchSearch, todayDispatchFilter);
                        return groups.Today.length;
                    })()}
                  </div>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{todayDispatchFilter === "all" ? "Total" : todayDispatchFilter}</span>
                </div>
              </div>
              <select 
                value={todayDispatchFilter} 
                onChange={(e) => setTodayDispatchFilter(e.target.value)}
                style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", outline: "none", cursor: "pointer", background: "#f8fafc", color: "#475569" }}
              >
                <option value="all">All</option>
                <option value="Retail">Retail</option>
                <option value="Ecommerce">Ecommerce</option>
              </select>
            </div>

            {/* Search input removed */}

            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {getCombinedDispatches(todayDispatchSearch, todayDispatchFilter).Today.map(a => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>By: <span style={{ fontWeight: 400, color: "#475569" }}>{a.user}</span> • {new Date(a.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
              {getCombinedDispatches(todayDispatchSearch, todayDispatchFilter).Today.length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No {todayDispatchFilter === "all" ? "" : todayDispatchFilter.toLowerCase() + " "}dispatches found today.</div>
              )}
            </div>
         </div>

         {/* CRITICAL STOCK CARD */}
         <div style={{ ...S.statCard, display: "flex", flexDirection: "column", maxHeight: 250 }}>
            <div style={S.statStripe("#ef4444")} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 400, textTransform: "capitalize" }}>Critical Stock</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#ef4444", background: "#fee2e2", padding: "2px 8px", borderRadius: 12 }}>{allProducts.filter(p => p.stock <= p.minStock).length}</div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {allProducts
                .filter(p => p.stock <= p.minStock)
                .slice((criticalPage - 1) * 2, criticalPage * 2)
                .map(p => (
                <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
                    <img src={p.imageUrl || "/placeholder-prod.png"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.productName}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{p.sku}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#ef4444", textAlign: "right", flexShrink: 0 }}>
                    {p.stock} <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.unit}</span>
                  </div>
                </div>
              ))}
              {allProducts.filter(p => p.stock <= p.minStock).length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>All stock levels are healthy.</div>
              )}
            </div>

            {/* Critical Stock Pagination */}
            {allProducts.filter(p => p.stock <= p.minStock).length > 2 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: "10px 4px 0", borderTop: "1px solid #f1f5f9" }}>
                <button 
                  disabled={criticalPage === 1}
                  onClick={() => setCriticalPage(p => p - 1)}
                  style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 10, opacity: criticalPage === 1 ? 0.5 : 1, cursor: criticalPage === 1 ? "not-allowed" : "pointer", minWidth: 50 }}
                >
                  Prev
                </button>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>Page {criticalPage}</div>
                <button 
                  disabled={criticalPage * 2 >= allProducts.filter(p => p.stock <= p.minStock).length}
                  onClick={() => setCriticalPage(p => p + 1)}
                  style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 10, opacity: (criticalPage * 2 >= allProducts.filter(p => p.stock <= p.minStock).length) ? 0.5 : 1, cursor: (criticalPage * 2 >= allProducts.filter(p => p.stock <= p.minStock).length) ? "not-allowed" : "pointer", minWidth: 50 }}
                >
                  Next
                </button>
              </div>
            )}
         </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: (isMobile || isTablet) ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 20, marginBottom: 20 }}>
        {/* DISPATCH CARD */}
        <div style={S.activityCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 400, color: "#0f172a", margin: 0 }}>🚛 Recent Dispatches</h3>
            <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end", minWidth: 200 }}>
              <input 
                type="text"
                value={dispatchSearch} 
                onChange={(e) => setDispatchSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 160, padding: "6px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc" }}
                placeholder="Search Dispatch ID"
              />
              <select 
                value={dispatchFilter} onChange={e => setDispatchFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc", cursor: "pointer" }}
              >
                <option value="all">All Types</option>
                <option value="Retail">Retail</option>
                <option value="Ecommerce">Ecommerce</option>
              </select>
            </div>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
            {["Today", "Yesterday", "Earlier"].map(g => {
              const groups = getCombinedDispatches(dispatchSearch, dispatchFilter);
              const gActs = groups[g];
              return gActs.length > 0 && <ActivityGroup key={g} group={g} activities={gActs} />;
            })}
            {(() => {
                 const groups = getCombinedDispatches(dispatchSearch, dispatchFilter);
                 if (groups.Today.length === 0 && groups.Yesterday.length === 0 && groups.Earlier.length === 0) {
                     return <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>No recent dispatches found.</div>;
                 }
                 return null;
            })()}
          </div>
        </div>

        {/* LIVE INVENTORY CARD */}
        <div style={S.activityCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 400, color: "#0f172a", margin: 0 }}>📦 Live Inventory</h3>
            <div style={{ position: "relative", flex: 1, maxWidth: 200 }}>
              <input 
                type="text"
                placeholder="Search Product / SKU"
                value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc" }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
            {allProducts
              .filter(p => !inventorySearch || p.productName.toLowerCase().includes(inventorySearch.toLowerCase()) || p.sku.toLowerCase().includes(inventorySearch.toLowerCase()))
              .slice((inventoryPage - 1) * 5, inventoryPage * 5)
              .map(p => (
                <div key={p.id} style={{ ...S.activityItem, padding: "10px", borderBottom: "1px solid #f8fafc", borderRadius: 10, marginBottom: 4, background: p.stock <= p.minStock ? "rgba(239, 68, 68, 0.03)" : "transparent", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f8fafc", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
                    <img src={p.imageUrl || "/placeholder-prod.png"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", minWidth: 0, gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.productName}</div>
                      <div style={{ fontSize: 13, fontWeight: 400, color: p.stock <= p.minStock ? "#ef4444" : "#10b981", flexShrink: 0 }}>
                        {p.stock} <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.unit}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>SKU: {p.sku}</div>
                      {p.stock <= p.minStock && (
                        <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 400 }}>Low Stock</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {allProducts.filter(p => !inventorySearch || p.productName.toLowerCase().includes(inventorySearch.toLowerCase()) || p.sku.toLowerCase().includes(inventorySearch.toLowerCase())).length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: 13 }}>No inventory found.</div>
            )}
          </div>

          {/* Inventory Pagination */}
          {allProducts.filter(p => !inventorySearch || p.productName.toLowerCase().includes(inventorySearch.toLowerCase()) || p.sku.toLowerCase().includes(inventorySearch.toLowerCase())).length > 5 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "10px 4px 0", borderTop: "1px solid #f1f5f9" }}>
              <button 
                disabled={inventoryPage === 1}
                onClick={() => setInventoryPage(p => p - 1)}
                style={{ ...S.btnSecondary, padding: "5px 12px", fontSize: 11, opacity: inventoryPage === 1 ? 0.5 : 1, cursor: inventoryPage === 1 ? "not-allowed" : "pointer" }}
              >
                Prev
              </button>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Page {inventoryPage}</div>
              <button 
                disabled={inventoryPage * 5 >= allProducts.filter(p => !inventorySearch || p.productName.toLowerCase().includes(inventorySearch.toLowerCase()) || p.sku.toLowerCase().includes(inventorySearch.toLowerCase())).length}
                onClick={() => setInventoryPage(p => p + 1)}
                style={{ ...S.btnSecondary, padding: "5px 12px", fontSize: 11, opacity: (inventoryPage * 5 >= allProducts.filter(p => !inventorySearch || p.productName.toLowerCase().includes(inventorySearch.toLowerCase()) || p.sku.toLowerCase().includes(inventorySearch.toLowerCase())).length) ? 0.5 : 1, cursor: (inventoryPage * 5 >= allProducts.filter(p => !inventorySearch || p.productName.toLowerCase().includes(inventorySearch.toLowerCase()) || p.sku.toLowerCase().includes(inventorySearch.toLowerCase())).length) ? "not-allowed" : "pointer" }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
