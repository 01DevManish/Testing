"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../lib/firebase";
import { PageHeader, Card } from "./ui";

export default function AllDispatchLists({ onView, onEdit }: { onView?: (list: any) => void; onEdit?: (list: any) => void }) {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const listsRef = ref(db, "packingLists");
    const unsubscribe = onValue(listsRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        if (val.status === "Completed") {
          data.push({ id: child.key, ...val });
        }
      });
      // Sort by newest first
      setLists(data.sort((a, b) => (b.dispatchedAt || 0) - (a.dispatchedAt || 0)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLists = lists.filter(l => 
    (l.partyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.dispatchedBy || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
      <div style={{ width: 24, height: 24, margin: "0 auto 12px", border: "2px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      Loading dispatch history...
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <PageHeader title="All Dispatch Lists" sub="History of all finalized and shipped retail dispatches." />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 20, borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 300 }}>
            <input 
              type="text" 
              placeholder="Search Party / Employee" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Showing {filteredLists.length} dispatches</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Dispatch ID / Date</th>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Party Name</th>
                <th style={{ padding: "12px 24px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Bails/Boxes</th>
                <th style={{ padding: "12px 24px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Items</th>
                <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Dispatched By</th>
                <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLists.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "14px 24px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>#{l.id?.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(l.dispatchedAt).toLocaleDateString()} {new Date(l.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{l.partyName}</td>
                  <td style={{ padding: "14px 24px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#f1f5f9", fontSize: 13, color: "#475569", fontWeight: 600 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                        <path d="m3.3 7 8.7 5 8.7-5"></path>
                        <path d="M12 22V12"></path>
                      </svg>
                      {l.bails || 0}
                    </div>
                  </td>
                  <td style={{ padding: "14px 24px", textAlign: "center", fontSize: 13, color: "#475569" }}>
                    {l.items?.length || 0} Products
                  </td>
                  <td style={{ padding: "14px 24px", textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{l.dispatchedBy}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{l.transporter}</div>
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
                       <button 
                         onClick={() => onEdit?.(l)}
                         style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", background: "#f5f3ff", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}
                         onMouseEnter={e => e.currentTarget.style.background = "#eee"}
                         onMouseLeave={e => e.currentTarget.style.background = "#f5f3ff"}
                       >
                         Edit
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLists.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                    No dispatched records found.
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
