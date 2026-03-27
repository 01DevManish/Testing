"use client";

import React, { useState, useRef } from "react";
import { Brand } from "./types";
import type { AdminStyles } from "./styles";
import { ref, set, push, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";
import { useAuth } from "../../context/AuthContext";
import { uploadToCloudinary } from "../inventory/cloudinary";

interface BrandsTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  brands: Brand[];
  fetching: boolean;
  loadData: () => void;
}

export default function BrandsTab({
  S, isMobile, isTablet, brands, fetching, loadData
}: BrandsTabProps) {
  const { user, userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; logoUrl: string }>({
    name: "",
    logoUrl: ""
  });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (b: Brand) => {
    setEditingId(b.id);
    setForm({ name: b.name, logoUrl: b.logoUrl });
    setLogoPreview(b.logoUrl);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete brand "${name}"? This will not remove the brand from existing products.`)) return;
    try {
      await remove(ref(db, `brands/${id}`));
      await logActivity({
        type: "system",
        action: "delete",
        title: "Brand Deleted",
        description: `Brand "${name}" was deleted by ${userData?.name || "Admin"}.`,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let finalLogoUrl = form.logoUrl;

      // If logoPreview is a data URL, upload to Cloudinary
      if (logoPreview.startsWith("data:")) {
        finalLogoUrl = await uploadToCloudinary(logoPreview);
      }

      const data = {
        name: form.name.trim(),
        logoUrl: finalLogoUrl,
        createdAt: editingId ? (brands.find(b => b.id === editingId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now()
      };

      if (editingId) {
        await update(ref(db, `brands/${editingId}`), data);
      } else {
        await push(ref(db, "brands"), data);
      }

      await logActivity({
        type: "system",
        action: editingId ? "update" : "create",
        title: editingId ? "Brand Updated" : "Brand Created",
        description: `Brand "${data.name}" was ${editingId ? "updated" : "created"} by ${userData?.name || "Admin"}.`,
        userId: user?.uid || "",
        userName: userData?.name || "Admin",
        userRole: "admin"
      });

      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", logoUrl: "" });
      setLogoPreview("");
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save brand.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? 0 : "0 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 19, fontWeight: 400, color: "#0f172a", margin: 0 }}>Brand Management</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", logoUrl: "" }); setLogoPreview(""); }} style={S.btnPrimary}>
            + Create Brand
          </button>
          <button onClick={loadData} style={S.btnSecondary}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
          <span style={{ color: "#94a3b8" }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search brands..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14, fontWeight: 400 }}
          />
        </div>
      </div>

      {showForm && (
        <div style={{ ...S.modalOverlay, zIndex: 1000 }} onClick={() => setShowForm(false)}>
          <div style={{ ...S.modalCard, maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 400, marginBottom: 20 }}>{editingId ? "Edit Brand" : "Create New Brand"}</h3>
            
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Brand Name</label>
              <input 
                style={{ ...S.input, fontWeight: 400 }} 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="e.g. Nike, Adidas"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={S.label}>Brand Logo</label>
              <div 
                onClick={() => fileRef.current?.click()}
                style={{ 
                  width: "100%", height: 120, borderRadius: 12, border: "2px dashed #e2e8f0", 
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  overflow: "hidden", background: "#f8fafc", position: "relative"
                }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 10 }} />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>Click to upload logo</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={S.btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name} style={{ ...S.btnPrimary, opacity: (saving || !form.name) ? 0.6 : 1 }}>
                {saving ? "Saving..." : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fetching ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", border: "3px solid #f1f5f9", borderTopColor: "#6366f1", animation: "spin-slow 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#94a3b8", fontWeight: 400 }}>Loading brands...</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {filteredBrands.map(b => (
            <div key={b.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                <button onClick={() => handleEdit(b)} style={{ border: "none", background: "#f8fafc", color: "#6366f1", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✎</button>
                <button onClick={() => handleDelete(b.id, b.name)} style={{ border: "none", background: "#fff1f2", color: "#ef4444", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🗑</button>
              </div>
              
              <div style={{ width: 80, height: 80, borderRadius: 12, background: "#f8fafc", padding: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={b.logoUrl} alt={b.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 400, color: "#1e293b" }}>{b.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Created {new Date(b.createdAt).toLocaleDateString()}</div>
            </div>
          ))}

          {filteredBrands.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0" }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>🏷️</p>
              <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 400 }}>No brands found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
