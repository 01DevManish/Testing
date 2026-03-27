"use client";

import React, { useState } from "react";
import { PartyRate } from "./types";
import { Product } from "../inventory/types";

import type { AdminStyles } from "./styles";
import { ref, set, push, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";
import { useAuth } from "../../context/AuthContext";

interface PartyRateTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  partyRates: PartyRate[];
  products: any[]; // Product[]
  fetching: boolean;
  isAdmin: boolean;
  loadData: () => void;
}

export default function PartyRateTab({
  S, isMobile, isTablet, partyRates, products, fetching, isAdmin, loadData
}: PartyRateTabProps) {
  const { user, userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ partyName: string; rates: { productName: string; rate: number }[] }>({
    partyName: "",
    rates: []
  });
  const [saving, setSaving] = useState(false);

  const filteredRates = partyRates.filter(r => 
    r.partyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (pr: PartyRate) => {
    if (!isAdmin) return;
    setEditingId(pr.id);
    setForm({ partyName: pr.partyName, rates: [...pr.rates] });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin || !confirm(`Delete rate list for "${name}"?`)) return;
    try {
      await remove(ref(db, `partyRates/${id}`));
      await logActivity({
        type: "system",
        action: "delete",
        title: "Party Rate Deleted",
        description: `Rate list for "${name}" was deleted by ${userData?.name || "Admin"}.`,
        userId: user?.uid || "",
        userName: userData?.name || "Admin",
        userRole: "admin"
      });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to delete.");
    }
  };

  const handleSave = async () => {
    if (!form.partyName.trim()) return;
    setSaving(true);
    try {
      const data = {
        partyName: form.partyName.trim(),
        rates: form.rates.filter(r => r.productName && r.rate > 0),
        updatedAt: Date.now()
      };

      if (editingId) {
        await update(ref(db, `partyRates/${editingId}`), data);
      } else {
        await push(ref(db, "partyRates"), data);
      }

      await logActivity({
        type: "system",
        action: editingId ? "update" : "create",
        title: editingId ? "Party Rate Updated" : "Party Rate Created",
        description: `Rate list for "${data.partyName}" was ${editingId ? "updated" : "created"} by ${userData?.name || "Admin"}.`,
        userId: user?.uid || "",
        userName: userData?.name || "Admin",
        userRole: "admin"
      });

      setShowForm(false);
      setEditingId(null);
      setForm({ partyName: "", rates: [] });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const addRateRow = () => {
    setForm({ ...form, rates: [...form.rates, { productName: "", rate: 0 }] });
  };

  const removeRateRow = (index: number) => {
    const newRates = [...form.rates];
    newRates.splice(index, 1);
    setForm({ ...form, rates: newRates });
  };

  const updateRate = (index: number, field: "productName" | "rate", value: string | number) => {
    const newRates = [...form.rates];
    newRates[index] = { ...newRates[index], [field]: value };
    setForm({ ...form, rates: newRates });
  };

  return (
    <div style={{ padding: isMobile ? 0 : "0 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 19, fontWeight: 400, color: "#0f172a", margin: 0 }}>Party Wise Rate</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ partyName: "", rates: [] }); }} style={S.btnPrimary}>
              + Create Party Rate
            </button>
          )}
          <button onClick={loadData} style={S.btnSecondary}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
          <span style={{ color: "#94a3b8" }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search party..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14 }}
          />
        </div>
      </div>

      {showForm && isAdmin && (
        <div style={{ ...S.modalOverlay, zIndex: 1000 }} onClick={() => setShowForm(false)}>
          <div style={{ ...S.modalCard, maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 400, marginBottom: 20 }}>{editingId ? "Edit Party Rate" : "New Party Rate List"}</h3>
            
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Party Name</label>
              <input 
                style={S.input} 
                value={form.partyName} 
                onChange={e => setForm({ ...form, partyName: e.target.value })} 
                placeholder="Enter party name..."
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={S.label}>Specific Product Rates</label>
                <button onClick={addRateRow} style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 12 }}>+ Add Product</button>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.rates.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select 
                      style={{ ...S.input, flex: 2 }} 
                      value={r.productName} 
                      onChange={e => updateRate(i, "productName", e.target.value)}
                    >
                      <option value="">Select Product...</option>
                      {products.map((p: any) => {
                        const pName = p.productName || p.name || "N/A";
                        return (
                          <option key={p.id} value={pName}>{pName} ({p.sku})</option>
                        );
                      })}
                    </select>
                    <input 
                      type="number" 
                      style={{ ...S.input, flex: 1 }} 
                      value={r.rate || ""} 
                      onChange={e => updateRate(i, "rate", parseFloat(e.target.value))} 
                      placeholder="₹ Rate"
                    />
                    <button onClick={() => removeRateRow(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>✕</button>
                  </div>
                ))}
                {form.rates.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, border: "1px dashed #e2e8f0", borderRadius: 8, color: "#94a3b8", fontSize: 13 }}>
                    Click "+ Add Product" to set custom rates for this party.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={S.btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.partyName} style={{ ...S.btnPrimary, opacity: (saving || !form.partyName) ? 0.6 : 1 }}>
                {saving ? "Saving..." : "Save Rate List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fetching ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", border: "3px solid #f1f5f9", borderTopColor: "#6366f1", animation: "spin-slow 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#94a3b8" }}>Loading records...</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)", gap: 16 }}>
          {filteredRates.map(pr => (
            <div key={pr.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <h4 style={{ fontSize: 15, fontWeight: 400, margin: 0, color: "#1e293b" }}>{pr.partyName}</h4>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleEdit(pr)} style={{ border: "none", background: "#f8fafc", color: "#6366f1", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14 }}>✎</button>
                    <button onClick={() => handleDelete(pr.id, pr.partyName)} style={{ border: "none", background: "#fff1f2", color: "#ef4444", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14 }}>🗑</button>
                  </div>
                )}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pr.rates.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{r.productName}</span>
                    <span style={{ fontWeight: 400, color: "#1e293b" }}>₹{r.rate}</span>
                  </div>
                ))}
                {pr.rates.length > 5 && (
                  <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>+ {pr.rates.length - 5} more items</div>
                )}
                {pr.rates.length === 0 && (
                  <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>No specific rates.</div>
                )}
              </div>

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Last updated {new Date(pr.updatedAt).toLocaleDateString()}</span>
                <button onClick={() => handleEdit(pr)} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 12, fontWeight: 400, cursor: "pointer" }}>
                  View / Edit →
                </button>
              </div>
            </div>
          ))}

          {filteredRates.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0" }}>
              <p style={{ fontSize: 30, marginBottom: 10 }}>📋</p>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>No party rate records found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
