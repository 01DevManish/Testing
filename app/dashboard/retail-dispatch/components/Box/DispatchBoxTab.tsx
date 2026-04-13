"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, PageHeader, BtnPrimary, BtnGhost } from "../ui";
import { api, firestoreApi } from "../../data";
import { ManagedBox, Party, Transporter } from "../../types";
import { useAuth } from "@/app/context/AuthContext";
import { ref, push, set } from "firebase/database";
import { db } from "@/app/lib/firebase";

interface DispatchBoxTabProps {
  products: any[];
}

export default function DispatchBoxTab({ products }: DispatchBoxTabProps) {
  const { user, userData } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [managedBoxes, setManagedBoxes] = useState<ManagedBox[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);

  // Selection State
  const [selectedBox, setSelectedBox] = useState<ManagedBox | null>(null);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [boxMultiplier, setBoxMultiplier] = useState(1);
  
  // Party / Transporter State
  // (Removed as per user request to simplify)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const boxes = await api.getManagedBoxes();
        setManagedBoxes(boxes);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSelectBox = (box: ManagedBox) => {
    setSelectedBox(box);
    const qtys: Record<string, number> = {};
    box.items.forEach(item => {
      qtys[item.productId] = item.quantity;
    });
    setItemQuantities(qtys);
    setStep(2);
  };

  const handleFinalize = async () => {
    if (!selectedBox) return;

    setLoading(true);
    try {
      const finalItems = selectedBox.items.map(item => ({
        ...item,
        quantity: (itemQuantities[item.productId] || 0) * boxMultiplier
      })).filter(i => i.quantity > 0);

      const packingList = {
          partyId: "manual",
          partyName: "Direct Box Dispatch",
          status: "Packed",
          items: finalItems,
          createdAt: new Date().toISOString(),
          createdBy: { uid: user?.uid, name: userData?.name || "Admin" },
          bails: boxMultiplier,
          transporter: "Self/Direct",
          transporterId: "",
          isBoxDispatch: true,
          sourceBoxId: selectedBox.id,
          sourceBoxBarcode: selectedBox.barcode
      };

      const newListRef = push(ref(db, "packingLists"));
      await set(newListRef, packingList);
      
      alert(`Successfully dispatched ${boxMultiplier} boxes!`);
      setStep(1);
      setSelectedBox(null);
    } catch (e) {
      console.error(e);
      alert("Failed to finalize. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  const S = {
    stepCircle: (active: boolean) => ({
      width: 32, height: 32, borderRadius: "50%", background: active ? "#6366f1" : "#f1f5f9",
      color: active ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700, border: active ? "none" : "1px solid #e2e8f0"
    }),
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
    boxCard: { padding: 20, cursor: "pointer", transition: "all 0.2s" },
    input: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", fontSize: 14, fontWeight: 500 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8fafc", borderRadius: 12, marginBottom: 8 }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Dispatch Box" sub="Fulfill orders quickly using box templates." />
      
      {/* Step Indicator */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", gap: 40, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.stepCircle(step >= 1)}>1</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: step >= 1 ? "#1e293b" : "#94a3b8" }}>Select Template</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.stepCircle(step >= 2)}>2</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: step >= 2 ? "#1e293b" : "#94a3b8" }}>Finalize Dispatch</span>
        </div>
      </Card>

      {step === 1 && (
        <div style={S.grid}>
          {managedBoxes.map(box => (
            <Card 
               key={box.id} 
               style={S.boxCard} 
               onClick={() => handleSelectBox(box)}
               className="hover:shadow-lg hover:border-indigo-200"
            >
               <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{box.id}</h3>
               <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>{box.barcode}</div>
               <div style={{ fontSize: 13, color: "#64748b" }}>SKUs in template: {box.items.length}</div>
               <div style={{ fontSize: 13, color: "#64748b" }}>Capacity: {box.capacity}</div>
            </Card>
          ))}
          {managedBoxes.length === 0 && !loading && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "#94a3b8" }}>No boxes created yet. Please go to Manage Boxes first.</div>}
        </div>
      )}

      {step === 2 && selectedBox && (
        <Card style={{ padding: 30, maxWidth: 700, margin: "0 auto" }}>
          <div style={{ marginBottom: 24, borderBottom: "1px solid #f1f5f9", paddingBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Dispatching {selectedBox.id}</h2>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Set quantity per SKU and confirm dispatch.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
            {selectedBox.items.map(item => (
              <div key={item.productId} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.productName}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{item.sku}</div>
                </div>
                <input 
                   type="number"
                   value={itemQuantities[item.productId] ?? 0}
                   onChange={(e) => setItemQuantities({...itemQuantities, [item.productId]: Number(e.target.value)})}
                   style={{ ...S.input, width: 80, textAlign: "center", padding: "8px" }}
                />
              </div>
            ))}
          </div>

          <div style={{ background: "#f5f3ff", padding: 20, borderRadius: 16, marginBottom: 30, border: "1px solid #ddd6fe" }}>
             <label style={{ fontSize: 12, fontWeight: 700, color: "#4338ca", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Number of Boxes (Multiplier)</label>
             <input 
                type="number" 
                value={boxMultiplier} 
                onChange={(e) => setBoxMultiplier(Number(e.target.value))}
                style={S.input}
                placeholder="e.g. 1"
             />
             <p style={{ fontSize: 11, color: "#6366f1", marginTop: 8 }}>Total units will be: (Qty * {boxMultiplier} boxes)</p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <BtnGhost style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</BtnGhost>
            <BtnPrimary style={{ flex: 2 }} onClick={handleFinalize} disabled={loading}>
              {loading ? "Confirming..." : `Finalize Dispatch (${boxMultiplier} Boxes) →`}
            </BtnPrimary>
          </div>
        </Card>
      )}
    </div>
  );
}
