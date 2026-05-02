"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FONT, Product } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import SmartImage from "../../../../components/SmartImage";
import { touchDataSignal } from "../../../../lib/dataSignals";
import { upsertDataItems } from "../../../../lib/dynamoDataApi";
import { appendInventoryAdjustmentLog, fetchInventoryAdjustmentLogsBySku, InventoryAdjustmentLog } from "../../../../lib/inventoryAdjustmentLogs";

export default function AdjustRow({ p, user, onRefresh, isMobile, mobileCard }: {
    p: Product,
    user: { uid: string; name: string },
    onRefresh?: () => void,
    isMobile?: boolean,
    mobileCard?: boolean
}) {
    const REMOVE_REASONS = ["Ecom Sale", "Retail Sale", "Remove Stock"];
    const ADD_REASONS = ["New Production", "New Job Work", "Dispatch Return", "Ecom Return", "Purchase"];
    const [qty, setQty] = useState<number | "">(1);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState<{ mode: "add" | "remove" } | null>(null);
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [logsOpen, setLogsOpen] = useState(false);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logs, setLogs] = useState<InventoryAdjustmentLog[]>([]);
    const stockState =
        p.stock <= 0
            ? { label: "Out Stock", color: "#7f1d1d" }
            : p.stock <= p.minStock
                ? { label: "Low Stock", color: "#78350f" }
                : { label: "In Stock", color: "#14532d" };

    const handleAdjust = async () => {
        if (!confirm) return;
        const mode = confirm.mode;
        const q = Number(qty);
        if (!q || q <= 0) { setConfirm(null); return; }
        if (mode === "remove" && q > p.stock) { alert("Cannot remove more stock than available."); setConfirm(null); return; }
        if (!reason) { alert("Please select a reason."); return; }
        if (!note.trim()) { alert("Please add a note."); return; }

        setSaving(true);
        try {
            const newStock = mode === "add" ? p.stock + q : p.stock - q;
            let autoStatus = p.status || "active";
            if (autoStatus === "active" || autoStatus === "low-stock" || autoStatus === "out-of-stock") {
                if (newStock <= 0) autoStatus = "out-of-stock";
                else if (newStock <= p.minStock) autoStatus = "low-stock";
                else autoStatus = "active";
            }
            await upsertDataItems("inventory", [{
                ...p,
                id: p.id,
                stock: newStock,
                status: autoStatus,
                updatedAt: Date.now(),
                updatedBy: user.uid,
                updatedByName: user.name,
                lastAdjustmentReason: reason,
                lastAdjustmentNote: note.trim().slice(0, 60),
                lastAdjustmentAt: Date.now(),
                lastAdjustmentByName: user.name
            }]);
            await touchDataSignal("inventory");
            await appendInventoryAdjustmentLog({
                sku: p.sku,
                productId: p.id,
                productName: p.productName,
                mode,
                source: "manual",
                quantity: q,
                previousStock: p.stock,
                newStock,
                reason,
                note: note.trim().slice(0, 60),
                createdByUid: user.uid,
                createdByName: user.name,
            });

            await logActivity({
                type: "inventory",
                action: "adjustment",
                title: mode === "add" ? "Stock Added" : "Stock Removed",
                description: `${user.name} ${mode === "add" ? "added" : "removed"} ${q} ${p.unit || "units"} for "${p.productName}" (${reason}). Note: ${note.trim().slice(0, 60)}. New stock: ${newStock}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "staff",
                metadata: { productId: p.id, adjustment: q, mode, newStock, reason, note: note.trim().slice(0, 60) }
            });

            setQty(1);
            setReason("");
            setNote("");
            setConfirm(null);
            onRefresh?.();
        } catch (e) {
            console.error(e);
            alert("Update failed");
            setConfirm(null);
        } finally {
            setSaving(false);
        }
    };

    const loadLogs = async () => {
        setLogsLoading(true);
        try {
            const rows = await fetchInventoryAdjustmentLogsBySku(p.sku);
            setLogs(rows);
        } catch (error) {
            console.error("Failed to load inventory logs:", error);
            alert("Could not load SKU logs.");
        } finally {
            setLogsLoading(false);
        }
    };

    const openLogs = async () => {
        setLogsOpen(true);
        await loadLogs();
    };

    const formatLogTime = (value?: number): string => {
        const ts = Number(value || 0);
        if (!ts) return "-";
        return new Date(ts).toLocaleString();
    };

    const controls = (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: isMobile ? 6 : 8, flexWrap: "nowrap" }}>
            <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: isMobile ? 44 : 60, padding: isMobile ? "6px 4px" : "8px", border: "1.5px solid #e2e8f0", borderRadius: 8, textAlign: "center", fontSize: isMobile ? 12 : 14, fontWeight: 400, outline: "none" }}
            />
            <button onClick={() => setConfirm({ mode: "add" })} disabled={saving} style={{ padding: isMobile ? "6px 10px" : "8px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontSize: isMobile ? 11 : 13, fontWeight: 400, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
            <button onClick={() => setConfirm({ mode: "remove" })} disabled={saving} style={{ padding: isMobile ? "6px 10px" : "8px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: isMobile ? 11 : 13, fontWeight: 400, cursor: "pointer", whiteSpace: "nowrap" }}>- Remove</button>
        </div>
    );

    const confirmModal = confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 18, padding: "24px", textAlign: "center", boxShadow: "0 18px 34px -16px rgba(0,0,0,0.28)", animation: "scaleIn 0.2s ease-out" }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: confirm.mode === "add" ? "#f0fdf4" : "#fef2f2", color: confirm.mode === "add" ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px" }}>
                    {confirm.mode === "add" ? "^" : "v"}
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 400, color: "#0f172a", margin: "0 0 6px", fontFamily: FONT }}>{confirm.mode === "add" ? "Add Stock" : "Remove Stock"}?</h3>
                <p style={{ fontSize: 13, color: "#64748b", fontWeight: 400, margin: "0 0 14px", fontFamily: FONT, lineHeight: 1.45 }}>You are adjusting <strong>{qty} {p.unit || "units"}</strong> for:<br /><span style={{ color: "#1e293b", fontWeight: 400 }}>{p.productName}</span></p>
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 10, background: "#fff", border: "1.5px solid #e2e8f0", overflow: "hidden", flexShrink: 0 }}>
                        {p.imageUrl && <SmartImage src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Stock</div>
                        <div style={{ fontSize: 16, fontWeight: 400, color: "#1e293b" }}>{p.stock} -&gt; <span style={{ color: confirm.mode === "add" ? "#10b981" : "#ef4444" }}>{confirm.mode === "add" ? p.stock + Number(qty) : p.stock - Number(qty)}</span></div>
                    </div>
                </div>
                <div style={{ display: "grid", gap: 9, textAlign: "left", marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Reason *</div>
                        <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", fontSize: 13, color: "#0f172a", background: "#fff" }}>
                            <option value="">Select reason</option>
                            {(confirm?.mode === "add" ? ADD_REASONS : REMOVE_REASONS).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Note * ({note.length}/60)</div>
                        <input
                            value={note}
                            maxLength={60}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Short note about this adjustment"
                            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", fontSize: 13, color: "#0f172a", background: "#fff" }}
                        />
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button onClick={handleAdjust} style={{ width: "100%", padding: "12px", background: confirm.mode === "add" ? "#10b981" : "#ef4444", color: "#fff", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", boxShadow: `0 4px 12px ${confirm.mode === "add" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>Confirm {confirm.mode === "add" ? "Addition" : "Removal"}</button>
                    <button onClick={() => setConfirm(null)} style={{ width: "100%", padding: "12px", background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 11, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
                </div>
            </div>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </div>
    );

    const confirmModalPortal =
        confirmModal && typeof document !== "undefined"
            ? createPortal(confirmModal, document.body)
            : null;

    const logsModal =
        logsOpen ? (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ width: "100%", maxWidth: 760, maxHeight: "86vh", overflow: "hidden", background: "#fff", borderRadius: 16, boxShadow: "0 18px 34px -16px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>SKU Logs</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>{p.sku} - {p.productName}</div>
                        </div>
                        <button type="button" onClick={() => setLogsOpen(false)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#334155" }}>Close</button>
                    </div>
                    <div style={{ padding: 12, overflowY: "auto" }}>
                        {logsLoading ? (
                            <div style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>Loading logs...</div>
                        ) : logs.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>No logs found for this SKU.</div>
                        ) : (
                            logs.map((row) => (
                                <div key={row.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 10, background: "#fff" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: row.mode === "add" ? "#059669" : "#dc2626" }}>
                                            {row.mode === "add" ? "Stock Added" : "Stock Removed"} - {row.quantity}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#64748b" }}>{formatLogTime(row.createdAt)}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 4 }}>
                                        Stock: {row.previousStock} -&gt; {row.newStock}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 4 }}>
                                        Reason: {row.reason || "-"}{row.note ? ` | Note: ${row.note}` : ""}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 4 }}>
                                        Source: {row.source}
                                        {row.partyName ? ` | Party: ${row.partyName}` : ""}
                                        {row.dispatchId ? ` | Dispatch: ${row.dispatchId}` : ""}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>
                                        By: {row.createdByName || "System"}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        ) : null;

    const logsModalPortal =
        logsModal && typeof document !== "undefined"
            ? createPortal(logsModal, document.body)
            : null;

    if (mobileCard) {
        return (
            <div style={{ borderBottom: "1px solid #f1f5f9", background: saving ? "#f8fafc" : "#fff", opacity: saving ? 0.6 : 1, transition: "0.2s", padding: "12px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f1f5f9", overflow: "hidden", flexShrink: 0 }}>
                            {p.imageUrl && <SmartImage src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, lineHeight: 1.3, fontWeight: 400, color: "#1e293b", fontFamily: FONT, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.productName}</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, marginTop: 2 }}>
                                SKU: {p.sku} | {p.unit || "PCS"}{p.size ? ` | ${p.size}` : ""}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: stockState.color, fontFamily: FONT }}>
                            {p.stock}
                        </div>
                        <div style={{ fontSize: 10, color: stockState.color, fontWeight: 700 }}>{stockState.label}</div>
                    </div>
                </div>
                <div style={{ marginTop: 10 }}>
                    {controls}
                </div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        onClick={() => void openLogs()}
                        style={{
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: 11,
                            color: "#334155",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        View Logs
                    </button>
                </div>
                {(p.lastAdjustmentReason || p.lastAdjustmentNote) && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
                        {p.lastAdjustmentReason || "Update"}{p.lastAdjustmentNote ? `: ${p.lastAdjustmentNote}` : ""}
                    </div>
                )}
                {confirmModalPortal}
                {logsModalPortal}
            </div>
        );
    }

    return (
        <>
            <tr style={{ borderBottom: "1px solid #f1f5f9", background: saving ? "#f8fafc" : "#fff", opacity: saving ? 0.6 : 1, transition: "0.2s" }}>
                <td style={{ padding: isMobile ? "12px 10px" : "14px 16px" }}>
                    <div style={{ display: "flex", gap: isMobile ? 8 : 12, alignItems: "center", minWidth: 0 }}>
                        <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 8, background: "#f1f5f9", overflow: "hidden", flexShrink: 0 }}>
                            {p.imageUrl && <SmartImage src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: isMobile ? 12 : 13, lineHeight: 1.3, fontWeight: 400, color: "#1e293b", fontFamily: FONT, display: "-webkit-box", WebkitLineClamp: isMobile ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.productName}</div>
                            <div style={{ fontSize: isMobile ? 10 : 11, color: "#64748b", fontFamily: FONT, whiteSpace: isMobile ? "normal" : "nowrap", lineHeight: 1.25 }}>
                                SKU: {p.sku}
                                <span style={{ whiteSpace: "nowrap" }}> | {p.unit || "PCS"}</span>
                                {p.size ? <span style={{ whiteSpace: "nowrap" }}> | {p.size}</span> : null}
                            </div>
                        </div>
                    </div>
                </td>
                <td style={{ padding: isMobile ? "12px 8px" : "14px 16px" }}>
                    <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: stockState.color, fontFamily: FONT }}>
                        {p.stock}
                    </div>
                    {!isMobile && <span style={{ fontSize: 10, color: stockState.color, fontWeight: 700 }}>{stockState.label}</span>}
                </td>
                <td style={{ padding: isMobile ? "12px 8px" : "14px 16px", maxWidth: 300 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => void openLogs()}
                            title="View SKU logs"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                border: "1.5px solid #cbd5e1",
                                background: "#fff",
                                color: "#334155",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 14
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </button>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "#334155", fontWeight: 500, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.lastAdjustmentReason || "-"}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                                {p.lastAdjustmentNote || "No note"}
                            </div>
                        </div>
                    </div>
                </td>
                <td style={{ padding: isMobile ? "12px 10px" : "14px 16px", textAlign: "right", position: "relative" }}>
                    {controls}
                </td>
            </tr>
            {confirmModalPortal}
            {logsModalPortal}
        </>
    );
}

