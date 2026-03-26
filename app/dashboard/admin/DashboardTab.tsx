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
  unit: string;
  status: string;
  createdByName?: string;
  updatedByName?: string;
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
  const [stockSearch, setStockSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, userData } = useAuth();

  // New states for activity feeds
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchFilter, setDispatchFilter] = useState("all"); 
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("all"); 

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
            icon: val.type === "dispatch" ? (val.title.includes("E-com") ? "🛒" : "🚛") : (val.type === "inventory" ? "📦" : "🔔"),
            color: val.type === "dispatch" ? (val.title.includes("E-com") ? "#6366f1" : "linear-gradient(135deg,#3b82f6,#2dd4bf)") : (val.type === "inventory" ? "#10b981" : "#94a3b8"),
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

    return () => {
      off(actRef, "value", unsubActivities);
      off(invRef, "value", unsubInv);
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
          description: `Retail/E-com dispatch ${orderId} was permanently deleted via dashboard log override by ${userData?.name || "Admin"}.`,
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

  const groupByType = (type: Activity["type"] | "other", search: string = "", filter: string = "all") => {
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);
    
    // Filter by type, search, and specific action filter
    const typeActivities = activities
      .filter(a => type === "other" ? (a.type !== "dispatch" && a.type !== "inventory") : a.type === type)
      .filter(a => {
        const queryMatches = a.title.toLowerCase().includes(search.toLowerCase()) || 
                             a.description.toLowerCase().includes(search.toLowerCase()) || 
                             a.user.toLowerCase().includes(search.toLowerCase());
        
        if (!queryMatches) return false;

        if (filter === "all") return true;
        
        if (type === "dispatch") {
            if (filter === "Retail" && !a.title.includes("Retail")) return false;
            if (filter === "E-com" && !a.title.includes("E-com")) return false;
        }

        if (type === "inventory") {
            if (filter === "Add" && !a.description.includes("added")) return false;
            if (filter === "Remove" && !a.description.includes("removed")) return false;
            if (filter === "Update" && a.description.includes("added") && a.description.includes("removed")) return false; // Basic distinction
        }
        
        return true;
      })
      .slice(0, 15); 

    const groups: { [key: string]: Activity[] } = { Today: [], Yesterday: [], Earlier: [] };
    typeActivities.forEach(a => {
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

  const filteredStock = useMemo(() => {
    return allProducts.filter(p => 
      p.productName.toLowerCase().includes(stockSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(stockSearch.toLowerCase())
    ).slice(0, 10);
  }, [allProducts, stockSearch]);

  const ActivityGroup = ({ group, activities }: { group: string; activities: Activity[] }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{a.title}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{group === "Earlier" ? formatDate(a.timestamp) : formatTime(a.timestamp)}</div>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{a.description}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
      <div style={{ fontWeight: 600 }}>Loading Management Data...</div>
    </div>
  );

  return (
    <div style={S.tabContent}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20, marginBottom: 20 }}>
         {/* PENDING TASKS CARD */}
         <div style={{ ...S.statCard, display: "flex", flexDirection: "column", maxHeight: 250 }}>
            <div style={S.statStripe("#f59e0b")} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 700, textTransform: "uppercase" }}>Pending Tasks</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", background: "#fef3c7", padding: "2px 8px", borderRadius: 12 }}>{tasks.filter(t => t.status !== "completed").length}</div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {tasks.filter(t => t.status !== "completed").map(t => (
                <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Assigned to: <span style={{ fontWeight: 600, color: "#475569" }}>{t.assignedToName}</span></div>
                </div>
              ))}
              {tasks.filter(t => t.status !== "completed").length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No pending tasks!</div>
              )}
            </div>
         </div>

         {/* TODAY'S DISPATCHES CARD */}
         <div style={{ ...S.statCard, display: "flex", flexDirection: "column", maxHeight: 250 }}>
            <div style={S.statStripe("#10b981")} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 700, textTransform: "uppercase" }}>Today's Dispatches</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", background: "#d1fae5", padding: "2px 8px", borderRadius: 12 }}>
                {activities.filter(a => a.type === "dispatch" && new Date(a.timestamp).setHours(0,0,0,0) === new Date().setHours(0,0,0,0)).length}
              </div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {activities.filter(a => a.type === "dispatch" && new Date(a.timestamp).setHours(0,0,0,0) === new Date().setHours(0,0,0,0)).map(a => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>By: <span style={{ fontWeight: 600, color: "#475569" }}>{a.user}</span> • {new Date(a.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
              {activities.filter(a => a.type === "dispatch" && new Date(a.timestamp).setHours(0,0,0,0) === new Date().setHours(0,0,0,0)).length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No dispatches today.</div>
              )}
            </div>
         </div>

         {/* CRITICAL STOCK CARD */}
         <div style={{ ...S.statCard, display: "flex", flexDirection: "column", maxHeight: 250 }}>
            <div style={S.statStripe("#ef4444")} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 700, textTransform: "uppercase" }}>Critical Stock</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", background: "#fee2e2", padding: "2px 8px", borderRadius: 12 }}>{allProducts.filter(p => p.stock <= p.minStock).length}</div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {allProducts.filter(p => p.stock <= p.minStock).map(p => (
                <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.productName}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{p.sku}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>
                    {p.stock} <span style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8" }}>{p.unit}</span>
                  </div>
                </div>
              ))}
              {allProducts.filter(p => p.stock <= p.minStock).length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>All stock levels are healthy.</div>
              )}
            </div>
         </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* DISPATCH CARD */}
        <div style={S.activityCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>🚛 Recent Dispatches</h3>
            <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end", minWidth: 200 }}>
              <input 
                type="text" 
                value={dispatchSearch} onChange={e => setDispatchSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 160, padding: "6px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc" }}
              />
              <select 
                value={dispatchFilter} onChange={e => setDispatchFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc", cursor: "pointer" }}
              >
                <option value="all">All Types</option>
                <option value="Retail">Retail</option>
                <option value="E-com">E-com</option>
              </select>
            </div>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
            {["Today", "Yesterday", "Earlier"].map(g => {
              const gActs = groupByType("dispatch", dispatchSearch, dispatchFilter)[g];
              return gActs.length > 0 && <ActivityGroup key={g} group={g} activities={gActs} />;
            })}
            {groupByType("dispatch", dispatchSearch, dispatchFilter).Today.length === 0 && 
             groupByType("dispatch", dispatchSearch, dispatchFilter).Yesterday.length === 0 && 
             groupByType("dispatch", dispatchSearch, dispatchFilter).Earlier.length === 0 && (
               <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>No recent dispatches found.</div>
            )}
          </div>
        </div>

        {/* INVENTORY CARD */}
        <div style={S.activityCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>📦 Stock Adjustments</h3>
            <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end", minWidth: 200 }}>
              <input 
                type="text" 
                value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}
                style={{ width: "100%", maxWidth: 160, padding: "6px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc" }}
              />
              <select 
                value={inventoryFilter} onChange={e => setInventoryFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", background: "#f8fafc", cursor: "pointer" }}
              >
                <option value="all">All Actions</option>
                <option value="Add">Stock Added</option>
                <option value="Remove">Stock Removed</option>
              </select>
            </div>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
            {["Today", "Yesterday", "Earlier"].map(g => {
              const gActs = groupByType("inventory", inventorySearch, inventoryFilter)[g];
              return gActs.length > 0 && <ActivityGroup key={g} group={g} activities={gActs} />;
            })}
             {groupByType("inventory", inventorySearch, inventoryFilter).Today.length === 0 && 
             groupByType("inventory", inventorySearch, inventoryFilter).Yesterday.length === 0 && 
             groupByType("inventory", inventorySearch, inventoryFilter).Earlier.length === 0 && (
               <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>No recent stock adjustments found.</div>
            )}
          </div>
        </div>
      </div>

      {/* CURRENT STOCK STATUS */}
      <div style={S.activityCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Current Stock Status</h3>
          <div style={{ position: "relative", width: isMobile ? "100%" : 280 }}>
            <input 
              type="text" 
              value={stockSearch} onChange={e => setStockSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", background: "#f8fafc" }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Product</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>SKU</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", textAlign: "right" }}>Stock</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Managed By</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{p.productName}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#64748b" }}>{p.sku}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 14, fontWeight: 700, color: p.stock <= p.minStock ? "#ef4444" : "#10b981", textAlign: "right" }}>
                    {p.stock} <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{p.unit}</span>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                     <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{p.updatedByName || p.createdByName || "System"}</div>
                     <div style={{ fontSize: 10, color: "#94a3b8" }}>{p.updatedByName ? "Last updated" : "Created"}</div>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                      <button 
                        onClick={() => deleteProduct(p)}
                        style={{ border: "none", background: "none", color: "#f87171", cursor: "pointer", padding: "4px" }}
                        title="Delete Product"
                      >
                         <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M5.5 1V1.5H3.5V2.5H11.5V1.5H9.5V1H5.5ZM2.5 3.5V13.5C2.5 14.0523 2.94772 14.5 3.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V3.5H2.5ZM4.5 5.5H5.5V12.5H4.5V5.5ZM7 5.5H8V12.5H7V5.5ZM9.5 5.5H10.5V12.5H10.5V5.5H9.5V5.5Z" fill="currentColor"/></svg>
                      </button>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStock.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 14 }}>No products found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
