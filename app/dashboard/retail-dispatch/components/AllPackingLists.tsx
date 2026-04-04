"use client";

import { useState, useEffect } from "react";
import { ref, get, onValue } from "firebase/database";
import { db } from "../../../lib/firebase";
import { PageHeader, Card } from "./ui";

export default function AllPackingLists({ onEdit, onView }: { onEdit?: (list: any) => void; onView?: (list: any) => void }) {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

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
      <PageHeader title="All Packing Lists" sub="Track the status of all assigned fulfillment tasks." />

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
