"use client";

import { useState, useEffect } from "react";
import { update, ref, get, push, set, serverTimestamp } from "firebase/database";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../context/AuthContext";
import { logActivity } from "../../../lib/activityLogger";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "./ui";
import { firestoreApi } from "../data";
import { sendNotification } from "../../../lib/notificationHelper";
import { generatePackingListPdf } from "../PackingListPdf";

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

export default function CreatePackingList({ onClose, onCreated, editingList }: CreatePackingListProps) {
  const { user, userData, fetchAllUsers } = useAuth();
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
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [transporter, setTransporter] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [partySearch, setPartySearch] = useState("");

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

        // Load All Users for assignment
        const users = await fetchAllUsers();
        setAllUsers(users);

        // Load Inventory for SKU Fallback
        const inv = await firestoreApi.getInventoryProducts();
        setInventory(inv);

        // Load Transporters
        const trans = await firestoreApi.getTransporters();
        setDbTransporters(trans);

        // Populate Edit Data
        if (editingList) {
           const pMatch = partiesData.find(p => p.id === editingList.partyId);
           if (pMatch) setSelectedParty(pMatch);
           
           const itemsMap: Record<string, number> = {};
           (editingList.items || []).forEach((it: any) => {
              itemsMap[it.productName] = it.quantity;
           });
           setSelectedItems(itemsMap);
           setTransporter(editingList.transporter || "");
           setAssignedUserId(editingList.assignedTo || "");
        }
      } catch (err) {
        console.error("Failed to load data for packing list:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchAllUsers, editingList]);

  const handleCreate = async () => {
    if (!selectedParty || !assignedUserId || !transporter) {
      alert("Please fill in all required fields (Party, Transporter, and Assigned User).");
      return;
    }

    const items = (selectedParty.rates || [])
      .filter((r: any) => selectedItems[r.productName] > 0)
      .map((r: any) => {
        const targetName = r.productName?.trim().toLowerCase();
        const invMatch = inventory.find(p => p.productName?.trim().toLowerCase() === targetName);
        return {
          productId: r.productName,
          productName: r.productName,
          sku: r.sku || invMatch?.sku || "N/A",
          barcode: invMatch?.barcode || "",
          category: invMatch?.category || "",
          collectionName: invMatch?.collection || "",
          brandName: invMatch?.brand || "Eurus",
          packagingType: r.packagingType || "Box",
          quantity: selectedItems[r.productName],
          rate: r.rate
        };
      });

    if (items.length === 0) {
      alert("Please select at least one product with a quantity greater than zero.");
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
          const targetPartyName = selectedParty.partyName?.trim().toLowerCase();
          partiesSnap.forEach(d => {
            const pData = d.val();
            if (pData.partyName?.trim().toLowerCase() === targetPartyName) {
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
                await update(ref(db, `packingLists/${finalId}`), { pdfUrl: secure_url });
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

  if (loading) return <div className="p-8 text-center text-slate-500">Loading data...</div>;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <PageHeader title="Create Packing List" sub="Generate a fulfillment list for an employee to pack.">
        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
        <BtnPrimary onClick={handleCreate} disabled={saving}>
          {saving ? "Generating..." : "✨ Generate Packing List"}
        </BtnPrimary>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* STEP 1: Select Party */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: "#1e293b", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>1</span>
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
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 0, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none" }}
                  />
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  {filteredParties.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { 
                        setSelectedParty(p); 
                        setPartySearch(""); 
                        if (p.transporter) setTransporter(p.transporter);
                      }}
                      style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>{p.partyName}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{p.billTo?.city}, {p.billTo?.state} | GST: {p.billTo?.gstNo || "N/A"}</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 500 }}>Select →</span>
                    </div>
                  ))}
                  {filteredParties.length === 0 && <div className="p-8 text-center text-slate-400 italic text-sm">No parties found.</div>}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1.5px solid #eef2ff" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>{selectedParty.partyName}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{selectedParty.billTo?.address || "No address provided"}</div>
                </div>
                <button 
                  onClick={() => { setSelectedParty(null); setSelectedItems({}); }}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", fontSize: 12, color: "#6366f1", cursor: "pointer" }}
                >
                  Change Party
                </button>
              </div>
            )}
          </Card>

          {/* STEP 2: Product List with Party-wise Rates */}
          {selectedParty && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>2</span>
                  Select Products & Quantities
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 6, marginLeft: 38 }}>
                  Pricing is automatically pulled from the <b>{selectedParty.partyName}</b> rate list.
                </p>
              </div>
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
                    {(selectedParty.rates || []).map((r: any, idx: number) => {
                      const invMatch = inventory.find(p => p.productName === r.productName);
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{r.productName}</td>
                          <td style={{ padding: "14px 24px", fontSize: 13, color: "#64748b" }}>{r.sku || invMatch?.sku || "—"}</td>
                          <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", textAlign: "right", fontWeight: 600 }}>₹{r.rate}</td>
                          <td style={{ padding: "14px 24px", textAlign: "center" }}>
                            <input 
                              type="number" 
                              min="0"
                              placeholder="0"
                              value={selectedItems[r.productName] || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setSelectedItems({ ...selectedItems, [r.productName]: val });
                              }}
                              style={{ width: "80px", padding: "8px", borderRadius: 0, border: "1.5px solid #e2e8f0", textAlign: "center", fontSize: 14, outline: "none", color: selectedItems[r.productName] > 0 ? "#6366f1" : "#1e293b", fontWeight: selectedItems[r.productName] > 0 ? 600 : 400 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {(selectedParty.rates || []).length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                          No rates have been assigned to this party yet. Please update the Party-wise Rate List first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Assignment & Logistics */}
          <Card style={{ padding: 24 }}>
             <h3 style={{ fontSize: 15, fontWeight: 500, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
               📦 Logistics & Assignment
             </h3>
             
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
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input 
                      type="text" 
                      placeholder="Transporter Name" 
                      value={newTransporterName}
                      onChange={(e) => setNewTransporterName(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 0, border: "1.5px solid #6366f1", fontSize: 13, outline: "none" }}
                    />
                    <button 
                      onClick={handleAddTransporter}
                      disabled={isAddingTransporter || !newTransporterName.trim()}
                      style={{ padding: "0 12px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontSize: 12, cursor: "pointer" }}
                    >
                      {isAddingTransporter ? "Saving" : "Save"}
                    </button>
                    <button 
                      onClick={() => { setShowAddTransporter(false); setNewTransporterName(""); }}
                      style={{ padding: "0 8px", background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select 
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 0, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 14 }}
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
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 0, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 14 }}
                >
                  <option value="">Select User</option>
                  {(allUsers || []).map((e: any) => (
                    <option key={e.uid} value={e.uid}>
                      {e.name} ({e.role?.charAt(0).toUpperCase() + e.role?.slice(1)})
                    </option>
                  ))}
                </select>
             </div>
             
             <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, margin: "12px 0 0" }}>
               The assigned employee will see this list on their dashboard and will be responsible for packing these items.
             </p>
          </Card>

          {/* Summary Card */}
          {selectedParty && Object.values(selectedItems).some(q => q > 0) && (
            <Card style={{ padding: 24, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", border: "none", color: "#fff" }}>
               <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, opacity: 0.9 }}>Selection Summary</h3>
               <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>Distinct Items:</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{Object.values(selectedItems).filter(v => v > 0).length}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Total Quantity:</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{Object.values(selectedItems).reduce((a, b) => a + b, 0)} Pcs</span>
               </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
