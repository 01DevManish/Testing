"use client";

import React, { useState, useEffect } from "react";
import { Card, PageHeader, BtnPrimary, BtnGhost } from "../ui";
import { api } from "../../data";
import { ManagedBox } from "../../types";
import { useAuth } from "@/app/context/AuthContext";
import { ref, push, set } from "firebase/database";
import { db } from "@/app/lib/firebase";
import { generateBoxDispatchPdf } from "../../BoxDispatchPdf";
import { renderBarcodeToBase64 } from "@/app/lib/barcodeUtils";
import Image from "next/image";
import type { ProductLookup } from "../../BoxDispatchPdf";

interface DispatchBoxTabProps {
  products: ProductLookup[];
}

export default function DispatchBoxTab({ products }: DispatchBoxTabProps) {
  const { user, userData } = useAuth();

  const [loading, setLoading] = useState(false);
  const [managedBoxes, setManagedBoxes] = useState<ManagedBox[]>([]);
  const [selectedBox, setSelectedBox] = useState<ManagedBox | null>(null);
  const [isDispatchMode, setIsDispatchMode] = useState(false);

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

  const handlePrintTemplatePdf = async (box: ManagedBox) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print PDF.");
      return;
    }

    const templateList = {
      sourceBoxId: box.id,
      sourceBoxBarcode: box.barcode,
      partyName: box.partyName || "Direct Box Dispatch",
      items: (box.items || []).map((i) => ({
        ...i,
        quantity: i.quantity || 0,
      })),
    };

    await generateBoxDispatchPdf(templateList, products, { mode: "print", targetWindow: printWindow });
  };

  const handleViewTemplatePdf = async (box: ManagedBox) => {
    const viewWindow = window.open("", "_blank");
    if (!viewWindow) {
      alert("Please allow popups to view PDF.");
      return;
    }

    const templateList = {
      sourceBoxId: box.id,
      sourceBoxBarcode: box.barcode,
      partyName: box.partyName || "Direct Box Dispatch",
      items: (box.items || []).map((i) => ({
        ...i,
        quantity: i.quantity || 0,
      })),
    };

    await generateBoxDispatchPdf(templateList, products, { mode: "view", targetWindow: viewWindow });
  };

  const handleStartDispatch = () => {
    setIsDispatchMode(true);
    setSelectedBox(null);
  };

  const handleFinalize = async () => {
    if (!selectedBox) return;

    setLoading(true);
    try {
      const finalItems = (selectedBox.items || []).map((item) => ({ ...item, quantity: Number(item.quantity) || 0 })).filter((i) => i.quantity > 0);

      if (finalItems.length === 0) {
        alert("Please keep at least one SKU quantity greater than 0.");
        setLoading(false);
        return;
      }

      const packingList = {
        partyId: selectedBox.partyId || "manual",
        partyName: selectedBox.partyName || "Direct Box Dispatch",
        status: "Packed",
        items: finalItems,
        createdAt: new Date().toISOString(),
        createdBy: { uid: user?.uid, name: userData?.name || "Admin" },
        bails: 1,
        transporter: "Self/Direct",
        transporterId: "",
        isBoxDispatch: true,
        sourceBoxId: selectedBox.id,
        sourceBoxBarcode: selectedBox.barcode,
        sourceBoxTotalBoxes: selectedBox.totalBoxes || 1,
      };

      const newListRef = push(ref(db, "packingLists"));
      await set(newListRef, packingList);
      await api.createBoxDispatchRecord({
        ...packingList,
        id: newListRef.key || "",
      });

      alert(`Dispatch created for ${selectedBox.id}`);
      setSelectedBox(null);
      setIsDispatchMode(false);
    } catch (e) {
      console.error(e);
      alert("Failed to finalize. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  const S = {
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
    boxCard: { padding: 20, transition: "all 0.2s", cursor: "pointer" },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8fafc", borderRadius: 12, marginBottom: 8 },
  };

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Dispatch Box" sub="Fulfill orders quickly using box templates." />

      <Card style={{ padding: 20, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Dispatch Flow</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
            {isDispatchMode ? `Select box then create dispatch${selectedBox ? `: ${selectedBox.id}` : ""}` : "Click Start Final Dispatch first"}
          </div>
        </div>

        {!isDispatchMode ? (
          <BtnPrimary onClick={handleStartDispatch} disabled={loading} style={{ minWidth: 200, justifyContent: "center" }}>
            Start Final Dispatch
          </BtnPrimary>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <BtnGhost
              onClick={() => {
                setIsDispatchMode(false);
                setSelectedBox(null);
              }}
              style={{ minWidth: 120, justifyContent: "center" }}
            >
              Cancel
            </BtnGhost>
            <BtnPrimary onClick={handleFinalize} disabled={!selectedBox || loading} style={{ minWidth: 180, justifyContent: "center" }}>
              {loading ? "Creating..." : "Create Dispatch"}
            </BtnPrimary>
          </div>
        )}
      </Card>

      <div style={S.grid}>
        {managedBoxes.map((box) => {
          const isSelected = selectedBox?.id === box.id;
          return (
            <Card
              key={box.id}
              style={{
                ...S.boxCard,
                border: isSelected ? "2px solid #6366f1" : "1px solid #e2e8f0",
                boxShadow: isSelected ? "0 10px 24px rgba(99,102,241,0.2)" : undefined,
                opacity: isDispatchMode ? 1 : 0.98,
              }}
              className="hover:shadow-lg hover:border-indigo-200"
              onClick={() => {
                if (isDispatchMode) setSelectedBox(box);
              }}
            >
              <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{box.id}</h3>
              <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, marginBottom: 8 }}>{box.partyName || "No Party"}</div>
              <Image
                src={renderBarcodeToBase64(box.barcode)}
                alt={box.barcode}
                width={240}
                height={42}
                unoptimized
                style={{ width: "100%", height: 42, objectFit: "contain", marginBottom: 8 }}
              />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "center", marginBottom: 12 }}>{box.barcode}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>SKUs in template: {box.items.length}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>Capacity: {box.capacity}</div>

              <div style={{ display: "flex", gap: 8 }}>
                <BtnGhost
                  onClick={() => {
                    if (isDispatchMode) setSelectedBox(box);
                    handleViewTemplatePdf(box);
                  }}
                  style={{ flex: 1, fontSize: 12, fontWeight: 700 }}
                >
                  View PDF
                </BtnGhost>
                <BtnPrimary
                  onClick={() => {
                    handlePrintTemplatePdf(box);
                  }}
                  style={{ flex: 1, fontSize: 12, justifyContent: "center" }}
                >
                  Print
                </BtnPrimary>
              </div>
            </Card>
          );
        })}

        {managedBoxes.length === 0 && !loading && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "#94a3b8" }}>
            No boxes created yet. Please go to Manage Boxes first.
          </div>
        )}
      </div>

      {selectedBox && (
        <Card style={{ padding: 24, marginTop: 24 }}>
          <div style={{ marginBottom: 14, fontSize: 16, fontWeight: 700 }}>Selected {selectedBox.id} SKUs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {selectedBox.items.map((item) => (
              <div key={item.productId} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.productName}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{item.sku}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{item.quantity}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
