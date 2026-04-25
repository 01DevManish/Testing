"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { useData } from "../../../../context/DataContext";
import { LeadRecord } from "../erm-leads/types";

export interface ErmOrder {
  id: string;
  leadId: string;
  leadName: string;
  employeeUid: string;
  employeeName: string;
  items: { productId: string; productName: string; sku: string; quantity: number; price: number }[];
  totalAmount: number;
  status: "pending_po" | "confirmed" | "dispatched";
  createdAt: number;
}

const crmCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 24,
  boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.03)",
};

const FONT = "'Inter', sans-serif";

export default function ErmOrdersModule() {
  const { userData } = useAuth();
  const { products } = useData();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [orders, setOrders] = useState<ErmOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = userData?.role === "admin";
  const currentUserUid = userData?.uid || "";

  // For order creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const visibleLeads = useMemo(() => {
    if (isAdmin) return leads;
    return leads.filter((l) => l.assignedToUid === currentUserUid);
  }, [leads, isAdmin, currentUserUid]);

  const interestedLeads = useMemo(() => {
    return visibleLeads.filter((l) => l.status === "interested");
  }, [visibleLeads]);

  const visibleOrders = useMemo(() => {
    if (isAdmin) return orders;
    return orders.filter((o) => o.employeeUid === currentUserUid);
  }, [orders, isAdmin, currentUserUid]);

  // Compute Stats
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

  const formatMoney = (amount: number) => `Rs. ${Math.round(amount || 0).toLocaleString("en-IN")}`;

  const handleCreateOrderClick = (lead: LeadRecord) => {
    setSelectedLead(lead);
    setOrderItems([{ productId: "", quantity: 1 }]);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { productId: "", quantity: 1 }]);
  };

  const handleItemChange = (index: number, field: "productId" | "quantity", value: string | number) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async () => {
    if (!selectedLead || orderItems.length === 0) return;
    
    // validate
    const validItems = orderItems.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) return alert("Please select at least one valid product and quantity.");

    setSaving(true);
    try {
      const orderId = `ermOrder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      let totalAmount = 0;
      const finalItems = validItems.map(item => {
        const p = products.find(prod => prod.id === item.productId);
        const price = Number(p?.price || 0);
        totalAmount += price * item.quantity;
        return {
          productId: item.productId,
          productName: p?.productName || "Unknown Product",
          sku: p?.sku || "N/A",
          quantity: Number(item.quantity),
          price
        };
      });

      const newOrder: ErmOrder = {
        id: orderId,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        employeeUid: userData?.uid || "",
        employeeName: userData?.name || "User",
        items: finalItems,
        totalAmount,
        status: "pending_po",
        createdAt: Date.now()
      };

      const r = await fetch("/api/data/ermOrders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upsert", items: [newOrder] }),
      });
      if (!r.ok) throw new Error("Failed to save order");

      setOrders(prev => [newOrder, ...prev]);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Leads", value: stats.totalLeads, color: "#4f46e5" },
          { label: "Daily Sales", value: formatMoney(stats.dailySales), color: "#16a34a" },
          { label: "Sale Items", value: stats.saleItemsCount, color: "#ea580c" },
          { label: "Pending PO", value: stats.pendingPoCount, color: "#d97706" }
        ].map(stat => (
          <div key={stat.label} style={{ ...crmCard, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{loading ? "..." : stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        {/* Interested Leads to Create Order */}
        <div style={crmCard}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Interested Leads (Ready for Order)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>Lead Name</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>Phone</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>City</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "2px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {interestedLeads.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 16 }}>No interested leads found. Change lead status to "Interested" in Leads tab.</td></tr>
                ) : interestedLeads.map(lead => (
                  <tr key={lead.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{lead.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#475569" }}>{lead.phone}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#475569" }}>{lead.city || "-"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <button onClick={() => handleCreateOrderClick(lead)} style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Create Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orders Table */}
        <div style={crmCard}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Created Orders</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px 14px", borderBottom: "2px solid #e2e8f0", fontSize: 14, color: "#64748b" }}>Order ID / Date</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", borderBottom: "2px solid #e2e8f0", fontSize: 14, color: "#64748b" }}>Lead</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", borderBottom: "2px solid #e2e8f0", fontSize: 14, color: "#64748b" }}>Employee</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", borderBottom: "2px solid #e2e8f0", fontSize: 14, color: "#64748b" }}>Amount</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", borderBottom: "2px solid #e2e8f0", fontSize: 14, color: "#64748b" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 16 }}>No orders found.</td></tr>
                ) : visibleOrders.sort((a,b) => b.createdAt - a.createdAt).map(order => (
                  <tr key={order.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px", fontSize: 15, color: "#1e293b" }}>
                      <div style={{ fontWeight: 600 }}>#{order.id.slice(order.id.length - 6).toUpperCase()}</div>
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: "14px", fontSize: 16, color: "#475569", fontWeight: 500 }}>{order.leadName}</td>
                    <td style={{ padding: "14px", fontSize: 16, color: "#475569" }}>{order.employeeName}</td>
                    <td style={{ padding: "14px", textAlign: "right", fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{formatMoney(order.totalAmount)}</td>
                    <td style={{ padding: "14px", textAlign: "right" }}>
                      <span style={{ padding: "6px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: "uppercase", background: order.status === "pending_po" ? "#fef3c7" : "#dcfce7", color: order.status === "pending_po" ? "#d97706" : "#16a34a" }}>
                        {order.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && selectedLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 650, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>Create Order for {selectedLead.name}</div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#64748b" }}>&times;</button>
            </div>
            
            <div style={{ padding: "24px", overflowY: "auto", display: "grid", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Select Products</div>
                {orderItems.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                    <select
                      value={item.productId}
                      onChange={e => handleItemChange(idx, "productId", e.target.value)}
                      style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15 }}
                    >
                      <option value="">Select a product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.productName} (SKU: {p.sku}) - Rs. {p.price}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => handleItemChange(idx, "quantity", parseInt(e.target.value) || 1)}
                      style={{ width: 100, padding: "12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15 }}
                      placeholder="Qty"
                    />
                    <button onClick={() => handleRemoveItem(idx)} style={{ padding: "12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={handleAddItem} style={{ marginTop: 8, padding: "10px 16px", background: "#f1f5f9", color: "#475569", border: "1px dashed #cbd5e1", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600, width: "100%" }}>
                  + Add Another Product
                </button>
              </div>
            </div>

            <div style={{ padding: "20px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 12, background: "#f8fafc", borderRadius: "0 0 16px 16px" }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSubmitOrder} disabled={saving} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
