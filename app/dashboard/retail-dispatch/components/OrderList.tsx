"use client";

import React from "react";
import { Order, OrderStatus } from "../types";
import { Card, Badge, BtnGhost, PageHeader, Spinner, Input, Select } from "./ui";

interface OrderListProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: OrderStatus | "All";
  setFilterStatus: (s: OrderStatus | "All") => void;
  onRefresh?: () => void;
  loading?: boolean;
  onDeleteOrder?: (id: string) => void;
  canDelete?: boolean;
}

const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  "Pending": { label: "Pending", color: "#f59e0b", bg: "#fefce8" },
  "Packed": { label: "Packed", color: "#3b82f6", bg: "#eff6ff" },
  "Dispatched": { label: "Dispatched", color: "#6366f1", bg: "#eef2ff" },
  "In Transit": { label: "In Transit", color: "#8b5cf6", bg: "#f5f3ff" },
  "Delivered": { label: "Delivered", color: "#10b981", bg: "#ecfdf5" },
};

export default function OrderList({ 
  orders, onSelectOrder, searchQuery, setSearchQuery, 
  filterStatus, setFilterStatus, onRefresh, loading, onDeleteOrder, canDelete
}: OrderListProps) {
  
  const filtered = orders.filter(o => {
    const matchSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "All" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const th: React.CSSProperties = {
    padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 400,
    textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8",
    borderBottom: "1px solid #e2e8f0", background: "#fafbfc",
    userSelect: "none", whiteSpace: "nowrap", fontFamily: FONT,
  };
  const td: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, color: "#475569",
    borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", fontFamily: FONT,
  };

  return (
    <div>
      <PageHeader title="All Dispatches" sub={`${filtered.length} dispatches found`} />

      <Card>
        {/* Filters bar exactly like Inventory */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 0, marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "#94a3b8", flexShrink: 0 }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 13, width: "100%", fontFamily: FONT }} 
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
             <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value as any)}
                style={{ padding: "6px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 0, color: "#475569", fontSize: 12, fontFamily: FONT, cursor: "pointer", outline: "none" }}
             >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Packed">Packed</option>
                <option value="Dispatched">Dispatched</option>
                <option value="In Transit">In Transit</option>
                <option value="Delivered">Delivered</option>
             </select>
             
             {(["All", "Pending", "Packed", "Dispatched"] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                    style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 400, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", border: `1.5px solid ${filterStatus === f ? "#6366f1" : "#e2e8f0"}`, background: filterStatus === f ? "rgba(99,102,241,0.08)" : "#fff", color: filterStatus === f ? "#6366f1" : "#94a3b8" }}>
                    {f}
                </button>
             ))}
          </div>
        </div>

        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>
             <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
             <p style={{ fontSize: 14 }}>No dispatches found.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={th}>Order ID</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Items</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const sc = statusConfig[order.status] || statusConfig.Pending;
                  return (
                    <tr key={order.id} style={{ background: "#fff" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                      <td style={td}><span style={{ fontWeight: 400, color: "#1e293b" }}>{order.id}</span></td>
                      <td style={td}>
                         <div style={{ fontWeight: 400, color: "#1e293b" }}>{order.customer.name}</div>
                         <div style={{ fontSize: 11, color: "#94a3b8" }}>{order.customer.phone}</div>
                      </td>
                      <td style={td}>
                         <div style={{ fontWeight: 400 }}>{order.products.reduce((acc, p) => acc + p.quantity, 0)} items</div>
                      </td>
                      <td style={td}>
                         <Badge color={sc.color} bg={sc.bg}>{sc.label}</Badge>
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                         <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                           <BtnGhost onClick={() => onSelectOrder(order)} style={{ padding: "5px 10px", fontSize: 12 }}>View</BtnGhost>
                           {canDelete && (
                             <button 
                               onClick={() => { if(confirm("Delete this dispatch record permanently?")) onDeleteOrder?.(order.id); }}
                               style={{ padding: "5px 10px", background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, fontSize: 12, fontFamily: FONT, cursor: "pointer" }}
                             >
                               Del
                             </button>
                           )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
