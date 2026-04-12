"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FONT, Product, Category, Collection } from "../../types";
import { Card, PageHeader, EmptyState } from "../../ui";
import SmartImage from "../../../../components/SmartImage";

export default function Overview({ products, categories, collections, loading, onNavigate, currentName, userRole, canCreate, canDelete, isMobile, isDesktop }: {
    products: Product[];
    categories: Category[];
    collections: Collection[];
    loading: boolean;
    onNavigate: (view: any) => void;
    currentName: string;
    userRole: string;
    canCreate?: boolean;
    canDelete?: boolean;
    isMobile?: boolean;
    isDesktop?: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [groupBy, setGroupBy] = useState<"category" | "collection">("category");
    const [breakdownSearch, setBreakdownSearch] = useState("");
    const [stockPage, setStockPage] = useState(1);
    const STOCK_ITEMS_PER_PAGE = 4;

    useEffect(() => {
        setStockPage(1);
    }, [searchTerm, filterStatus]);

    const stats = useMemo(() => {
        const total = products.length;
        const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
        const inStock = products.filter(p => p.stock > p.minStock).length;
        const outStock = products.filter(p => p.stock <= 0).length;
        const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
        const totalVal = products.reduce((s, p) => s + (p.price * p.stock), 0);

        const list = [
            { label: "Total Products", value: total, color: "#6366f1" },
            { label: "In Stock Items", value: inStock, color: "#10b981" },
            { label: "Low Stock Alert", value: lowStock, color: "#f59e0b" },
            { label: "Out of Stock", value: outStock, color: "#ef4444" },
        ];

        if (userRole === "admin") {
            list.splice(1, 0, { label: "Total Stock", value: totalStock, color: "#3b82f6" });
            list.push({ label: "Total Asset Value", value: totalVal, color: "#8b5cf6" });
        }
        return { list, total, totalStock, totalVal };
    }, [products, userRole]);

    const breakdownData = useMemo(() => {
        let breakdown: Record<string, number> = {};
        if (groupBy === "category") {
            products.forEach(p => {
                if (p.category) breakdown[p.category] = (breakdown[p.category] || 0) + 1;
            });
        } else {
            products.forEach(p => {
                if (p.collection) breakdown[p.collection] = (breakdown[p.collection] || 0) + 1;
            });
        }
        return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    }, [products, groupBy]);

    const filteredBreakdown = useMemo(() =>
        breakdownData.filter(([name]: [string, number]) => name.toLowerCase().includes(breakdownSearch.toLowerCase())),
        [breakdownData, breakdownSearch]
    );

    const recentProducts = useMemo(() =>
        [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
        [products]
    );

    const filteredStock = useMemo(() =>
        products.filter((p: Product) => {
            const matchQ = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
            let matchS = true;
            if (filterStatus === "in-stock") matchS = p.stock > p.minStock;
            if (filterStatus === "low-stock") matchS = p.stock > 0 && p.stock <= p.minStock;
            if (filterStatus === "out-stock") matchS = p.stock <= 0;
            return matchQ && matchS;
        }),
        [products, searchTerm, filterStatus]
    );

    const paginatedStock = useMemo(() => {
        const sorted = [...filteredStock].sort((a, b) => (a.stock || 0) - (b.stock || 0));
        return sorted.slice((stockPage - 1) * STOCK_ITEMS_PER_PAGE, stockPage * STOCK_ITEMS_PER_PAGE);
    }, [filteredStock, stockPage]);

    const totalStockPages = Math.ceil(filteredStock.length / STOCK_ITEMS_PER_PAGE);

    return (
        <div>
            <PageHeader title="Inventory Overview" sub="Comprehensive view of your entire stock status." />

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(${userRole === 'admin' ? 6 : 4}, 1fr)`, gap: 14, marginBottom: 20 }}>
                {stats.list.map((s, i) => (
                    <Card key={i}>
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, marginBottom: 10 }} />
                            <div style={{ fontSize: 20, fontWeight: 400, color: "#1e293b", fontFamily: FONT, marginBottom: 3 }}>
                                {s.label === "Total Asset Value" && typeof s.value === "number" ? `₹${s.value.toLocaleString("en-IN")}` : s.value}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT, fontWeight: 400 }}>{s.label}</div>
                        </div>
                    </Card>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: 18 }}>
                <Card>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ fontSize: 14, fontWeight: 400, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Recently Added Products</div>
                        {recentProducts.length === 0 ? (
                            <EmptyState title="No Products" sub="Your inventory is currently empty." />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {recentProducts.map((p) => (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {p.imageUrl ? <SmartImage src={p.imageUrl} alt={p.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, color: "#cbd5e1" }}>📦</span>}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{p.productName}</div>
                                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>SKU: {p.sku} • Stock: {p.stock}</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>₹{p.price.toLocaleString("en-IN")}</div>
                                            <div style={{ fontSize: 11, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontWeight: 400, fontFamily: FONT }}>
                                                {p.stock <= 0 ? "Out of Stock" : p.stock <= p.minStock ? "Low Stock" : "In Stock"}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                <Card>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <div style={{ fontSize: 14, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Products by {groupBy === "category" ? "Category" : "Collection"}</div>
                            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, background: "#f8fafc", outline: "none", cursor: "pointer" }}>
                                <option value="category">Category</option>
                                <option value="collection">Collection</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                                <input type="text" placeholder={groupBy === "category" ? "Search Category" : "Search Collection"} value={breakdownSearch} onChange={(e) => setBreakdownSearch(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, outline: "none", fontFamily: FONT, color: "#1e293b", boxShadow: "none" }} />
                            </div>
                        </div>
                        {filteredBreakdown.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: FONT, textAlign: "center", padding: "20px 0" }}>No data found.</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {filteredBreakdown.slice(0, 10).map(([key, count]) => {
                                    const pct = Math.round((count / stats.total) * 100);
                                    return (
                                        <div key={key}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 400, color: "#334155", fontFamily: FONT }}>{key}</span>
                                                <span style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, fontWeight: 400 }}>{count} items ({pct}%)</span>
                                            </div>
                                            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                                                <div style={{ width: `${pct}%`, height: "100%", background: groupBy === "category" ? "linear-gradient(90deg,#6366f1,#8b5cf6)" : "linear-gradient(90deg,#8b5cf6,#d946ef)", borderRadius: 99 }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div style={{ marginTop: 18 }}>
                <Card>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                            <div style={{ fontSize: 15, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Detailed Stock Levels</div>
                            <div style={{ display: "flex", gap: 10, flex: 1, maxWidth: 480, justifyContent: "flex-end", alignItems: "center" }}>
                                <input type="text" placeholder="Search Product / SKU" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: "8px 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 13, fontFamily: FONT, outline: "none", background: "#f8fafc", flex: 1 }} />
                                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: FONT, outline: "none", background: "#f8fafc", cursor: "pointer", width: 140 }}>
                                    <option value="all">All Status</option>
                                    <option value="in-stock">In Stock</option>
                                    <option value="low-stock">Low Stock</option>
                                    <option value="out-stock">Out of Stock</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ overflowX: "auto", maxHeight: 400 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Product Details</th>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>SKU</th>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", textAlign: "right" }}>Pieces</th>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", textAlign: "right" }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedStock.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "#fff", overflow: "hidden", border: "1.5px solid #f1f5f9", flexShrink: 0 }}>{p.imageUrl ? <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div>📦</div>}</div>
                                                    <div><div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{p.productName}</div><div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>{p.category}</div></div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", fontSize: 13, color: "#64748b", fontFamily: FONT }}>{p.sku}</td>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", fontSize: 15, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#1e293b", fontWeight: 500, fontFamily: FONT, textAlign: "right" }}>{p.stock}</td>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: p.stock <= 0 ? "#fff1f2" : p.stock <= p.minStock ? "#fffbeb" : "#f0fdf4", color: p.stock <= 0 ? "#e11d48" : p.stock <= p.minStock ? "#d97706" : "#15803d", fontWeight: 500, fontSize: 11, fontFamily: FONT }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                                                    {p.stock <= 0 ? "Out" : p.stock <= p.minStock ? "Low" : "In"}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalStockPages > 1 && (
                            <div style={{ padding: "20px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 12, color: "#64748b" }}>Showing {((stockPage - 1) * STOCK_ITEMS_PER_PAGE) + 1} - {Math.min(stockPage * STOCK_ITEMS_PER_PAGE, filteredStock.length)} of {filteredStock.length}</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button disabled={stockPage === 1} onClick={() => setStockPage(p => p - 1)} style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: stockPage === 1 ? "#f8fafc" : "#fff", fontSize: 12 }}>Prev</button>
                                    <button disabled={stockPage >= totalStockPages} onClick={() => setStockPage(p => p + 1)} style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: stockPage >= totalStockPages ? "#f8fafc" : "#fff", fontSize: 12 }}>Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
