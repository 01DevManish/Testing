"use client";

import React, { useState, useMemo } from "react";
import { ref, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { FONT, Product, CATEGORIES, STATUS_CONFIG } from "./types";
import { BtnPrimary, BtnGhost, Card, Badge, EmptyState, Spinner, PageHeader } from "./ui";

type SortKey = "productName" | "category" | "price" | "stock" | "status" | "createdAt";
type SortDir = "asc" | "desc";

interface Props {
    products: Product[];
    loading: boolean;
    isAdminOrManager: boolean;
    onEdit: (p: Product) => void;
    onRefresh: () => void;
    onCreateNew: () => void;
    onProductsChange: (updated: Product[]) => void;
}

export default function ProductList({
    products, loading, isAdminOrManager, onEdit, onRefresh, onCreateNew, onProductsChange,
}: Props) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCat, setFilterCat] = useState("all");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "out-of-stock">("all");
    const [sortKey, setSortKey] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState("");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const filtered = useMemo(() => {
        let list = [...products];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(p => p.productName?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
        }
        if (filterCat !== "all") list = list.filter(p => p.category === filterCat);
        if (filterStatus !== "all") list = list.filter(p => p.status === filterStatus);
        list.sort((a, b) => {
            let va: any = a[sortKey]; let vb: any = b[sortKey];
            if (sortKey === "createdAt") { va = va || 0; vb = vb || 0; }
            if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
        return list;
    }, [products, searchTerm, filterCat, filterStatus, sortKey, sortDir]);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    };
    const toggleAll = () => {
        setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this product permanently?")) return;
        try {
            await remove(ref(db, `inventory/${id}`));
            onProductsChange(products.filter(p => p.id !== id));
        } catch (err) { console.error(err); }
    };

    const executeBulk = async () => {
        if (!bulkAction || selectedIds.size === 0) return;
        if (bulkAction === "delete") {
            if (!confirm(`Delete ${selectedIds.size} products?`)) return;
            await Promise.all(Array.from(selectedIds).map(id => remove(ref(db, `inventory/${id}`))));
            onProductsChange(products.filter(p => !selectedIds.has(p.id)));
        } else {
            await Promise.all(Array.from(selectedIds).map(id => update(ref(db, `inventory/${id}`), { status: bulkAction, updatedAt: Date.now() })));
            onProductsChange(products.map(p => selectedIds.has(p.id) ? { ...p, status: bulkAction as Product["status"] } : p));
        }
        setSelectedIds(new Set()); setBulkAction("");
    };

    const exportCSV = () => {
        const headers = ["Name", "SKU", "Category", "Brand", "Price", "Cost", "Stock", "Unit", "HSN", "GST%", "Status"];
        const rows = filtered.map(p => [p.productName, p.sku, p.category, p.brand, p.price, p.costPrice, p.stock, p.unit, p.hsnCode, p.gstRate, p.status]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `products_${new Date().toISOString().slice(0, 10)}.csv` });
        a.click();
    };

    const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

    const th: React.CSSProperties = {
        padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8",
        borderBottom: "1px solid #e2e8f0", background: "#fafbfc",
        cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", fontFamily: FONT,
    };
    const td: React.CSSProperties = {
        padding: "12px 14px", fontSize: 13, color: "#475569",
        borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", fontFamily: FONT,
    };

    return (
        <div>
            <PageHeader title="All Products" sub={`${filtered.length} products`}>
                {isAdminOrManager && <BtnPrimary onClick={onCreateNew}>+ Add Product</BtnPrimary>}
                <BtnGhost onClick={exportCSV} style={{ fontSize: 13 }}>Export CSV</BtnGhost>
                <BtnGhost onClick={onRefresh} style={{ fontSize: 13 }}>Refresh</BtnGhost>
            </PageHeader>

            <Card>
                {/* Filters */}
                <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e2e8f0" }}>
                    {/* Search */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, marginBottom: 10 }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "#94a3b8", flexShrink: 0 }}>
                            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        <input type="text" placeholder="Search name, SKU, brand..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 13, width: "100%", fontFamily: FONT }} />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}>
                                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Filter chips */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                            style={{ padding: "6px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 12, fontFamily: FONT, cursor: "pointer", outline: "none" }}>
                            <option value="all">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {(["all", "active", "inactive", "out-of-stock"] as const).map(f => (
                            <button key={f} onClick={() => setFilterStatus(f)}
                                style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", border: `1.5px solid ${filterStatus === f ? "#6366f1" : "#e2e8f0"}`, background: filterStatus === f ? "rgba(99,102,241,0.08)" : "#fff", color: filterStatus === f ? "#6366f1" : "#94a3b8" }}>
                                {f === "all" ? "All Status" : STATUS_CONFIG[f]?.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bulk action bar */}
                {selectedIds.size > 0 && isAdminOrManager && (
                    <div style={{ padding: "9px 16px", background: "rgba(99,102,241,0.04)", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", fontFamily: FONT }}>{selectedIds.size} selected</span>
                        <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                            style={{ padding: "5px 10px", fontSize: 12, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontFamily: FONT, cursor: "pointer", outline: "none" }}>
                            <option value="">Action...</option>
                            <option value="active">Set Active</option>
                            <option value="inactive">Set Inactive</option>
                            <option value="delete">Delete</option>
                        </select>
                        <BtnPrimary onClick={executeBulk} disabled={!bulkAction} style={{ padding: "5px 12px", fontSize: 12 }}>Apply</BtnPrimary>
                        <BtnGhost onClick={() => setSelectedIds(new Set())} style={{ padding: "5px 10px", fontSize: 12 }}>Clear</BtnGhost>
                    </div>
                )}

                {/* Table */}
                {loading ? <Spinner /> : filtered.length === 0 ? (
                    <EmptyState title="No products found" sub={products.length === 0 ? "Add your first product to get started." : "Try adjusting your search or filters."} />
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                            <thead>
                                <tr>
                                    {isAdminOrManager && (
                                        <th style={{ ...th, width: 38, textAlign: "center" }}>
                                            <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll}
                                                style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                                        </th>
                                    )}
                                    <th style={th} onClick={() => handleSort("productName")}>Product{sortArrow("productName")}</th>
                                    <th style={th} onClick={() => handleSort("category")}>Category{sortArrow("category")}</th>
                                    <th style={th}>Unit / HSN</th>
                                    <th style={th} onClick={() => handleSort("price")}>Price{sortArrow("price")}</th>
                                    <th style={th} onClick={() => handleSort("stock")}>Stock{sortArrow("stock")}</th>
                                    <th style={th}>GST</th>
                                    <th style={th} onClick={() => handleSort("status")}>Status{sortArrow("status")}</th>
                                    {isAdminOrManager && <th style={{ ...th, textAlign: "right" }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => {
                                    const isLow = p.stock > 0 && p.stock <= (p.minStock || 5);
                                    const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
                                    return (
                                        <tr key={p.id} style={{ background: "#fff" }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                                            {isAdminOrManager && (
                                                <td style={{ ...td, textAlign: "center", width: 38 }}>
                                                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                                                        style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                                                </td>
                                            )}
                                            <td style={td}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#e2e8f0,#cbd5e1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
                                                        {p.imageUrl
                                                            ? <img src={p.imageUrl} alt={p.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                            : <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", fontFamily: FONT }}>IMG</span>}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{p.productName}</div>
                                                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>SKU: {p.sku}{p.brand ? ` · ${p.brand}` : ""}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={td}>
                                                {p.category
                                                    ? <span style={{ padding: "3px 8px", background: "#f1f5f9", borderRadius: 6, fontSize: 11, fontWeight: 500, color: "#475569", fontFamily: FONT }}>{p.category}</span>
                                                    : <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily: FONT }}>—</span>}
                                            </td>
                                            <td style={td}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{p.unit || "PCS"}</div>
                                                {p.hsnCode && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>HSN: {p.hsnCode}</div>}
                                            </td>
                                            <td style={td}>
                                                <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13, fontFamily: FONT }}>Rs.{Number(p.price || 0).toLocaleString("en-IN")}</div>
                                                {p.costPrice > 0 && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>Cost: Rs.{Number(p.costPrice).toLocaleString("en-IN")}</div>}
                                            </td>
                                            <td style={td}>
                                                <div style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT, color: isLow ? "#f59e0b" : p.stock <= 0 ? "#ef4444" : "#1e293b" }}>{p.stock}</div>
                                                {isLow && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 500, fontFamily: FONT }}>Low</div>}
                                                {p.stock <= 0 && <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 500, fontFamily: FONT }}>Empty</div>}
                                            </td>
                                            <td style={td}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", fontFamily: FONT }}>{p.gstRate ?? 18}%</span>
                                            </td>
                                            <td style={td}>
                                                <Badge color={sc.color} bg={sc.bg}>{sc.label}</Badge>
                                            </td>
                                            {isAdminOrManager && (
                                                <td style={{ ...td, textAlign: "right" }}>
                                                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                                        <button onClick={() => onEdit(p)} style={{ padding: "5px 10px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: FONT, cursor: "pointer" }}>Edit</button>
                                                        <button onClick={() => handleDelete(p.id)} style={{ padding: "5px 10px", background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, fontSize: 12, fontFamily: FONT, cursor: "pointer" }}>Del</button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                {!loading && filtered.length > 0 && (
                    <div style={{ padding: "10px 18px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#94a3b8", flexWrap: "wrap", gap: 6, fontFamily: FONT }}>
                        <span>Showing {filtered.length} of {products.length}</span>
                        <span>Total Value: Rs.{filtered.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.stock) || 0), 0).toLocaleString("en-IN")}</span>
                    </div>
                )}
            </Card>
        </div>
    );
}