"use client";

import React, { useState, useEffect } from "react";
import { FONT, Product, Collection } from "../../types";
import { Card, PageHeader } from "../../ui";
import AdjustRow from "./AdjustRow";

export default function InventoryAdjustment({ products, collections, user, onDone, isMobile }: {
    products: Product[];
    collections: Collection[];
    user: { uid: string; name: string };
    onDone?: () => void;
    isMobile?: boolean;
}) {
    const safeLower = (value: unknown) => String(value ?? "").toLowerCase();

    const [search, setSearch] = useState("");
    const [filterCol, setFilterCol] = useState("all");
    const [filterSize, setFilterSize] = useState("all");
    const [successMsg, setSuccessMsg] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 4;

    const sizes = [
        "Single", "Double", "Queen", "King", "Super King",
        "Single Fitted", "Double Fitted", "Queen Fitted", "King Fitted"
    ];

    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(""), 4000);
            return () => clearTimeout(t);
        }
    }, [successMsg]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterCol, filterSize]);

    const filtered = products.filter((p) => {
        if (!p) return false;
        const q = safeLower(search);
        const matchSearch =
            safeLower(p.productName).includes(q) ||
            safeLower(p.sku).includes(q) ||
            safeLower(p.brand).includes(q) ||
            safeLower(p.category).includes(q) ||
            safeLower(p.collection).includes(q);

        const matchSize = filterSize === "all" || p.unit === filterSize || p.size === filterSize;

        let matchCol = true;
        if (filterCol !== "all") {
            matchCol = (p.collection === filterCol);
        }

        return matchSearch && matchSize && matchCol;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div style={{ position: "relative" }}>
            <style>{`
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            {successMsg && (
                <div style={{
                    position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
                    background: "#10b981", color: "#fff", padding: "16px 24px", borderRadius: 16,
                    boxShadow: "0 20px 25px -5px rgba(16,185,129,0.2), 0 8px 10px -6px rgba(16,185,129,0.1)",
                    zIndex: 3000, fontWeight: 400, fontSize: 15, fontFamily: FONT,
                    display: "flex", alignItems: "center", gap: 12,
                    animation: "slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>OK</span>
                    {successMsg}
                </div>
            )}
            <PageHeader title="Inventory Adjustment" sub="Quickly add or remove stock and adjust quantities in one place." />

            <Card style={{ marginBottom: 20 }}>
                <div style={{ padding: isMobile ? "12px" : "16px 20px", display: "flex", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap", alignItems: "center", overflowX: "visible" }}>
                    <div style={{ flex: 1, minWidth: isMobile ? "100%" : 240, width: isMobile ? "100%" : undefined }}>
                        <div style={{
                            display: "flex", alignItems: "center", gap: isMobile ? 8 : 10, padding: isMobile ? "8px 10px" : "10px 16px",
                            background: search ? "#fff" : "#f8fafc",
                            border: "1.5px solid",
                            borderColor: search ? "#6366f1" : "#e2e8f0",
                            borderRadius: 12,
                            transition: "all 0.2s ease",
                            boxShadow: search ? "0 4px 10px rgba(99,102,241,0.08)" : "none",
                        }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: search ? "#6366f1" : "#94a3b8", flexShrink: 0 }}>
                                <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <input
                                type="text" placeholder="Search Product / SKU" value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: isMobile ? 12 : 14, width: "100%", fontFamily: FONT, boxShadow: "none" }}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", padding: 2 }}>
                                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ width: isMobile ? "calc(50% - 4px)" : undefined, flexShrink: 0, padding: isMobile ? "8px 8px" : "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: isMobile ? 11 : 13, fontFamily: FONT, outline: "none", cursor: "pointer", background: "#f8fafc" }}>
                        <option value="all">All Collections</option>
                        {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <select value={filterSize} onChange={e => setFilterSize(e.target.value)} style={{ width: isMobile ? "calc(50% - 4px)" : undefined, flexShrink: 0, padding: isMobile ? "8px 8px" : "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: isMobile ? 11 : 13, fontFamily: FONT, outline: "none", cursor: "pointer", background: "#f8fafc" }}>
                        <option value="all">All Sizes / Units</option>
                        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </Card>

            <Card>
                {isMobile ? (
                    <div>
                        {paginatedItems.map(p => (
                            <AdjustRow
                                key={p.id}
                                p={p}
                                user={user}
                                onRefresh={() => {
                                    onDone?.();
                                    setSuccessMsg(`Stock updated for ${p.productName}`);
                                }}
                                isMobile={true}
                                mobileCard={true}
                            />
                        ))}
                        {filtered.length === 0 && (
                            <div style={{ textAlign: "center", padding: "32px 14px", color: "#94a3b8", fontSize: 14 }}>No products match your filters.</div>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: "auto", maxHeight: "60vh", WebkitOverflowScrolling: "touch" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                <tr>
                                    <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Product & Info</th>
                                    <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Current Stock</th>
                                    <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Implicate</th>
                                    <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", textAlign: "right" }}>Adjust Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.map(p => (
                                    <AdjustRow
                                        key={p.id}
                                        p={p}
                                        user={user}
                                        onRefresh={() => {
                                            onDone?.();
                                            setSuccessMsg(`Stock updated for ${p.productName}`);
                                        }}
                                        isMobile={false}
                                    />
                                ))}
                            </tbody>
                        </table>
                        {filtered.length === 0 && (
                            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 14 }}>No products match your filters.</div>
                        )}
                    </div>
                )}

                {totalPages > 1 && (
                    <div style={{ padding: isMobile ? "14px 12px" : "16px 20px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap", background: "#fff", borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontFamily: FONT }}>
                            Showing <strong>{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</strong> - <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> products
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", color: currentPage === 1 ? "#cbd5e1" : "#475569", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: FONT, transition: "0.2s" }}>Previous</button>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1e293b", padding: "0 12px", fontFamily: FONT, background: "#f1f5f9", borderRadius: 10 }}><span style={{ fontWeight: 600 }}>{currentPage}</span><span style={{ color: "#94a3b8" }}>/</span><span>{totalPages}</span></div>
                            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: currentPage >= totalPages ? "#f8fafc" : "#fff", color: currentPage >= totalPages ? "#cbd5e1" : "#475569", cursor: currentPage >= totalPages ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: FONT, transition: "0.2s" }}>Next</button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
