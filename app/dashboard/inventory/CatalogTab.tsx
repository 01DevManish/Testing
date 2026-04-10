"use client";

import React, { useState, useMemo } from "react";
import { Product, Category, Collection, FONT } from "./types";
import { BtnPrimary, BtnGhost, Card, Badge, EmptyState, Spinner, PageHeader } from "./ui";
import ShareModal from "./ShareModal";
import { resolveS3Url } from "./imageService";

interface CatalogTabProps {
    products: Product[];
    categories: Category[];
    collections: Collection[];
    brands: { id: string, name: string, logoUrl?: string }[];
    loading: boolean;
    isMobile?: boolean;
    isDesktop?: boolean;
}

export default function CatalogTab({ products, categories, collections, brands, loading, isMobile, isDesktop }: CatalogTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedCollection, setSelectedCollection] = useState("all");
    const [selectedSize, setSelectedSize] = useState("all");
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareOutOfStock, setShareOutOfStock] = useState(false);

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
            const matchesSearch = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.sku.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
            const matchesColl = selectedCollection === "all" || p.collection === selectedCollection;
            const matchesSize = selectedSize === "all" || p.size === selectedSize;
            const matchesStock = shareOutOfStock ? true : (p.stock || 0) > 0;
            return matchesSearch && matchesCat && matchesColl && matchesSize && matchesStock;
        });
    }, [products, searchTerm, selectedCategory, selectedCollection, selectedSize, shareOutOfStock]);

    const finalSelectedProducts = useMemo(() => {
        return shareOutOfStock ? selectedProducts : selectedProducts.filter(p => (p.stock || 0) > 0);
    }, [selectedProducts, shareOutOfStock]);

    const handleToggleSelect = (p: Product) => {
        setSelectedProducts(prev => {
            const exists = prev.find(item => item.id === p.id);
            if (exists) return prev.filter(item => item.id !== p.id);
            return [...prev, p];
        });
    };

    const handleSelectAll = () => {
        if (selectedProducts.length === filtered.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts([...filtered]);
        }
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
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 16, alignItems: isMobile ? "stretch" : "center" }}>
                    <div style={{ flex: 1, minWidth: isMobile ? "100%" : 240 }}>
                        <div style={labelStyle}>Search Products</div>
                        <input 
                            style={inputStyle} 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Product / SKU"
                        />
                    </div>
                    <div style={{ width: isMobile ? "100%" : 180 }}>
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
                    <div style={{ width: isMobile ? "100%" : 180 }}>
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
                    <div style={{ width: isMobile ? "100%" : 150 }}>
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
            </Card>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 400 }}>
                    Showing <strong>{filtered.length}</strong> products
                </div>
                <button 
                    onClick={handleSelectAll}
                    style={{ background: "none", border: "none", color: "#6366f1", fontSize: 13, fontWeight: 400, cursor: "pointer" }}
                >
                    {selectedProducts.length === filtered.length ? "Deselect All" : "Select All Visible"}
                </button>
            </div>

            {filtered.length === 0 ? (
                <EmptyState 
                    title="No products found" 
                    sub="Try adjusting your search or filters to find what you're looking for."
                />
            ) : (
                <div style={gridStyle}>
                    {filtered.map(p => {
                        const isSelected = !!selectedProducts.find(item => item.id === p.id);
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
                                    <img 
                                        src={resolveS3Url(p.imageUrl || "/placeholder-prod.png")} 
                                        alt={p.productName} 
                                        style={imageStyle} 
                                    />
                                    {isSelected && (
                                        <div style={checkOverlay}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: "12px 14px" }}>
                                    <div style={{ fontSize: 11, fontWeight: 400, color: "#6366f1", textTransform: "uppercase", marginBottom: 2 }}>{p.category}</div>
                                    <div style={{ fontSize: 14, fontWeight: 400, color: "#0f172a", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.productName}</div>
                                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>SKU: {p.sku}</div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: 15, fontWeight: 400, color: "#0f172a" }}>₹{p.price}</div>
                                        <Badge 
                                            color={p.stock > 0 ? "#10b981" : "#ef4444"} 
                                            bg={p.stock > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"}
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
