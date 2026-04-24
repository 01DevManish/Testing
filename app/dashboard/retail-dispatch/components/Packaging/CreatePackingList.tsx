"use client";

import { useState, useEffect, useMemo } from "react";
import { update, ref, get, push, set } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../context/AuthContext";
import { useData } from "../../../../context/DataContext";
import { logActivity } from "../../../../lib/activityLogger";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "../ui";
import { firestoreApi } from "../../data";
import { sendNotification } from "../../../../lib/notificationHelper";
import { generatePackingListPdf } from "../../PackingListPdf";
import { touchDataSignal } from "../../../../lib/dataSignals";

interface PackingItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  rate: number;
  collectionName?: string;
  brandName?: string;
}

interface CreatePackingListProps {
  onClose: () => void;
  onCreated: () => void;
  editingList?: any;
}

const TRANSPORTERS = ["DTDC", "Delhivery", "BlueDart", "FedEx", "Ecom Express", "Own Vehicle", "Other"];
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";
const HIDDEN_ADMIN_NAME = "dev manish";
const normalizeSku = (value?: string): string => (value || "").trim().toLowerCase();
const getItemMatchKey = (row: any): string => {
  const sku = normalizeSku(row?.sku);
  if (sku) return `sku:${sku}`;
  const productId = String(row?.productId || "").trim().toLowerCase();
  if (productId) return `pid:${productId}`;
  const productName = String(row?.productName || "").trim().toLowerCase();
  if (productName) return `name:${productName}`;
  return "";
};
const toStockNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
const mapInventoryForDispatch = (rows: any[]) =>
  rows.map((item) => ({
    id: item.id,
    productName: item.productName || "",
    sku: item.sku || "",
    stock: Number(item.stock) || 0,
    unit: item.unit || "PCS",
    barcode: item.barcode || "",
    category: item.category || "",
    collection: item.collection || "",
    brand: item.brand || "",
  }));

