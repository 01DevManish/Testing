"use client";

import { useState, useEffect } from "react";
import { ref, get, onValue } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { PageHeader, Card } from "../ui";
import { PackingList } from "../../types";
import { generatePackingListPdf } from "../../PackingListPdf";

export default function AllPackingLists({ onEdit, onView }: { onEdit?: (list: any) => void; onView?: (list: any) => void }) {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handlePdf = async (list: any) => {
    if (list.pdfUrl) {
      window.open(list.pdfUrl, "_blank");
      return;
    }
    setDownloadingId(list.id);
    try {
      // 1. Fetch full party details for complete contact info (Phone, Address, etc.)
      let fullPartyData: any = {};
      if (list.partyId) {
        const partySnap = await get(ref(db, `parties/${list.partyId}`));
        if (partySnap.exists()) {
          const p = partySnap.val();
          fullPartyData = {
            partyId: list.partyId,
            partyName: p.name || p.partyName || list.partyName || "Unknown Party",
            partyAddress: p.address || p.billTo?.address || p.billingAddress || list.partyAddress || "Address not provided",
            partyCity: p.city || p.billTo?.city || list.partyCity || "",
            partyPhone: p.phone || p.contactNo || p.mobile || p.billTo?.phone || ""
          };
        }
      }
      
      // 2. Fetch Inventory to resolve barcodes dynamically
      const inventorySnap = await get(ref(db, "inventory"));
      const inventoryMap: Record<string, string> = {};
      if (inventorySnap.exists()) {
        inventorySnap.forEach(snap => {
          const inv = snap.val();
          if (inv.sku && inv.barcode) {
             inventoryMap[inv.sku.trim().toLowerCase()] = inv.barcode;
          }
        });
      }

      // 3. Map items to ensure barcodes are present
      const mappedItems = (list.items || []).map((item: any) => {
         const skuKey = (item.sku || "").trim().toLowerCase();
         return {
           ...item,
           barcode: item.barcode || inventoryMap[skuKey] || item.sku || "N/A"
         };
      });

      await generatePackingListPdf({ ...list, ...fullPartyData, items: mappedItems });
    } catch (err) {
      console.error("PDF Error:", err);
      alert("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (filteredLists.length === 0) return;
    if (!confirm(`Are you sure you want to download ${filteredLists.length} packing lists?`)) return;
    
    setDownloadingAll(true);
    // Iterate sequentially to avoid browser blocks/performance issues
    for (const list of filteredLists) {
      await handlePdf(list);
      // Small delay between downloads
      await new Promise(r => setTimeout(r, 600));
    }
    setDownloadingAll(false);
  };

  useEffect(() => {
    const listsRef = ref(db, "packingLists");
    const unsubscribe = onValue(listsRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((child) => {
        data.push({ id: child.key, ...child.val() });
      });
      // Sort by newest first
      setLists(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLists = lists.filter(l => {
    const matchesSearch = 
      (l.partyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.assignedToName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.id || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterDate) {
      const listDate = new Date(l.createdAt).toISOString().split('T')[0];
      return matchesSearch && listDate === filterDate;
    }
    
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending": return "#f59e0b";
      case "in progress": return "#6366f1";
      case "completed": return "#10b981";
      case "cancelled": return "#ef4444";
      default: return "#64748b";
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading packing lists...</div>;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <PageHeader title="All Packing Lists" sub="Track the status of all assigned fulfillment tasks.">
        <button 
          onClick={handleDownloadAll}
          disabled={downloadingAll || filteredLists.length === 0}
          style={{ 
            fontSize: 13, 
            fontWeight: 600, 
            color: "#fff", 
            background: "#6366f1", 
            padding: "10px 18px", 
            borderRadius: 10, 
            border: "none", 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: downloadingAll ? 0.6 : 1
          }}
        >
          {downloadingAll ? "Downloading..." : `📥 Download All (${filteredLists.length})`}
        </button>
      </PageHeader>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 20, borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 300 }}>
             <div style={{ position: "relative", flex: 1 }}>
               <input 
                 type="text" 
                 placeholder="Search Party / Employee" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none" }}
               />
             </div>
             <input 
               type="date" 
               value={filterDate}
               onChange={(e) => setFilterDate(e.target.value)}
               style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", color: "#64748b" }}
             />
             {filterDate && (
               <button onClick={() => setFilterDate("")} style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Clear</button>
             )}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Showing {filteredLists.length} records</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>List ID / Date</th>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Party Name</th>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Assigned To</th>
                <th style={{ padding: "12px 24px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Items</th>
                <th style={{ padding: "12px 24px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLists.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "14px 24px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>#{l.id?.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(l.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{l.partyName}</td>
                  <td style={{ padding: "14px 24px" }}>
                    <div style={{ fontSize: 13, color: "#1e293b" }}>{l.assignedToName}</div>
                    <div style={{ fontSize: 11, color: "#6366f1" }}>{l.transporter}</div>
                  </td>
                  <td style={{ padding: "14px 24px", textAlign: "center", fontSize: 13, color: "#475569" }}>
                    {l.items?.length || 0} Products
                  </td>
                  <td style={{ padding: "14px 24px", textAlign: "center" }}>
                    <span style={{ 
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: `${getStatusColor(l.status)}15`,
                      color: getStatusColor(l.status)
                    }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 24px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button 
                        onClick={() => handlePdf(l)}
                        disabled={downloadingId === l.id}
                        style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#10b981", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s", opacity: downloadingId === l.id ? 0.7 : 1 }}
                        onMouseEnter={e => e.currentTarget.style.background = "#059669"}
                        onMouseLeave={e => e.currentTarget.style.background = "#10b981"}
                      >
                        {downloadingId === l.id ? "..." : "PDF"}
                      </button>
                      <button 
                        onClick={() => onView?.(l)}
                        style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
                        onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}
                      >
                        View
                      </button>
                      {l.status === "Pending" && (
                        <button 
                          onClick={() => onEdit?.(l)}
                          style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", background: "#f5f3ff", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#eee"}
                          onMouseLeave={e => e.currentTarget.style.background = "#f5f3ff"}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLists.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                    No packing lists found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
