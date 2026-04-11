"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";
import { ref, push, set, update, remove, get } from "firebase/database";
import { db } from "../../lib/firebase";
import { FONT, Category, Collection, ItemGroup, Product } from "./types";
import { logActivity } from "../../lib/activityLogger";
import { deleteImage } from "./imageService";
import { Input, Textarea, FormField, BtnPrimary, BtnSecondary, BtnGhost, SuccessBanner, Card, PageHeader, EmptyState } from "./ui";
import SmartImage from "../../components/SmartImage";

// ══════════════════════════════════════════════════════════════
// CREATE CATEGORY
// ══════════════════════════════════════════════════════════════
export function CreateCategory({ user, onCreated, isMobile, isDesktop }: { user: { uid: string; name: string }, onCreated?: (c: Category) => void, isMobile?: boolean, isDesktop?: boolean }) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!name.trim()) { setError("Category name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), createdAt: Date.now() };
            const newRef = push(ref(db, "categories"));
            await set(newRef, d);

            // Log activity
            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Category Created",
                description: `Category "${name}" was created by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { categoryId: newRef.key }
            });

            onCreated?.({ id: newRef.key as string, ...d } as Category);
            setSuccess(`Category "${name}" created.`);
            setName(""); setDesc(""); setError("");
        } catch (e) { console.error(e); alert("Failed to create category."); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <PageHeader title="Create Category" sub="Add a new product category." />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <Card style={{ maxWidth: 520 }}>
                <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <FormField label="Category Name" required>
                        <Input value={name} onChange={e => { setName(e.target.value); setError(""); }}
                            style={error ? { borderColor: "#ef4444" } : {}} />
                        {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                    </FormField>
                    <FormField label="Description">
                        <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                    </FormField>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                        <BtnGhost onClick={() => { setName(""); setDesc(""); setError(""); }}>Reset</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Create Category</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// CATEGORY LIST
// ══════════════════════════════════════════════════════════════
export function CategoryList({ categories, user, loading, canCreate, canDelete, onCreateNew, isMobile, isDesktop }: { categories: Category[]; user: { uid: string; name: string }, loading: boolean; canCreate?: boolean; canDelete?: boolean; onCreateNew: () => void, isMobile?: boolean, isDesktop?: boolean }) {
    const [editing, setEditing] = useState<Category | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState("");
    
    // Increased to 12 items to show more categories at once
    const ITEMS_PER_PAGE = 12;

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return categories;
        return categories.filter(c => c.name?.toLowerCase().includes(q));
    }, [search, categories]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    useEffect(() => { setCurrentPage(1); }, [search]);
    return (
        <div>
            <PageHeader title="All Categories" sub={`${filtered.length} matching categories`}>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ position: "relative" }}>
                        <Input 
                            placeholder="Find Category..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            style={{ paddingRight: 32, minWidth: 220 }}
                        />
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                    </div>
                    {canCreate && <BtnPrimary onClick={onCreateNew} style={{ whiteSpace: "nowrap" }}>+ New Category</BtnPrimary>}
                </div>
            </PageHeader>
            <Card>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontFamily: FONT, fontSize: 13 }}>Loading...</div>
                ) : categories.length === 0 ? (
                    <EmptyState title="No categories yet" sub="Create your first category to organize products." />
                ) : (
                    <div>
                        {paginatedItems.map((c, i) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: i < paginatedItems.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 14 }}>
                                    <span style={{ fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: FONT }}>{c.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{c.name}</div>
                                    {c.description && <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{c.description}</div>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                                    <button
                                        onClick={() => setEditing(c)}
                                        style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 400, fontFamily: FONT }}
                                    >
                                        Edit
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete category "${c.name}"?`)) {
                                                    await remove(ref(db, `categories/${c.id}`));
                                                    await logActivity({
                                                        type: "inventory",
                                                        action: "delete",
                                                        title: "Category Deleted",
                                                        description: `Category "${c.name}" was deleted by ${user.name}.`,
                                                        userId: user.uid,
                                                        userName: user.name,
                                                        userRole: "admin",
                                                        metadata: { categoryId: c.id, categoryName: c.name }
                                                    });
                                                }
                                            }}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex", borderRadius: 6, transition: "all 0.2s" }}
                                            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                                            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                    <div style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", color: currentPage === 1 ? "#cbd5e1" : "#475569", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: FONT }}
                        >
                            Previous
                        </button>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, fontFamily: FONT }}>
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: currentPage === totalPages ? "#f8fafc" : "#fff", color: currentPage === totalPages ? "#cbd5e1" : "#475569", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: FONT }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </Card>

            {editing && (
                <EditCategoryModal
                    category={editing}
                    user={user}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}

function EditCategoryModal({ category, user, onClose, isMobile, isDesktop }: {
    category: Category;
    user: { uid: string; name: string };
    onClose: () => void;
    isMobile?: boolean;
    isDesktop?: boolean;
}) {
    const [name, setName] = useState(category.name);
    const [desc, setDesc] = useState(category.description || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await update(ref(db, `categories/${category.id}`), { name: name.trim(), description: desc.trim() });
            await logActivity({
                type: "inventory",
                action: "update",
                title: "Category Updated",
                description: `Category "${category.name}" was updated by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { categoryId: category.id }
            });
            onClose();
        } catch (e) { console.error(e); alert("Failed to update."); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Card style={{ maxWidth: 460, width: "100%" }}>
                <div style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", marginBottom: 20 }}>Edit Category</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <FormField label="Category Name" required><Input value={name} onChange={e => setName(e.target.value)} /></FormField>
                        <FormField label="Description"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} /></FormField>
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Save Changes</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// CREATE COLLECTION
// ══════════════════════════════════════════════════════════════
export function CreateCollection({ products, user, onCreated, isMobile, isDesktop }: { products: { id: string; productName: string }[]; user: { uid: string; name: string }, onCreated?: (c: Collection) => void, isMobile?: boolean, isDesktop?: boolean }) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [desc, setDesc] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [itemPage, setItemPage] = useState(1);

    useEffect(() => { setItemPage(1); }, [search]);

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError("Collection name is required"); return; }
        setSaving(true);
        try {
            // If code is empty, generate a deterministic one
            let finalCode = code.trim();
            if (!finalCode) {
                const n = name.trim().toLowerCase();
                let hash = 0;
                for (let i = 0; i < n.length; i++) {
                    hash = ((hash << 5) - hash) + n.charCodeAt(i);
                    hash |= 0;
                }
                finalCode = Math.abs(hash % 892 + 108).toString().padStart(3, "0");
            }

            const d = { name: name.trim(), collectionCode: finalCode, description: desc.trim(), productIds: Array.from(selected), createdAt: Date.now() };
            const newRef = push(ref(db, "collections"));
            await set(newRef, d);

            // Log activity
            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Collection Created",
                description: `Collection "${name}" (${selected.size} items) was created by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { collectionId: newRef.key, productCount: selected.size }
            });

            onCreated?.({ id: newRef.key as string, ...d } as Collection);
            setSuccess(`Collection "${name}" created.`);
            setName(""); setDesc(""); setSelected(new Set()); setError("");
        } catch (e) { console.error(e); alert("Failed to create collection."); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <PageHeader title="Create Collection" sub="Group products into a named collection." />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 18, alignItems: "start" }}>
                <Card>
                    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                        <FormField label="Collection Name" required>
                            <Input value={name} onChange={e => { setName(e.target.value); setError(""); }}
                                style={error ? { borderColor: "#ef4444" } : {}} />
                            {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                        </FormField>
                        <FormField label="Collection Code (3 Digits)">
                            <Input
                                value={code}
                                maxLength={3}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                            />
                        </FormField>
                        <FormField label="Description">
                            <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                        </FormField>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <BtnGhost onClick={() => { setName(""); setDesc(""); setSelected(new Set()); setError(""); }}>Reset</BtnGhost>
                            <BtnPrimary onClick={handleSave} loading={saving}>Create Collection</BtnPrimary>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ padding: "16px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>
                            Add Products ({selected.size} selected)
                        </div>
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search Product / SKU"
                            style={{ marginBottom: 12, height: 36, fontSize: 12 }}
                        />
                        <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 8 }}>
                            {products.length === 0 ? (
                                <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontFamily: FONT }}>No products available</div>
                            ) : products
                                .filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase()))
                                .slice((itemPage - 1) * 5, itemPage * 5)
                                .map(p => (
                                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", transition: "0.2s" }}>
                                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                            style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {(p as any).imageUrl ? <SmartImage src={(p as any).imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10 }}>📦</span>}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily: FONT, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</span>
                                            <span style={{ fontSize: 10, color: "#64748b", fontFamily: FONT }}>SKU: {(p as any).sku || "N/A"}</span>
                                        </div>
                                    </label>
                                ))}
                            {products.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length === 0 && products.length > 0 && (
                                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No items found</div>
                            )}
                        </div>
                        {/* Simple Pagination */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                            <button
                                disabled={itemPage === 1}
                                onClick={() => setItemPage(p => p - 1)}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: itemPage === 1 ? "#f8fafc" : "#fff", color: itemPage === 1 ? "#cbd5e1" : "#475569", cursor: itemPage === 1 ? "not-allowed" : "pointer", fontSize: 11 }}
                            >
                                Prev
                            </button>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>Page {itemPage}</span>
                            <button
                                disabled={itemPage * 5 >= products.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length}
                                onClick={() => setItemPage(p => p + 1)}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: (itemPage * 5 >= products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "#f8fafc" : "#fff", color: (itemPage * 5 >= products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "#cbd5e1" : "#475569", cursor: (itemPage * 5 >= products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "not-allowed" : "pointer", fontSize: 11 }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// COLLECTION LIST
// ══════════════════════════════════════════════════════════════
export function CollectionList({ collections, user, loading, canCreate, canDelete, onCreateNew, products, isMobile, isDesktop }: { collections: Collection[]; user: { uid: string; name: string }, loading: boolean; canCreate?: boolean; canDelete?: boolean; onCreateNew: () => void; products?: Product[], isMobile?: boolean, isDesktop?: boolean }) {
    const [editing, setEditing] = useState<Collection | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState("");
    
    // Increased to 12 items to show more collections at once
    const ITEMS_PER_PAGE = 12;

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return collections;
        return collections.filter(c => c.name?.toLowerCase().includes(q));
    }, [search, collections]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    useEffect(() => { setCurrentPage(1); }, [search]);
    return (
        <div>
            <PageHeader title="All Collections" sub={`${filtered.length} collections matching`}>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ position: "relative" }}>
                        <Input 
                            placeholder="Find Collection..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            style={{ paddingRight: 32, minWidth: 220 }}
                        />
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                    </div>
                    {canCreate && <BtnPrimary onClick={onCreateNew} style={{ whiteSpace: "nowrap" }}>+ New Collection</BtnPrimary>}
                </div>
            </PageHeader>
            <Card>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontFamily: FONT, fontSize: 13 }}>Loading...</div>
                ) : collections.length === 0 ? (
                    <EmptyState title="No collections yet" sub="Create a collection to group related products." />
                ) : (
                    <div>
                        {paginatedItems.map((c, i) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: i < paginatedItems.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#8b5cf6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 14 }}>
                                    <span style={{ fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: FONT }}>{c.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{c.name}</div>
                                        {c.collectionCode && (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                                                {c.collectionCode}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>
                                        {products?.filter(p => p.collection?.trim().toLowerCase() === c.name?.trim().toLowerCase()).length ?? 0} products
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                                    <button
                                        onClick={() => setEditing(c)}
                                        style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 400, fontFamily: FONT }}
                                    >
                                        Edit
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete collection "${c.name}"?`)) {
                                                    await remove(ref(db, `collections/${c.id}`));
                                                    await logActivity({
                                                        type: "inventory",
                                                        action: "delete",
                                                        title: "Collection Deleted",
                                                        description: `Collection "${c.name}" was deleted by ${user.name}.`,
                                                        userId: user.uid,
                                                        userName: user.name,
                                                        userRole: "admin",
                                                        metadata: { collectionId: c.id, collectionName: c.name }
                                                    });
                                                }
                                            }}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex", borderRadius: 6, transition: "all 0.2s" }}
                                            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                                            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                    <div style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", color: currentPage === 1 ? "#cbd5e1" : "#475569", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: FONT }}
                        >
                            Previous
                        </button>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, fontFamily: FONT }}>
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: currentPage === totalPages ? "#f8fafc" : "#fff", color: currentPage === totalPages ? "#cbd5e1" : "#475569", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, fontFamily: FONT }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </Card>

            {editing && (
                <EditCollectionModal
                    collection={editing}
                    user={user}
                    allProducts={products || []}
                    onClose={() => setEditing(null)}
                    isMobile={isMobile}
                    isDesktop={isDesktop}
                />
            )}
        </div>
    );
}

function EditCollectionModal({ collection, user, allProducts, onClose, isMobile, isDesktop }: { collection: Collection; user: { uid: string; name: string }; allProducts: { id: string; productName: string }[]; onClose: () => void, isMobile?: boolean, isDesktop?: boolean }) {
    const [name, setName] = useState(collection.name);
    const [code, setCode] = useState(collection.collectionCode || "");
    const [desc, setDesc] = useState(collection.description || "");
    const [selected, setSelected] = useState<Set<string>>(new Set(collection.productIds || []));
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [itemPage, setItemPage] = useState(1);

    useEffect(() => { setItemPage(1); }, [search]);

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await update(ref(db, `collections/${collection.id}`), { name: name.trim(), collectionCode: code.trim(), description: desc.trim(), productIds: Array.from(selected) });
            await logActivity({
                type: "inventory",
                action: "update",
                title: "Collection Updated",
                description: `Collection "${collection.name}" was updated by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { collectionId: collection.id }
            });
            onClose();
        } catch (e) { console.error(e); alert("Failed to update."); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Card style={{ maxWidth: 800, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", marginBottom: 20 }}>Edit Collection</h3>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <FormField label="Collection Name" required><Input value={name} onChange={e => setName(e.target.value)} /></FormField>
                            <FormField label="Collection Code (3 Digits)">
                                <Input
                                    value={code}
                                    maxLength={3}
                                    onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                                />
                            </FormField>
                            <FormField label="Description"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} /></FormField>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Manage Products ({selected.size})</div>
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Product / SKU" />
                            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                {allProducts
                                    .filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase()))
                                    .slice((itemPage - 1) * 5, itemPage * 5)
                                    .map(p => (
                                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                                style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                                            <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                {(p as any).imageUrl ? <img src={(p as any).imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10 }}>📦</span>}
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily: FONT, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</span>
                                                <span style={{ fontSize: 10, color: "#64748b", fontFamily: FONT }}>SKU: {(p as any).sku || "N/A"}</span>
                                            </div>
                                        </label>
                                    ))}
                            </div>
                            {/* Simple Pagination */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                                <button
                                    disabled={itemPage === 1}
                                    onClick={() => setItemPage(p => p - 1)}
                                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: itemPage === 1 ? "#f8fafc" : "#fff", color: itemPage === 1 ? "#cbd5e1" : "#475569", cursor: itemPage === 1 ? "not-allowed" : "pointer", fontSize: 11 }}
                                >
                                    Prev
                                </button>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>Page {itemPage}</span>
                                <button
                                    disabled={itemPage * 5 >= allProducts.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length}
                                    onClick={() => setItemPage(p => p + 1)}
                                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: (itemPage * 5 >= allProducts.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "#f8fafc" : "#fff", color: (itemPage * 5 >= allProducts.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "#cbd5e1" : "#475569", cursor: (itemPage * 5 >= allProducts.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "not-allowed" : "pointer", fontSize: 11 }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Save Changes</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// CREATE ITEM GROUP
// ══════════════════════════════════════════════════════════════
export function CreateItemGroup({ products, user, onCreated, isMobile, isDesktop }: { products: Product[]; user: { uid: string; name: string }, onCreated?: (g: ItemGroup) => void, isMobile?: boolean, isDesktop?: boolean }) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [itemPage, setItemPage] = useState(1);

    useEffect(() => { setItemPage(1); }, [search]);

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError("Group name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), productIds: Array.from(selected), createdAt: Date.now() };
            const newRef = push(ref(db, "itemGroups"));
            await set(newRef, d);

            // Log activity
            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Item Group Created",
                description: `Item Group "${name}" (${selected.size} items) was created by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { groupId: newRef.key, itemCount: selected.size }
            });

            onCreated?.({ id: newRef.key as string, ...d } as ItemGroup);
            setSuccess(`Group "${name}" created.`);
            setName(""); setDesc(""); setSelected(new Set()); setError("");
        } catch (e) { console.error(e); alert("Failed to create group."); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <PageHeader title="Create Item Group" sub="Group similar items for bulk management." />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 18, alignItems: "start" }}>
                <Card>
                    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                        <FormField label="Group Name" required>
                            <Input value={name} onChange={e => { setName(e.target.value); setError(""); }}
                                style={error ? { borderColor: "#ef4444" } : {}} />
                            {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                        </FormField>
                        <FormField label="Description">
                            <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                        </FormField>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <BtnGhost onClick={() => { setName(""); setDesc(""); setSelected(new Set()); setError(""); }}>Reset</BtnGhost>
                            <BtnPrimary onClick={handleSave} loading={saving}>Create Group</BtnPrimary>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ padding: "16px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>
                            Add Items ({selected.size} selected)
                        </div>
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search Product / SKU"
                            style={{ marginBottom: 12, height: 36, fontSize: 12 }}
                        />
                        <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 8 }}>
                            {products
                                .filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()))
                                .slice((itemPage - 1) * 5, itemPage * 5)
                                .map(p => (
                                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", transition: "0.2s" }}>
                                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                            style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {p.imageUrl ? <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10 }}>📦</span>}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily: FONT, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</span>
                                            <span style={{ fontSize: 10, color: "#64748b", fontFamily: FONT }}>SKU: {p.sku}</span>
                                        </div>
                                    </label>
                                ))}
                            {products.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No items found</div>
                            )}
                        </div>
                        {/* Simple Pagination */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                            <button
                                disabled={itemPage === 1}
                                onClick={() => setItemPage(p => p - 1)}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: itemPage === 1 ? "#f8fafc" : "#fff", color: itemPage === 1 ? "#cbd5e1" : "#475569", cursor: itemPage === 1 ? "not-allowed" : "pointer", fontSize: 11 }}
                            >
                                Prev
                            </button>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>Page {itemPage}</span>
                            <button
                                disabled={itemPage * 5 >= products.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).length}
                                onClick={() => setItemPage(p => p + 1)}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: (itemPage * 5 >= products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())).length) ? "#f8fafc" : "#fff", color: (itemPage * 5 >= products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())).length) ? "#cbd5e1" : "#475569", cursor: (itemPage * 5 >= products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())).length) ? "not-allowed" : "pointer", fontSize: 11 }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// ITEM GROUP LIST
// ══════════════════════════════════════════════════════════════
export function ItemGroupList({ groups, user, loading, canCreate, canDelete, onCreateNew, products, isMobile, isDesktop }: { groups: ItemGroup[]; user: { uid: string; name: string }, loading: boolean; canCreate?: boolean; canDelete?: boolean; onCreateNew: () => void; products?: Product[], isMobile?: boolean, isDesktop?: boolean }) {
    const [editing, setEditing] = useState<ItemGroup | null>(null);
    return (
        <div>
            <PageHeader title="All Item Groups" sub={`${groups.length} groups`}>
                {canCreate && <BtnPrimary onClick={onCreateNew}>+ New Group</BtnPrimary>}
            </PageHeader>
            <Card>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontFamily: FONT, fontSize: 13 }}>Loading...</div>
                ) : groups.length === 0 ? (
                    <EmptyState title="No groups yet" sub="Create an item group to manage similar products together." />
                ) : (
                    <div>
                        {groups.map((g, i) => (
                            <div key={g.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: i < groups.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#10b981,#34d399)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 14 }}>
                                    <span style={{ fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: FONT }}>{g.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{g.name}</div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{g.productIds?.length ?? 0} items</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{new Date(g.createdAt).toLocaleDateString("en-IN")}</div>
                                    <button
                                        onClick={() => setEditing(g)}
                                        style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 400, fontFamily: FONT }}
                                    >
                                        Edit
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete group "${g.name}"?`)) {
                                                    await remove(ref(db, `itemGroups/${g.id}`));
                                                    await logActivity({
                                                        type: "inventory",
                                                        action: "delete",
                                                        title: "Item Group Deleted",
                                                        description: `Item Group "${g.name}" was deleted by ${user.name}.`,
                                                        userId: user.uid,
                                                        userName: user.name,
                                                        userRole: "admin",
                                                        metadata: { groupId: g.id, groupName: g.name }
                                                    });
                                                }
                                            }}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex", borderRadius: 6, transition: "all 0.2s" }}
                                            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                                            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {editing && (
                <EditItemGroupModal
                    group={editing}
                    user={user}
                    allProducts={products || []}
                    onClose={() => setEditing(null)}
                    isMobile={isMobile}
                    isDesktop={isDesktop}
                />
            )}
        </div>
    );
}

