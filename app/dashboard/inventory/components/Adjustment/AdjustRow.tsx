"use client";

import React, { useState } from "react";
import { ref, update } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { FONT, Product } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import SmartImage from "../../../../components/SmartImage";

export default function AdjustRow({ p, user, onRefresh, isMobile, mobileCard }: {
    p: Product,
    user: { uid: string; name: string },
    onRefresh?: () => void,
    isMobile?: boolean,
    mobileCard?: boolean
}) {
    const [qty, setQty] = useState<number | "">(1);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState<{ mode: "add" | "remove" } | null>(null);

    const handleAdjust = async () => {
        if (!confirm) return;
        const mode = confirm.mode;
        const q = Number(qty);
        if (!q || q <= 0) { setConfirm(null); return; }
        if (mode === "remove" && q > p.stock) { alert("Cannot remove more stock than available."); setConfirm(null); return; }

        setSaving(true);
        try {
            const newStock = mode === "add" ? p.stock + q : p.stock - q;
            let autoStatus = p.status || "active";
            if (autoStatus === "active" || autoStatus === "low-stock" || autoStatus === "out-of-stock") {
                if (newStock <= 0) autoStatus = "out-of-stock";
                else if (newStock <= p.minStock) autoStatus = "low-stock";
                else autoStatus = "active";
            }
            await update(ref(db, `inventory/${p.id}`), {
                stock: newStock,
                status: autoStatus,
                updatedAt: Date.now(),
                updatedBy: user.uid,
                updatedByName: user.name
            });

            await logActivity({
                type: "inventory",
                action: "adjustment",
                title: mode === "add" ? "Stock Added" : "Stock Removed",
                description: `${user.name} ${mode === "add" ? "added" : "removed"} ${q} ${p.unit || "units"} for "${p.productName}". New stock: ${newStock}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "staff",
                metadata: { productId: p.id, adjustment: q, mode, newStock }
            });

            setQty(1);
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
            <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "40px", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", animation: "scaleIn 0.2s ease-out" }}>
                <div style={{ width: 80, height: 80, borderRadius: 40, background: confirm.mode === "add" ? "#f0fdf4" : "#fef2f2", color: confirm.mode === "add" ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 24px" }}>
                    {confirm.mode === "add" ? "^" : "v"}
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 400, color: "#0f172a", margin: "0 0 8px", fontFamily: FONT }}>{confirm.mode === "add" ? "Add Stock" : "Remove Stock"}?</h3>
                <p style={{ fontSize: 15, color: "#64748b", fontWeight: 400, margin: "0 0 24px", fontFamily: FONT, lineHeight: 1.5 }}>You are adjusting <strong>{qty} {p.unit || "units"}</strong> for:<br /><span style={{ color: "#1e293b", fontWeight: 400 }}>{p.productName}</span></p>
                <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 30, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 10, background: "#fff", border: "1.5px solid #e2e8f0", overflow: "hidden", flexShrink: 0 }}>
                        {p.imageUrl && <SmartImage src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Stock</div>
                        <div style={{ fontSize: 18, fontWeight: 400, color: "#1e293b" }}>{p.stock} -&gt; <span style={{ color: confirm.mode === "add" ? "#10b981" : "#ef4444" }}>{confirm.mode === "add" ? p.stock + Number(qty) : p.stock - Number(qty)}</span></div>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button onClick={handleAdjust} style={{ width: "100%", padding: "16px", background: confirm.mode === "add" ? "#10b981" : "#ef4444", color: "#fff", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 400, cursor: "pointer", transition: "all 0.2s", boxShadow: `0 4px 12px ${confirm.mode === "add" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>Confirm {confirm.mode === "add" ? "Addition" : "Removal"}</button>
                    <button onClick={() => setConfirm(null)} style={{ width: "100%", padding: "16px", background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 14, fontSize: 16, fontWeight: 400, cursor: "pointer" }}>Cancel</button>
                </div>
            </div>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </div>
    );

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
                        <div style={{ fontSize: 17, fontWeight: 400, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontFamily: FONT }}>
                            {p.stock}
                        </div>
                        {p.stock <= p.minStock && p.stock > 0 && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 400 }}>Low Stock</div>}
                    </div>
                </div>
                <div style={{ marginTop: 10 }}>
                    {controls}
                </div>
                {confirmModal}
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
                    <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 400, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontFamily: FONT }}>
                        {p.stock}
                    </div>
                    {!isMobile && p.stock <= p.minStock && p.stock > 0 && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 400 }}>Low Stock</span>}
                </td>
                <td style={{ padding: isMobile ? "12px 10px" : "14px 16px", textAlign: "right", position: "relative" }}>
                    {controls}
                </td>
            </tr>
            {confirmModal}
        </>
    );
}
