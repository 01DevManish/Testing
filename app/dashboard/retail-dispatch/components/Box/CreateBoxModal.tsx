"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BtnPrimary, BtnGhost } from "../ui";
import { api } from "../../data";
import { ManagedBox } from "../../types";
import { generateBoxMgtBarcode, renderBarcodeToBase64 } from "@/app/lib/barcodeUtils";
import { useAuth } from "@/app/context/AuthContext";
import { db } from "@/app/lib/firebase";
import { ref, get, push, set } from "firebase/database";

interface CreateBoxModalProps {
  onClose: () => void;
  onCreated: () => void;
  products: any[];
  initialBox?: ManagedBox;
}

interface ManagedBoxParty {
  id: string;
  name: string;
}

export default function CreateBoxModal({ onClose, onCreated, products, initialBox }: CreateBoxModalProps) {
  const { user, userData } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [boxId, setBoxId] = useState(initialBox?.id || "");
  const [barcode, setBarcode] = useState(initialBox?.barcode || "");
  const [capacity, setCapacity] = useState(initialBox?.capacity || 16);
  const [totalBoxes, setTotalBoxes] = useState(initialBox?.totalBoxes || 1);
  const [selectedItems, setSelectedItems] = useState<any[]>(initialBox?.items || []);
  const [searchQuery, setSearchQuery] = useState("");

  const [parties, setParties] = useState<ManagedBoxParty[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>(initialBox?.partyId || "");
  const [newPartyName, setNewPartyName] = useState(initialBox?.partyName || "");
  const [creatingNewParty, setCreatingNewParty] = useState<boolean>(!!initialBox?.partyName && !initialBox?.partyId);

  const isEditing = !!initialBox;

  useEffect(() => {
    const init = async () => {
      try {
        const partySnap = await get(ref(db, "managedBoxParties"));
        if (partySnap.exists()) {
          const list: ManagedBoxParty[] = [];
          partySnap.forEach((child) => {
            const val = child.val();
            list.push({ id: child.key || "", name: val?.name || "" });
          });
          list.sort((a, b) => a.name.localeCompare(b.name));
          setParties(list);

          if (!initialBox?.partyId && !initialBox?.partyName && list.length > 0) {
            setSelectedPartyId(list[0].id);
            setCreatingNewParty(false);
          }
        }

        if (isEditing) return;

        const id = await api.getNextManagedBoxId();
        setBoxId(id);
        setBarcode(generateBoxMgtBarcode());
      } catch (e) {
        console.error("Failed to initialize box data:", e);
        alert("Could not load box setup data. Please check your internet connection or Firebase rules.");
      }
    };
    init();
  }, [isEditing, initialBox]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    return products
      .filter(
        (p) =>
          p.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  const handleAddItem = (product: any) => {
    if (selectedItems.length >= capacity) {
      alert(`Box capacity reached! Max ${capacity} items.`);
      return;
    }
    if (selectedItems.find((i) => i.productId === product.id)) {
      alert("This product is already in the box.");
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        productId: product.id,
        productName: product.productName,
        sku: product.sku || product.id.slice(0, 8),
        quantity: 1,
      },
    ]);
    setSearchQuery("");
  };

  const resolveParty = async (): Promise<{ partyId: string; partyName: string } | null> => {
    if (creatingNewParty) {
      const name = newPartyName.trim();
      if (!name) {
        alert("Please enter Party Name.");
        return null;
      }

      const existing = parties.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) return { partyId: existing.id, partyName: existing.name };

      const partyRef = push(ref(db, "managedBoxParties"));
      await set(partyRef, {
        name,
        createdAt: Date.now(),
        createdBy: userData?.name || user?.uid || "System",
      });

      return { partyId: partyRef.key || "", partyName: name };
    }

    if (!selectedPartyId) {
      alert("Please select Party Name.");
      return null;
    }

    const selected = parties.find((p) => p.id === selectedPartyId);
    if (!selected) {
      alert("Selected party not found.");
      return null;
    }

    return { partyId: selected.id, partyName: selected.name };
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const party = await resolveParty();
      if (!party) {
        setLoading(false);
        return;
      }

      const cleanItems = selectedItems
        .map((i) => ({ ...i, quantity: Math.max(0, Number(i.quantity) || 0) }))
        .filter((i) => i.quantity > 0);

      if (cleanItems.length === 0) {
        alert("Please keep at least one SKU quantity greater than 0.");
        setLoading(false);
        return;
      }

      const box: ManagedBox = {
        id: boxId,
        barcode,
        partyId: party.partyId,
        partyName: party.partyName,
        capacity,
        totalBoxes: Math.max(1, Number(totalBoxes) || 1),
        items: cleanItems,
        status: initialBox?.status || "Available",
        createdAt: initialBox?.createdAt || Date.now(),
      };

      await api.createManagedBox(box, { uid: user?.uid || "unknown", name: userData?.name || "Admin" });
      onCreated();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to ${isEditing ? "update" : "create"} box: ${e.message || "Unknown Error"}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedPartyName = creatingNewParty
    ? newPartyName
    : parties.find((p) => p.id === selectedPartyId)?.name || "";

  const S = {
    overlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: {
      width: "100%",
      maxWidth: 700,
      maxHeight: "90vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column" as const,
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
    },
    header: {
      padding: "24px 30px",
      borderBottom: "1px solid #f1f5f9",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    body: { padding: 30, overflowY: "auto" as const, flex: 1 },
    input: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: 12,
      border: "1px solid #e2e8f0",
      outline: "none",
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "inherit",
      background: "#fff",
    },
    itemRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      background: "#f8fafc",
      borderRadius: 12,
      marginBottom: 8,
    },
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} className="animate-in zoom-in-95 duration-200">
        <div style={S.header}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {isEditing ? `Edit Box ${boxId}` : `Initialize Box ${boxId}`}
          </h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#64748b" }}>
            &times;
          </button>
        </div>

        <div style={S.body}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                  Party Name
                </label>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setCreatingNewParty(false)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: !creatingNewParty ? "#eef2ff" : "#fff",
                      color: !creatingNewParty ? "#4338ca" : "#64748b",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Select Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingNewParty(true)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: creatingNewParty ? "#eef2ff" : "#fff",
                      color: creatingNewParty ? "#4338ca" : "#64748b",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Create New
                  </button>
                </div>

                {creatingNewParty ? (
                  <input
                    type="text"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder="Enter Party Name"
                    style={S.input}
                  />
                ) : (
                  <select value={selectedPartyId} onChange={(e) => setSelectedPartyId(e.target.value)} style={S.input}>
                    <option value="">Select Party</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                  Box Capacity (SKU Slots)
                </label>
                <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} style={S.input} />
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Total unique SKUs allowed in this physical box.</p>
              </div>

              <BtnPrimary onClick={() => setStep(2)}>Continue to Product Selection -&gt;</BtnPrimary>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                  Select Products ({selectedItems.length} / {capacity})
                </label>
                <input
                  type="text"
                  placeholder="Search SKU or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={S.input}
                />

                {searchQuery && (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      marginTop: 4,
                      overflow: "hidden",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                      position: "relative",
                      zIndex: 10,
                    }}
                  >
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddItem(p)}
                        style={{ padding: "10px 16px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
                {selectedItems.map((item) => (
                  <div key={item.productId} style={S.itemRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.productName}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{item.sku}</div>
                    </div>
                    <button
                      onClick={() => setSelectedItems(selectedItems.filter((i) => i.productId !== item.productId))}
                      style={{ border: "none", background: "#fee2e2", color: "#ef4444", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <BtnGhost style={{ flex: 1 }} onClick={() => setStep(1)}>
                  &larr; Back
                </BtnGhost>
                <BtnPrimary style={{ flex: 2 }} onClick={() => setStep(3)} disabled={selectedItems.length === 0}>
                  Set Box Count &amp; SKU Qty -&gt;
                </BtnPrimary>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block", textAlign: "left" }}>
                  No. of Boxes for {boxId}
                </label>
                <input type="number" min={1} value={totalBoxes} onChange={(e) => setTotalBoxes(Math.max(1, Number(e.target.value) || 1))} style={S.input} />
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8, textAlign: "left" }}>
                  Label will print as {boxId} 1/{Math.max(1, Number(totalBoxes) || 1)} to {boxId} {Math.max(1, Number(totalBoxes) || 1)}/{Math.max(1, Number(totalBoxes) || 1)}.
                </p>
              </div>

              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "block" }}>SKU Quantities</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedItems.map((item) => (
                    <div key={item.productId} style={S.itemRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.productName}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{item.sku}</div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={item.quantity ?? 0}
                        onChange={(e) => {
                          const value = Math.max(0, Number(e.target.value) || 0);
                          setSelectedItems((prev) => prev.map((p) => (p.productId === item.productId ? { ...p, quantity: value } : p)));
                        }}
                        style={{ ...S.input, width: 100, textAlign: "center", padding: "8px 10px" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 30, background: "#f8fafc", borderRadius: 20, border: "1px dashed #e2e8f0" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 800 }}>{boxId}</h3>
                <div style={{ fontSize: 13, color: "#64748b" }}>Party: {selectedPartyName || "-"}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Capacity: {capacity} SKUs</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Total Boxes: {Math.max(1, Number(totalBoxes) || 1)}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Filled: {selectedItems.length} SKUs</div>

                <div style={{ background: "#fff", padding: 20, borderRadius: 12, display: "inline-block" }}>
                  <img src={renderBarcodeToBase64(barcode)} alt={barcode} style={{ height: 60 }} />
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 8, letterSpacing: 2 }}>{barcode}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <BtnGhost style={{ flex: 1 }} onClick={() => setStep(2)}>
                  &larr; Back
                </BtnGhost>
                <BtnPrimary style={{ flex: 2 }} onClick={handleSave} disabled={loading || !boxId || !barcode}>
                  {loading ? (isEditing ? "Updating..." : "Creating...") : !boxId ? "ID Error" : isEditing ? "Save Changes" : "Complete Box Setup"}
                </BtnPrimary>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
