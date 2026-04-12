"use client";

import React, { useState, useMemo } from "react";
import { Card, PageHeader, BtnGhost } from "../ui";

interface BoxManagementTabProps {
  packingLists: any[];
}

export default function BoxManagementTab({ packingLists }: BoxManagementTabProps) {
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [selectedBoxName, setSelectedBoxName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter only packed/completed dispatches
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

  const boxes = useMemo(() => {
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
    container: { maxWidth: 1200, margin: "0 auto", padding: "20px 0" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
    dispatchCard: { cursor: "pointer", transition: "all 0.2s", border: "1px solid #e2e8f0" },
    boxGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 },
    boxCard: { 
      cursor: "pointer", 
      display: "flex", 
      flexDirection: "column" as const, 
      alignItems: "center", 
      padding: 16, 
      borderRadius: 12, 
      border: "1px solid #e2e8f0",
      background: "#fff",
      transition: "all 0.2s"
    },
    activeBox: { background: "#f5f3ff", borderColor: "#818cf8", transform: "translateY(-2px)", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" },
    meta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
    badge: { padding: "4px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const }
  };

  return (
    <div style={S.container} className="animate-in fade-in duration-500">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageHeader 
          title="Box Management" 
          sub={
            selectedDispatch 
              ? `Viewing Box Breakdown for ${selectedDispatch.partyName}` 
              : "Select a dispatch to explore its boxes and contents."
          } 
        />
        {selectedDispatchId && (
          <BtnGhost onClick={() => { setSelectedDispatchId(null); setSelectedBoxName(null); }}>
             ← Back to Dispatch List
          </BtnGhost>
        )}
      </div>

      {/* STEP 1: SELECT DISPATCH */}
      {!selectedDispatchId && (
        <>
          <Card style={{ marginBottom: 16, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" 
                placeholder="Search Dispatch ID or Party Name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", width: "100%", fontSize: 14 }}
              />
            </div>
          </Card>

          <div style={S.grid}>
            {dispatchHistory.map(l => (
              <Card 
                key={l.id} 
                onClick={() => setSelectedDispatchId(l.id)}
                className="hover-card"
                style={S.dispatchCard}
              >
                 <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                       <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>#{l.dispatchId}</span>
                       <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(l.dispatchedAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{l.partyName}</div>
                    <div style={S.meta}>
                       {l.items?.length || 0} Total Items | {l.bails || (l.items || []).reduce((acc: Set<string>, i: any) => { if(i.boxName) acc.add(i.boxName); return acc; }, new Set()).size} Boxes/Bails
                    </div>
                 </div>
              </Card>
            ))}
            {dispatchHistory.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "#94a3b8" }}>
                 No finalized dispatches found.
              </div>
            )}
          </div>
        </>
      )}

      {/* STEP 2: SELECT BOX */}
      {selectedDispatchId && !selectedBoxName && (
        <Card style={{ padding: 24 }}>
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
             <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6366f115", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>1</div>
             <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select a Box or Bale</h3>
          </div>
          
          <div style={S.boxGrid}>
            {(boxes as string[]).map((box: string) => {
              const isBale = box.startsWith("BL");
              return (
                <div 
                  key={box} 
                  onClick={() => setSelectedBoxName(box)}
                  style={S.boxCard}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#818cf8"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{isBale ? "🧶" : "📦"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{box}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                    {isBale ? "Bale" : "Box"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* STEP 3: VIEW CONTENTS */}
      {selectedDispatchId && selectedBoxName && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
           <Card style={{ padding: 24 }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                   <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b98115", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>2</div>
                   <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Contents of {selectedBoxName}</h3>
                </div>
                <BtnGhost onClick={() => setSelectedBoxName(null)}>
                   Change Box
                </BtnGhost>
             </div>

             <div style={{ overflowX: "auto" }}>
               <table style={{ width: "100%", borderCollapse: "collapse" }}>
                 <thead>
                    <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                       <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Product Name</th>
                       <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>SKU</th>
                       <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Packaging</th>
                       <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Qty</th>
                    </tr>
                 </thead>
                 <tbody>
                    {(boxContents as any[]).map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                         <td style={{ padding: "12px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{item.productName}</td>
                         <td style={{ padding: "12px", fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>{item.sku}</td>
                         <td style={{ padding: "12px" }}>
                            <span style={{ 
                               fontSize: 10, 
                               fontWeight: 700, 
                               padding: "4px 8px", 
                               borderRadius: 6, 
                               background: "#eff6ff", 
                               color: "#2563eb" 
                            }}>{item.packagingType || "N/A"}</span>
                         </td>
                         <td style={{ padding: "12px", fontSize: 14, fontWeight: 700, color: "#1e293b", textAlign: "right" }}>{item.quantity}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
           </Card>
        </div>
      )}
    </div>
  );
}