function EditItemGroupModal({ group, user, allProducts, onClose, isMobile, isDesktop }: { group: ItemGroup; user: { uid: string; name: string }; allProducts: Product[]; onClose: () => void, isMobile?: boolean, isDesktop?: boolean }) {
    const [name, setName] = useState(group.name);
    const [desc, setDesc] = useState(group.description || "");
    const [selected, setSelected] = useState<Set<string>>(new Set(group.productIds || []));
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [itemPage, setItemPage] = useState(1);

    useEffect(() => { setItemPage(1); }, [search]);

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await update(ref(db, `itemGroups/${group.id}`), { name: name.trim(), description: desc.trim(), productIds: Array.from(selected) });
            await logActivity({
                type: "inventory",
                action: "update",
                title: "Item Group Updated",
                description: `Item Group "${group.name}" was updated by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { groupId: group.id }
            });
            onClose();
        } catch (e) { console.error(e); alert("Failed to update."); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Card style={{ maxWidth: 800, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", marginBottom: 20 }}>Edit Item Group</h3>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <FormField label="Group Name" required><Input value={name} onChange={e => setName(e.target.value)} /></FormField>
                            <FormField label="Description"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} /></FormField>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Manage Products ({selected.size})</div>
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Product / SKU" />
                            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                {allProducts
                                    .filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase()))
                                    .slice((itemPage - 1) * 5, itemPage * 5)
                                    .map(p => (
                                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                                style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                                            <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                {(p as any).imageUrl ? <img src={(p as any).imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10 }}>📦</span>}
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily: FONT, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</span>
                                                <span style={{ fontSize: 10, color: "#64748b", fontFamily: FONT }}>SKU: {(p as any).sku || "N/A"}</span>
                                            </div>
                                        </label>
                                    ))}
                            </div>
                            {/* Simple Pagination */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                                <button
                                    disabled={itemPage === 1}
                                    onClick={() => setItemPage(p => p - 1)}
                                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: itemPage === 1 ? "#f8fafc" : "#fff", color: itemPage === 1 ? "#cbd5e1" : "#475569", cursor: itemPage === 1 ? "not-allowed" : "pointer", fontSize: 11 }}
                                >
                                    Prev
                                </button>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>Page {itemPage}</span>
                                <button
                                    disabled={itemPage * 5 >= allProducts.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length}
                                    onClick={() => setItemPage(p => p + 1)}
                                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: (itemPage * 5 >= allProducts.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "#f8fafc" : "#fff", color: (itemPage * 5 >= allProducts.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "#cbd5e1" : "#475569", cursor: (itemPage * 5 >= allProducts.filter(p => p.productName.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase())).length) ? "not-allowed" : "pointer", fontSize: 11 }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Save Changes</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// INVENTORY ADJUSTMENT
// ══════════════════════════════════════════════════════════════
export function InventoryAdjustment({ products, collections, user, onDone, isMobile, isDesktop }: {
    products: Product[];
    collections: Collection[];
    user: { uid: string; name: string };
    onDone?: () => void;
    isMobile?: boolean;
    isDesktop?: boolean;
}) {
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

    const filtered = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = 
            p.productName.toLowerCase().includes(q) || 
            p.sku.toLowerCase().includes(q) ||
            p.brand?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.collection?.toLowerCase().includes(q);
            
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

            {/* Success Notification */}
            {successMsg && (
                <div style={{
                    position: "fixed",
                    top: 24,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#10b981",
                    color: "#fff",
                    padding: "16px 24px",
                    borderRadius: 16,
                    boxShadow: "0 20px 25px -5px rgba(16,185,129,0.2), 0 8px 10px -6px rgba(16,185,129,0.1)",
                    zIndex: 3000,
                    fontWeight: 400,
                    fontSize: 15,
                    fontFamily: FONT,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    animation: "slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}>
                    <span style={{ fontSize: 20 }}>✓</span>
                    {successMsg}
                </div>
            )}
            <PageHeader title="Inventory Adjustment" sub="Quickly add or remove stock and adjust quantities in one place." />

            <Card style={{ marginBottom: 20 }}>
                <div style={{ padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
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
                                type="text"
                                placeholder="Search Product / SKU"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    background: "transparent", border: "none", outline: "none",
                                    color: "#1e293b", fontSize: 14, width: "100%", fontFamily: FONT,
                                    boxShadow: "none"
                                }}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", padding: 2 }}>
                                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: "none", cursor: "pointer", background: "#f8fafc" }}>
                        <option value="all">All Collections</option>
                        {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <select value={filterSize} onChange={e => setFilterSize(e.target.value)} style={{ padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: "none", cursor: "pointer", background: "#f8fafc" }}>
                        <option value="all">All Sizes / Units</option>
                        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </Card>

            <Card>
                <div style={{ overflowX: "auto", maxHeight: "60vh" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <tr>
                                <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Product & Info</th>
                                <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Current Stock</th>
                                <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 400, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", textAlign: "right" }}>Adjust Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.map(p => <AdjustRow key={p.id} p={p} user={user} onRefresh={() => { onDone?.(); setSuccessMsg(`Stock updated for ${p.productName}`); }} isMobile={isMobile} />)}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 14 }}>No products match your filters.</div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontFamily: FONT }}>
                            Showing <strong>{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</strong> - <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> products
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                style={{
                                    padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                                    background: currentPage === 1 ? "#f8fafc" : "#fff",
                                    color: currentPage === 1 ? "#cbd5e1" : "#475569",
                                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                    fontSize: 12, fontWeight: 500, fontFamily: FONT, transition: "0.2s"
                                }}
                            >
                                Previous
                            </button>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1e293b", padding: "0 12px", fontFamily: FONT, background: "#f1f5f9", borderRadius: 10 }}>
                                <span style={{ fontWeight: 600 }}>{currentPage}</span>
                                <span style={{ color: "#94a3b8" }}>/</span>
                                <span>{totalPages}</span>
                            </div>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                style={{
                                    padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                                    background: currentPage >= totalPages ? "#f8fafc" : "#fff",
                                    color: currentPage >= totalPages ? "#cbd5e1" : "#475569",
                                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                                    fontSize: 12, fontWeight: 500, fontFamily: FONT, transition: "0.2s"
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}

function AdjustRow({ p, user, onRefresh, isMobile }: { p: Product, user: { uid: string; name: string }, onRefresh?: () => void, isMobile?: boolean }) {
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

            // Log activity
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
        } catch (e) { console.error(e); alert("Update failed"); setConfirm(null); }
        finally { setSaving(false); }
    };

    return (
        <tr style={{ borderBottom: "1px solid #f1f5f9", background: saving ? "#f8fafc" : "#fff", opacity: saving ? 0.6 : 1, transition: "0.2s" }}>
            <td style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f1f5f9", overflow: "hidden", flexShrink: 0 }}>
                        {p.imageUrl && <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{p.productName}</div>
                        <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>
                            SKU: {p.sku} • {p.unit || "PCS"}{p.size ? ` • ${p.size}` : ""}
                        </div>
                    </div>
                </div>
            </td>
            <td style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 16, fontWeight: 400, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontFamily: FONT }}>
                    {p.stock}
                </div>
                {p.stock <= p.minStock && p.stock > 0 && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 400 }}>Low Stock</span>}
            </td>
            <td style={{ padding: "14px 16px", textAlign: "right", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <input
                        type="number" min="1" value={qty}
                        onChange={e => setQty(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: 60, padding: "8px", border: "1.5px solid #e2e8f0", borderRadius: 8, textAlign: "center", fontSize: 14, fontWeight: 400, outline: "none" }}
                    />
                    <button onClick={() => setConfirm({ mode: "add" })} disabled={saving} style={{ padding: "8px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 400, cursor: "pointer" }}>+ Add</button>
                    <button onClick={() => setConfirm({ mode: "remove" })} disabled={saving} style={{ padding: "8px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 400, cursor: "pointer" }}>- Remove</button>
                </div>

                {confirm && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15,23,42,0.65)",
                        backdropFilter: "blur(6px)",
                        zIndex: 2000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20
                    }}>
                        <div style={{
                            width: "100%",
                            maxWidth: 420,
                            background: "#fff",
                            borderRadius: 24,
                            padding: "40px",
                            textAlign: "center",
                            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                            animation: "scaleIn 0.2s ease-out"
                        }}>
                            {/* Header Icon */}
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                background: confirm.mode === "add" ? "#f0fdf4" : "#fef2f2",
                                color: confirm.mode === "add" ? "#10b981" : "#ef4444",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 40,
                                margin: "0 auto 24px"
                            }}>
                                {confirm.mode === "add" ? "↑" : "↓"}
                            </div>

                            <h3 style={{ fontSize: 22, fontWeight: 400, color: "#0f172a", margin: "0 0 8px", fontFamily: FONT }}>
                                {confirm.mode === "add" ? "Add Stock" : "Remove Stock"}?
                            </h3>
                            <p style={{ fontSize: 15, color: "#64748b", fontWeight: 400, margin: "0 0 24px", fontFamily: FONT, lineHeight: 1.5 }}>
                                You are adjusting <strong>{qty} {p.unit || "units"}</strong> for:<br />
                                <span style={{ color: "#1e293b", fontWeight: 400 }}>{p.productName}</span>
                            </p>

                            {/* Product Preview Snippet */}
                            <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 30, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                                <div style={{ width: 50, height: 50, borderRadius: 10, background: "#fff", border: "1.5px solid #e2e8f0", overflow: "hidden", flexShrink: 0 }}>
                                    {p.imageUrl && <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Stock</div>
                                    <div style={{ fontSize: 18, fontWeight: 400, color: "#1e293b" }}>
                                        {p.stock} → <span style={{ color: confirm.mode === "add" ? "#10b981" : "#ef4444" }}>
                                            {confirm.mode === "add" ? p.stock + Number(qty) : p.stock - Number(qty)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <button
                                    onClick={handleAdjust}
                                    style={{
                                        width: "100%",
                                        padding: "16px",
                                        background: confirm.mode === "add" ? "#10b981" : "#ef4444",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 14,
                                        fontSize: 16,
                                        fontWeight: 400,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        boxShadow: `0 4px 12px ${confirm.mode === "add" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`
                                    }}
                                >
                                    Confirm {confirm.mode === "add" ? "Addition" : "Removal"}
                                </button>
                                <button
                                    onClick={() => setConfirm(null)}
                                    style={{
                                        width: "100%",
                                        padding: "16px",
                                        background: "#fff",
                                        color: "#64748b",
                                        border: "1.5px solid #e2e8f0",
                                        borderRadius: 14,
                                        fontSize: 16,
                                        fontWeight: 400,
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                        <style>{`
                            @keyframes scaleIn {
                                from { transform: scale(0.95); opacity: 0; }
                                to { transform: scale(1); opacity: 1; }
                            }
                        `}</style>
                    </div>
                )}
            </td>
        </tr>
    );
}

// ══════════════════════════════════════════════════════════════
// BARCODE PLACEHOLDER
// Reusable Real Barcode SVG Component
function BarcodeSVG({ value, height = 40, width = 2, fontSize = 20, showValue = false, displayHeight }: { value: string; height?: number; width?: number; fontSize?: number; showValue?: boolean; displayHeight?: string | number }) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: width,
                    height: height,
                    displayValue: showValue,
                    fontSize: fontSize,
                    margin: 0,
                    background: "#ffffff",
                    lineColor: "#000000"
                });
            } catch (e) {
                console.error("Barcode Generation Error", e);
            }
        }
    }, [value, height, width, fontSize, showValue]);

    return <svg ref={svgRef} style={{ height: displayHeight || "auto", maxWidth: "100%" }} />;
}

// ══════════════════════════════════════════════════════════════
// BARCODE MANAGER
// ══════════════════════════════════════════════════════════════
export function BarcodeView({
    products,
    collections,
    user,
    isMobile,
    isDesktop
}: {
    products: Product[];
    collections: Collection[];
    user: { uid: string; name: string };
    isMobile?: boolean;
    isDesktop?: boolean;
}) {
    const [search, setSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [generatedBarcode, setGeneratedBarcode] = useState<string>("");
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkPrint, setIsBulkPrint] = useState(false);
    const [selectedSize, setSelectedSize] = useState<"50x25" | "38x25" | "100x150">("50x25");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 4;

    // Shared Mapping for Display & Generation
    // ── Collection Codes (Persistent & Deterministic) ──────────────────
    const collectionCodes: Record<string, string> = {
        "Royal": "101",
        "Veera": "102",
        "Petal": "103",
        "Home Satin": "104",
        "Cotton Linen": "105",
        "Rise N Shine": "106",
        "Cozy Nest": "107",
        "Duke": "417",
        "Classic": "892",
        "Coral": "305",
        "Fantasy": "761",
        "Rome": "248",
        "Embosa": "639",
        "Posh": "574"
    };

    const getCollectionCode = (collectionName: string) => {
        const prodCol = (collectionName || "").trim().toLowerCase();
        
        // 1. Try to find the actual collection object to get its persistent code
        const colObj = collections.find(c => c.name.toLowerCase() === prodCol);
        if (colObj?.collectionCode) return colObj.collectionCode;
        
        // 2. Check fallback map (case-insensitive)
        const matchedColKey = Object.keys(collectionCodes).find(k => k.toLowerCase() === prodCol);
        if (matchedColKey) return collectionCodes[matchedColKey];

        // 3. Generate deterministic code if absolutely missing
        let titleHash = 0;
        for (let i = 0; i < prodCol.length; i++) {
            titleHash = ((titleHash << 5) - titleHash) + prodCol.charCodeAt(i);
            titleHash |= 0;
        }
        const dynamicCode = Math.abs(titleHash % 892 + 108).toString().padStart(3, "0");
        return dynamicCode;
    };

    const handleAutoAssignCodes = async () => {
        if (!confirm("This will assign unique 3-digit codes to all collections that don't have one yet. Ready?")) return;
        let count = 0;
        try {
            // Explicit mapping for major collections as requested
            const mapping: Record<string, string> = {
                "royal": "101",
                "veera": "102", "vera": "102",
                "petal": "103",
                "home satin": "104",
                "cotton linen": "105",
                "rise n shine": "106",
                "cozy nest": "107"
            };

            for (const col of collections) {
                if (col.collectionCode) continue;

                const nameLower = col.name.toLowerCase().trim();
                let newCode = "";
                
                if (mapping[nameLower]) {
                    newCode = mapping[nameLower];
                } else {
                    newCode = getCollectionCode(col.name);
                }

                await update(ref(db, `collections/${col.id}`), { collectionCode: newCode });
                count++;
            }
            alert(`Succesfully assigned codes to ${count} collections.`);
        } catch (e) {
            console.error(e);
            alert("Assignment failed. Check console.");
        }
    };



    const getSizeCode = (size: string) => {
        const s = (size || "").trim().toUpperCase();
        if (s.includes("SUPER KING")) return "005";
        if (s.includes("KING FITTED")) return "009";
        if (s.includes("KING")) return "004";
        if (s.includes("QUEEN FITTED")) return "008";
        if (s.includes("QUEEN")) return "003";
        if (s.includes("DOUBLE FITTED")) return "007";
        if (s.includes("DOUBLE")) return "002";
        if (s.includes("SINGLE FITTED")) return "006";
        if (s.includes("SINGLE")) return "001";
        return "000";
    };

    const getSkuPart = (sku: string) => {
        const p = (sku || "").replace(/\D/g, "");
        return p.substring(p.length - 3).padStart(3, "0");
    };

    const getStylePart = (styleId: string) => {
        const s = (styleId || "").replace(/\D/g, "");
        if (s) return s.substring(s.length - 3).padStart(3, "0");
        
        // Hashing fallback for alphanumeric Style IDs
        let h = 0;
        const cleanStyle = (styleId || "GEN").toUpperCase();
        for (let i = 0; i < cleanStyle.length; i++) {
            h = ((h << 5) - h) + cleanStyle.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h % 900 + 100).toString();
    };

    const generateBarcodeNumber = (product: Product) => {
        const colPart = getCollectionCode(product.collection || "");
        const skuPart = getSkuPart(product.sku);
        const stylePart = getStylePart(product.styleId || "");

        // Deterministic 4-digit ID part
        const idStr = (product.id || "0000").replace(/[^a-zA-Z0-0]/g, "");
        let idHash = 0;
        for (let i = 0; i < idStr.length; i++) {
            idHash = ((idHash << 5) - idHash) + idStr.charCodeAt(i);
            idHash |= 0;
        }
        const randPart = Math.abs(idHash % 9000 + 1000).toString();

        return `${colPart}${skuPart}${stylePart}${randPart}`;
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length && filtered.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(p => p.id)));
        }
    };

    const handleBulkPrint = async () => {
        if (selectedIds.size === 0) return;

        const productsToPrint = products.filter(p => selectedIds.has(p.id));
        for (const p of productsToPrint) {
            const expectedColPart = getCollectionCode(p.collection || "");
            const expectedSkuPart = getSkuPart(p.sku);
            const expectedSizeCode = getSizeCode(p.size || "");

            let needsNew = !p.barcode;
            if (p.barcode) {
                const existingCol = p.barcode.substring(0, 3);
                const existingSku = p.barcode.substring(3, 6);
                const existingSize = p.barcode.substring(6, 9);
                if (existingCol !== expectedColPart || existingSku !== expectedSkuPart || existingSize !== expectedSizeCode) {
                    needsNew = true;
                }
            }

            if (needsNew) {
                const code = generateBarcodeNumber(p);
                try {
                    await update(ref(db, `inventory/${p.id}`), { barcode: code });
                } catch (e) { console.error(e); }
            }
        }

        setIsBulkPrint(true);
        setPrintModalOpen(true);
    };

    const handleGenerate = async (p: Product) => {
        // Use the most up-to-date product from the list to avoid stale props
        const currentP = products.find(x => x.id === p.id) || p;
        setSelectedProduct(currentP);

        const expectedColPart = getCollectionCode(currentP.collection || "");
        const expectedSkuPart = getSkuPart(currentP.sku);
        const expectedStylePart = getStylePart(currentP.styleId || "");

        let needsNew = !currentP.barcode;
        if (currentP.barcode) {
            const existingCol = currentP.barcode.substring(0, 3);
            const existingSku = currentP.barcode.substring(3, 6);
            const existingStyle = currentP.barcode.substring(6, 9);

            if (existingCol !== expectedColPart ||
                existingSku !== expectedSkuPart ||
                existingStyle !== expectedStylePart) {
                needsNew = true;
            }
        }

        if (needsNew) {
            const code = generateBarcodeNumber(currentP);
            try {
                await update(ref(db, `inventory/${currentP.id}`), { barcode: code });
                setGeneratedBarcode(code);
            } catch (e) {
                console.error(e);
                alert("Failed to save barcode to database.");
            }
        } else {
            setGeneratedBarcode(currentP.barcode!);
        }
    };

    const [isResetting, setIsResetting] = useState(false);
    const handleResetAllBarcodes = async () => {
        if (!confirm("Are you sure? This will regenerate barcodes for ALL products shown below to match the new structure.")) return;
        setIsResetting(true);
        let count = 0;
        try {
            for (const p of filtered) {
                const newCode = generateBarcodeNumber(p);
                if (p.barcode !== newCode) {
                    await update(ref(db, `inventory/${p.id}`), { barcode: newCode });
                    count++;
                }
            }
            alert(`Succesfully reset and updated ${count} barcodes.`);
        } catch (e) {
            console.error(e);
            alert("Failed to reset barcodes. Check console for details.");
        } finally {
            setIsResetting(false);
        }
    };

    const filtered = useMemo(() => products.filter(p => {
        const q = search.toLowerCase();
        return (
            p.productName.toLowerCase().includes(q) || 
            p.sku.toLowerCase().includes(q) ||
            p.brand?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.collection?.toLowerCase().includes(q)
        );
    }), [products, search]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <PageHeader title="Barcode Manager" sub="Generate and manage 13-digit product barcodes." />
                {selectedIds.size > 0 && (
                    <button
                        onClick={handleBulkPrint}
                        style={{ padding: "10px 20px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.25)", transition: "0.2s" }}
                    >
                        Print Selected ({selectedIds.size})
                    </button>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 400px", gap: 20, alignItems: "start" }}>
                <Card>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                                background: search ? "#fff" : "#f8fafc",
                                border: "1.5px solid",
                                borderColor: search ? "#6366f1" : "#e2e8f0",
                                borderRadius: 16,
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: search ? "0 4px 12px rgba(99,102,241,0.12)" : "0 2px 4px rgba(0,0,0,0.02)",
                            }}>
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ color: search ? "#6366f1" : "#94a3b8", flexShrink: 0, transition: "color 0.3s" }}>
                                    <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search Product / SKU"
                                    style={{
                                        background: "transparent", border: "none", outline: "none",
                                        color: "#1e293b", fontSize: 13, width: "100%", fontFamily: FONT,
                                        fontWeight: 400, boxShadow: "none"
                                    }}
                                />
                                <style>{`
                                    input::placeholder { color: #94a3b8; opacity: 0.8; }
                                    div > input[type="text"]:focus { 
                                        border-color: transparent !important; 
                                        box-shadow: none !important; 
                                    }
                                `}</style>
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        style={{
                                            background: "#f1f5f9", border: "none", cursor: "pointer",
                                            color: "#64748b", padding: 4, borderRadius: "50%",
                                            display: "flex", alignItems: "center", justifyContent: "center"
                                        }}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ overflowX: "auto", maxHeight: "60vh" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", width: 40 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === filtered.length && filtered.length > 0}
                                                onChange={toggleSelectAll}
                                                style={{ cursor: "pointer" }}
                                            />
                                        </th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Image</th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>SKU</th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Collection</th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", textAlign: "right" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedItems.map(p => (
                                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: selectedIds.has(p.id) ? "rgba(99,102,241,0.02)" : "transparent" }}>
                                            <td style={{ padding: "12px 14px" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(p.id)}
                                                    onChange={() => toggleSelect(p.id)}
                                                    style={{ cursor: "pointer" }}
                                                />
                                            </td>
                                            <td style={{ padding: "8px 14px" }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    {p.imageUrl ? (
                                                        <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    ) : (
                                                        <span style={{ fontSize: 10, color: "#cbd5e1" }}>📦</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 14px", fontSize: 13, color: "#1e293b", fontWeight: 400, fontFamily: FONT }}>{p.sku}</td>
                                            <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", fontFamily: FONT }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                    <span>{p.collection || "—"}</span>
                                                    <span style={{ fontSize: 10, color: "#94a3b8" }}>#{getCollectionCode(p.collection || "")}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                                <button
                                                    onClick={() => handleGenerate(p)}
                                                    style={{ padding: "6px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", transition: "0.2s" }}
                                                    onMouseEnter={e => e.currentTarget.style.background = "#4f46e5"}
                                                    onMouseLeave={e => e.currentTarget.style.background = "#6366f1"}
                                                >
                                                    Generate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filtered.length === 0 && (
                                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 14 }}>No products found.</div>
                            )}
                        </div>

                        {/* Pagination moved out of overflowX div */}
                        {filtered.length > 0 && (
                            <div style={{ padding: "16px 0 0", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", color: currentPage === 1 ? "#cbd5e1" : "#475569", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, transition: "0.2s" }}
                                    >
                                        Prev
                                    </button>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#1e293b", padding: "0 10px", fontWeight: 600 }}>
                                        {currentPage} / {totalPages}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: currentPage === totalPages ? "#f8fafc" : "#fff", color: currentPage === totalPages ? "#cbd5e1" : "#475569", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, transition: "0.2s" }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                <Card>
                    <div style={{ padding: "24px", textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 400, color: "#0f172a", marginBottom: 20, fontFamily: FONT }}>Barcode Preview</div>

                        {selectedProduct && generatedBarcode ? (
                            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "30px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{selectedProduct.productName}</div>
                                <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, marginBottom: 10 }}>SKU: {selectedProduct.sku}</div>

                                {/* Visual Barcode Representation (REAL Industry Standard) - Large for screen scanning */}
                                <div style={{ background: "#fff", padding: "10px", borderRadius: 8, display: "flex", justifyContent: "center", width: "100%", marginBottom: 15 }}>
                                    <BarcodeSVG value={generatedBarcode} height={120} width={2.5} displayHeight={120} />
                                </div>

                                <div style={{ fontSize: 28, fontWeight: 700, color: "#000", fontFamily: "'Courier New', Courier, monospace", letterSpacing: 5, marginTop: 5 }}>
                                    {generatedBarcode}
                                </div>

                                <div style={{ marginTop: 24, display: "flex", gap: 10, width: "100%" }}>
                                    <button
                                        onClick={() => {
                                            setIsBulkPrint(false);
                                            setPrintModalOpen(true);
                                        }}
                                        style={{ flex: 1, padding: "12px", background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, cursor: "pointer" }}
                                    >
                                        Print Barcode
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(generatedBarcode);
                                            alert("Barcode number copied to clipboard!");
                                        }}
                                        style={{ flex: 1, padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, cursor: "pointer" }}
                                    >
                                        Copy Code
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: "40px 20px", color: "#94a3b8", fontSize: 14, fontFamily: FONT }}>
                                Select a product to generate its barcode.
                            </div>
                        )}

                        <div style={{ marginTop: 30, textAlign: "left", padding: 16, background: "#f8fafc", borderRadius: 12, border: "1px solid #f1f5f9" }}>
                            <div style={{ fontSize: 12, fontWeight: 400, color: "#475569", marginBottom: 8, fontFamily: FONT }}>Barcode Structure:</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, lineHeight: 1.6 }}>
                                • Collection Code (3 digits - Mapped)<br />
                                • SKU Numeric Part (3 digits)<br />
                                • Size Code (3 digits - Mapped)<br />
                                • Random Number (4 digits)
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Print Selection Modal */}
            {printModalOpen && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", maxWidth: 400, width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
                        <h3 style={{ fontSize: 16, fontWeight: 500, color: "#0f172a", marginBottom: 16, textAlign: "center", fontFamily: FONT }}>Select Print Size</h3>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                                { id: "50x25", label: "50 x 25 mm (Standard)", icon: "🏷️" },
                                { id: "38x25", label: "38 x 25 mm (Small)", icon: "🔖" },
                                { id: "100x150", label: "100 x 150 mm (Large/Shipping)", icon: "📦" }
                            ].map(size => (
                                <button
                                    key={size.id}
                                    onClick={() => setSelectedSize(size.id as any)}
                                    style={{
                                        padding: "14px", border: "1.5px solid", borderRadius: 12, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                                        borderColor: selectedSize === size.id ? "#6366f1" : "#e2e8f0",
                                        background: selectedSize === size.id ? "rgba(99,102,241,0.05)" : "#fff",
                                        color: selectedSize === size.id ? "#6366f1" : "#475569",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    <span style={{ fontSize: 18 }}>{size.icon}</span>
                                    <span style={{ fontWeight: selectedSize === size.id ? 500 : 400 }}>{size.label}</span>
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                            <button
                                onClick={() => setPrintModalOpen(false)}
                                style={{ flex: 1, padding: "12px", background: "transparent", border: "none", color: "#64748b", fontSize: 14, cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setPrintModalOpen(false);
                                    // Give more time for multiple SVGs to render via useEffect
                                    setTimeout(() => window.print(), 800);
                                }}
                                style={{ flex: 2, padding: "12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                            >
                                Confirm & Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT-ONLY COMPONENT (Portal to Body) */}
            {typeof document !== "undefined" && createPortal(
                <div id="print-area" className="print-only">
                    <style>{`
                        @media print {
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            /* Hide Everything except the label */
                            body > *:not(#print-area) { 
                                display: none !important; 
                            }
                            #print-area { 
                                display: block !important; 
                                position: relative !important;
                                width: 100% !important;
                                background: #fff !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                visibility: visible !important;
                                z-index: 99999;
                            }
                            .barcode-label-container {
                                width: ${selectedSize === "50x25" ? "50mm" : selectedSize === "38x25" ? "38mm" : "100mm"} !important;
                                height: ${selectedSize === "50x25" ? "25mm" : selectedSize === "38x25" ? "25mm" : "150mm"} !important;
                                display: flex !important;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                padding: 0 !important;
                                margin: 0 !important;
                                box-sizing: border-box !important;
                                break-inside: avoid !important;
                            }
                            @page { 
                                margin: 0; 
                                size: ${selectedSize === "50x25" ? "50mm 25mm" : selectedSize === "38x25" ? "38mm 25mm" : "100mm 150mm"};
                            }
                            .page-break {
                                page-break-after: always !important;
                                break-after: page !important;
                            }
                        }
                        .print-only { display: none; }
                    `}</style>

                    {isBulkPrint ? (
                        products.filter(p => selectedIds.has(p.id)).map(p => (
                            <div key={p.id} className="barcode-label-container page-break" style={{
                                width: selectedSize === "50x25" ? "50mm" : selectedSize === "38x25" ? "38mm" : "100mm",
                                height: selectedSize === "50x25" ? "25mm" : selectedSize === "38x25" ? "25mm" : "150mm",
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                textAlign: "center", fontFamily: "'Inter', sans-serif", fontWeight: "600",
                                color: "#000", background: "#fff", padding: "2.5mm", boxSizing: "border-box", overflow: "hidden"
                            }}>
                                <BarcodeSVG
                                    value={p.barcode || generateBarcodeNumber(p)}
                                    height={selectedSize === "100x150" ? 170 : 48}
                                    width={selectedSize === "50x25" ? 1.4 : selectedSize === "38x25" ? 1.0 : 3.0}
                                    fontSize={selectedSize === "100x150" ? 30 : 16}
                                />
                                <div style={{
                                    fontSize: selectedSize === "100x150" ? "26pt" : selectedSize === "50x25" ? "9pt" : "7.5pt",
                                    letterSpacing: selectedSize === "100x150" ? 4 : selectedSize === "50x25" ? 1.5 : 1.0,
                                    fontWeight: "700",
                                    marginTop: "0.5mm",
                                    color: "#000",
                                    width: "100%",
                                    textOverflow: "clip",
                                    whiteSpace: "nowrap"
                                }}>
                                    {p.barcode || generateBarcodeNumber(p)}
                                </div>
                                <div style={{
                                    fontSize: selectedSize === "100x150" ? "14pt" : selectedSize === "50x25" ? "7pt" : "6pt",
                                    fontWeight: "700",
                                    marginTop: "0.3mm",
                                    color: "#000",
                                    letterSpacing: selectedSize === "100x150" ? 2 : 0.5
                                }}>
                                    {p.sku}
                                </div>
                            </div>
                        ))
                    ) : selectedProduct && generatedBarcode && (
                        <div className="barcode-label-container" style={{
                            width: selectedSize === "50x25" ? "50mm" : selectedSize === "38x25" ? "38mm" : "100mm",
                            height: selectedSize === "50x25" ? "25mm" : selectedSize === "38x25" ? "25mm" : "150mm",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            textAlign: "center", fontFamily: "'Inter', sans-serif", fontWeight: "600",
                            color: "#000", background: "#fff", padding: "2.5mm", boxSizing: "border-box", overflow: "hidden"
                        }}>
                            {/* REAL Barcode SVG - Scaled for thermal labels with ZERO internal margins but 2.5mm external padding */}
                            <BarcodeSVG
                                value={generatedBarcode}
                                height={selectedSize === "100x150" ? 170 : 48}
                                width={selectedSize === "50x25" ? 1.4 : selectedSize === "38x25" ? 1.0 : 3.0}
                                fontSize={selectedSize === "100x150" ? 30 : 16}
                            />

                            <div style={{
                                fontSize: selectedSize === "100x150" ? "26pt" : selectedSize === "50x25" ? "9pt" : "7.5pt",
                                letterSpacing: selectedSize === "100x150" ? 4 : selectedSize === "50x25" ? 1.5 : 1.0,
                                fontWeight: "700",
                                marginTop: "0.5mm",
                                color: "#000",
                                width: "100%",
                                textOverflow: "clip",
                                whiteSpace: "nowrap"
                            }}>
                                {generatedBarcode}
                            </div>
                            <div style={{
                                fontSize: selectedSize === "100x150" ? "14pt" : selectedSize === "50x25" ? "7pt" : "6pt",
                                fontWeight: "700",
                                marginTop: "0.3mm",
                                color: "#000",
                                letterSpacing: selectedSize === "100x150" ? 2 : 0.5
                            }}>
                                {selectedProduct.sku}
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW (ALL INVENTORY DASHBOARD)
// ══════════════════════════════════════════════════════════════
export function Overview({ products, categories, collections, loading, onNavigate, currentName, userRole, canCreate, canDelete, isMobile, isDesktop }: {
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
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
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

    // Dynamic Breakdown Calculation
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
                {stats.list.map((s: { label: string; value: string | number; color: string }, i: number) => (
                    <Card key={i}>
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, marginBottom: 10 }} />
                            <div style={{ fontSize: 20, fontWeight: 400, color: "#1e293b", fontFamily: FONT, marginBottom: 3 }}>
                                {s.label === "Total Asset Value" && typeof s.value === "number" ? `₹${s.value.toLocaleString("en-IN")}` : s.value}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT, fontWeight: 400 }}>
                                {s.label}
                            </div>
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
                                {recentProducts.map((p: Product) => (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {p.imageUrl ? (
                                                <SmartImage src={p.imageUrl} alt={p.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <span style={{ fontSize: 16, color: "#cbd5e1" }}>📦</span>
                                            )}
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
                            <select
                                value={groupBy}
                                onChange={(e) => setGroupBy(e.target.value as any)}
                                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, background: "#f8fafc", outline: "none", cursor: "pointer" }}
                            >
                                <option value="category">Category</option>
                                <option value="collection">Collection</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                                background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
                                transition: "all 0.2s"
                            }}>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: "#94a3b8", flexShrink: 0 }}>
                                    <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder={groupBy === "category" ? "Search Category" : "Search Collection"}
                                    value={breakdownSearch}
                                    onChange={(e) => setBreakdownSearch(e.target.value)}
                                    style={{
                                        width: "100%", background: "transparent", border: "none",
                                        fontSize: 12, outline: "none", fontFamily: FONT, color: "#1e293b",
                                        boxShadow: "none"
                                    }}
                                />
                            </div>
                        </div>

                        {filteredBreakdown.length === 0 ? (
                            <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: FONT, textAlign: "center", padding: "20px 0" }}>No data found.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {filteredBreakdown.slice(0, 10).map(([key, count]: [string, number]) => {
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

            {/* Detailed Stock Levels */}
            <div style={{ marginTop: 18 }}>
                <Card>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                            <div style={{ fontSize: 15, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Detailed Stock Levels</div>
                            <div style={{ display: "flex", gap: 10, flex: 1, maxWidth: 480, justifyContent: "flex-end", alignItems: "center" }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                                    background: searchTerm ? "#fff" : "#f8fafc",
                                    border: "1.5px solid",
                                    borderColor: searchTerm ? "#6366f1" : "#e2e8f0",
                                    borderRadius: 12,
                                    flex: 1,
                                    transition: "all 0.2s ease",
                                    boxShadow: searchTerm ? "0 4px 10px rgba(99,102,241,0.08)" : "none",
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: searchTerm ? "#6366f1" : "#94a3b8", flexShrink: 0 }}>
                                        <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667zM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search Product / SKU"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{
                                            background: "transparent", border: "none", outline: "none",
                                            color: "#1e293b", fontSize: 13, width: "100%", fontFamily: FONT,
                                            boxShadow: "none"
                                        }}
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", padding: 2 }}>
                                            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: FONT, outline: "none", background: "#f8fafc", cursor: "pointer", width: 140 }}
                                >
                                    <option value="all">All Status</option>
                                    <option value="in-stock">In Stock</option>
                                    <option value="low-stock">Low Stock</option>
                                    <option value="out-stock">Out of Stock</option>
                                </select>
                            </div>
                        </div>
                        <style>{`
                            input::placeholder { color: #94a3b8; opacity: 0.7; }
                        `}</style>
                        <div style={{ overflowX: "auto", maxHeight: 400 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                                    <tr>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product Details</th>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em" }}>SKU</th>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Available Pieces</th>
                                        <th style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Stock Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedStock.map(p => (
                                        <tr key={p.id} style={{ transition: "all 0.2s ease" }} onMouseEnter={e => e.currentTarget.style.background = "#f8faff"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "#fff", overflow: "hidden", border: "1.5px solid #f1f5f9", flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
                                                        {p.imageUrl ? <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>}
                                                    </div>
                                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                                        <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{p.productName}</span>
                                                        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>{p.category}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", fontSize: 13, color: "#64748b", fontWeight: 400, fontFamily: FONT, whiteSpace: "nowrap" }}>
                                                {p.sku}
                                            </td>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", fontSize: 15, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#1e293b", fontWeight: 500, fontFamily: FONT, textAlign: "right" }}>{p.stock}</td>
                                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", textAlign: "right" }}>
                                                <div style={{
                                                    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
                                                    background: p.stock <= 0 ? "#fff1f2" : p.stock <= p.minStock ? "#fffbeb" : "#f0fdf4",
                                                    color: p.stock <= 0 ? "#e11d48" : p.stock <= p.minStock ? "#d97706" : "#15803d",
                                                    fontWeight: 500, fontSize: 11, fontFamily: FONT,
                                                    border: `1px solid ${p.stock <= 0 ? "#fecaca" : p.stock <= p.minStock ? "#fde68a" : "#bbf7d0"}`,
                                                    whiteSpace: "nowrap"
                                                }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                                                    {p.stock <= 0 ? "Out of Stock" : p.stock <= p.minStock ? "Low Stock" : "In Stock"}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredStock.length === 0 && (
                                <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: 13, fontFamily: FONT }}>No products match your current search/filter.</div>
                            )}
                        </div>

                        {/* Inventory Pagination Controls */}
                        {totalStockPages > 1 && (
                            <div style={{ padding: "20px 0 0", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 12, color: "#64748b", fontFamily: FONT }}>
                                    Showing <strong>{((stockPage - 1) * STOCK_ITEMS_PER_PAGE) + 1}</strong> - <strong>{Math.min(stockPage * STOCK_ITEMS_PER_PAGE, filteredStock.length)}</strong> of <strong>{filteredStock.length}</strong> products
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        disabled={stockPage === 1}
                                        onClick={() => setStockPage(p => p - 1)}
                                        style={{
                                            padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                                            background: stockPage === 1 ? "#f8fafc" : "#fff",
                                            color: stockPage === 1 ? "#cbd5e1" : "#475569",
                                            cursor: stockPage === 1 ? "not-allowed" : "pointer",
                                            fontSize: 12, fontWeight: 500, fontFamily: FONT, transition: "0.2s"
                                        }}
                                    >
                                        Previous
                                    </button>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1e293b", padding: "0 12px", fontFamily: FONT, background: "#f1f5f9", borderRadius: 10 }}>
                                        <span style={{ fontWeight: 600 }}>{stockPage}</span>
                                        <span style={{ color: "#94a3b8" }}>/</span>
                                        <span>{totalStockPages}</span>
                                    </div>
                                    <button
                                        disabled={stockPage >= totalStockPages}
                                        onClick={() => setStockPage(p => p + 1)}
                                        style={{
                                            padding: "6px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                                            background: stockPage >= totalStockPages ? "#f8fafc" : "#fff",
                                            color: stockPage >= totalStockPages ? "#cbd5e1" : "#475569",
                                            cursor: stockPage >= totalStockPages ? "not-allowed" : "pointer",
                                            fontSize: 12, fontWeight: 500, fontFamily: FONT, transition: "0.2s"
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Delete Confirmation Modal */}
            {productToDelete && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "40px", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", animation: "scaleIn 0.2s ease-out" }}>
                        <div style={{ width: 80, height: 80, borderRadius: 40, background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 24px" }}>🔒</div>
                        <h3 style={{ fontSize: 22, fontWeight: 400, color: "#0f172a", margin: "0 0 8px", fontFamily: FONT }}>Delete Product?</h3>
                        <p style={{ fontSize: 15, color: "#64748b", fontWeight: 400, margin: "0 0 24px", fontFamily: FONT, lineHeight: 1.5 }}>
                            Are you sure you want to delete <strong style={{ color: "#0f172a" }}>{productToDelete.productName}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 30, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: "#fff", border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
                                {productToDelete.imageUrl && <SmartImage src={productToDelete.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, textTransform: "uppercase" }}>SKU</div>
                                <div style={{ fontSize: 14, fontWeight: 400, color: "#1e293b" }}>{productToDelete.sku}</div>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <button
                                onClick={async () => {
                                    try {
                                        await remove(ref(db, `inventory/${productToDelete.id}`));

                                        // Delete images from Cloudinary
                                        if (productToDelete.imageUrl) await deleteImage(productToDelete.imageUrl);
                                        if (productToDelete.imageUrls && productToDelete.imageUrls.length > 0) {
                                            await Promise.all(productToDelete.imageUrls.map(url => deleteImage(url)));
                                        }

                                        setProductToDelete(null);
                                    } catch (e) { console.error(e); alert("Failed to delete."); }
                                }}
                                style={{ background: "#ef4444", color: "#fff", border: "none", width: "100%", padding: "16px", borderRadius: 14, fontSize: 16, fontWeight: 400, cursor: "pointer" }}
                            >
                                Delete Inventory
                            </button>
                            <button onClick={() => setProductToDelete(null)} style={{ width: "100%", padding: "16px", background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 14, fontSize: 16, fontWeight: 400, cursor: "pointer" }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}