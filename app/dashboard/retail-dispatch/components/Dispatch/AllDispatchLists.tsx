"use client";

import { useState, useEffect } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { Card } from "../ui";
import { PackingList } from "../../types";
import { generateDispatchListPdf } from "../../DispatchListPdf";
import { generatePackingListPdf } from "../../PackingListPdf";

interface AllDispatchListsProps {
  onView: (list: PackingList) => void;
  onEdit: (list: PackingList) => void;
}

export default function AllDispatchLists({ onView }: AllDispatchListsProps) {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempLr, setTempLr] = useState<{ [key: string]: string }>({});
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const listsRef = ref(db, "packingLists");
    const unsubscribe = onValue(listsRef, (snapshot) => {
      const data: PackingList[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        if (val.status === "Completed" || val.status === "Packed") {
          data.push({ id: child.key, ...val });
        }
      });
      // Sort by dispatchedAt desc
      data.sort((a, b) => (Number(b.dispatchedAt) || 0) - (Number(a.dispatchedAt) || 0));
      setLists(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFinalize = async (id: string) => {
    const lrVal = tempLr[id];
    if (!lrVal || !lrVal.trim()) return alert("Please enter LR Number");

    setUpdating(id);
    try {
      const listRef = ref(db, `packingLists/${id}`);
      await update(listRef, {
        lrNo: lrVal.trim(),
        status: "Completed"
      });
      setTempLr(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error(err);
      alert("Failed to update LR Number");
    } finally {
      setUpdating(null);
    }
  };

  const handleDownload = async (l: PackingList, type: "dispatch" | "packing") => {
    try {
      // Resolve full party data from partyRates node (which contains the structured billTo object)
      let fullPartyData: any = {};
      if (l.partyId) {
        const rateSnap = await get(ref(db, `partyRates/${l.partyId}`));
        if (rateSnap.exists()) {
          const p = rateSnap.val();
          fullPartyData = {
            ...p.billTo, // Spread structured billTo fields (companyName, traderName, gstNo, panNo, address, state, district, pincode, contactNo)
            partyName: p.billTo?.companyName || p.partyName || l.partyName,
            partyAddress: p.billTo?.address || l.partyAddress,
            partyCity: p.billTo?.district || l.partyCity,
            partyPhone: p.billTo?.contactNo || l.partyPhone
          };
        }
      }

      if (type === "dispatch") {
        await generateDispatchListPdf({ ...l, ...fullPartyData });
      } else {
        await generatePackingListPdf({ ...l, ...fullPartyData });
      }
    } catch (err) {
      console.error("PDF Error:", err);
      alert("Failed to generate PDF");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading history...</div>;

  const filteredLists = lists;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: 0 }}>Dispatch History</h3>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>View all verified and shipped retail dispatches.</p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Dispatch ID / Date</th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Party Name</th>
              <th style={{ padding: "12px 24px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Packages</th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Dispatched By</th>
              <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLists.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={{ padding: "14px 24px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>#{l.dispatchId || l.id?.slice(-6).toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {l.dispatchedAt ? new Date(l.dispatchedAt).toLocaleDateString() : "N/A"}{" "}
                    {l.dispatchedAt ? new Date(l.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                  </div>
                </td>
                <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{l.partyName}</td>
                <td style={{ padding: "14px 24px", textAlign: "center" }}>
                   <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#f1f5f9", fontSize: 13, color: "#475569", fontWeight: 600 }}>
                     {l.bails || 0} Items
                   </div>
                </td>
                <td style={{ padding: "14px 24px" }}>
                   <span style={{ 
                      padding: "4px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                      background: l.status === "Completed" ? "#dcfce7" : "#fef3c7",
                      color: l.status === "Completed" ? "#166534" : "#92400e"
                   }}>
                      {l.status === "Completed" ? "Shipped" : "Ready / Pending LR"}
                   </span>
                   {l.lrNo && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>LR: {l.lrNo}</div>}
                </td>
                <td style={{ padding: "14px 24px", textAlign: "right" }}>
                   <div style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>{l.dispatchedBy}</div>
                </td>
                <td style={{ padding: "14px 24px", textAlign: "right" }}>
                   <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      {l.status === "Packed" && (
                         <div style={{ display: "flex", gap: 6 }}>
                            <input 
                               placeholder="Enter LR No."
                               value={tempLr[l.id || ""] || ""}
                               onChange={(e) => setTempLr(p => ({ ...p, [l.id || ""]: e.target.value }))}
                               style={{ width: 120, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none" }}
                            />
                            <button 
                               onClick={() => l.id && handleFinalize(l.id)}
                               disabled={updating === l.id}
                               style={{ background: "#6366f1", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                            >
                               {updating === l.id ? "..." : "Set LR"}
                            </button>
                         </div>
                      )}
                      
                      {l.status === "Completed" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button 
                            onClick={() => handleDownload(l, "dispatch")}
                            title="Dispatch List"
                            style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                          >
                             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                             Disp
                          </button>
                          <button 
                            onClick={() => handleDownload(l, "packing")}
                            title="Packing List"
                            style={{ background: "#6366f1", border: "none", padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                          >
                             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                             Pack
                          </button>
                        </div>
                      )}

                      <button 
                         onClick={() => onView(l)}
                         style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer" }}
                      >
                         Details
                      </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lists.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            No dispatch records found.
          </div>
        )}
      </div>
    </Card>
  );
}
