"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ref, remove, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { FONT, Product, Category, Collection, STATUS_CONFIG } from "./types";
import { BtnPrimary, BtnGhost, Card, Badge, EmptyState, Spinner, PageHeader } from "./ui";
import { logActivity } from "../../lib/activityLogger";
import { deleteImage } from "./imageService";
import ExcelJS from "exceljs";


type SortKey = "productName" | "category" | "collection" | "price" | "stock" | "status" | "createdAt";
type SortDir = "asc" | "desc";

interface Props {
    products: Product[];
    categories: Category[];
    collections: Collection[];
    loading: boolean;
    isAdminOrManager: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (p: Product) => void;
    onRefresh: () => void;
    user: { uid: string; name: string; role?: string };
    onCreateNew: () => void;
    onProductsChange: (updated: Product[]) => void;
    onShareCatalog: (selected: Product[]) => void;
    isMobile?: boolean;
    isDesktop?: boolean;
}

export default function ProductList({
    products, categories, collections, user, loading, isAdminOrManager, canCreate, canEdit, canDelete, onEdit, onRefresh, onCreateNew, onProductsChange, onShareCatalog, isMobile, isDesktop,
}: Props) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCat, setFilterCat] = useState("all");
    const [filterCol, setFilterCol] = useState("all");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "out-of-stock" | "low-stock">("all");
    const [sortKey, setSortKey] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const filtered = useMemo(() => {
        let list = [...products];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(p => 
                p.productName?.toLowerCase().includes(q) || 
                p.sku?.toLowerCase().includes(q) || 
                p.brand?.toLowerCase().includes(q) ||
                p.category?.toLowerCase().includes(q) ||
                p.collection?.toLowerCase().includes(q)
            );
        }
        if (filterCat !== "all") list = list.filter(p => p.category === filterCat);
        if (filterCol !== "all") list = list.filter(p => p.collection === filterCol);
        if (filterStatus !== "all") {
            if (filterStatus === "out-of-stock") {
                list = list.filter(p => (p.status as string) === "out-of-stock" || (p.stock || 0) <= 0);
            } else if (filterStatus === "low-stock") {
                list = list.filter(p => (p.status as string) === "low-stock" || ((p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 5)));
            } else {
                list = list.filter(p => (p.status as string) === filterStatus);
            }
        }
        list.sort((a, b) => {
            let va: any = a[sortKey]; let vb: any = b[sortKey];
            if (sortKey === "createdAt") { va = va || 0; vb = vb || 0; }
            if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
        return list;
    }, [products, searchTerm, filterCat, filterCol, filterStatus, sortKey, sortDir]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCat, filterCol, filterStatus]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    };
    const toggleAll = () => {
        setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) return alert("You do not have permission to delete products.");
        const p = products.find(x => x.id === id);
        if (!p) return;
        if (!confirm(`Delete "${p.productName}" permanently?`)) return;
        try {
            await remove(ref(db, `inventory/${id}`));
            
            // Delete images from Cloudinary
            if (p.imageUrl) await deleteImage(p.imageUrl);
            if (p.imageUrls && p.imageUrls.length > 0) {
                await Promise.all(p.imageUrls.map(url => deleteImage(url)));
            }
            
            // Log activity
            await logActivity({
                type: "inventory",
                action: "delete",
                title: "Product Deleted",
                description: `Product "${p.productName}" (SKU: ${p.sku}) was deleted by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { productId: id, productName: p.productName, sku: p.sku }
            });

            onProductsChange(products.filter(p => p.id !== id));
        } catch (err) { console.error(err); }
    };

    const executeBulk = async () => {
        if (!bulkAction || selectedIds.size === 0) return;
        if (bulkAction === "delete") {
            if (!canDelete) return alert("You do not have permission to delete products.");
            if (!confirm(`Delete ${selectedIds.size} products?`)) return;
            const selectedProducts = products.filter(p => selectedIds.has(p.id));
            
            // Delete from Firebase and Cloudinary
            await Promise.all(selectedProducts.map(async (p) => {
                await remove(ref(db, `inventory/${p.id}`));
                if (p.imageUrl) await deleteImage(p.imageUrl);
                if (p.imageUrls && p.imageUrls.length > 0) {
                    await Promise.all(p.imageUrls.map(url => deleteImage(url)));
                }
            }));
            
            // Log activity
            await logActivity({
                type: "inventory",
                action: "delete",
                title: "Bulk Products Deleted",
                description: `${selectedIds.size} products were deleted in bulk by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { count: selectedIds.size, productNames: selectedProducts.map(p => p.productName).join(", ") }
            });

            onProductsChange(products.filter(p => !selectedIds.has(p.id)));
        } else {
            await Promise.all(Array.from(selectedIds).map(id => update(ref(db, `inventory/${id}`), { status: bulkAction, updatedAt: Date.now() })));
            
            // Log activity
            await logActivity({
                type: "inventory",
                action: "status_change",
                title: "Bulk Status Updated",
                description: `Status for ${selectedIds.size} products was updated to "${bulkAction}" by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { count: selectedIds.size, newStatus: bulkAction }
            });

            onProductsChange(products.map(p => selectedIds.has(p.id) ? { ...p, status: bulkAction as Product["status"] } : p));
        }
        setSelectedIds(new Set()); setBulkAction("");
    };

    const exportExcelForBulkEdit = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Inventory_Bulk_Edit");

            const headers = [
                "Product Name*", "SKU*", "Category", "Collection", "Brand",
                "Description", "Selling Price (Rs.)*", "Wholesale Price (Rs.)", "MRP (Rs.)", "Cost Price (Rs.)",
                "GST Rate", "HSN Code", "Opening Stock", "Min Stock (Alert)", "Unit",
                "Size", "Thumbnail URL", "Status"
            ];

            worksheet.addRow(headers);

            // Styling
            worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
            worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
            worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
            worksheet.getRow(1).height = 25;
            worksheet.columns = headers.map(() => ({ width: 22 }));

            // Data mapping
            filtered.forEach(p => {
                worksheet.addRow([
                    p.productName || "",
                    p.sku || "",
                    p.category || "",
                    p.collection || "",
                    p.brand || "",
                    p.description || "",
                    p.price || 0,
                    p.wholesalePrice || 0,
                    p.mrp || 0,
                    p.costPrice || 0,
                    `${p.gstRate || 18}%`,
                    p.hsnCode || "",
                    p.stock || 0,
                    p.minStock || 5,
                    p.unit || "PCS",
                    p.size || "",
                    p.imageUrl || "",
                    p.status || "active"
                ]);
            });

            // Unlock all cells first
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.protection = { locked: false };
                });
            });

            // Lock specific columns: SKU(2), Category(3), Collection(4), Brand(5), GST(11), HSN(12)
            // WE UNLOCKED: Size(16) and Thumbnail(17) per user request to allow bulk editing of these fields.
            const lockedCols = [2, 3, 4, 5, 11, 12];


            lockedCols.forEach(colIndex => {
                const col = worksheet.getColumn(colIndex);
                col.eachCell({ includeEmpty: true }, (cell) => {
                    cell.protection = { locked: true };
                });
            });

            // Protect the sheet
            await worksheet.protect("", {
                selectLockedCells: true,
                selectUnlockedCells: true,
                formatCells: true,
                formatColumns: true,
                formatRows: true,
                insertRows: false,
                insertColumns: false,
                deleteRows: false,
                deleteColumns: false
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `inventory_bulk_edit_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to export Excel file.");
        }
    };

    const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

    const th: React.CSSProperties = {
        padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 400,
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                    {canCreate && <BtnPrimary onClick={onCreateNew} style={isMobile ? { flex: 1, minWidth: 120 } : {}}>+ Add Product</BtnPrimary>}
                    <BtnGhost onClick={exportExcelForBulkEdit} style={{ fontSize: 13, flex: isMobile ? 1 : "initial" }}>Export for Bulk Edit</BtnGhost>
                </div>
            </PageHeader>

            <Card>
                {/* Filters */}
                <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e2e8f0" }}>
                    {/* Search */}
                    <div style={{ 
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", 
                        background: searchTerm ? "#fff" : "#f8fafc", 
                        border: "1.5px solid", 
                        borderColor: searchTerm ? "#6366f1" : "#e2e8f0",
                        borderRadius: 16, 
                        marginBottom: 16, 
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: searchTerm ? "0 4px 12px rgba(99,102,241,0.12)" : "0 2px 4px rgba(0,0,0,0.02)",
                    }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ color: searchTerm ? "#6366f1" : "#94a3b8", flexShrink: 0, transition: "color 0.3s" }}>
                            <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Product / SKU"
                            style={{ 
                                background: "transparent", border: "none", outline: "none", 
                                color: "#1e293b", fontSize: 13, width: "100%", fontFamily: FONT,
                                fontWeight: 400,
                                // Override global focus styles effectively
                                boxShadow: "none"
                            }} 
                        />
                        <style>{`
                            input::placeholder { color: #94a3b8; opacity: 0.8; }
                            /* Force disable global focus rectangle for this specific input */
                            div > input[type="text"]:focus { 
                                border-color: transparent !important; 
                                box-shadow: none !important; 
                            }
                        `}</style>
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm("")} 
                                style={{ 
                                    background: "#f1f5f9", border: "none", cursor: "pointer", 
                                    color: "#64748b", padding: 4, borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
                                onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}
                            >
                                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Filter chips */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                            style={{ padding: "6px 10px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 12, fontFamily: FONT, cursor: "pointer", outline: "none", flex: isMobile ? 1 : "initial" }}>
                            <option value="all">All Categories</option>
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <select value={filterCol} onChange={e => setFilterCol(e.target.value)}
                            style={{ padding: "6px 10px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#475569", fontSize: 12, fontFamily: FONT, cursor: "pointer", outline: "none", flex: isMobile ? 1 : "initial" }}>
                            <option value="all">All Collections</option>
                            {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2, flex: isMobile ? "0 0 100%" : "initial" }}>
                            {(["all", "active", "inactive", "out-of-stock"] as const).map(f => (
                                <button key={f} onClick={() => setFilterStatus(f)}
                                    style={{ padding: "5px 10px", borderRadius: 20, fontSize: 10, fontWeight: 400, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap", border: `1.5px solid ${filterStatus === f ? "#6366f1" : "#e2e8f0"}`, background: filterStatus === f ? "rgba(99,102,241,0.08)" : "#fff", color: filterStatus === f ? "#6366f1" : "#94a3b8" }}>
                                    {f === "all" ? "All" : STATUS_CONFIG[f]?.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bulk action bar */}
                {selectedIds.size > 0 && isAdminOrManager && (
                    <div style={{ padding: "9px 16px", background: "rgba(99,102,241,0.04)", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 400, color: "#6366f1", fontFamily: FONT }}>{selectedIds.size} selected</span>
                        <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                            style={{ padding: "5px 10px", fontSize: 12, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontFamily: FONT, cursor: "pointer", outline: "none" }}>
                            <option value="">Action...</option>
                            <option value="active">Set Active</option>
                            <option value="inactive">Set Inactive</option>
                            {canDelete && <option value="delete">Delete</option>}
                        </select>
                        <BtnPrimary onClick={executeBulk} disabled={!bulkAction} style={{ padding: "5px 12px", fontSize: 12 }}>Apply</BtnPrimary>
                        <button 
                            onClick={() => onShareCatalog(Array.from(selectedIds).map(id => products.find(p => p.id === id)!))}
                            style={{ 
                                padding: "5px 14px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", 
                                color: "#fff", border: "none", borderRadius: 8, fontSize: 12, 
                                fontWeight: 400, fontFamily: FONT, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                                <path d="M12.5 10.5V12.5H2.5V2.5H4.5M12.5 7.5V10.5M12.5 10.5H9.5M12.5 10.5L8.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Share Catalog
                        </button>
                        <BtnGhost onClick={() => setSelectedIds(new Set())} style={{ padding: "5px 10px", fontSize: 12 }}>Clear</BtnGhost>
                    </div>
                )}

                {/* Selection bar for non-admins (only for sharing) */}
                {selectedIds.size > 0 && !isAdminOrManager && (
                    <div style={{ padding: "9px 16px", background: "rgba(99,102,241,0.04)", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 400, color: "#6366f1", fontFamily: FONT }}>{selectedIds.size} selected</span>
                        <button 
                            onClick={() => onShareCatalog(Array.from(selectedIds).map(id => products.find(p => p.id === id)!))}
                            style={{ 
                                padding: "5px 14px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", 
                                color: "#fff", border: "none", borderRadius: 8, fontSize: 12, 
                                fontWeight: 400, fontFamily: FONT, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                                <path d="M12.5 10.5V12.5H2.5V2.5H4.5M12.5 7.5V10.5M12.5 10.5H9.5M12.5 10.5L8.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Share Catalog
                        </button>
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
                                    <th style={{ ...th, width: 38, textAlign: "center" }}>
                                        <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll}
                                            style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                                    </th>
                                    <th style={th} onClick={() => handleSort("productName")}>Product{sortArrow("productName")}</th>
                                    <th style={th} onClick={() => handleSort("collection")}>Collection{sortArrow("collection")}</th>
                                    <th style={th}>Unit / HSN</th>
                                    <th style={th} onClick={() => handleSort("price")}>Price{sortArrow("price")}</th>
                                    <th style={th} onClick={() => handleSort("stock")}>Stock{sortArrow("stock")}</th>
                                    <th style={th}>GST</th>
                                    <th style={th} onClick={() => handleSort("status")}>Status{sortArrow("status")}</th>
                                    {isAdminOrManager && <th style={{ ...th, textAlign: "right" }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.map(p => {
                                    const isLow = p.stock > 0 && p.stock <= (p.minStock || 5);
                                    const isOut = (p.stock || 0) <= 0;
                                    const effectiveStatus = isOut ? "out-of-stock" : (isLow ? "low-stock" : p.status);
                                    const sc = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.active;
                                    return (
                                        <tr key={p.id} style={{ background: "#fff" }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                                            {/* Show checkbox even for non-admins for catalog sharing */}
                                            <td style={{ ...td, textAlign: "center", width: 38 }}>
                                                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                                                    style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                                            </td>
                                            <td style={td}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#e2e8f0,#cbd5e1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
                                                        {p.imageUrl ? (
                                                            <img 
                                                                src={p.imageUrl} 
                                                                alt={p.productName} 
                                                                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                                                                onError={e => { 
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = "none";
                                                                    const parent = target.parentElement;
                                                                    if (parent) {
                                                                        const placeholder = document.createElement("span");
                                                                        placeholder.innerText = "N/A";
                                                                        placeholder.style.fontSize = "9px";
                                                                        placeholder.style.color = "#94a3b8";
                                                                        placeholder.style.fontFamily = "inherit";
                                                                        parent.appendChild(placeholder);
                                                                    }
                                                                }} 
                                                            />
                                                        ) : (
                                                            <span style={{ fontSize: 9, fontWeight: 400, color: "#94a3b8", fontFamily: FONT }}>IMG</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{p.productName}</div>
                                                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>SKU: {p.sku}{p.brand ? ` · ${p.brand}` : ""}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={td}>
                                                {p.collection
                                                    ? <span style={{ padding: "3px 8px", background: "rgba(99,102,241,0.06)", borderRadius: 6, fontSize: 11, fontWeight: 500, color: "#6366f1", fontFamily: FONT, border: "1px solid rgba(99,102,241,0.1)" }}>{p.collection}</span>
                                                    : <span style={{ color: "#cbd5e1", fontSize: 12, fontFamily: FONT }}>—</span>}
                                            </td>
                                            <td style={td}>
                                                <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{p.unit || "PCS"}</div>
                                                {p.hsnCode && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>HSN: {p.hsnCode}</div>}
                                            </td>
                                            <td style={td}>
                                                <div style={{ fontWeight: 400, color: "#1e293b", fontSize: 13, fontFamily: FONT }}>Rs.{Number(p.price || 0).toLocaleString("en-IN")}</div>
                                                {user.role === "admin" && p.costPrice > 0 && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>Cost: Rs.{Number(p.costPrice).toLocaleString("en-IN")}</div>}
                                            </td>
                                            <td style={td}>
                                                <div style={{ fontWeight: 400, fontSize: 14, fontFamily: FONT, color: isLow ? "#f59e0b" : p.stock <= 0 ? "#ef4444" : "#1e293b" }}>{p.stock}</div>
                                                {isLow && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 400, fontFamily: FONT }}>Low</div>}
                                                {p.stock <= 0 && <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 400, fontFamily: FONT }}>Empty</div>}
                                            </td>
                                            <td style={td}>
                                                <span style={{ fontSize: 13, fontWeight: 400, color: "#6366f1", fontFamily: FONT }}>{p.gstRate ?? 18}%</span>
                                            </td>
                                            <td style={td}>
                                                <Badge color={sc.color} bg={sc.bg}>{sc.label}</Badge>
                                            </td>
                                            {(canEdit || canDelete) && (
                                                <td style={{ ...td, textAlign: "right" }}>
                                                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                                        {canEdit && <button onClick={() => onEdit(p)} style={{ padding: "5px 10px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: FONT, cursor: "pointer" }}>Edit</button>}
                                                        {canDelete && <button onClick={() => handleDelete(p.id)} style={{ padding: "5px 10px", background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, fontSize: 12, fontFamily: FONT, cursor: "pointer" }}>Del</button>}
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

                {/* Footer with Pagination */}
                {!loading && filtered.length > 0 && (
                    <div style={{ 
                        padding: "16px 20px", 
                        borderTop: "1px solid #f1f5f9", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        fontSize: 12, 
                        color: "#64748b", 
                        flexWrap: "wrap", 
                        gap: 16, 
                        fontFamily: FONT,
                        background: "#fff"
                    }}>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            Showing <span style={{ color: "#1e293b", fontWeight: 500 }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of <span style={{ color: "#1e293b", fontWeight: 500 }}>{filtered.length} items</span>

                        </div>

                        {/* Pagination Controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{ 
                                    padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", 
                                    color: currentPage === 1 ? "#cbd5e1" : "#475569", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 11, transition: "0.2s"
                                }}
                            >
                                Previous
                            </button>
                            
                            <div style={{ display: "flex", gap: 4 }}>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1))
                                    .map((p, i, arr) => (
                                        <React.Fragment key={p}>
                                            {i > 0 && arr[i-1] !== p - 1 && <span style={{ padding: "0 4px" }}>...</span>}
                                            <button 
                                                onClick={() => setCurrentPage(p)}
                                                style={{ 
                                                    width: 28, height: 28, borderRadius: 8, border: "1.5px solid", 
                                                    borderColor: currentPage === p ? "#6366f1" : "transparent",
                                                    background: currentPage === p ? "rgba(99,102,241,0.08)" : "transparent",
                                                    color: currentPage === p ? "#6366f1" : "#64748b",
                                                    fontWeight: currentPage === p ? 600 : 400,
                                                    cursor: "pointer", fontSize: 11, transition: "0.2s"
                                                }}
                                            >
                                                {p}
                                            </button>
                                        </React.Fragment>
                                    ))
                                }
                            </div>

                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                style={{ 
                                    padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: currentPage === totalPages ? "#f8fafc" : "#fff", 
                                    color: currentPage === totalPages ? "#cbd5e1" : "#475569", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 11, transition: "0.2s"
                                }}
                            >
                                Next
                            </button>
                        </div>

                        <div style={{ flex: 1, textAlign: "right", color: "#94a3b8", fontWeight: 400 }}>
                            Page {currentPage} of {totalPages}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}