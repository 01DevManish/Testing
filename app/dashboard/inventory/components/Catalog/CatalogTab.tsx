"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Product, Category, Collection, FONT } from "../../types";
import { BtnPrimary, BtnGhost, Card, Badge, EmptyState, Spinner, PageHeader } from "../../ui";
import ShareModal from "./ShareModal";
import { resolveS3Url } from "../Products/imageService";
import { MOBILE_CATALOG_GRID } from "../mobile/mobileGrid";

interface CatalogTabProps {
    products: Product[];
    categories: Category[];
    collections: Collection[];
    brands: { id: string, name: string, logoUrl?: string }[];
    loading: boolean;
    isMobile?: boolean;
    isDesktop?: boolean;
    isAdmin?: boolean;
}

export default function CatalogTab({ products, categories, collections, brands, loading, isMobile, isDesktop, isAdmin }: CatalogTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedCollection, setSelectedCollection] = useState("all");
    const [selectedSize, setSelectedSize] = useState("all");
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareOutOfStock, setShareOutOfStock] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [proxyFallbackIds, setProxyFallbackIds] = useState<Set<string>>(new Set());
    const ITEMS_PER_PAGE = 24;
    const canToggleOutOfStock = Boolean(isAdmin);
    const includeOutOfStock = canToggleOutOfStock ? shareOutOfStock : false;

    const uniqueCategories = useMemo(() => {
        const cats = products.map(p => p.category).filter(Boolean) as string[];
        return Array.from(new Set(cats)).sort();
    }, [products]);

    const uniqueCollections = useMemo(() => {
        const cols = products.map(p => p.collection).filter(Boolean) as string[];
        return Array.from(new Set(cols)).sort();
    }, [products]);

    const uniqueSizes = useMemo(() => {
        const sizes = products.map(p => p.size).filter(Boolean) as string[];
        return Array.from(new Set(sizes)).sort();
    }, [products]);

    const filtered = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
            const matchesColl = selectedCollection === "all" || p.collection === selectedCollection;
            const matchesSize = selectedSize === "all" || p.size === selectedSize;
            const matchesStock = includeOutOfStock ? true : (p.stock || 0) > 0;
            return matchesSearch && matchesCat && matchesColl && matchesSize && matchesStock;
        });
    }, [products, searchTerm, selectedCategory, selectedCollection, selectedSize, includeOutOfStock]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory, selectedCollection, selectedSize, includeOutOfStock]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginatedItems = useMemo(
        () => filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
        [filtered, currentPage]
    );

    const finalSelectedProducts = useMemo(() => {
        return includeOutOfStock ? selectedProducts : selectedProducts.filter(p => (p.stock || 0) > 0);
    }, [selectedProducts, includeOutOfStock]);

    const getBaseImageUrl = (p: Product): string => {
        const raw =
            p.imageUrl ||
            (Array.isArray(p.imageUrls) ? p.imageUrls.find((u) => typeof u === "string" && u.trim()) : "") ||
            "";
        if (!raw) return "";
        return resolveS3Url(raw);
    };

    const getDisplayImageSrc = (p: Product): string => {
        const base = getBaseImageUrl(p);
        if (!base) return "/placeholder-prod.png";
        if (proxyFallbackIds.has(p.id)) {
            return `/api/proxy-image?url=${encodeURIComponent(base)}`;
        }
        return base;
    };

    const handleToggleSelect = (p: Product) => {
        setSelectedProducts(prev => {
            const exists = prev.find(item => item.id === p.id);
            if (exists) return prev.filter(item => item.id !== p.id);
            return [...prev, p];
        });
    };

    const handleSelectAll = () => {
        const visibleIds = new Set(paginatedItems.map(item => item.id));
        const allVisibleSelected = paginatedItems.length > 0 && paginatedItems.every(item => selectedProducts.some(sel => sel.id === item.id));
        if (allVisibleSelected) {
            setSelectedProducts(prev => prev.filter(item => !visibleIds.has(item.id)));
            return;
        }
        const merged = [...selectedProducts];
        paginatedItems.forEach(item => {
            if (!merged.some(sel => sel.id === item.id)) merged.push(item);
        });
        setSelectedProducts(merged);
    };

    if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Spinner /></div>;

    return (
        <div style={{ paddingBottom: selectedProducts.length > 0 ? 100 : 20 }}>
            <PageHeader 
                title="Product Catalog" 
                sub="Browse, filter, and select products to share with your customers."
            />

            {/* Filters */}
            <Card style={{ marginBottom: 24, padding: isMobile ? "12px 14px" : "16px 20px" }}>
                {isMobile ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.8fr)", gap: 10, alignItems: "end" }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={labelStyle}>Search Products</div>
                                <input 
                                    style={{ ...inputStyle, fontSize: 13, padding: "9px 12px" }} 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search Product / SKU"
                                />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={labelStyle}>Size</div>
                                <select 
                                    style={{ ...inputStyle, fontSize: 13, padding: "9px 12px" }}
                                    value={selectedSize}
                                    onChange={e => setSelectedSize(e.target.value)}
                                >
                                    <option value="all">All Sizes</option>
                                    {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, alignItems: "end" }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={labelStyle}>Category</div>
                                <select 
                                    style={{ ...inputStyle, fontSize: 13, padding: "9px 12px" }}
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                >
                                    <option value="all">All Categories</option>
                                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={labelStyle}>Collection</div>
                                <select 
                                    style={{ ...inputStyle, fontSize: 13, padding: "9px 12px" }}
                                    value={selectedCollection}
                                    onChange={e => setSelectedCollection(e.target.value)}
                                >
                                    <option value="all">All Collections</option>
                                    {uniqueCollections.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                            {isAdmin && (
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "#f8fafc", padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0", transition: "all 0.2s" }}>
                                    <input 
                                        type="checkbox" 
                                        checked={shareOutOfStock}
                                        onChange={e => setShareOutOfStock(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer", margin: 0 }}
                                    />
                                    <span style={{ fontSize: 12, color: "#475569", fontWeight: 500, fontFamily: FONT }}>Share Out of Stock</span>
                                </label>
                            )}
                            <BtnGhost 
                                onClick={() => { 
                                    setSearchTerm(""); 
                                    setSelectedCategory("all"); 
                                    setSelectedCollection("all"); 
                                    setSelectedSize("all");
                                    setShareOutOfStock(false);
                                }}
                                style={{ padding: "9px 14px" }}
                            >
                                Reset
                            </BtnGhost>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 240 }}>
                            <div style={labelStyle}>Search Products</div>
                            <input 
                                style={inputStyle} 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search Product / SKU"
                            />
                        </div>
                        <div style={{ width: 180 }}>
                            <div style={labelStyle}>Category</div>
                            <select 
                                style={inputStyle}
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                            >
                                <option value="all">All Categories</option>
                                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div style={{ width: 180 }}>
                            <div style={labelStyle}>Collection</div>
                            <select 
                                style={inputStyle}
                                value={selectedCollection}
                                onChange={e => setSelectedCollection(e.target.value)}
                            >
                                <option value="all">All Collections</option>
                                {uniqueCollections.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div style={{ width: 150 }}>
                            <div style={labelStyle}>Size</div>
                            <select 
                                style={inputStyle}
                                value={selectedSize}
                                onChange={e => setSelectedSize(e.target.value)}
                            >
                                <option value="all">All Sizes</option>
                                {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {isAdmin && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "flex-end", height: 40 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "#f8fafc", padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0", transition: "all 0.2s" }}>
                                    <input 
                                        type="checkbox" 
                                        checked={shareOutOfStock}
                                        onChange={e => setShareOutOfStock(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer", margin: 0 }}
                                    />
                                    <span style={{ fontSize: 13, color: "#475569", fontWeight: 500, fontFamily: FONT }}>Share Out of Stock</span>
                                </label>
                            </div>
                        )}
                        <div style={{ alignSelf: "flex-end" }}>
                            <BtnGhost 
                                onClick={() => { 
                                    setSearchTerm(""); 
                                    setSelectedCategory("all"); 
                                    setSelectedCollection("all"); 
                                    setSelectedSize("all");
                                    setShareOutOfStock(false);
                                }}
                                style={{ padding: "10px 16px" }}
                            >
                                Reset
                            </BtnGhost>
                        </div>
                    </div>
                )}
            </Card>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 400 }}>
                    Showing <strong>{filtered.length}</strong> products
                </div>
                <button 
                    onClick={handleSelectAll}
                    style={{ background: "none", border: "none", color: "#6366f1", fontSize: 13, fontWeight: 400, cursor: "pointer" }}
                >
                    {paginatedItems.length > 0 && paginatedItems.every(item => selectedProducts.some(sel => sel.id === item.id)) ? "Deselect All" : "Select All Visible"}
                </button>
            </div>

            {filtered.length === 0 ? (
                <EmptyState 
                    title="No products found" 
                    sub="Try adjusting your search or filters to find what you're looking for."
                />
            ) : (
                <div style={{ ...gridStyle, gridTemplateColumns: isMobile ? MOBILE_CATALOG_GRID : "repeat(auto-fill, minmax(220px, 1fr))", gap: isMobile ? 8 : 20 }}>
                    {paginatedItems.map(p => {
                        const isSelected = !!selectedProducts.find(item => item.id === p.id);
                        const baseImageUrl = getBaseImageUrl(p);
                        return (
                            <div 
                                key={p.id} 
                                onClick={() => handleToggleSelect(p)}
                                style={{ 
                                    ...productCard, 
                                    borderColor: isSelected ? "#6366f1" : "transparent",
                                    boxShadow: isSelected ? "0 0 0 2px #6366f1" : "0 4px 6px -1px rgba(0,0,0,0.05)"
                                }}
                            >
                                <div style={imageContainer}>
                                    {baseImageUrl ? (
                                        <img 
                                            src={getDisplayImageSrc(p)} 
                                            alt={p.productName} 
                                            style={imageStyle} 
                                            loading={paginatedItems.indexOf(p) < 8 ? "eager" : "lazy"}
                                            {...({ fetchpriority: paginatedItems.indexOf(p) < 8 ? "high" : "auto" } as any)}
                                            onError={() => {
                                                setProxyFallbackIds((prev) => {
                                                    if (prev.has(p.id)) return prev;
                                                    const next = new Set(prev);
                                                    next.add(p.id);
                                                    return next;
                                                });
                                            }}
                                        />
                                    ) : (
                                        <div style={{ ...imageStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11, letterSpacing: "0.08em", background: "linear-gradient(145deg,#f8fafc,#eef2f7)" }}>
                                            IMG
                                        </div>
                                    )}
                                    {isSelected && (
                                        <div style={checkOverlay}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: isMobile ? "8px 8px" : "12px 14px" }}>
                                    <div style={{ fontSize: isMobile ? 8 : 11, fontWeight: 400, color: "#6366f1", textTransform: "uppercase", marginBottom: 2 }}>{p.category}</div>
                                    <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 400, color: "#0f172a", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.productName}</div>
                                    <div style={{ fontSize: isMobile ? 9 : 12, color: "#64748b", marginBottom: isMobile ? 6 : 10 }}>SKU: {p.sku}</div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: isMobile ? 10 : 15, fontWeight: 400, color: "#0f172a" }}>₹{p.price}</div>
                                        <Badge 
                                            color={p.stock > 0 ? "#10b981" : "#991b1b"} 
                                            bg={p.stock > 0 ? "rgba(16,185,129,0.1)" : "rgba(153,27,27,0.12)"}
                                        >
                                            {p.stock} In Stock
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {filtered.length > ITEMS_PER_PAGE && (
                <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                        Page {currentPage} of {totalPages}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", color: currentPage === 1 ? "#cbd5e1" : "#334155", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 12 }}
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: currentPage === totalPages ? "#f8fafc" : "#fff", color: currentPage === totalPages ? "#cbd5e1" : "#334155", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 12 }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Selection Floating Bar */}
            {finalSelectedProducts.length > 0 && (
                <div style={{ 
                    ...floatingBar, 
                    width: isMobile ? "calc(100% - 32px)" : "auto",
                    bottom: isMobile ? 12 : 24,
                }}>
                    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", gap: isMobile ? 12 : 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 400, color: "#fff", textAlign: "center" }}>
                            {finalSelectedProducts.length} Product{finalSelectedProducts.length > 1 ? "s" : ""} Selected
                        </div>
                        {!isMobile && <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)" }} />}
                        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
                            <BtnPrimary 
                                onClick={() => setShowShareModal(true)}
                                style={{ background: "#fff", color: "#6366f1", border: "none", flex: isMobile ? 1 : "initial" }}
                            >
                                {isMobile ? "Share Catalog" : "Share Selected Catalog"}
                            </BtnPrimary>
                            {!isMobile && (
                                <button 
                                    onClick={() => setSelectedProducts([])}
                                    style={{ background: "none", border: "none", color: "#fff", fontSize: 13, fontWeight: 400, cursor: "pointer", padding: "0 10px" }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showShareModal && (
                <ShareModal 
                    selectedProducts={finalSelectedProducts}
                    brands={brands}
                    collectionName={selectedCollection === "all" ? undefined : selectedCollection}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 400, color: "#64748b", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: FONT, background: "#fff" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 };
const productCard: React.CSSProperties = { background: "#fff", borderRadius: 16, border: "2px solid transparent", overflow: "hidden", cursor: "pointer", transition: "all 0.2s" };
const imageContainer: React.CSSProperties = { position: "relative", width: "100%", paddingBottom: "100%", background: "#f8fafc" };
const imageStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
const checkOverlay: React.CSSProperties = { position: "absolute", inset: 0, background: "rgba(99,102,241,0.4)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" };
const floatingBar: React.CSSProperties = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1e293b", padding: "12px 24px", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 300, display: "flex", alignItems: "center" };

