"use client";

import React, { useState, useMemo } from "react";
import { Card, PageHeader, BtnGhost } from "../ui";
import PackingListDetailsModal from "../Packaging/PackingListDetailsModal";
import { generateBoxDispatchPdf } from "../../BoxDispatchPdf";
import type { ProductLookup } from "../../BoxDispatchPdf";

interface DispatchListItem {
  quantity?: number;
}

interface BoxDispatchRecord {
  id: string;
  isBoxDispatch?: boolean;
  partyName?: string;
  createdAt: string | number;
  createdBy?: string | { name?: string };
  sourceBoxId?: string;
  bails?: number;
  items?: DispatchListItem[];
}

interface AllBoxDispatchesTabProps {
  packingLists: BoxDispatchRecord[];
  products: ProductLookup[];
}

export default function AllBoxDispatchesTab({ packingLists, products }: AllBoxDispatchesTabProps) {
  const [selectedList, setSelectedList] = useState<BoxDispatchRecord | null>(null);

  const boxDispatches = useMemo(() => {
    return packingLists
      .filter((l) => l.isBoxDispatch || l.partyName === "Direct Box Dispatch")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [packingLists]);

  const formatDate = (value: string | number) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Box Dispatch History" sub="Detailed log of all dispatches fulfilled via box templates." />

      <Card style={{ padding: 0, overflow: "hidden", minHeight: 500 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Date & Time", "Box ID", "Boxes", "Total Items", "Created By", "Action"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "16px 24px",
                      textAlign: h === "Action" ? "right" : "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boxDispatches.map((l) => {
                const totalUnits = l.items?.reduce((acc: number, cur: DispatchListItem) => acc + (cur.quantity || 0), 0) || 0;
                return (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "18px 24px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{formatDate(l.createdAt)}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>ID: {l.id.slice(-8).toUpperCase()}</div>
                    </td>
                    <td style={{ padding: "18px 24px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: "#f1f5f9",
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#0f172a",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {l.sourceBoxId || "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "18px 24px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#6366f1" }}>{l.bails || 0} Boxes</div>
                    </td>
                    <td style={{ padding: "18px 24px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{totalUnits} Units</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{l.items?.length || 0} unique SKUs</div>
                    </td>
                    <td style={{ padding: "18px 24px", fontSize: 13, fontWeight: 500, color: "#475569" }}>{typeof l.createdBy === "string" ? l.createdBy : l.createdBy?.name || "Admin"}</td>
                    <td style={{ padding: "18px 24px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <BtnGhost
                          onClick={() => {
                            const printWindow = window.open("", "_blank");
                            if (!printWindow) {
                              alert("Please allow popups to print PDF.");
                              return;
                            }
                            generateBoxDispatchPdf(l, products, { mode: "print", targetWindow: printWindow });
                          }}
                          style={{ fontSize: 12, fontWeight: 700 }}
                        >
                          Print PDF
                        </BtnGhost>
                        <BtnGhost
                          onClick={() => {
                            const viewWindow = window.open("", "_blank");
                            if (!viewWindow) {
                              alert("Please allow popups to view PDF.");
                              return;
                            }
                            generateBoxDispatchPdf(l, products, { mode: "view", targetWindow: viewWindow });
                          }}
                          style={{ fontSize: 12, fontWeight: 700 }}
                        >
                          View PDF
                        </BtnGhost>
                        <BtnGhost onClick={() => setSelectedList(l)} style={{ fontSize: 12, fontWeight: 600 }}>
                          View SKUs -&gt;
                        </BtnGhost>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {boxDispatches.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 100, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 16 }}>No Data</div>
                    No box dispatch history found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedList && <PackingListDetailsModal list={selectedList} onClose={() => setSelectedList(null)} />}
    </div>
  );
}
