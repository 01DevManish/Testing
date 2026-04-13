"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, BtnPrimary, BtnGhost } from "../ui";
import { api } from "../../data";
import { ManagedBox } from "../../types";
import { generateBoxMgtBarcode, renderBarcodeToBase64 } from "@/app/lib/barcodeUtils";
import { useAuth } from "@/app/context/AuthContext";

interface CreateBoxModalProps {
  onClose: () => void;
  onCreated: () => void;
  products: any[];
  initialBox?: ManagedBox;
}

export default function CreateBoxModal({ onClose, onCreated, products, initialBox }: CreateBoxModalProps) {
  const { user, userData } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Box Data
  const [boxId, setBoxId] = useState(initialBox?.id || "");
  const [barcode, setBarcode] = useState(initialBox?.barcode || "");
  const [capacity, setCapacity] = useState(initialBox?.capacity || 16);
  const [selectedItems, setSelectedItems] = useState<any[]>(initialBox?.items || []);
  const [searchQuery, setSearchQuery] = useState("");
  const isEditing = !!initialBox;

  useEffect(() => {
    if (isEditing) return; // Don't fetch next ID if editing
    
    const init = async () => {
       try {
         const id = await api.getNextManagedBoxId();
         setBoxId(id);
         setBarcode(generateBoxMgtBarcode());
       } catch (e) {
         console.error("Failed to initialize box data:", e);
         alert("Could not load Box ID. Please check your internet connection or Firebase rules.");
       }
    };
    init();
  }, [isEditing]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    return products.filter(p => 
      p.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [products, searchQuery]);

  const handleAddItem = (product: any) => {
    if (selectedItems.length >= capacity) {
      alert(`Box capacity reached! Max ${capacity} items.`);
      return;
    }
    if (selectedItems.find(i => i.productId === product.id)) {
      alert("This product is already in the box.");
      return;
    }
    setSelectedItems([...selectedItems, {
       productId: product.id,
       productName: product.productName,
       sku: product.sku || product.id.slice(0, 8),
       quantity: 1
    }]);
    setSearchQuery("");
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const box: ManagedBox = {
        id: boxId,
        barcode,
        capacity,
        items: selectedItems,
        status: initialBox?.status || "Available",
        createdAt: initialBox?.createdAt || Date.now()
      };
      await api.createManagedBox(box, { uid: user?.uid || "unknown", name: userData?.name || "Admin" });
      onCreated();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to ${isEditing ? 'update' : 'create'} box: ${e.message || "Unknown Error"}`);
    } finally {
      setLoading(false);
    }
  };

  const S = {
    overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
    modal: { width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" as const, background: "#fff", borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" },
    header: { padding: "24px 30px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" },
    body: { padding: 30, overflowY: "auto" as const, flex: 1 },
    footer: { padding: "20px 30px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 12 },
    input: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", fontSize: 14, fontWeight: 500 },
    itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8fafc", borderRadius: 12, marginBottom: 8 }
  };

  return (
    <div style={S.overlay}>
       <div style={S.modal} className="animate-in zoom-in-95 duration-200">
          <div style={S.header}>
             <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEditing ? `Edit Box ${boxId}` : `Initialize Box ${boxId}`}</h2>
             <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#64748b" }}>&times;</button>
          </div>

          <div style={S.body}>
             {step === 1 && (
               <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                     <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Box Capacity (SKU Slots)</label>
                     <input 
                        type="number" 
                        value={capacity} 
                        onChange={(e) => setCapacity(Number(e.target.value))}
                        style={S.input}
                     />
                     <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Total unique SKUs allowed in this physical box.</p>
                  </div>
                  <BtnPrimary onClick={() => setStep(2)}>Continue to SKU Selection →</BtnPrimary>
               </div>
             )}

             {step === 2 && (
               <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                     <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Select SKUs ({selectedItems.length} / {capacity})</label>
                     <input 
                        type="text" 
                        placeholder="Search SKU or Name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={S.input}
                     />
                     
                     {searchQuery && (
                       <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginTop: 4, overflow: "hidden", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", position: "relative", zIndex: 10 }}>
                          {filteredProducts.map(p => (
                            <div 
                              key={p.id} 
                              onClick={() => handleAddItem(p)}
                              style={{ padding: "10px 16px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                               <div style={{ fontWeight: 600 }}>{p.productName}</div>
                               <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.sku}</div>
                            </div>
                          ))}
                          {filteredProducts.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>No products found.</div>}
                       </div>
                     )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                     {selectedItems.map(item => (
                       <div key={item.productId} style={S.itemRow}>
                          <div style={{ flex: 1 }}>
                             <div style={{ fontSize: 14, fontWeight: 600 }}>{item.productName}</div>
                             <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{item.sku}</div>
                          </div>
                          <button onClick={() => setSelectedItems(selectedItems.filter(i => i.productId !== item.productId))} style={{ border: "none", background: "#fee2e2", color: "#ef4444", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                       </div>
                     ))}
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                     <BtnGhost style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</BtnGhost>
                     <BtnPrimary style={{ flex: 2 }} onClick={() => setStep(3)} disabled={selectedItems.length === 0}>Review & Generate →</BtnPrimary>
                  </div>
               </div>
             )}

             {step === 3 && (
               <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center" }}>
                  <div style={{ padding: 30, background: "#f8fafc", borderRadius: 20, border: "1px dashed #e2e8f0" }}>
                     <h3 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 800 }}>{boxId}</h3>
                     <div style={{ fontSize: 13, color: "#64748b" }}>Capacity: {capacity} SKUs</div>
                     <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Filled: {selectedItems.length} SKUs</div>
                     
                     <div style={{ background: "#fff", padding: 20, borderRadius: 12, display: "inline-block" }}>
                        <img src={renderBarcodeToBase64(barcode)} alt={barcode} style={{ height: 60 }} />
                        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 8, letterSpacing: 2 }}>{barcode}</div>
                     </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: 12 }}>
                     <BtnGhost style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</BtnGhost>
                     <BtnPrimary style={{ flex: 2 }} onClick={handleSave} disabled={loading || !boxId || !barcode}>
                        {loading ? (isEditing ? "Updating..." : "Creating...") : (!boxId ? "ID Error" : isEditing ? "Save Changes" : "Confirm & Save Box")}
                     </BtnPrimary>
                  </div>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}
