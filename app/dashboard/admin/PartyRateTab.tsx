"use client";

import React, { useState } from "react";
import { PartyRate } from "./types";
import { Product } from "../inventory/types";

import type { AdminStyles } from "./styles";
import { ref, set, push, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";
import { useAuth } from "../../context/AuthContext";
import { generatePartyRatePdf } from "../inventory/PdfGenerator";

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
  const [viewingParty, setViewingParty] = useState<PartyRate | null>(null);
  const [viewingRateList, setViewingRateList] = useState<PartyRate | null>(null);
  const [rateSearch, setRateSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCollection, setFilterCollection] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [selectedRateIndices, setSelectedRateIndices] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    partyName: "",
    billTo: { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" },
    sameAsBillTo: true,
    shipTo: { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", adharNo: "", email: "" },
    rates: []
  });
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareData, setShareData] = useState<{ blob: Blob, filename: string, party: any } | null>(null);
  const [editingRateProduct, setEditingRateProduct] = useState<any>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);

  const handleVerifyGst = async (gstin: string) => {
    if (!gstin || gstin.length !== 15) {
      alert("Please enter a valid 15-digit GST number.");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/gst?gstin=${gstin}`);
      const result = await res.json();
        if (result.success && result.data) {
          setGstVerified(true);
          setForm((prev: any) => ({
          ...prev,
          billTo: {
            ...prev.billTo,
            companyName: result.data.companyName,
            ownerName: result.data.ownerName,
            address: result.data.address,
            state: result.data.state,
            district: result.data.district,
            pincode: result.data.pincode,
            gstNo: gstin,
            panNo: gstin.substring(2, 12)
          }
        }));
      } else {
        alert(result.error || "GSTIN validation failed.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to verify GST. Please check your connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  const safePartyRates = Array.isArray(partyRates) ? partyRates : [];
  const filteredRates = safePartyRates.filter(r => 
    r && (r?.partyName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      partyName: "",
      billTo: { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" },
      sameAsBillTo: true,
      shipTo: { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", adharNo: "", email: "" },
      rates: []
    });
    setShowForm(true);
  };

  const openAdminEditModal = (pr: PartyRate) => {
    if (!isAdmin) return;
    setEditingId(pr.id);
    const defaultSection = { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" };
    setForm({ 
      partyName: pr.partyName || "", 
      billTo: { ...defaultSection, ...(pr.billTo || {}) },
      sameAsBillTo: pr.sameAsBillTo !== undefined ? pr.sameAsBillTo : true,
      shipTo: { ...defaultSection, ...(pr.shipTo || {}) },
      rates: pr.rates || []
    });
    setGstVerified(!!pr.billTo?.gstNo);
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
    // Validation
    const b = form.billTo;
    if (!b.companyName?.trim() || !b.address?.trim() || !b.contactNo?.trim() || !b.panNo?.trim()) {
      alert("Company Name, Address, Contact No, and PAN No are mandatory fields in Bill To.");
      return;
    }

    setSaving(true);
    try {
      const data = {
        partyName: b.companyName.trim(),
        billTo: b,
        sameAsBillTo: form.sameAsBillTo,
        shipTo: form.sameAsBillTo ? {
          companyName: b.companyName,
          ownerName: b.ownerName,
          address: b.address,
          state: b.state,
          district: b.district,
          pincode: b.pincode,
          contactNo: b.contactNo,
          adharNo: b.adharNo,
          email: b.email,
        } : form.shipTo,
        rates: form.rates.filter((r: any) => r.productName && r.rate > 0),
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
      setForm({
        partyName: "",
        billTo: { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" },
        sameAsBillTo: true,
        shipTo: { companyName: "", ownerName: "", address: "", state: "", district: "", pincode: "", contactNo: "", email: "" },
        rates: []
      });
      setGstVerified(false);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save.");
    } finally {
      setSaving(false);
      // If we were editing a party from the management view, update our local viewingParty state
      if (editingId && viewingParty && editingId === viewingParty.id) {
         // Refresh list data will handle it, but for immediate UI we can set viewingParty
      }
    }
  };

  const handleUpdateProductRates = async (updatedRates: any[]) => {
    if (!viewingParty) return;
    try {
      const partyRef = ref(db, `partyRates/${viewingParty.id}`);
      await update(partyRef, { 
        rates: updatedRates,
        updatedAt: Date.now() 
      });
      loadData();
      // Update local state to reflect changes in UI
      setViewingParty({ ...viewingParty, rates: updatedRates });
    } catch (e) {
      console.error(e);
      alert("Failed to update rates.");
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

  const handleShare = async (party: any, ratesToShare: any[]) => {
    try {
      setSharing(true);
      // Generate blob instead of dropping a forced save
      const blob = await generatePartyRatePdf(party, ratesToShare, products, false);
      if (!blob) return;

      const filename = `RateList_${party.partyName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;

      if (navigator.share) {
        const file = new File([blob], filename, { type: "application/pdf" });
        try {
          await navigator.share({
            title: `Rate List for ${party.partyName}`,
            files: [file]
          });
          setSharing(false);
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') { setSharing(false); return; }
          console.error("Native share failed:", e);
        }
      }

      // If native share fails or isn't available, show our custom Premium Share Modal
      setShareData({ blob, filename, party });
    } catch (err) {
      console.error(err);
      alert("Failed to share PDF.");
    } finally {
      setSharing(false);
    }
  };

  if (viewingRateList) {
    const safeRateSearch = rateSearch.toLowerCase();
    
    // Compute enhanced list and unique filter sets
    const mappedRates = (viewingRateList.rates || []).map((r, originalIdx) => {
      const product = products.find(p => p.productName === r.productName || p.name === r.productName);
      return {
        ...r,
        originalIdx,
        sku: product?.sku || "N/A",
        imgUrl: product?.imageUrl || "",
        category: product?.category || "",
        collection: product?.collection || "",
        size: product?.size || "",
        pkgCost: r.packagingCost || 0,
        total: Number(r.rate || 0) + Number(r.packagingCost || 0)
      };
    });

    const uniqueCategories = Array.from(new Set(mappedRates.map(r => r.category).filter(Boolean)));
    const uniqueCollections = Array.from(new Set(mappedRates.map(r => r.collection).filter(Boolean)));
    const uniqueSizes = Array.from(new Set(mappedRates.map(r => r.size).filter(Boolean)));

    const filteredListRates = mappedRates.filter(r => {
      const matchSearch = r.productName.toLowerCase().includes(safeRateSearch) || r.sku.toLowerCase().includes(safeRateSearch);
      const matchCat = !filterCategory || r.category === filterCategory;
      const matchCol = !filterCollection || r.collection === filterCollection;
      const matchSize = !filterSize || r.size === filterSize;
      return matchSearch && matchCat && matchCol && matchSize;
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) setSelectedRateIndices(filteredListRates.map(r => r.originalIdx));
      else setSelectedRateIndices([]);
    };

    const toggleSelect = (idx: number) => {
      setSelectedRateIndices(prev => 
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
    };

    return (
      <div style={{ padding: isMobile ? 0 : "0 8px", animation: "fadeIn 0.2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "2px solid #f8fafc", paddingBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <button 
              onClick={() => { 
                setViewingRateList(null); 
                setRateSearch(""); 
                setFilterCategory("");
                setFilterCollection("");
                setFilterSize("");
                setSelectedRateIndices([]);
              }} 
              style={{ ...S.btnSecondary, padding: "8px 12px", background: "#fff", display: "flex", alignItems: "center", gap: 8 }}
            >
              <span style={{ fontSize: 18 }}>←</span> Back
            </button>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#0f172a" }}>{viewingRateList.partyName} Catalog</h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0 0" }}>Manage rates and share customized catalogs</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button 
              onClick={() => {
                const itemsToShare = selectedRateIndices.length > 0 
                   ? mappedRates.filter(r => selectedRateIndices.includes(r.originalIdx))
                   : filteredListRates;
                handleShare(viewingRateList, itemsToShare);
              }}
              disabled={filteredListRates.length === 0}
              style={{ ...S.btnPrimary, background: "#10b981", border: "none", opacity: filteredListRates.length === 0 ? 0.5 : 1 }}
            >
              Share PDF {selectedRateIndices.length > 0 ? `(${selectedRateIndices.length})` : ""} 🖨️
            </button>
          </div>
        </div>

        <div style={{ 
          marginBottom: 20, 
          display: "flex", 
          gap: 12, 
          flexWrap: "wrap", 
          alignItems: "center",
          background: "#fff",
          padding: "16px",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
        }}>
          <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "0 0 280px" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search Product / SKU" 
              value={rateSearch} 
              onChange={(e) => setRateSearch(e.target.value)} 
              style={{ ...S.input, paddingLeft: 38, fontSize: 13, height: 40 }}
            />
          </div>
          
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ ...S.input, width: isMobile ? "calc(50% - 6px)" : 160, height: 40, fontSize: 13, background: "#f8fafc" }}>
            <option value="">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={filterCollection} onChange={(e) => setFilterCollection(e.target.value)} style={{ ...S.input, width: isMobile ? "calc(50% - 6px)" : 160, height: 40, fontSize: 13, background: "#f8fafc" }}>
            <option value="">All Collections</option>
            {uniqueCollections.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)} style={{ ...S.input, width: isMobile ? "100%" : 130, height: 40, fontSize: 13, background: "#f8fafc" }}>
            <option value="">All Sizes</option>
            {uniqueSizes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          {(rateSearch || filterCategory || filterCollection || filterSize) && (
            <button 
              onClick={() => { setRateSearch(""); setFilterCategory(""); setFilterCollection(""); setFilterSize(""); }} 
              style={{ padding: "0 12px", height: 40, background: "none", border: "none", color: "#6366f1", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ ...S.th, width: 40, textAlign: "center" }}>
                    <input type="checkbox" onChange={handleSelectAll} checked={filteredListRates.length > 0 && selectedRateIndices.length === filteredListRates.length} />
                  </th>
                  <th style={{ ...S.th, width: 60, textAlign: "center" }}>Image</th>
                  <th style={{ ...S.th, textAlign: "left" }}>Product & SKU</th>
                  <th style={{ ...S.th, textAlign: "left" }}>Pkg Type</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Pkg Price</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Product Price</th>
                  <th style={{ ...S.th, textAlign: "right", background: "#eef2ff", color: "#4f46e5" }}>Total Price</th>
                  <th style={{ ...S.th, width: 80, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredListRates.map((r, idx) => {
                  const isSelected = selectedRateIndices.includes(r.originalIdx);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s", background: isSelected ? "#f5f3ff" : "transparent" }} onMouseEnter={e => {if(!isSelected) e.currentTarget.style.background="#f8fafc"}} onMouseLeave={e => {if(!isSelected) e.currentTarget.style.background="transparent"}}>
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.originalIdx)} />
                      </td>
                      <td style={{ ...S.td, textAlign: "center", padding: "8px" }}>
                        {r.imgUrl ? (
                          <img src={r.imgUrl} alt="Product" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                        ) : (
                          <div style={{ width: 44, height: 44, background: "#f1f5f9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", color: "#cbd5e1", fontSize: 10 }}>No Img</div>
                        )}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 500, color: "#1e293b", fontSize: 14 }}>{r.productName}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{r.sku}</div>
                      </td>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 13 }}>{r.packagingType || "-"}</td>
                      <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 13 }}>{r.pkgCost > 0 ? `₹${r.pkgCost}` : "-"}</td>
                      <td style={{ ...S.td, textAlign: "right", color: "#64748b", fontSize: 13 }}>₹{r.rate}</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 600, color: "#4f46e5", background: "#fbfbff" }}>₹{r.total}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button 
                            onClick={() => {
                              // We'll define setEditingRateProduct soon
                              setEditingRateProduct({ ...r, originalParty: viewingRateList });
                            }}
                            style={{ border: "none", background: "#eff6ff", padding: "6px 10px", borderRadius: 6, color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleShare(viewingRateList, [r])}
                            style={{ border: "none", background: "#f1f5f9", padding: "6px 10px", borderRadius: 6, color: "#475569", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                          >
                            Share
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredListRates.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontStyle: "italic" }}>
                      {rateSearch ? "No matching rates found." : "No assigned rates found for this party."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Overlays */}
        {sharing && (
          <div style={{ 
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)",
            zIndex: 3000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, color: "#fff"
          }}>
            <div style={{ 
              width: 50, height: 50, border: "4px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", 
              borderRadius: "50%", animation: "spin 1s linear infinite" 
            }}></div>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "0.02em" }}>Generating Premium Rate List PDF...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {shareData && (
          <div style={{ ...S.modalOverlay, zIndex: 3100 }} onClick={() => setShareData(null)}>
            <div style={{ ...S.modalCard, maxWidth: 380, textAlign: "center", padding: "40px 24px" }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 70, height: 70, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <span style={{ fontSize: 36 }}>✨</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Rate List Ready!</h3>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 30 }}>Your customized catalog for <b>{shareData.party.partyName}</b> is ready to send.</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button 
                  onClick={() => {
                     const whatsappText = encodeURIComponent(`Eurus Lifestyle - Rate List for ${shareData.party.partyName}`);
                     window.open(`https://wa.me/?text=${whatsappText}`, '_blank');
                  }}
                  style={{ ...S.btnPrimary, background: "#22c55e", border: "none", justifyContent: "center", height: 50, fontSize: 16 }}
                >
                  Share to WhatsApp 💬
                </button>
                
                <button 
                  onClick={() => {
                    const url = window.URL.createObjectURL(shareData.blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = shareData.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    setShareData(null);
                  }}
                  style={{ ...S.btnSecondary, justifyContent: "center", height: 50, fontSize: 16 }}
                >
                  Download PDF 📥
                </button>
              </div>

              <button 
                onClick={() => setShareData(null)} 
                style={{ marginTop: 24, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
              >
                Close Window
              </button>
            </div>
          </div>
        )}

        {/* Edit Rate Modal */}
        {editingRateProduct && (
          <div style={{ ...S.modalOverlay, zIndex: 3200 }} onClick={() => setEditingRateProduct(null)}>
            <div style={{ ...S.modalCard, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#0f172a" }}>Edit Rate: {editingRateProduct.productName}</h3>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>SKU: {editingRateProduct.sku || "N/A"}</div>
                  </div>
                  <button onClick={() => setEditingRateProduct(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', padding: 0 }}>✕</button>
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={S.label}>Product Rate (₹)</label>
                    <input 
                      type="number" 
                      style={S.input} 
                      value={editingRateProduct.rate} 
                      onChange={e => setEditingRateProduct({ ...editingRateProduct, rate: e.target.value })} 
                    />
                  </div>
                  
                  <div>
                    <label style={S.label}>Packaging Type</label>
                    <select 
                      style={S.input} 
                      value={editingRateProduct.packagingType || ""} 
                      onChange={e => setEditingRateProduct({ ...editingRateProduct, packagingType: e.target.value })}
                    >
                      <option value="">No Packaging</option>
                      <option value="PVC Packing">PVC Packing</option>
                      <option value="Zip Packing">Zip Packing</option>
                      <option value="Bookfold Packing">Bookfold Packing</option>
                      <option value="Envolope Fold">Envolope Fold</option>
                      <option value="HOMCOT Bag">HOMCOT Bag</option>
                      <option value="myBEDZY Comfoter Bag">myBEDZY Comfoter Bag</option>
                      <option value="myBEDZY Comfoter Set Bag">myBEDZY Comfoter Set Bag</option>
                      <option value="Embroize Bag">Embroize Bag</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={S.label}>Packaging Cost (₹)</label>
                    <input 
                      type="number" 
                      style={S.input} 
                      value={editingRateProduct.packagingCost || 0} 
                      onChange={e => setEditingRateProduct({ ...editingRateProduct, packagingCost: e.target.value })} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <button onClick={() => setEditingRateProduct(null)} style={{ ...S.btnSecondary, flex: 1 }}>Cancel</button>
                    <button 
                      onClick={() => {
                        const party = editingRateProduct.originalParty;
                        const updatedRates = (party.rates || []).map((r: any) => 
                          r.productName === editingRateProduct.productName 
                            ? { 
                                productName: r.productName, 
                                rate: parseFloat(editingRateProduct.rate),
                                packagingType: editingRateProduct.packagingType || "",
                                packagingCost: parseFloat(editingRateProduct.packagingCost || "0")
                              } 
                            : r
                        );
                        
                        // Use existing update logic
                        const partyRef = ref(db, `partyRates/${party.id}`);
                        update(partyRef, { 
                          rates: updatedRates,
                          updatedAt: Date.now() 
                        }).then(() => {
                           loadData();
                           setViewingRateList({ ...party, rates: updatedRates });
                           setEditingRateProduct(null);
                        });
                      }}
                      style={{ ...S.btnPrimary, flex: 1 }}
                    >
                      Save Changes
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (viewingParty) {
    return (
      <div style={{ padding: isMobile ? 0 : "0 8px", animation: "fadeIn 0.2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "1px solid #f1f5f9", paddingBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <button onClick={() => setViewingParty(null)} style={{ ...S.btnSecondary, padding: "8px 12px", background: "#f8fafc" }}>← Back</button>
            <div>
              <h3 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "#0f172a" }}>{viewingParty.partyName}</h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0 0" }}>Manage party-specific product rates and packaging</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {isAdmin && <button onClick={() => { openAdminEditModal(viewingParty); setViewingParty(null); }} style={S.btnSecondary}>✎ Edit Profile</button>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Bill To / Ship To cards from before */}
          <div style={{ padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Bill To Details</div>
            <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5 }}>
              <strong>{viewingParty.billTo?.companyName}</strong><br/>
              {viewingParty.billTo?.address}<br/>
              {viewingParty.billTo?.district}, {viewingParty.billTo?.state} - {viewingParty.billTo?.pincode}<br/>
              Contact: {viewingParty.billTo?.contactNo}<br/>
              PAN: {viewingParty.billTo?.panNo}
            </div>
          </div>
          <div style={{ padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Ship To Details</div>
            <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5 }}>
              {viewingParty.sameAsBillTo ? (
                <span style={{ fontStyle: "italic", color: "#64748b" }}>Same as Billing Address</span>
              ) : (
                <>
                  <strong>{viewingParty.shipTo?.companyName}</strong><br/>
                  {viewingParty.shipTo?.address}, {viewingParty.shipTo?.district}, {viewingParty.shipTo?.state} - {viewingParty.shipTo?.pincode}<br/>
                  Contact: {viewingParty.shipTo?.contactNo}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 16, fontWeight: 500, color: "#0f172a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Assign New Rate</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20 }}>Independent Pricing</span>
          </h4>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", background: "#fafafa", padding: 20, borderRadius: 12, border: "1px dashed #e2e8f0" }}>
            {/* SEARCH */}
            <div style={{ flex: "1 1 250px", position: "relative" }}>
              <label style={S.label}>Search Product / SKU</label>
              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  style={{ ...S.input, paddingLeft: 42 }} 
                  placeholder="Search Product / SKU" 
                  value={selectedProduct ? (selectedProduct.productName || selectedProduct.name) : productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (selectedProduct) setSelectedProduct(null);
                  }}
                  onFocus={() => { if (selectedProduct) { setProductSearch(""); setSelectedProduct(null); } }}
                />
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                {selectedProduct && (
                  <button onClick={() => { setSelectedProduct(null); setProductSearch(""); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#f1f5f9", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 12, color: "#64748b" }}>✕</button>
                )}
              </div>
              {productSearch && !selectedProduct && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, marginTop: 4, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                  {products.filter(p => {
                    const search = productSearch.toLowerCase();
                    return (p.productName || p.name || "").toLowerCase().includes(search) || (p.sku || "").toLowerCase().includes(search);
                  }).slice(0, 10).map(p => (
                    <div key={p.id} onClick={() => setSelectedProduct(p)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{p.productName || p.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>SKU: {p.sku} | MRP: ₹{p.mrp || p.price || 0}</div>
                    </div>
                  ))}
                  {products.filter(p => {
                    const search = productSearch.toLowerCase();
                    return (p.productName || p.name || "").toLowerCase().includes(search) || (p.sku || "").toLowerCase().includes(search);
                  }).length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No products found.</div>}
                </div>
              )}
            </div>

            {/* NEW FIELDS */}
            <div style={{ flex: "1 1 120px" }}>
              <label style={S.label}>Rate (₹)</label>
              <input id="new-rate-val" type="number" style={S.input} placeholder="0.00" />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={S.label}>Packaging Type</label>
              <select id="new-pkg-type" style={S.input}>
                <option value="">No Packaging</option>
                <option value="PVC Packing">PVC Packing</option>
                <option value="Zip Packing">Zip Packing</option>
                <option value="Bookfold Packing">Bookfold Packing</option>
                <option value="Envolope Fold">Envolope Fold</option>
                <option value="HOMCOT Bag">HOMCOT Bag</option>
                <option value="myBEDZY Comfoter Bag">myBEDZY Comfoter Bag</option>
                <option value="myBEDZY Comfoter Set Bag">myBEDZY Comfoter Set Bag</option>
                <option value="Embroize Bag">Embroize Bag</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={S.label}>Pkg Cost (₹)</label>
              <input id="new-pkg-cost" type="number" style={S.input} placeholder="0.00" />
            </div>

            <div style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
              <button 
                onClick={() => {
                  const pVal = document.getElementById("new-rate-val") as HTMLInputElement;
                  const pType = document.getElementById("new-pkg-type") as HTMLInputElement;
                  const pCost = document.getElementById("new-pkg-cost") as HTMLInputElement;
                  if (selectedProduct && pVal?.value) {
                     const existing = viewingParty?.rates || [];
                     const pName = selectedProduct?.productName || selectedProduct?.name || "";
                     const updated = [...existing.filter(r => r.productName !== pName), { 
                        productName: pName, 
                        rate: parseFloat(pVal.value),
                        packagingType: pType?.value || "",
                        packagingCost: parseFloat(pCost?.value || "0")
                     }];
                     handleUpdateProductRates(updated);
                     setSelectedProduct(null);
                     setProductSearch("");
                     if (pVal) pVal.value = "";
                     if (pType) pType.value = "";
                     if (pCost) pCost.value = "";
                  } else {
                     alert("Please select a product and enter a rate.");
                  }
                }}
                disabled={!selectedProduct}
                style={{ ...S.btnPrimary, height: 44, opacity: (!selectedProduct) ? 0.6 : 1, cursor: (!selectedProduct) ? "not-allowed" : "pointer", padding: "0 24px" }}
              >
                Assign Rate
              </button>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: 16, fontWeight: 500, color: "#0f172a", marginBottom: 12 }}>Assigned Rates ({(viewingParty?.rates?.length || 0)})</h4>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ ...S.th, textAlign: "left" }}>Product Name</th>
                  <th style={{ ...S.th, textAlign: "left" }}>Packaging Type</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Pkg Cost</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Party Rate</th>
                  <th style={{ ...S.th, width: 80, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(viewingParty?.rates || []).map((r, idx) => (
                  <tr key={idx}>
                    <td style={S.td}>{r.productName}</td>
                    <td style={{ ...S.td, color: "#64748b" }}>{r.packagingType || "N/A"}</td>
                    <td style={{ ...S.td, textAlign: "right", color: "#64748b" }}>{(r.packagingCost || 0) > 0 ? `₹${r.packagingCost || 0}` : "₹0"}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 500, color: "#1e293b" }}>₹{r.rate}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <button 
                        onClick={() => {
                          if (confirm(`Remove custom rate for ${r.productName}?`)) {
                            const updated = (viewingParty.rates || []).filter((_, i) => i !== idx);
                            handleUpdateProductRates(updated);
                          }
                        }}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}
                      >✕</button>
                    </td>
                  </tr>
                ))}
                {(!viewingParty?.rates || viewingParty?.rates?.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32, color: "#94a3b8", fontStyle: "italic" }}>
                      No specific rates assigned to this party yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 0 : "0 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 19, fontWeight: 400, color: "#0f172a", margin: 0 }}>Party Wise Rate</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <button onClick={openCreateModal} style={S.btnPrimary}>
              Create Party
            </button>
          )}
          <button onClick={loadData} style={S.btnSecondary}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <div 
          className="search-container"
          style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            gap: 12,
            padding: "10px 16px", 
            background: "#fff", 
            border: "1.5px solid #e2e8f0", 
            borderRadius: 12,
            transition: "all 0.2s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="Search Party"
            style={{ 
              border: "none", 
              outline: "none", 
              background: "transparent", 
              width: "100%", 
              fontSize: 14,
              color: "#0f172a",
              fontWeight: 400,
              padding: "4px 0",
              boxShadow: "none"
            }}
          />
          <style>{`
            .search-container:focus-within {
              border-color: #6366f1 !important;
              background: #fff !important;
            }
            .search-container input:focus {
              background: transparent !important;
              outline: none !important;
              box-shadow: none !important;
            }
          `}</style>
        </div>
      </div>

      {showForm && isAdmin && (
        <div style={{ ...S.modalOverlay, zIndex: 1000 }}>
          <div style={{ ...S.modalCard, maxWidth: 640, maxHeight: "90vh", overflowY: "auto", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowForm(false)} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}>✕</button>
            <h3 style={{ fontSize: 20, fontWeight: 500, marginBottom: 24, color: "#0f172a" }}>{editingId ? "Edit Party Profile" : "Create New Party"}</h3>
            
            {/* Bill To Section */}
            <div style={{ marginBottom: 20, padding: 16, border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>BILL TO</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Company Name *</label>
                  <input style={S.input} value={form?.billTo?.companyName || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, companyName: e.target.value } })} />
                </div>
                <div>
                  <label style={S.label}>Owner Name</label>
                  <input style={S.input} value={form?.billTo?.ownerName || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, ownerName: e.target.value } })} />
                </div>
                <div style={{ gridColumn: isMobile ? "span 2" : "span 2" }}>
                  <label style={S.label}>Full Address *</label>
                  <input style={S.input} value={form?.billTo?.address || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, address: e.target.value } })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, gridColumn: "span 2" }}>
                  <div>
                    <label style={S.label}>District / City *</label>
                    <input style={S.input} value={form?.billTo?.district || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, district: e.target.value } })} />
                  </div>
                  <div>
                    <label style={S.label}>State *</label>
                    <input style={S.input} value={form?.billTo?.state || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, state: e.target.value } })} />
                  </div>
                  <div>
                    <label style={S.label}>Pin Code *</label>
                    <input style={S.input} value={form?.billTo?.pincode || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, pincode: e.target.value } })} />
                  </div>
                </div>
                <div>
                  <label style={S.label}>Contact No *</label>
                  <input style={S.input} value={form?.billTo?.contactNo || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, contactNo: e.target.value } })} />
                </div>
                <div>
                  <label style={S.label}>Email ID</label>
                  <input style={S.input} value={form?.billTo?.email || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, email: e.target.value } })} />
                </div>
                <div>
                  <label style={S.label}>GST No</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input 
                      style={{ ...S.input, flex: 1, paddingRight: gstVerified ? 36 : 12 }} 
                      value={form?.billTo?.gstNo || ""} 
                      onChange={e => {
                        setForm({ ...form, billTo: { ...form.billTo, gstNo: e.target.value.toUpperCase() } });
                        setGstVerified(false);
                      }} 
                      placeholder="Enter 15-digit GSTIN"
                    />
                    {gstVerified && (
                      <span style={{ 
                        position: 'absolute', 
                        right: 86, 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: '#22c55e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        animation: 'pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}>
                        ✅
                      </span>
                    )}
                    <button 
                      onClick={() => handleVerifyGst(form?.billTo?.gstNo || "")}
                      disabled={isVerifying || !form?.billTo?.gstNo}
                      style={{ 
                        ...S.btnSecondary, 
                        padding: "0 14px", 
                        fontSize: 12, 
                        background: gstVerified ? "#f0fdf4" : (isVerifying ? "#f1f5f9" : "#6366f1"), 
                        color: gstVerified ? "#22c55e" : (isVerifying ? "#94a3b8" : "#fff"),
                        borderColor: gstVerified ? "#22c55e" : "transparent",
                        border: gstVerified ? "1px solid #22c55e" : "none",
                        boxShadow: (isVerifying || gstVerified) ? "none" : "0 2px 4px rgba(99,102,241,0.2)",
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {isVerifying ? "..." : (gstVerified ? "Verified" : "Verify")}
                    </button>
                    <style>{`
                      @keyframes pop-in {
                        0% { transform: translateY(-50%) scale(0.5); opacity: 0; }
                        100% { transform: translateY(-50%) scale(1); opacity: 1; }
                      }
                    `}</style>
                  </div>
                </div>
                <div>
                  <label style={S.label}>PAN No *</label>
                  <input style={S.input} value={form?.billTo?.panNo || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, panNo: e.target.value } })} />
                </div>
                <div>
                  <label style={S.label}>Aadhar No</label>
                  <input style={S.input} value={form?.billTo?.adharNo || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, adharNo: e.target.value } })} />
                </div>
              </div>
            </div>

            {/* Ship To Section */}
            <div style={{ marginBottom: 20, padding: 16, border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 8, marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 16, color: "#1e293b" }}>SHIP TO</h4>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#475569" }}>
                  <input type="checkbox" checked={form.sameAsBillTo} onChange={e => setForm({ ...form, sameAsBillTo: e.target.checked })} />
                  Same as Bill To
                </label>
              </div>

              {!form.sameAsBillTo && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={S.label}>Company Name</label>
                    <input style={S.input} value={form?.shipTo?.companyName || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, companyName: e.target.value } })} />
                  </div>
                  <div>
                    <label style={S.label}>Owner Name</label>
                    <input style={S.input} value={form?.shipTo?.ownerName || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, ownerName: e.target.value } })} />
                  </div>
                  <div style={{ gridColumn: isMobile ? "span 2" : "span 2" }}>
                    <label style={S.label}>Full Address</label>
                    <input style={S.input} value={form?.shipTo?.address || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, address: e.target.value } })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, gridColumn: "span 2" }}>
                    <div>
                      <label style={S.label}>District / City</label>
                      <input style={S.input} value={form?.shipTo?.district || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, district: e.target.value } })} />
                    </div>
                    <div>
                      <label style={S.label}>State</label>
                      <input style={S.input} value={form?.shipTo?.state || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, state: e.target.value } })} />
                    </div>
                    <div>
                      <label style={S.label}>Pin Code</label>
                      <input style={S.input} value={form?.shipTo?.pincode || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, pincode: e.target.value } })} />
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Contact No</label>
                    <input style={S.input} value={form?.shipTo?.contactNo || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, contactNo: e.target.value } })} />
                  </div>
                  <div>
                    <label style={S.label}>Email ID</label>
                    <input style={S.input} value={form?.shipTo?.email || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, email: e.target.value } })} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={S.btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form?.billTo?.companyName} style={{ ...S.btnPrimary, opacity: (saving || !form?.billTo?.companyName) ? 0.6 : 1 }}>
                {saving ? "Saving..." : editingId ? "Update Profile" : "Create Party"}
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
          {(filteredRates || []).map(pr => (
            <div key={pr.id} 
              onClick={() => setViewingParty(pr)}
              style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.02)", cursor: "pointer", transition: "transform 0.2s", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <h4 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: "#1e293b" }}>{pr.partyName}</h4>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openAdminEditModal(pr)} style={{ border: "none", background: "#f8fafc", color: "#6366f1", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14 }}>✎</button>
                    <button onClick={() => handleDelete(pr.id, pr.partyName)} style={{ border: "none", background: "#fff1f2", color: "#ef4444", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14 }}>🗑</button>
                  </div>
                )}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pr.rates && pr.rates.slice(0, 3).map((r: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{r.productName}</span>
                    <span style={{ fontWeight: 400, color: "#0f172a" }}>₹{r.rate}</span>
                  </div>
                ))}
                {(pr?.rates?.length || 0) > 3 && (
                  <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>+ {(pr?.rates?.length || 0) - 3} more items</div>
                )}
                {(!pr?.rates || pr?.rates?.length === 0) && (
                  <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>No specific rates. Click to manage.</div>
                )}
              </div>

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{pr.updatedAt ? new Date(pr.updatedAt).toLocaleDateString() : "N/A"}</span>
                <div style={{ display: "flex", gap: 12 }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setViewingRateList(pr); }} 
                    style={{ background: "none", border: "none", color: "#10b981", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                  >
                    View Rate List 📋
                  </button>
                  <button style={{ background: "none", border: "none", color: "#6366f1", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                    Manage Rates →
                  </button>
                </div>
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