export default function CreatePackingList({ onClose, onCreated, editingList }: CreatePackingListProps) {
  const { user, userData } = useAuth();
  const { products: cachedProducts, refreshData, users: dataUsers } = useData();
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [parties, setParties] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [dbTransporters, setDbTransporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddTransporter, setShowAddTransporter] = useState(false);
  const [newTransporterName, setNewTransporterName] = useState("");
  const [isAddingTransporter, setIsAddingTransporter] = useState(false);

  // Form State
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [transporter, setTransporter] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const isMobile = viewportWidth < 640;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sendAssignmentNotification = async (targetUid: string, partyName: string, isUpdate: boolean) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUid,
          title: isUpdate ? "Task Updated" : "New Task Assigned! 📦",
          body: `You have a new packing list for ${partyName}. Please check your dashboard.`,
          url: "/dashboard"
        })
      });
    } catch (err) {
      console.warn("Failed to deliver notification:", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load Party Rates
        const partyRatesRef = ref(db, "partyRates");
        const partySnap = await get(partyRatesRef);
        let partiesData: any[] = [];
        if (partySnap.exists()) {
          partySnap.forEach((child) => {
            partiesData.push({ id: child.key, ...child.val() });
          });
          setParties(partiesData);
        }

        // Trigger shared inventory refresh (Dynamo-first in DataContext).
        refreshData("inventory");
        const inv = await firestoreApi.getInventoryProducts();
        setInventory(mapInventoryForDispatch(inv as any[]));

        // Load Transporters
        const trans = await firestoreApi.getTransporters();
        setDbTransporters(trans);

        // Populate Edit Data
        if (editingList) {
           const pMatch = partiesData.find(p => p.id === editingList.partyId);
           if (pMatch) setSelectedParty(pMatch);
        }
      } catch (err) {
        console.error("Failed to load data for packing list:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [editingList, refreshData]);

  useEffect(() => {
    if (!Array.isArray(dataUsers)) return;
    setAllUsers(dataUsers);
  }, [dataUsers]);

  const partyRatesForForm = useMemo(() => {
    if (!selectedParty) return [];
    const baseRates = Array.isArray(selectedParty.rates) ? selectedParty.rates : [];
    if (!editingList) return baseRates;

    const editingItems = Array.isArray(editingList.items) ? editingList.items : [];
    const baseKeys = new Set(baseRates.map((r: any) => getItemMatchKey(r)).filter(Boolean));
    const mergedRates = [...baseRates];

    editingItems.forEach((item: any) => {
      const key = getItemMatchKey(item);
      if (!key || baseKeys.has(key)) return;
      mergedRates.push({
        productName: item.productName || "Unknown Product",
        sku: item.sku || "",
        rate: Number(item.rate) || 0,
        packagingType: item.packagingType || item.packingType || "Box",
      });
    });

    return mergedRates;
  }, [selectedParty, editingList]);

  useEffect(() => {
    if (!editingList || !selectedParty) return;
    const qtyByKey = new Map<string, number>();
    (editingList.items || []).forEach((item: any) => {
      const key = getItemMatchKey(item);
      if (!key) return;
      qtyByKey.set(key, Number(item.quantity) || 0);
    });

    const mappedQuantities: Record<number, number> = {};
    partyRatesForForm.forEach((rate: any, idx: number) => {
      const key = getItemMatchKey(rate);
      if (!key) return;
      const qty = qtyByKey.get(key);
      if (typeof qty === "number" && qty > 0) mappedQuantities[idx] = qty;
    });

    setSelectedItems(mappedQuantities);
    setTransporter(editingList.transporter || "");
    setAssignedUserId(editingList.assignedTo || "");
  }, [editingList, selectedParty, partyRatesForForm]);

  useEffect(() => {
    if (Array.isArray(cachedProducts) && cachedProducts.length > 0) {
      setInventory(mapInventoryForDispatch(cachedProducts as any[]));
    }
  }, [cachedProducts]);

  useEffect(() => {
    if (!selectedParty) return;
    setSelectedItems((prev) => {
      let changed = false;
      const next = { ...prev };

      partyRatesForForm.forEach((r: any, idx: number) => {
        const rateSkuKey = normalizeSku(r.sku);
        const invMatch =
          inventory.find(p => rateSkuKey && normalizeSku(p.sku) === rateSkuKey) ||
          inventory.find(p => p.productName?.trim()?.toLowerCase() === (r.productName || "").trim().toLowerCase());
        const availableStock = toStockNumber(invMatch?.stock);
        const currentQty = Number(prev[idx]) || 0;
        const clampedQty = Math.max(0, Math.min(currentQty, availableStock));
        if (clampedQty !== currentQty) {
          next[idx] = clampedQty;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [inventory, partyRatesForForm, selectedParty]);

  const handleCreate = async () => {
    if (!selectedParty || !assignedUserId || !transporter) {
      alert("Please fill in all required fields (Party, Transporter, and Assigned User).");
      return;
    }

    const latestInventory = await firestoreApi.getInventoryProducts({ forceFresh: true });
    setInventory(mapInventoryForDispatch(latestInventory as any[]));

    const stockValidationErrors: string[] = [];

    const items = partyRatesForForm
      .map((r: any, idx: number) => ({ r, idx }))
      .filter(({ idx }: { idx: number }) => (selectedItems[idx] || 0) > 0)
      .map(({ r, idx }: { r: any; idx: number }) => {
        const targetName = r.productName?.trim()?.toLowerCase();
        const rateSkuKey = normalizeSku(r.sku);
        const invMatch =
          latestInventory.find(p => rateSkuKey && normalizeSku(p.sku) === rateSkuKey) ||
          latestInventory.find(p => p.productName?.trim()?.toLowerCase() === targetName);
        const requestedQty = Number(selectedItems[idx]) || 0;
        const availableStock = toStockNumber(invMatch?.stock);
        const displayName = r.productName || invMatch?.productName || `Item #${idx + 1}`;

        if (!invMatch) {
          stockValidationErrors.push(`${displayName}: not found in inventory`);
        } else if (availableStock <= 0) {
          stockValidationErrors.push(`${displayName}: out of stock`);
        } else if (requestedQty > availableStock) {
          stockValidationErrors.push(`${displayName}: requested ${requestedQty}, available ${availableStock}`);
        }

        return {
          productId: invMatch?.id || r.productName,
          productName: r.productName,
          sku: r.sku || invMatch?.sku || "N/A",
          barcode: invMatch?.barcode || "",
          category: invMatch?.category || "",
          collectionName: invMatch?.collection || "",
          brandName: invMatch?.brand || "Eurus",
          packagingType: r.packagingType || "Box",
          quantity: requestedQty,
          rate: r.rate
        };
      });

    const commonPkgType = items[0]?.packagingType || "Box";

    if (items.length === 0) {
      alert("Please select at least one product with a quantity greater than zero.");
      return;
    }

    if (stockValidationErrors.length > 0) {
      alert(`Cannot create packing list due to live stock mismatch:\n\n${stockValidationErrors.join("\n")}`);
      return;
    }

    setSaving(true);
    try {
      const assignedUser = allUsers.find(e => e.uid === assignedUserId);
      const isEdit = !!editingList;

      // Fetch the full party details from 'parties' node for original address
      let fullPartyAddress = selectedParty.billTo?.address || "";
      let fullPartyCity = selectedParty.billTo?.city || "";
      
      try {
        const partiesSnap = await get(ref(db, "parties"));
        if (partiesSnap.exists()) {
          const targetPartyName = selectedParty.partyName?.trim()?.toLowerCase();
          partiesSnap.forEach(d => {
            const pData = d.val();
            if (pData.partyName?.trim()?.toLowerCase() === targetPartyName) {
              if (pData.address) fullPartyAddress = pData.address;
              if (pData.city) fullPartyCity = pData.city;
            }
          });
        }
      } catch (e) {
         console.warn("Could not fetch full party address");
      }
      
      const packingListData = {
        id: isEdit ? editingList.id : "", // Will be set below
        partyId: selectedParty.id,
        partyName: selectedParty.partyName,
        partyAddress: fullPartyAddress,
        partyCity: fullPartyCity,
        items,
        transporter,
        packagingType: commonPkgType,
        assignedTo: assignedUserId,
        assignedToName: assignedUser?.name || "Unknown",
        status: isEdit ? editingList.status : "Pending",
        createdAt: isEdit ? editingList.createdAt : Date.now(),
        createdBy: isEdit ? editingList.createdBy : (userData?.name || user?.name || "System"),
        createdById: isEdit ? editingList.createdById : (user?.uid || ""),
        updatedAt: Date.now(),
        updatedBy: userData?.name || user?.name || "System"
      };

      let finalId = isEdit ? editingList.id : "";
      if (isEdit) {
        const listRef = ref(db, `packingLists/${editingList.id}`);
        await set(listRef, packingListData);
      } else {
        const packingListRef = ref(db, "packingLists");
        const newListRef = push(packingListRef);
        finalId = newListRef.key!;
        packingListData.id = finalId;
        await set(newListRef, packingListData);
      }
      await touchDataSignal("packingLists");

      // ── Cloudinary PDF Upload ──
      try {
        const pdfBlob = await generatePackingListPdf(packingListData, false);
        if (pdfBlob) {
            const formData = new FormData();
            formData.append("file", new File([pdfBlob], `PL_${finalId}.pdf`, { type: "application/pdf" }));
            
            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            
            if (uploadRes.ok) {
                const { secure_url } = await uploadRes.json();
                await update(ref(db, `packingLists/${finalId}`), { packingPdfUrl: secure_url });
                await touchDataSignal("packingLists");
                console.log("PDF uploaded to Cloudinary:", secure_url);
            }
        }
      } catch (pdfErr) {
        console.error("Failed to upload PDF to Cloudinary:", pdfErr);
      }

      await logActivity({
        type: "system",
        action: isEdit ? "update" : "create",
        title: isEdit ? "Packing List Updated" : "Packing List Created",
        description: `Packing list #${isEdit ? editingList.id : "new"} ${isEdit ? "updated" : "created"} for ${selectedParty.partyName}.`,
        userId: user?.uid || "",
        userName: userData?.name || "Admin",
        userRole: userData?.role || "admin",
      });


      alert(isEdit ? "Packing List updated successfully!" : "Packing List generated successfully!");
      
      // 1. Trigger Push Notification (FCM)
      if (assignedUserId) {
        sendAssignmentNotification(assignedUserId, selectedParty.partyName, isEdit);
      }

      // 2. Trigger In-App Notification (Bell Icon)
      const notifUsers = [user?.uid].filter(Boolean) as string[];
      if (assignedUserId && assignedUserId !== user?.uid) notifUsers.push(assignedUserId);
      
      sendNotification(notifUsers, {
        title: isEdit ? "Packing List Updated" : "New Packing List Created",
        message: `Packing list #${packingListData.id.slice(-6).toUpperCase()} for ${selectedParty.partyName} has been ${isEdit ? "updated" : "assigned to " + (assignedUser?.name || "Unknown")}.`,
        type: "order",
        actorId: user?.uid,
        actorName: userData?.name || "Admin",
        link: "/dashboard"
      });
      
      onCreated();
    } catch (err) {
      console.error("Failed to save packing list:", err);
      alert("Error saving packing list.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTransporter = async () => {
    if (!newTransporterName.trim()) return;
    setIsAddingTransporter(true);
    try {
      await firestoreApi.createTransporter({ name: newTransporterName.trim() });
      const trans = await firestoreApi.getTransporters();
      setDbTransporters(trans);
      setTransporter(newTransporterName.trim());
      setNewTransporterName("");
      setShowAddTransporter(false);
    } catch (e) {
      console.error(e);
      alert("Failed to add transporter.");
    } finally {
      setIsAddingTransporter(false);
    }
  };

  const filteredParties = parties.filter(p => 
    (p.partyName || "").toLowerCase().includes(partySearch.toLowerCase())
  );

  const assignableUsers = (allUsers || []).filter((u: any) => {
    if (!u || typeof u !== "object") return false;
    const uid = typeof u.uid === "string" ? u.uid.trim() : "";
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
    const name = typeof u.name === "string" ? u.name.trim() : "";
    const nameLower = name.toLowerCase();
    if (!uid || !name) return false;
    if (email === HIDDEN_ADMIN_EMAIL || nameLower === HIDDEN_ADMIN_NAME) return false;
    return true;
  });

  const getRoleLabel = (role: unknown) => {
    if (typeof role !== "string") return "Employee";
    const normalized = role.trim().toLowerCase();
    if (!normalized) return "Employee";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading data...</div>;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <PageHeader title="Create Packing List" sub="Generate a fulfillment list for an employee to pack.">
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
          <BtnGhost onClick={onClose} style={isMobile ? { flex: 1, justifyContent: "center", fontSize: 12 } : undefined}>
            Cancel
          </BtnGhost>
          <BtnPrimary onClick={handleCreate} disabled={saving} style={isMobile ? { flex: 1, justifyContent: "center", fontSize: 12 } : undefined}>
            {saving ? "Generating..." : "Generate List"}
          </BtnPrimary>
        </div>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: isMobile ? 14 : 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24 }}>
          {/* STEP 1: Select Party */}
          <Card style={{ padding: isMobile ? 16 : 24 }}>
            <h3 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 500, color: "#1e293b", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 12 : 14 }}>1</span>
              Select Retail Party
            </h3>
            
            {!selectedParty ? (
              <>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input 
                    type="text" 
                    placeholder="Search Party Name" 
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                    style={{ width: "100%", padding: isMobile ? "11px 14px" : "12px 16px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: isMobile ? 13 : 14, outline: "none" }}
                  />
                </div>
              <div style={{ maxHeight: isMobile ? 210 : 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  {filteredParties.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { 
                        setSelectedParty(p); 
                        setPartySearch(""); 
                        if (p.transporter) setTransporter(p.transporter);
                      }}
                      style={{ padding: isMobile ? "10px 12px" : "12px 16px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s", gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: "#1e293b" }}>{p.partyName}</div>
                        <div style={{ fontSize: isMobile ? 11 : 12, color: "#64748b" }}>{p.billTo?.city}, {p.billTo?.state} | GST: {p.billTo?.gstNo || "N/A"}</div>
                      </div>
                      <span style={{ fontSize: isMobile ? 10 : 11, color: "#6366f1", fontWeight: 500, whiteSpace: "nowrap" }}>Select</span>
                    </div>
                  ))}
                  {filteredParties.length === 0 && <div className="p-8 text-center text-slate-400 italic text-sm">No parties found.</div>}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", padding: isMobile ? "14px 16px" : "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1.5px solid #eef2ff", gap: 12 }}>
                <div>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: "#1e293b" }}>{selectedParty.partyName}</div>
                  <div style={{ fontSize: isMobile ? 11 : 12, color: "#64748b", marginTop: 2 }}>{selectedParty.billTo?.address || "No address provided"}</div>
                </div>
                <button 
                  onClick={() => { setSelectedParty(null); setSelectedItems({}); }}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", fontSize: isMobile ? 11 : 12, color: "#6366f1", cursor: "pointer" }}
                >
                  Change Party
                </button>
              </div>
            )}
          </Card>

          {/* STEP 2: Product List with Party-wise Rates */}
          {selectedParty && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: isMobile ? "16px 16px 14px" : "18px 24px", borderBottom: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 500, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 12 : 14 }}>2</span>
                  Select Products & Quantities
                </h3>
                <p style={{ fontSize: isMobile ? 11 : 12, color: "#64748b", marginTop: 6, marginLeft: isMobile ? 34 : 38 }}>
                  Pricing is automatically pulled from the <b>{selectedParty.partyName}</b> rate list.
                </p>
              </div>
              {isMobile ? (
              <div style={{ display: "grid", gap: 8, padding: 10 }}>
                  {partyRatesForForm.map((r: any, idx: number) => {
                    const rateSkuKey = normalizeSku(r.sku);
                    const invMatch =
                      inventory.find(p => rateSkuKey && normalizeSku(p.sku) === rateSkuKey) ||
                      inventory.find(p => p.productName === r.productName);
                    const availableStock = toStockNumber(invMatch?.stock);
                    const isOutOfStock = availableStock <= 0;
                    return (
                      <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{r.productName}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                            SKU: {r.sku || invMatch?.sku || "-"} | Stock: {availableStock} {invMatch?.unit || "PCS"}
                          </div>
                          {isOutOfStock && (
                            <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 600, marginTop: 4 }}>Out of stock</div>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Assigned Rate</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Rs. {r.rate}</div>
                          </div>
                          <input 
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            max={availableStock}
                            disabled={isOutOfStock}
                            placeholder="0"
                            value={selectedItems[idx] ?? ""}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value, 10);
                              const val = Number.isFinite(raw) ? raw : 0;
                              const clamped = Math.max(0, Math.min(val, availableStock));
                              setSelectedItems(prev => ({ ...prev, [idx]: clamped }));
                            }}
                            style={{ width: 78, padding: "9px 8px", borderRadius: 10, border: "1.5px solid #e2e8f0", textAlign: "center", fontSize: 12, outline: "none", color: (selectedItems[idx] || 0) > 0 ? "#6366f1" : "#1e293b", fontWeight: (selectedItems[idx] || 0) > 0 ? 600 : 400, background: isOutOfStock ? "#f8fafc" : "#fff", cursor: isOutOfStock ? "not-allowed" : "text", appearance: "textfield" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {partyRatesForForm.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>
                      No rates have been assigned to this party yet. Please update the Party-wise Rate List first.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f8fafc" }}>
                      <tr>
                        <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Product Name</th>
                        <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>SKU</th>
                        <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Assigned Rate</th>
                        <th style={{ padding: "12px 24px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", width: 140 }}>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyRatesForForm.map((r: any, idx: number) => {
                        const rateSkuKey = normalizeSku(r.sku);
                        const invMatch =
                          inventory.find(p => rateSkuKey && normalizeSku(p.sku) === rateSkuKey) ||
                          inventory.find(p => p.productName === r.productName);
                        const availableStock = toStockNumber(invMatch?.stock);
                        const isOutOfStock = availableStock <= 0;
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #f8fafc" }}>
                            <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{r.productName}</td>
                            <td style={{ padding: "14px 24px", fontSize: 13, color: "#64748b" }}>
                              <div>{r.sku || invMatch?.sku || "-"}</div>
                              <div style={{ fontSize: 11, marginTop: 2, color: isOutOfStock ? "#dc2626" : "#64748b" }}>
                                Stock: {availableStock} {invMatch?.unit || "PCS"}
                              </div>
                            </td>
                            <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", textAlign: "right", fontWeight: 600 }}>Rs. {r.rate}</td>
                            <td style={{ padding: "14px 24px", textAlign: "center" }}>
                              <input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                max={availableStock}
                                disabled={isOutOfStock}
                                placeholder="0"
                                value={selectedItems[idx] ?? ""}
                                onChange={(e) => {
                                  const raw = parseInt(e.target.value, 10);
                                  const val = Number.isFinite(raw) ? raw : 0;
                                  const clamped = Math.max(0, Math.min(val, availableStock));
                                  setSelectedItems(prev => ({ ...prev, [idx]: clamped }));
                                }}
                                style={{ width: "80px", padding: "8px", borderRadius: 10, border: "1.5px solid #e2e8f0", textAlign: "center", fontSize: 14, outline: "none", color: (selectedItems[idx] || 0) > 0 ? "#6366f1" : "#1e293b", fontWeight: (selectedItems[idx] || 0) > 0 ? 600 : 400, background: isOutOfStock ? "#f8fafc" : "#fff", cursor: isOutOfStock ? "not-allowed" : "text", appearance: "textfield" }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {partyRatesForForm.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                            No rates have been assigned to this party yet. Please update the Party-wise Rate List first.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        <div style={{ position: isMobile ? "static" : "sticky", top: 24, display: "flex", flexDirection: "column", gap: isMobile ? 14 : 24 }}>
          {/* Assignment & Logistics */}
          <Card style={{ padding: isMobile ? 16 : 24 }}>
             <h3 style={{ fontSize: isMobile ? 14 : 15, fontWeight: 500, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>Logistics and Assignment</h3>
             
             <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                   <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}>Logistics Partner</label>
                   {!showAddTransporter && (
                     <button 
                       onClick={() => setShowAddTransporter(true)}
                       style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                     >
                       + Create
                     </button>
                   )}
                </div>

                {showAddTransporter ? (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexDirection: isMobile ? "column" : "row" }}>
                    <input 
                      type="text" 
                      placeholder="Transporter Name" 
                      value={newTransporterName}
                      onChange={(e) => setNewTransporterName(e.target.value)}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #6366f1", fontSize: isMobile ? 12 : 13, outline: "none" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        onClick={handleAddTransporter}
                        disabled={isAddingTransporter || !newTransporterName.trim()}
                        style={{ flex: 1, minHeight: 38, padding: "0 12px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontSize: 12, cursor: "pointer" }}
                      >
                        {isAddingTransporter ? "Saving" : "Save"}
                      </button>
                      <button 
                        onClick={() => { setShowAddTransporter(false); setNewTransporterName(""); }}
                        style={{ minWidth: 42, background: "none", border: "1px solid #fecaca", color: "#ef4444", fontSize: 14, borderRadius: 8, cursor: "pointer" }}
                      >
                        X
                      </button>
                    </div>
                  </div>
                ) : (
                  <select 
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: isMobile ? 13 : 14 }}
                  >
                    <option value="">Select Transporter</option>
                    {/* Hardcoded defaults then DB values */}
                    {["DTDC", "Delhivery", "BlueDart", "FedEx", "Ecom Express", "Own Vehicle"].map(t => <option key={t} value={t}>{t}</option>)}
                    {dbTransporters.filter(t => !["DTDC", "Delhivery", "BlueDart", "FedEx", "Ecom Express", "Own Vehicle"].includes(t.name)).map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                )}
             </div>

             <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b", display: "block", marginBottom: 8 }}>Assign To User</label>
                <select 
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: isMobile ? 13 : 14 }}
                >
                  <option value="">Select User</option>
                  {assignableUsers.map((e: any) => (
                    <option key={e.uid} value={e.uid}>
                      {e.name} ({getRoleLabel(e.role)})
                    </option>
                  ))}
                </select>
             </div>
             
             <p style={{ fontSize: isMobile ? 10 : 11, color: "#94a3b8", lineHeight: 1.5, margin: "12px 0 0" }}>
               The assigned employee will see this list on their dashboard and will be responsible for packing these items.
             </p>
          </Card>

          {/* Summary Card */}
          {selectedParty && Object.values(selectedItems).some(q => q > 0) && (
            <Card style={{ padding: isMobile ? 16 : 24, background: "#fff", border: "1px solid #e2e8f0", color: "#0f172a", boxShadow: "none" }}>
               <h3 style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, marginBottom: 16, color: "#64748b" }}>Selection Summary</h3>
               <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: isMobile ? 12 : 13, color: "#64748b" }}>Distinct Items:</span>
                  <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: "#0f172a" }}>{Object.values(selectedItems).filter(v => v > 0).length}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                  <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: "#0f172a" }}>Total Quantity:</span>
                  <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: "#6366f1" }}>{Object.values(selectedItems).reduce((a, b) => a + b, 0)} Pcs</span>
               </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

