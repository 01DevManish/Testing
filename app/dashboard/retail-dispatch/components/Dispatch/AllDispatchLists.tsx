"use client";

import { useEffect, useMemo, useState } from "react";
import { get, ref, remove, update } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../../../lib/firebase";
import { PackingList } from "../../types";
import { firestoreApi } from "../../data";
import { useAuth } from "../../../../context/AuthContext";
import { useData } from "../../../../context/DataContext";
import { generateDispatchListPdf } from "../../DispatchListPdf";
import { generatePackingListPdf } from "../../PackingListPdf";
import { touchDataSignal } from "../../../../lib/dataSignals";

const normalizeSku = (value?: string): string => (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AllDispatchLists() {
  const { userData } = useAuth();
  const { refreshData, packingLists: allPackingLists, loading: dataLoading } = useData();
  const isAdmin = userData?.role === "admin";
  const PAGE_SIZE = 3;
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [tempLr, setTempLr] = useState<Record<string, string>>({});
  const [tempInvoice, setTempInvoice] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingLrId, setEditingLrId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "packed" | "completed">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [viewingList, setViewingList] = useState<PackingList | null>(null);

  const isMobile = viewportWidth < 640;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const lists = useMemo(() => {
    const rows = (allPackingLists || [])
      .filter((list) => list.status === "Completed" || list.status === "Packed")
      .slice()
      .sort((a, b) => (Number(b.dispatchedAt) || 0) - (Number(a.dispatchedAt) || 0));
    return rows as PackingList[];
  }, [allPackingLists]);
  const scopedLists = useMemo(() => {
    if (isAdmin) return lists;
    const currentUid = String(userData?.uid || "").trim();
    if (!currentUid) return [];
    return lists.filter((list) => String(list.assignedTo || "").trim() === currentUid);
  }, [isAdmin, lists, userData?.uid]);

  const handleFinalize = async (id: string) => {
    const lrVal = tempLr[id];
    if (!lrVal || !lrVal.trim()) {
      alert("Please enter LR Number");
      return;
    }

    setUpdating(id);
    try {
      await update(ref(db, `packingLists/${id}`), {
        lrNo: lrVal.trim(),
        status: "Completed",
      });
      await touchDataSignal("packingLists");
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

  const handleSaveInvoice = async (id: string) => {
    const invoiceVal = tempInvoice[id];
    if (!invoiceVal || !invoiceVal.trim()) {
      alert("Please enter Invoice Number");
      return;
    }

    setUpdating(id);
    try {
      await update(ref(db, `packingLists/${id}`), {
        invoiceNo: invoiceVal.trim(),
      });
      await touchDataSignal("packingLists");
      setTempInvoice((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditingInvoiceId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update Invoice Number");
    } finally {
      setUpdating(null);
    }
  };

  const hasInvoice = (list: PackingList): boolean => Boolean(String(list.invoiceNo || "").trim());

  const handleViewDispatchInfo = (list: PackingList) => {
    setViewingList(list);
  };

  const actionRowStyle = (compact?: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: compact ? 6 : 8,
    flexWrap: "nowrap",
    overflowX: "auto",
    paddingBottom: compact ? 2 : 0,
    justifyContent: "flex-end",
  });

  const iconButtonStyle = (danger?: boolean, compact?: boolean): React.CSSProperties => ({
    width: compact ? 32 : 34,
    height: compact ? 32 : 34,
    borderRadius: 10,
    border: danger ? "1.5px solid #fca5a5" : "1px solid #dbe4f0",
    background: danger ? "#fff" : "#4f46e5",
    color: danger ? "#dc2626" : "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  });

  const iconSvg = (kind: "invoice" | "view" | "lr" | "dispatch" | "packing" | "cancel") => {
    if (kind === "invoice") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M6 3h9l5 5v13H6V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M15 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    }
    if (kind === "view") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    }
    if (kind === "lr") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M5 5h14v14H5z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    }
    if (kind === "dispatch") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 4v11M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    }
    if (kind === "packing") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  };

  const renderActionButton = ({
    title,
    kind,
    onClick,
    danger,
    compact,
    disabled,
    badgeText,
  }: {
    title: string;
    kind: "invoice" | "view" | "lr" | "dispatch" | "packing" | "cancel";
    onClick: () => void;
    danger?: boolean;
    compact?: boolean;
    disabled?: boolean;
    badgeText?: string;
  }) => (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...iconButtonStyle(Boolean(danger), compact),
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
      }}
    >
      {iconSvg(kind)}
      {badgeText && (
        <span
          style={{
            position: "absolute",
            right: -5,
            top: -5,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "#0f172a",
            color: "#fff",
            border: "1px solid #fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {badgeText}
        </span>
      )}
    </button>
  );

  const renderActionRow = (list: PackingList, compact?: boolean) => (
    <div style={actionRowStyle(compact)}>
      {renderActionButton({
        title: hasInvoice(list) ? "Update Invoice" : "Set Invoice",
        kind: "invoice",
        compact,
        disabled: updating === list.id,
        onClick: () => {
          if (list.status === "Packed") {
            if (!list.id) return;
            setTempInvoice((prev) => ({ ...prev, [list.id || ""]: String(list.invoiceNo || "") }));
            setEditingLrId(null);
            setEditingInvoiceId(list.id);
            return;
          }
          handlePromptInvoiceUpdate(list);
        },
      })}

      {renderActionButton({
        title: "View Dispatch Details",
        kind: "view",
        compact,
        onClick: () => handleViewDispatchInfo(list),
      })}

      {list.status === "Packed" &&
        renderActionButton({
          title: "Set LR",
          kind: "lr",
          compact,
          onClick: () => {
            if (!list.id) return;
            setEditingInvoiceId(null);
            setEditingLrId(list.id);
          },
        })}

      {hasInvoice(list) &&
        renderActionButton({
          title: "Print Dispatch",
          kind: "dispatch",
          compact,
          onClick: () => handleDownload(list, "dispatch"),
        })}

      {hasInvoice(list) &&
        renderActionButton({
          title: "Print Packing",
          kind: "packing",
          compact,
          onClick: () => handleDownload(list, "packing"),
        })}

      {isAdmin &&
        renderActionButton({
          title: "Cancel Dispatch",
          kind: "cancel",
          danger: true,
          compact,
          disabled: cancelling === list.id,
          onClick: () => handleCancelDispatch(list),
        })}
    </div>
  );

  const handlePromptInvoiceUpdate = async (list: PackingList) => {
    if (!list.id) return;
    const existing = String(list.invoiceNo || "").trim();
    const value = window.prompt("Enter Invoice Number", existing);
    if (value === null) return;
    const next = value.trim();
    if (!next) {
      alert("Please enter Invoice Number");
      return;
    }

    setUpdating(list.id);
    try {
      await update(ref(db, `packingLists/${list.id}`), {
        invoiceNo: next,
      });
      await touchDataSignal("packingLists");
    } catch (err) {
      console.error(err);
      alert("Failed to update Invoice Number");
    } finally {
      setUpdating(null);
    }
  };

  const handleCancelDispatch = async (list: PackingList) => {
    if (!list.id) return;
    const confirm1 = window.confirm(
      `Are you sure you want to cancel Dispatch "${list.dispatchId || list.id.slice(-6)}"?\n\nThis action will:\n• Reset the dispatch status to Pending\n• Restore deducted stock quantities to inventory`
    );
    if (!confirm1) return;

    setCancelling(list.id);
    try {
      // 1. Restore stock to inventory
      if (list.stockDeducted && list.items && list.items.length > 0) {
        const inventory = await firestoreApi.getInventoryProducts({ forceFresh: true });
        const deductionMap = new Map<string, { qty: number; productId?: string; sku?: string; productName?: string }>();
        
        for (const item of list.items as any[]) {
          const sku = typeof item?.sku === "string" ? item.sku : "";
          const skuKey = normalizeSku(sku);
          const productId = typeof item?.productId === "string" ? item.productId : undefined;
          const dedupeKey = productId
            ? `id:${productId}`
            : (skuKey && skuKey !== "n/a" ? `sku:${skuKey}` : "");

          if (!dedupeKey) {
            console.warn("Item skipped for stock restoration because it lacks both productId and valid SKU:", item);
            continue;
          }

          if (!deductionMap.has(dedupeKey)) {
            deductionMap.set(dedupeKey, {
              qty: 0,
              productId,
              sku,
              productName: typeof item?.productName === "string" ? item.productName : undefined
            });
          }
          deductionMap.get(dedupeKey)!.qty += (Number(item.quantity) || 1);
        }

        for (const { qty, productId, sku, productName } of deductionMap.values()) {
          const skuKey = normalizeSku(sku);
          const invProd =
            inventory.find((p: any) => productId && p.id === productId) ||
            inventory.find((p: any) => skuKey && skuKey !== "n/a" && normalizeSku(p.sku) === skuKey);

          if (invProd?.id) {
             // Pass negative quantity to restore stock
             const returnContextNote = `${list.dispatchId || list.id} - ${list.partyName || "Unknown Party"}`.slice(0, 60);
             await firestoreApi.deductStock(invProd.id, -qty, {
               reason: "Dispatch Return",
               note: returnContextNote,
               userName: userData?.name || "System",
             });
          } else {
             console.warn("Could not find inventory product to restore stock:", { productId, sku, productName, qty });
          }
        }
      }

      // 2. Reset PackingList status — back to "In Progress"
      await update(ref(db, `packingLists/${list.id}`), {
        status: "In Progress",
        stockDeducted: false,
        dispatchId: null,
        dispatchBarcode: null,
        invoiceNo: null,
        lrNo: null,
        dispatchedAt: null,
        dispatchedBy: null,
        bails: null,
        boxBarcodes: null,
        cancelledAt: Date.now(),
      });
      await touchDataSignal("packingLists");

      alert("Dispatch cancelled successfully and stock restored! ✅");
      refreshData("inventory");
    } catch (err) {
      console.error("Cancel dispatch failed:", err);
      alert("Error cancelling dispatch. Please check the console.");
    } finally {
      setCancelling(null);
    }
  };

  const handleDownload = async (list: PackingList, type: "dispatch" | "packing") => {
    if (!String(list.invoiceNo || "").trim()) {
      alert("Please set Invoice Number first. Print/Download requires invoice.");
      return;
    }

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      alert("Please allow popups to view PDF.");
      return;
    }

    try {
      let fullPartyData: Record<string, unknown> = {};
      if (list.partyId) {
        const rateSnap = await get(ref(db, `partyRates/${list.partyId}`));
        if (rateSnap.exists()) {
          const party = rateSnap.val() as {
            partyName?: string;
            billTo?: {
              companyName?: string;
              address?: string;
              district?: string;
              contactNo?: string;
            };
          };

          fullPartyData = {
            ...party.billTo,
            partyName: party.billTo?.companyName || party.partyName || list.partyName,
            partyAddress: party.billTo?.address || list.partyAddress,
            partyCity: party.billTo?.district || list.partyCity,
            partyPhone: party.billTo?.contactNo || list.partyPhone,
          };
        }
      }

      if (type === "dispatch") {
        // Always generate fresh PDF to reflect latest layout/data changes.
        await generateDispatchListPdf(
          { ...list, ...fullPartyData },
          { uploadToS3: false, preferUploadedUrl: false, targetWindow: previewWindow }
        );
      } else {
        await generatePackingListPdf({ ...list, ...fullPartyData }, { targetWindow: previewWindow });
      }
    } catch (err) {
      console.error("PDF Error:", err);
      alert("Failed to generate PDF");
      previewWindow.close();
    }
  };

  const getBoxOrBailCount = (list: PackingList) => {
    const uniqueBoxes = new Set(
      (list.items || [])
        .map((item) => {
          const maybeBox = (item as { boxName?: string }).boxName;
          const name = typeof maybeBox === "string" ? maybeBox.trim() : "";
          if (!name || name === "-" || name.toUpperCase() === "UNASSIGNED") return "";
          return name;
        })
        .filter(Boolean),
    );
    if (uniqueBoxes.size > 0) return uniqueBoxes.size;
    const explicit = Number(list.bails || 0);
    if (explicit > 0) return explicit;
    return list.items?.length ?? 0;
  };

  const stats = useMemo(() => {
    const total = scopedLists.length;
    const pendingLr = scopedLists.filter((list) => list.status === "Packed").length;
    const shipped = scopedLists.filter((list) => list.status === "Completed").length;
    return { total, pendingLr, shipped };
  }, [scopedLists]);

  const filteredLists = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return scopedLists.filter((list) => {
      const statusPass =
        statusFilter === "all" ||
        (statusFilter === "packed" && list.status === "Packed") ||
        (statusFilter === "completed" && list.status === "Completed");

      if (!statusPass) return false;
      if (!query) return true;

      const dispatchCode = String(list.dispatchId || list.id || "").toLowerCase();
      const party = String(list.partyName || "").toLowerCase();
      const lr = String(list.lrNo || "").toLowerCase();
      const by = String(list.dispatchedBy || "").toLowerCase();

      return dispatchCode.includes(query) || party.includes(query) || lr.includes(query) || by.includes(query);
    });
  }, [scopedLists, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLists.length / PAGE_SIZE));

  const paginatedLists = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLists.slice(start, start + PAGE_SIZE);
  }, [filteredLists, currentPage]);

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
    return { label: "Pending LR", color: "#3730a3", bg: "#eef2ff", border: "#c7d2fe" };
  };

  if (dataLoading && lists.length === 0) return <div className="p-8 text-center text-slate-500">Loading history...</div>;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          padding: isMobile ? "16px 14px 12px" : "18px 20px 14px",
          borderBottom: "1px solid #e2e8f0",
          background: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 500, color: "#0f172a", margin: 0 }}>Dispatch History</h3>
            <p style={{ fontSize: isMobile ? 11 : 12, color: "#64748b", margin: "5px 0 0" }}>
              Manage LR updates and download dispatch documents quickly.
            </p>
          </div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#64748b", fontWeight: 400 }}>
            Showing {filteredLists.length} of {scopedLists.length}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontSize: isMobile ? 11 : 12, color: "#334155", fontWeight: 500 }}>
            Total: {stats.total}
          </div>
          <div style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid #fcd34d", background: "#fffbeb", fontSize: isMobile ? 11 : 12, color: "#92400e", fontWeight: 500 }}>
            Pending LR: {stats.pendingLr}
          </div>
          <div style={{ padding: "7px 10px", borderRadius: 999, border: "1px solid #86efac", background: "#f0fdf4", fontSize: isMobile ? 11 : 12, color: "#166534", fontWeight: 500 }}>
            Shipped: {stats.shipped}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", minWidth: 0 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Dispatch ID"
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              padding: isMobile ? "8px 10px" : "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              fontSize: isMobile ? 11 : 13,
              color: "#0f172a",
              outline: "none",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "packed" | "completed")}
            style={{
              width: isMobile ? 124 : 170,
              flexShrink: 0,
              padding: isMobile ? "8px 10px" : "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              fontSize: isMobile ? 11 : 13,
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

      {isMobile ? (
        <div style={{ display: "grid", gap: 8, padding: 10 }}>
          {paginatedLists.map((list) => {
            const statusMeta = getStatusMeta(list.status);
            return (
              <div key={list.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>#{list.dispatchId || list.id?.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {list.dispatchedAt ? new Date(list.dispatchedAt).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: 600,
                      background: statusMeta.bg,
                      color: statusMeta.color,
                      border: `1px solid ${statusMeta.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{list.partyName || "N/A"}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>
                    {list.partyCity || "City not set"}{list.partyPhone ? ` | ${list.partyPhone}` : ""}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <div style={{ padding: "9px 10px", borderRadius: 11, background: "#f8fafc", border: "1px solid #eef2f7" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 5 }}>Packages</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{getBoxOrBailCount(list)} Box/Bail</div>
                  </div>
                  <div style={{ padding: "9px 10px", borderRadius: 11, background: "#f8fafc", border: "1px solid #eef2f7" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 5 }}>Dispatched By</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>{list.dispatchedBy || "N/A"}</div>
                  </div>
                </div>

                <div style={{ padding: "9px 10px", borderRadius: 11, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 5 }}>LR Number</div>
                  <div style={{ fontSize: 12, color: list.lrNo ? "#0f172a" : "#94a3b8", fontWeight: list.lrNo ? 500 : 400 }}>
                    {list.lrNo ? `LR: ${list.lrNo}` : "LR not assigned"}
                  </div>
                </div>

                <div style={{ padding: "9px 10px", borderRadius: 11, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 5 }}>Invoice Number</div>
                  <div style={{ fontSize: 12, color: list.invoiceNo ? "#0f172a" : "#94a3b8", fontWeight: list.invoiceNo ? 500 : 400 }}>
                    {list.invoiceNo ? `INV: ${list.invoiceNo}` : "Invoice not set"}
                  </div>
                </div>

                {list.status === "Packed" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {editingInvoiceId === list.id ? (
                      <>
                        <input
                          placeholder="Enter Invoice No."
                          value={tempInvoice[list.id || ""] || ""}
                          onChange={(e) => setTempInvoice((prev) => ({ ...prev, [list.id || ""]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 11px", border: "1.5px solid #dbe4f0", borderRadius: 10, fontSize: 11, outline: "none", background: "#fff" }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          <button
                            onClick={() => list.id && handleSaveInvoice(list.id)}
                            disabled={updating === list.id}
                            style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "0 10px", borderRadius: 10, minHeight: 34, fontSize: 11, fontWeight: 600, opacity: updating === list.id ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {updating === list.id ? "Saving..." : "Save Invoice"}
                          </button>
                          <button
                            onClick={() => setEditingInvoiceId(null)}
                            style={{ background: "#fff", color: "#475569", border: "1px solid #dbe4f0", padding: "0 10px", borderRadius: 10, minHeight: 34, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : editingLrId === list.id ? (
                      <>
                        <input
                          placeholder="Enter LR No."
                          value={tempLr[list.id || ""] || ""}
                          onChange={(e) => setTempLr((prev) => ({ ...prev, [list.id || ""]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 11px", border: "1.5px solid #dbe4f0", borderRadius: 10, fontSize: 11, outline: "none", background: "#fff" }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          <button
                            onClick={() => list.id && handleFinalize(list.id)}
                            disabled={updating === list.id}
                            style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "0 10px", borderRadius: 10, minHeight: 34, fontSize: 11, fontWeight: 600, opacity: updating === list.id ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {updating === list.id ? "Saving..." : "Save LR"}
                          </button>
                          <button
                            onClick={() => setEditingLrId(null)}
                            style={{ background: "#fff", color: "#475569", border: "1px solid #dbe4f0", padding: "0 10px", borderRadius: 10, minHeight: 34, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : renderActionRow(list, true)}
                  </div>
                )}

                {list.status !== "Packed" && (
                  <div>{renderActionRow(list, true)}</div>
                )}
              </div>
            );
          })}

          {filteredLists.length === 0 && (
            <div style={{ padding: "42px 24px", textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>No Records</div>
              <div style={{ fontSize: 12 }}>
                {searchTerm || statusFilter !== "all"
                  ? "No dispatches match your current filters."
                  : "No dispatch records found yet."}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "hidden" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={{ width: "16%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Dispatch</th>
                <th style={{ width: "20%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Party</th>
                <th style={{ width: "11%", padding: "12px 12px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Packages</th>
                <th style={{ width: "17%", padding: "12px 12px", textAlign: "center", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Status / LR</th>
                <th style={{ width: "12%", padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Dispatched By</th>
                <th style={{ width: "24%", padding: "12px 12px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLists.map((list) => (
                <tr key={list.id} style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                  <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      #{list.dispatchId || list.id?.slice(-6).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {list.dispatchedAt ? new Date(list.dispatchedAt).toLocaleDateString() : "N/A"}{" "}
                      {list.dispatchedAt ? new Date(list.dispatchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </td>

                  <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                    <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 500 }}>{list.partyName || "N/A"}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {list.partyCity || "City not set"}{list.partyPhone ? ` | ${list.partyPhone}` : ""}
                    </div>
                  </td>

                  <td style={{ padding: "12px", textAlign: "center", verticalAlign: "top" }}>
                    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "6px 10px", borderRadius: 10, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: "#0f172a", lineHeight: 1 }}>{getBoxOrBailCount(list)}</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#475569", textTransform: "uppercase" }}>Box/Bail</span>
                    </div>
                  </td>

                  <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word", textAlign: "center" }}>
                    {(() => {
                      const statusMeta = getStatusMeta(list.status);
                      return (
                        <div style={{ display: "grid", placeItems: "center", gap: 7, minHeight: 52 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 130,
                              padding: "5px 12px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                              background: statusMeta.bg,
                              color: statusMeta.color,
                              border: `1px solid ${statusMeta.border}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {statusMeta.label}
                          </span>
                          <div style={{ fontSize: 12, color: list.lrNo ? "#0f172a" : "#94a3b8", fontWeight: 400, lineHeight: 1.2, minHeight: 14, textAlign: "center", width: "100%" }}>
                            {list.lrNo ? `LR: ${list.lrNo}` : "LR not assigned"}
                          </div>
                        </div>
                      );
                    })()}
                  </td>

                  <td style={{ padding: "12px", verticalAlign: "top", wordBreak: "break-word" }}>
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b" }}>{list.dispatchedBy || "N/A"}</div>
                  </td>

                  <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {list.status === "Packed" && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {editingInvoiceId === list.id ? (
                            <>
                              <input
                                placeholder="Enter Invoice No."
                                value={tempInvoice[list.id || ""] || ""}
                                onChange={(e) => setTempInvoice((prev) => ({ ...prev, [list.id || ""]: e.target.value }))}
                                style={{ width: 130, padding: "7px 9px", border: "1.5px solid #dbe4f0", borderRadius: 9, fontSize: 12, outline: "none", background: "#fff" }}
                              />
                              <button
                                onClick={() => list.id && handleSaveInvoice(list.id)}
                                disabled={updating === list.id}
                                style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", opacity: updating === list.id ? 0.7 : 1 }}
                              >
                                {updating === list.id ? "Saving..." : "Save Invoice"}
                              </button>
                              <button
                                onClick={() => setEditingInvoiceId(null)}
                                style={{ background: "#fff", color: "#475569", border: "1px solid #dbe4f0", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 400, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : editingLrId === list.id ? (
                            <>
                              <input
                                placeholder="Enter LR No."
                                value={tempLr[list.id || ""] || ""}
                                onChange={(e) => setTempLr((prev) => ({ ...prev, [list.id || ""]: e.target.value }))}
                                style={{ width: 130, padding: "7px 9px", border: "1.5px solid #dbe4f0", borderRadius: 9, fontSize: 12, outline: "none", background: "#fff" }}
                              />
                              <button
                                onClick={() => list.id && handleFinalize(list.id)}
                                disabled={updating === list.id}
                                style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", opacity: updating === list.id ? 0.7 : 1 }}
                              >
                                {updating === list.id ? "Saving..." : "Save LR"}
                              </button>
                              <button
                                onClick={() => setEditingLrId(null)}
                                style={{ background: "#fff", color: "#475569", border: "1px solid #dbe4f0", padding: "7px 10px", borderRadius: 9, fontSize: 12, fontWeight: 400, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : renderActionRow(list, false)}
                        </div>
                      )}

                      {list.status === "Completed" && <div>{renderActionRow(list, false)}</div>}
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
        </div>
      )}

      {viewingList && (
        <div
          onClick={() => setViewingList(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 28px 50px rgba(15,23,42,0.25)",
              padding: isMobile ? 14 : 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: "#0f172a" }}>Dispatch Full View</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  #{viewingList.dispatchId || viewingList.id?.slice(-6).toUpperCase() || "N/A"} · {viewingList.status}
                </div>
              </div>
              <button
                onClick={() => setViewingList(null)}
                style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer" }}
                aria-label="Close"
                title="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>Party</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{viewingList.partyName || "N/A"}</div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>Dispatched By</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{viewingList.dispatchedBy || "N/A"}</div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>Invoice</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{String(viewingList.invoiceNo || "").trim() || "Not set"}</div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>LR Number</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{String(viewingList.lrNo || "").trim() || "Not set"}</div>
              </div>
            </div>

            <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", marginBottom: 12 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>Dispatch Summary</div>
              <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                Items: {(viewingList.items || []).length} · Qty: {(viewingList.items || []).reduce((sum, item) => sum + (Number((item as { quantity?: number })?.quantity) || 0), 0)}
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1.2fr .9fr .5fr" : "1.5fr 1fr .7fr", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Item</div>
                <div style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>SKU</div>
                <div style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", textAlign: "right" }}>Qty</div>
              </div>
              {(viewingList.items || []).length > 0 ? (
                (viewingList.items || []).map((item, idx) => {
                  const row = item as { productName?: string; sku?: string; quantity?: number };
                  return (
                    <div key={`${row.sku || "sku"}-${idx}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "1.2fr .9fr .5fr" : "1.5fr 1fr .7fr", borderBottom: idx === (viewingList.items || []).length - 1 ? "none" : "1px solid #f1f5f9" }}>
                      <div style={{ padding: "10px 12px", fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{row.productName || "N/A"}</div>
                      <div style={{ padding: "10px 12px", fontSize: 12, color: "#334155", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{row.sku || "N/A"}</div>
                      <div style={{ padding: "10px 12px", fontSize: 13, color: "#0f172a", fontWeight: 700, textAlign: "right" }}>{Number(row.quantity) || 0}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: "18px 12px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>No dispatch items found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredLists.length > 0 && (
        <div
          style={{
            padding: isMobile ? "12px" : "14px 12px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: isMobile ? 11 : 12, color: "#64748b" }}>
            Page {currentPage} of {totalPages}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              style={{
                background: "#fff",
                color: "#334155",
                border: "1px solid #dbe4f0",
                padding: isMobile ? "9px 11px" : "7px 11px",
                borderRadius: 9,
                fontSize: isMobile ? 11 : 12,
                fontWeight: 400,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: "#fff",
                color: "#334155",
                border: "1px solid #dbe4f0",
                padding: isMobile ? "9px 11px" : "7px 11px",
                borderRadius: 9,
                fontSize: isMobile ? 11 : 12,
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
  );
}

