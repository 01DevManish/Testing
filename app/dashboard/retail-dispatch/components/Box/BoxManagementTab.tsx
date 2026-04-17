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
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [activeSubTab, setActiveSubTab] = useState<"managed" | "dispatch">("managed");
  const [managedBoxes, setManagedBoxes] = useState<ManagedBox[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<ManagedBox | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [selectedBoxName, setSelectedBoxName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isMobile = viewportWidth < 640;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadManagedBoxes = async () => {
    setLoading(true);
    try {
      const data = await api.getManagedBoxes();
      setManagedBoxes(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "managed") loadManagedBoxes();
  }, [activeSubTab]);

  const dispatchHistory = useMemo(() => {
    return packingLists
      .filter((list) => (list.status === "Packed" || list.status === "Completed") && list.dispatchId)
      .filter(
        (list) =>
          !searchQuery ||
          list.partyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          list.dispatchId?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => (Number(b.dispatchedAt) || 0) - (Number(a.dispatchedAt) || 0));
  }, [packingLists, searchQuery]);

  const selectedDispatch = useMemo(() => packingLists.find((list) => list.id === selectedDispatchId), [packingLists, selectedDispatchId]);

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

  const totalBoxesForDispatch = (list: any) =>
    list.bails ||
    (list.items || []).reduce((acc: Set<string>, item: any) => {
      if (item.boxName) acc.add(item.boxName);
      return acc;
    }, new Set<string>()).size;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 0 }} className="animate-in fade-in duration-500">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 24 }}>
        <PageHeader
          title="Box Management"
          sub={activeSubTab === "managed" ? "Create and manage physical warehouse boxes." : "View boxes associated with finalized dispatches."}
        />

        <div style={{ display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 12, gap: 4, width: isMobile ? "100%" : "auto" }}>
          <button
            style={{
              flex: isMobile ? 1 : undefined,
              padding: isMobile ? "10px 12px" : "10px 20px",
              borderRadius: 10,
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
              background: activeSubTab === "managed" ? "#6366f1" : "transparent",
              color: activeSubTab === "managed" ? "#fff" : "#64748b",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setActiveSubTab("managed")}
          >
            Managed Boxes
          </button>
          <button
            style={{
              flex: isMobile ? 1 : undefined,
              padding: isMobile ? "10px 12px" : "10px 20px",
              borderRadius: 10,
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
              background: activeSubTab === "dispatch" ? "#6366f1" : "transparent",
              color: activeSubTab === "dispatch" ? "#fff" : "#64748b",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setActiveSubTab("dispatch")}
          >
            Dispatch History
          </button>
        </div>
      </div>

      {activeSubTab === "managed" ? (
        <div className="animate-in slide-in-from-bottom-2 duration-400">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 24 }}>
            <div style={{ fontSize: isMobile ? 12 : 14, color: "#64748b", fontWeight: 500 }}>{managedBoxes.length} Total Boxes Created</div>
            <BtnPrimary onClick={() => setIsCreateModalOpen(true)} style={isMobile ? { width: "100%", justifyContent: "center", fontSize: 12 } : undefined}>
              + Create New Box
            </BtnPrimary>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading boxes...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 160 : 220}px, 1fr))`, gap: isMobile ? 12 : 20 }}>
              {managedBoxes.map((box) => (
                <Card key={box.id} style={{ padding: isMobile ? 14 : 20, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "#1e293b" }}>{box.id}</div>
                      <div style={{ fontSize: isMobile ? 10 : 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{box.status}</div>
                      {box.partyName && <div style={{ fontSize: isMobile ? 10 : 11, color: "#6366f1", fontWeight: 700, marginTop: 2 }}>{box.partyName}</div>}
                    </div>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: box.status === "Available" ? "#10b981" : "#f59e0b" }} />
                  </div>

                  <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 12 }}>
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "#64748b", marginBottom: 4 }}>
                      Items: <span style={{ fontWeight: 700, color: "#1e293b" }}>{box.items?.length || 0} / {box.capacity}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 10 : 11, color: "#94a3b8", marginBottom: 6 }}>
                      Total Boxes: <span style={{ fontWeight: 700, color: "#334155" }}>{box.totalBoxes || 1}</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, ((box.items?.length || 0) / box.capacity) * 100)}%`, height: "100%", background: "#6366f1" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", padding: "10px 0" }}>
                    <img src={renderBarcodeToBase64(box.barcode)} alt={box.barcode} style={{ width: "100%", height: 40, objectFit: "contain" }} />
                    <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1, color: "#64748b" }}>{box.barcode}</span>
                  </div>

                  <div style={{ alignSelf: isMobile ? "stretch" : "flex-end", display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
                    <BtnPrimary style={{ fontSize: 11, padding: isMobile ? "8px 10px" : "4px 10px", justifyContent: "center" }} onClick={() => printBoxLabel(box)}>
                      Print Label
                    </BtnPrimary>
                    <BtnGhost style={{ fontSize: 11, padding: isMobile ? "8px 10px" : "4px 8px", justifyContent: "center" }} onClick={() => setEditingBox(box)}>
                      Edit
                    </BtnGhost>
                    <BtnGhost
                      style={{ fontSize: 11, padding: isMobile ? "8px 10px" : "4px 8px", color: "#ef4444", justifyContent: "center" }}
                      onClick={() => {
                        if (confirm("Permanent Delete?")) api.deleteManagedBox(box.id).then(loadManagedBoxes);
                      }}
                    >
                      Delete
                    </BtnGhost>
                  </div>
                </Card>
              ))}
              {managedBoxes.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: isMobile ? 40 : 80, border: "2px dashed #e2e8f0", borderRadius: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>No managed boxes found. Create one to get started.</div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in slide-in-from-bottom-2 duration-400">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, maxWidth: isMobile ? "100%" : 400, width: isMobile ? "100%" : "auto" }}>
              <input
                type="text"
                placeholder="Search Dispatch ID or Party Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: isMobile ? "11px 14px" : "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", fontSize: isMobile ? 12 : 14 }}
              />
            </div>
            {selectedDispatchId && (
              <BtnGhost onClick={() => { setSelectedDispatchId(null); setSelectedBoxName(null); }} style={isMobile ? { width: "100%", justifyContent: "center", fontSize: 12 } : undefined}>
                Back to Dispatch List
              </BtnGhost>
            )}
          </div>

          {!selectedDispatchId && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 220 : 300}px, 1fr))`, gap: isMobile ? 12 : 16 }}>
              {dispatchHistory.map((list) => (
                <Card key={list.id} onClick={() => setSelectedDispatchId(list.id)} className="hover-card" style={{ cursor: "pointer", transition: "all 0.2s", border: "1px solid #e2e8f0" }}>
                  <div style={{ padding: isMobile ? 14 : 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>#{list.dispatchId}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(list.dispatchedAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{list.partyName}</div>
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", marginTop: 4 }}>
                      {list.items?.length || 0} Total Items | {totalBoxesForDispatch(list)} Boxes/Bails
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {selectedDispatchId && !selectedBoxName && (
            <Card style={{ padding: isMobile ? 16 : 24 }}>
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6366f115", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>1</div>
                <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>Select a Box from {selectedDispatch?.partyName}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 220}px, 1fr))`, gap: isMobile ? 12 : 20 }}>
                {(dispatchBoxes as string[]).map((box) => (
                  <div key={box} onClick={() => setSelectedBoxName(box)} className="hover-card" style={{ border: "1px solid #e2e8f0", padding: isMobile ? 14 : 20, borderRadius: 16, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{box.startsWith("BL") ? "Bale" : "Box"}</div>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700 }}>{box}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {selectedDispatchId && selectedBoxName && (
            <Card style={{ padding: isMobile ? 16 : 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b98115", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>2</div>
                  <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>Contents of {selectedBoxName}</h3>
                </div>
                <BtnGhost onClick={() => setSelectedBoxName(null)} style={isMobile ? { width: "100%", justifyContent: "center", fontSize: 12 } : undefined}>
                  Change Box
                </BtnGhost>
              </div>

              {isMobile ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {boxContents.map((item: any, index: number) => (
                    <div key={index} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff", display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{item.productName}</div>
                      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{item.sku}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 10, background: "#f8fafc", border: "1px solid #eef2f7" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>Quantity</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                      <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>SKU</th>
                      <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Name</th>
                      <th style={{ padding: 12, fontSize: 11, color: "#64748b", textTransform: "uppercase", textAlign: "right" }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxContents.map((item: any, index: number) => (
                      <tr key={index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 12, fontSize: 13, fontFamily: "monospace" }}>{item.sku}</td>
                        <td style={{ padding: 12, fontSize: 14, fontWeight: 500 }}>{item.productName}</td>
                        <td style={{ padding: 12, fontSize: 14, fontWeight: 700, textAlign: "right" }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
