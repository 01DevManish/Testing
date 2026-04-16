"use client";

import { useEffect, useMemo, useState } from "react";
import { get, onValue, ref, update } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { PackingList } from "../../types";
import { generateDispatchListPdf } from "../../DispatchListPdf";
import { generatePackingListPdf } from "../../PackingListPdf";

export default function AllDispatchLists() {
  const PAGE_SIZE = 3;
  const [lists, setLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempLr, setTempLr] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingLrId, setEditingLrId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "packed" | "completed">("all");
  const [currentPage, setCurrentPage] = useState(1);

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
      data.sort((a, b) => (Number(b.dispatchedAt) || 0) - (Number(a.dispatchedAt) || 0));
      setLists(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFinalize = async (id: string) => {
    const lrVal = tempLr[id];
    if (!lrVal || !lrVal.trim()) {
      alert("Please enter LR Number");
      return;
    }

    setUpdating(id);
    try {
      const listRef = ref(db, `packingLists/${id}`);
      await update(listRef, {
        lrNo: lrVal.trim(),
        status: "Completed",
      });
      setTempLr((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditingLrId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update LR Number");
    } finally {
      setUpdating(null);
    }
  };

  const handleDownload = async (l: PackingList, type: "dispatch" | "packing") => {
    try {
      let fullPartyData: Record<string, unknown> = {};
      if (l.partyId) {
        const rateSnap = await get(ref(db, `partyRates/${l.partyId}`));
        if (rateSnap.exists()) {
          const p = rateSnap.val() as {
            partyName?: string;
            billTo?: {
              companyName?: string;
              address?: string;
              district?: string;
              contactNo?: string;
            };
          };
          fullPartyData = {
            ...p.billTo,
            partyName: p.billTo?.companyName || p.partyName || l.partyName,
            partyAddress: p.billTo?.address || l.partyAddress,
            partyCity: p.billTo?.district || l.partyCity,
            partyPhone: p.billTo?.contactNo || l.partyPhone,
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

  const getBoxOrBailCount = (l: PackingList) => {
    const explicit = Number(l.bails || 0);
    if (explicit > 0) return explicit;
    const uniqueBoxes = new Set(
      (l.items || [])
        .map((i) => {
          const maybeBox = (i as { boxName?: string }).boxName;
          return typeof maybeBox === "string" ? maybeBox.trim() : "";
        })
        .filter(Boolean)
    );
    return uniqueBoxes.size || (l.items?.length ?? 0);
  };

  const stats = useMemo(() => {
    const total = lists.length;
    const pendingLr = lists.filter((l) => l.status === "Packed").length;
    const shipped = lists.filter((l) => l.status === "Completed").length;
    return { total, pendingLr, shipped };
  }, [lists]);

  const filteredLists = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return lists.filter((l) => {
      const statusPass =
        statusFilter === "all" ||
        (statusFilter === "packed" && l.status === "Packed") ||
        (statusFilter === "completed" && l.status === "Completed");

      if (!statusPass) return false;
      if (!q) return true;

      const dispatchCode = String(l.dispatchId || l.id || "").toLowerCase();
      const party = String(l.partyName || "").toLowerCase();
      const lr = String(l.lrNo || "").toLowerCase();
      const by = String(l.dispatchedBy || "").toLowerCase();

      return dispatchCode.includes(q) || party.includes(q) || lr.includes(q) || by.includes(q);
    });
  }, [lists, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLists.length / PAGE_SIZE));

  const paginatedLists = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredLists.slice(start, end);
  }, [filteredLists, currentPage, PAGE_SIZE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getStatusMeta = (status: PackingList["status"]) => {
    if (status === "Completed") {
      return { label: "Shipped", color: "#065f46", bg: "#dcfce7", border: "#86efac" };
    }
    return { label: "Ready - Pending LR", color: "#92400e", bg: "#fef3c7", border: "#fcd34d" };
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading history...</div>;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: "#0f172a", margin: 0 }}>Dispatch History</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "5px 0 0" }}>
              Manage LR updates and download dispatch documents quickly.
            </p>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>
            Showing {filteredLists.length} of {lists.length}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, color: "#334155", fontWeight: 500 }}>
            Total: {stats.total}
          </div>
          <div style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid #fcd34d", background: "#fffbeb", fontSize: 12, color: "#92400e", fontWeight: 500 }}>
            Pending LR: {stats.pendingLr}
          </div>
          <div style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid #86efac", background: "#f0fdf4", fontSize: 12, color: "#166534", fontWeight: 500 }}>
            Shipped: {stats.shipped}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Dispatch ID"
            style={{
              flex: "1 1 320px",
              minWidth: 220,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              fontSize: 13,
              color: "#0f172a",
              outline: "none",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "packed" | "completed")}
            style={{
              width: 170,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              fontSize: 13,
              color: "#0f172a",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="packed">Pending LR</option>
            <option value="completed">Shipped</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: "hidden" }}>
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={{ width: "16%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Dispatch</th>
              <th style={{ width: "20%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Party</th>
              <th style={{ width: "11%", padding: "12px 12px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Packages</th>
              <th style={{ width: "17%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Status / LR</th>
              <th style={{ width: "12%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Dispatched By</th>
              <th style={{ width: "24%", padding: "12px 12px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLists.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    #{l.dispatchId || l.id?.slice(-6).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {l.dispatchedAt ? new Date(l.dispatchedAt).toLocaleDateString() : "N/A"}{" "}
                    {l.dispatchedAt ? new Date(l.dispatchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </td>

                <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 500 }}>{l.partyName || "N/A"}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {l.partyCity || "City not set"}{l.partyPhone ? ` | ${l.partyPhone}` : ""}
                  </div>
                </td>

                <td style={{ padding: "12px", textAlign: "center", verticalAlign: "top" }}>
                  <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "6px 10px", borderRadius: 10, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#0f172a", lineHeight: 1 }}>{getBoxOrBailCount(l)}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#475569", textTransform: "uppercase" }}>Box/Bail</span>
                  </div>
                </td>

                <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  {(() => {
                    const statusMeta = getStatusMeta(l.status);
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 52 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 150,
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 500,
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            border: `1px solid ${statusMeta.border}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {statusMeta.label}
                        </span>
                        <div style={{ fontSize: 12, color: l.lrNo ? "#0f172a" : "#94a3b8", fontWeight: 400, lineHeight: 1.2, minHeight: 14, textAlign: "center", width: "100%" }}>
                          {l.lrNo ? `LR: ${l.lrNo}` : "LR not assigned"}
                        </div>
                      </div>
                    );
                  })()}
                </td>

                <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b" }}>{l.dispatchedBy || "N/A"}</div>
                </td>

                <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {l.status === "Packed" && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {editingLrId === l.id ? (
                          <>
                            <input
                              placeholder="Enter LR No."
                              value={tempLr[l.id || ""] || ""}
                              onChange={(e) => setTempLr((p) => ({ ...p, [l.id || ""]: e.target.value }))}
                              style={{ width: 130, padding: "7px 9px", border: "1.5px solid #dbe4f0", borderRadius: 9, fontSize: 12, outline: "none", background: "#fff" }}
                            />
                            <button
                              onClick={() => l.id && handleFinalize(l.id)}
                              disabled={updating === l.id}
                              style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", opacity: updating === l.id ? 0.7 : 1 }}
                            >
                              {updating === l.id ? "Saving..." : "Save LR"}
                            </button>
                            <button
                              onClick={() => setEditingLrId(null)}
                              style={{ background: "#fff", color: "#475569", border: "1px solid #dbe4f0", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 400, cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => l.id && setEditingLrId(l.id)}
                            style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            Set LR
                          </button>
                        )}
                      </div>
                    )}

                    {(l.status === "Completed" || l.status === "Packed") && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleDownload(l, "dispatch")}
                          title="Dispatch List"
                          style={{ background: "#f8fafc", border: "1px solid #dbe4f0", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Disp
                        </button>
                        <button
                          onClick={() => handleDownload(l, "packing")}
                          title="Packing List"
                          style={{ background: "#6366f1", border: "none", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Pack
                        </button>
                      </div>
                    )}

                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLists.length === 0 && (
          <div style={{ padding: "52px 24px", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>No Records</div>
            <div style={{ fontSize: 13 }}>
              {searchTerm || statusFilter !== "all"
                ? "No dispatches match your current filters."
                : "No dispatch records found yet."}
            </div>
          </div>
        )}

        {filteredLists.length > 0 && (
          <div
            style={{
              padding: "14px 12px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Page {currentPage} of {totalPages}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  background: "#fff",
                  color: "#334155",
                  border: "1px solid #dbe4f0",
                  padding: "7px 11px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  opacity: currentPage === 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  background: "#fff",
                  color: "#334155",
                  border: "1px solid #dbe4f0",
                  padding: "7px 11px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  opacity: currentPage === totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
