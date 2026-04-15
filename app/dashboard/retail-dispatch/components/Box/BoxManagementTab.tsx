"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, PageHeader, BtnGhost, BtnPrimary } from "../ui";
import { api } from "../../data";
import { ManagedBox } from "../../types";
import CreateBoxModal from "./CreateBoxModal";
import { renderBarcodeToBase64 } from "@/app/lib/barcodeUtils";
import { printBoxLabel } from "./BoxPrintHelper";

interface BoxManagementTabProps {
  packingLists: any[];
  products: any[];
}

export default function BoxManagementTab({ packingLists, products }: BoxManagementTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"managed" | "dispatch">("managed");
  const [managedBoxes, setManagedBoxes] = useState<ManagedBox[]>([]);
  const [loading, setLoading] = useState(false);
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<ManagedBox | null>(null);
  
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [selectedBoxName, setSelectedBoxName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadManagedBoxes = async () => {
    setLoading(true);
    try {
      const data = await api.getManagedBoxes();
      setManagedBoxes(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "managed") loadManagedBoxes();
  }, [activeSubTab]);

  // --- Dispatch Breakdown Logic (Historical) ---
  const dispatchHistory = useMemo(() => {
    return packingLists
      .filter(l => (l.status === "Packed" || l.status === "Completed") && l.dispatchId)
      .filter(l => 
        !searchQuery || 
        l.partyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.dispatchId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => (Number(b.dispatchedAt) || 0) - (Number(a.dispatchedAt) || 0));
  }, [packingLists, searchQuery]);

  const selectedDispatch = useMemo(() => 
    packingLists.find(l => l.id === selectedDispatchId), 
    [packingLists, selectedDispatchId]
  );

  const dispatchBoxes = useMemo(() => {
    if (!selectedDispatch) return [];
    const itemBoxes = (selectedDispatch.items || []).reduce((acc: Set<string>, item: any) => {
      if (item.boxName) acc.add(item.boxName);
      return acc;
    }, new Set<string>());
    return Array.from(itemBoxes).sort();
  }, [selectedDispatch]);

  const boxContents = useMemo(() => {
    if (!selectedDispatch || !selectedBoxName) return [];
    return (selectedDispatch.items || []).filter((item: any) => item.boxName === selectedBoxName);
  }, [selectedDispatch, selectedBoxName]);

  const S = {
    container: { maxWidth: 1200, margin: "0 auto", padding: "0" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
    dispatchCard: { cursor: "pointer", transition: "all 0.2s", border: "1px solid #e2e8f0" },
    boxGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 },
    boxCard: { 
      padding: 20, 
      borderRadius: 16, 
      border: "1px solid #e2e8f0",
      background: "#fff",
      transition: "all 0.2s",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      position: "relative" as const
    },
    tabBtn: (active: boolean) => ({
      padding: "10px 20px",
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      background: active ? "#6366f1" : "transparent",
      color: active ? "#fff" : "#64748b",
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s"
    })
  };

  return (
    <div style={S.container} className="animate-in fade-in duration-500">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageHeader 
          title="Box Management" 
          sub={activeSubTab === "managed" ? "Create and manage physical warehouse boxes." : "View boxes associated with finalized dispatches."} 
        />
        
        <div style={{ display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 12, gap: 4 }}>
          <button style={S.tabBtn(activeSubTab === "managed")} onClick={() => setActiveSubTab("managed")}>Managed Boxes</button>
          <button style={S.tabBtn(activeSubTab === "dispatch")} onClick={() => setActiveSubTab("dispatch")}>Dispatch History</button>
        </div>
      </div>

      {activeSubTab === "managed" ? (
        <div className="animate-in slide-in-from-bottom-2 duration-400">
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>
                {managedBoxes.length} Total Boxes Created
              </div>
              <BtnPrimary onClick={() => setIsCreateModalOpen(true)}>
                + Create New Box
              </BtnPrimary>
           </div>

           {loading ? (
             <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading boxes...</div>
           ) : (
             <div style={S.boxGrid}>
                {managedBoxes.map(box => (
                  <Card key={box.id} style={S.boxCard}>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                           <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{box.id}</div>
                           <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{box.status}</div>
                           {box.partyName && <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginTop: 2 }}>{box.partyName}</div>}
                        </div>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: box.status === "Available" ? "#10b981" : "#f59e0b" }} />
                     </div>

                     <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Items: <span style={{ fontWeight: 700, color: "#1e293b" }}>{box.items?.length || 0} / {box.capacity}</span></div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Total Boxes: <span style={{ fontWeight: 700, color: "#334155" }}>{box.totalBoxes || 1}</span></div>
                        <div style={{ width: "100%", height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                           <div style={{ width: `${Math.min(100, ((box.items?.length || 0) / box.capacity) * 100)}%`, height: "100%", background: "#6366f1" }} />
                        </div>
                     </div>

                     <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", padding: "10px 0" }}>
                        <img src={renderBarcodeToBase64(box.barcode)} alt={box.barcode} style={{ width: "100%", height: 40, objectFit: "contain" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1, color: "#64748b" }}>{box.barcode}</span>
                     </div>
                     
                      <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
                         <BtnPrimary style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => printBoxLabel(box)}>Print Label</BtnPrimary>
                         <BtnGhost style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setEditingBox(box)}>Edit</BtnGhost>
                         <BtnGhost style={{ fontSize: 11, padding: "4px 8px", color: "#ef4444" }} onClick={() => { if(confirm("Permanent Delete?")) api.deleteManagedBox(box.id).then(loadManagedBoxes) }}>Delete</BtnGhost>
                      </div>
                  </Card>
                ))}
                {managedBoxes.length === 0 && (
                  <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 80, border: "2px dashed #e2e8f0", borderRadius: 20 }}>
                     <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
                     <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>No managed boxes found. Click "+ Create New Box" to start.</div>
                  </div>
                )}
             </div>
           )}
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-2 duration-400">
           {/* Legacy Dispatch Breakdown Logic */}
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ flex: 1, maxWidth: 400 }}>
                 <input 
                    type="text" 
                    placeholder="Search Dispatch ID or Party Name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", fontSize: 14 }}
                 />
              </div>
              {selectedDispatchId && (
                <BtnGhost onClick={() => { setSelectedDispatchId(null); setSelectedBoxName(null); }}>
                  ← Back to Dispatch List
                </BtnGhost>
              )}
           </div>

           {!selectedDispatchId && (
              <div style={S.grid}>
                 {dispatchHistory.map(l => (
                    <Card key={l.id} onClick={() => setSelectedDispatchId(l.id)} className="hover-card" style={S.dispatchCard}>
                       <div style={{ padding: 20 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                             <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>#{l.dispatchId}</span>
                             <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(l.dispatchedAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{l.partyName}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                             {l.items?.length || 0} Total Items | {l.bails || (l.items || []).reduce((acc: Set<string>, i: any) => { if(i.boxName) acc.add(i.boxName); return acc; }, new Set()).size} Boxes/Bails
                          </div>
                       </div>
                    </Card>
                 ))}
              </div>
           )}

           {selectedDispatchId && !selectedBoxName && (
              <Card style={{ padding: 24 }}>
                 <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6366f115", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>1</div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select a Box from {selectedDispatch?.partyName}</h3>
                 </div>
                 <div style={S.boxGrid}>
                    {(dispatchBoxes as string[]).map(box => (
                       <div key={box} onClick={() => setSelectedBoxName(box)} className="hover-card" style={{ border: "1px solid #e2e8f0", padding: 20, borderRadius: 16, cursor: "pointer", textAlign: "center" }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>{box.startsWith("BL") ? "🧶" : "📦"}</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{box}</div>
                       </div>
                    ))}
                 </div>
              </Card>
           )}

           {selectedDispatchId && selectedBoxName && (
              <Card style={{ padding: 24 }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                       <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b98115", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>2</div>
                       <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Contents of {selectedBoxName}</h3>
                    </div>
                    <BtnGhost onClick={() => setSelectedBoxName(null)}>Change Box</BtnGhost>
                 </div>
                 <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                       <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                          <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>SKU</th>
                          <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Name</th>
                          <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Qty</th>
                       </tr>
                    </thead>
                    <tbody>
                       {boxContents.map((item: any, i: number) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                             <td style={{ padding: 12, fontSize: 13, fontFamily: "monospace" }}>{item.sku}</td>
                             <td style={{ padding: 12, fontSize: 14, fontWeight: 500 }}>{item.productName}</td>
                             <td style={{ padding: 12, fontSize: 14, fontWeight: 700, textAlign: "right" }}>{item.quantity}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </Card>
           )}
        </div>
      )}

      {(isCreateModalOpen || editingBox) && (
         <CreateBoxModal 
            onClose={() => { setIsCreateModalOpen(false); setEditingBox(null); }} 
            onCreated={() => { setIsCreateModalOpen(false); setEditingBox(null); loadManagedBoxes(); }}
            products={products}
            initialBox={editingBox || undefined}
         />
      )}
    </div>
  );
}
