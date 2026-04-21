"use client";

import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { PageHeader, Card } from "../ui";
import { generatePackingListPdf } from "../../PackingListPdf";
import { useData } from "../../../../context/DataContext";
import { firestoreApi } from "../../data";

export default function AllPackingLists({
  onEdit,
  onView,
  onDelete,
  canDelete,
}: {
  onEdit?: (list: any) => void;
  onView?: (list: any) => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}) {
  const { packingLists, loading: dataLoading } = useData();
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const isMobile = viewportWidth < 640;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handlePdf = async (list: any) => {
    setDownloadingId(list.id);
    try {
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
            partyPhone: p.phone || p.contactNo || p.mobile || p.billTo?.phone || "",
          };
        }
      }

      const inventoryMap: Record<string, string> = {};
      const inventory = await firestoreApi.getInventoryProducts();
      inventory.forEach((inv) => {
        if (inv.sku && inv.barcode) {
          inventoryMap[String(inv.sku).trim().toLowerCase()] = inv.barcode;
        }
      });

      const mappedItems = (list.items || []).map((item: any) => {
        const skuKey = String(item.sku || "").trim().toLowerCase();
        return {
          ...item,
          barcode: item.barcode || inventoryMap[skuKey] || item.sku || "N/A",
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
    for (const list of filteredLists) {
      await handlePdf(list);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    setDownloadingAll(false);
  };

  const lists = (packingLists || []).slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  const filteredLists = lists.filter((list) => {
    const matchesSearch =
      String(list.partyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(list.assignedToName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(list.id || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (filterDate) {
      const listDate = new Date(list.createdAt).toISOString().split("T")[0];
      return matchesSearch && listDate === filterDate;
    }

    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "#f59e0b";
      case "in progress":
        return "#6366f1";
      case "completed":
        return "#10b981";
      case "cancelled":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  if (dataLoading && lists.length === 0) return <div className="p-8 text-center text-slate-500">Loading packing lists...</div>;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <PageHeader title="All Packing Lists" sub="Track the status of all assigned fulfillment tasks.">
        <button
          onClick={handleDownloadAll}
          disabled={downloadingAll || filteredLists.length === 0}
          style={{
            fontSize: isMobile ? 12 : 13,
            fontWeight: 600,
            color: "#fff",
            background: "#6366f1",
            padding: isMobile ? "10px 14px" : "10px 18px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: downloadingAll ? 0.6 : 1,
            width: isMobile ? "100%" : "auto",
            justifyContent: "center",
          }}
        >
          {downloadingAll ? "Downloading..." : `Download All (${filteredLists.length})`}
        </button>
      </PageHeader>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: isMobile ? 16 : 20,
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flex: 1,
              minWidth: isMobile ? "100%" : 300,
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                placeholder="Search Party / Employee"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: isMobile ? "11px 14px" : "10px 16px",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  fontSize: isMobile ? 12 : 13,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{
                  flex: 1,
                  padding: isMobile ? "11px 12px" : "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  fontSize: isMobile ? 12 : 13,
                  outline: "none",
                  color: "#64748b",
                }}
              />
              {filterDate && (
                <button onClick={() => setFilterDate("")} style={{ fontSize: isMobile ? 10 : 11, color: "#ef4444", fontWeight: 600 }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#94a3b8", width: isMobile ? "100%" : "auto" }}>
            Showing {filteredLists.length} records
          </div>
        </div>

        {isMobile ? (
        <div style={{ display: "grid", gap: 8, padding: 10 }}>
            {filteredLists.map((list) => (
              <div key={list.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>#{list.id?.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{new Date(list.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: 600,
                      background: `${getStatusColor(list.status)}15`,
                      color: getStatusColor(list.status),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {list.status}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{list.partyName}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>Assigned to {list.assignedToName}</div>
                  <div style={{ fontSize: 10, color: "#6366f1", marginTop: 2 }}>{list.transporter}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 11, background: "#f8fafc", border: "1px solid #eef2f7" }}>
                  <span style={{ fontSize: 10, color: "#64748b" }}>Items</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{list.items?.length || 0} Products</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      canDelete && list.status === "Pending"
                        ? "repeat(4, minmax(0, 1fr))"
                        : canDelete || list.status === "Pending"
                          ? "repeat(3, minmax(0, 1fr))"
                          : "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => handlePdf(list)}
                    disabled={downloadingId === list.id}
                    style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#10b981", padding: "9px 8px", borderRadius: 10, border: "none", opacity: downloadingId === list.id ? 0.7 : 1 }}
                  >
                    {downloadingId === list.id ? "..." : "PDF"}
                  </button>
                  <button
                    onClick={() => onView?.(list)}
                    style={{ fontSize: 10, fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "9px 8px", borderRadius: 10, border: "1px solid #e2e8f0" }}
                  >
                    View
                  </button>
                  {list.status === "Pending" && (
                    <button
                      onClick={() => onEdit?.(list)}
                      style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", background: "#f5f3ff", padding: "9px 8px", borderRadius: 10, border: "1px solid #e9d5ff" }}
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete packing list #${list.id?.slice(-6).toUpperCase()}?`)) {
                          onDelete?.(list.id);
                        }
                      }}
                      style={{ fontSize: 10, fontWeight: 600, color: "#ef4444", background: "#fef2f2", padding: "9px 8px", borderRadius: 10, border: "1px solid #fecaca" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredLists.length === 0 && (
              <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>
                No packing lists found.
              </div>
            )}
          </div>
        ) : (
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
                {filteredLists.map((list) => (
                  <tr key={list.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>#{list.id?.slice(-6).toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(list.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: "14px 24px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{list.partyName}</td>
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ fontSize: 13, color: "#1e293b" }}>{list.assignedToName}</div>
                      <div style={{ fontSize: 11, color: "#6366f1" }}>{list.transporter}</div>
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "center", fontSize: 13, color: "#475569" }}>
                      {list.items?.length || 0} Products
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${getStatusColor(list.status)}15`,
                          color: getStatusColor(list.status),
                        }}
                      >
                        {list.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handlePdf(list)}
                          disabled={downloadingId === list.id}
                          style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#10b981", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s", opacity: downloadingId === list.id ? 0.7 : 1 }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#059669")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#10b981")}
                        >
                          {downloadingId === list.id ? "..." : "PDF"}
                        </button>
                        <button
                          onClick={() => onView?.(list)}
                          style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        >
                          View
                        </button>
                        {list.status === "Pending" && (
                          <button
                            onClick={() => onEdit?.(list)}
                            style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", background: "#f5f3ff", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#eee")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete packing list #${list.id?.slice(-6).toUpperCase()}?`)) {
                                onDelete?.(list.id);
                              }
                            }}
                            style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "#fef2f2", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
                          >
                            Delete
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
        )}
      </Card>
    </div>
  );
}
