"use client";

import React, { useState, useEffect } from "react";
import { ref, push, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { FONT, Category, Collection, ItemGroup, Product } from "./types";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, SuccessBanner, Card, PageHeader, EmptyState } from "./ui";

// ══════════════════════════════════════════════════════════════
// CREATE CATEGORY
// ══════════════════════════════════════════════════════════════
export function CreateCategory({ onCreated }: { onCreated?: (c: Category) => void }) {
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
                        <Input placeholder="e.g. Clothing" value={name} onChange={e => { setName(e.target.value); setError(""); }}
                            style={error ? { borderColor: "#ef4444" } : {}} />
                        {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                    </FormField>
                    <FormField label="Description">
                        <Textarea placeholder="Optional description..." value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
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
export function CategoryList({ categories, loading, onCreateNew }: { categories: Category[]; loading: boolean; onCreateNew: () => void }) {
    return (
        <div>
            <PageHeader title="All Categories" sub={`${categories.length} categories`}>
                <BtnPrimary onClick={onCreateNew}>+ New Category</BtnPrimary>
            </PageHeader>
            <Card>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontFamily: FONT, fontSize: 13 }}>Loading...</div>
                ) : categories.length === 0 ? (
                    <EmptyState title="No categories yet" sub="Create your first category to organize products." />
                ) : (
                    <div>
                        {categories.map((c, i) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: i < categories.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 14 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{c.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{c.name}</div>
                                    {c.description && <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{c.description}</div>}
                                </div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// CREATE COLLECTION
// ══════════════════════════════════════════════════════════════
export function CreateCollection({ products, onCreated }: { products: { id: string; productName: string }[]; onCreated?: (c: Collection) => void }) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError("Collection name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), productIds: Array.from(selected), createdAt: Date.now() };
            const newRef = push(ref(db, "collections"));
            await set(newRef, d);
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
                <Card>
                    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                        <FormField label="Collection Name" required>
                            <Input placeholder="e.g. Summer 2025" value={name} onChange={e => { setName(e.target.value); setError(""); }}
                                style={error ? { borderColor: "#ef4444" } : {}} />
                            {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                        </FormField>
                        <FormField label="Description">
                            <Textarea placeholder="Optional..." value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                        </FormField>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <BtnGhost onClick={() => { setName(""); setDesc(""); setSelected(new Set()); setError(""); }}>Reset</BtnGhost>
                            <BtnPrimary onClick={handleSave} loading={saving}>Create Collection</BtnPrimary>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ padding: "16px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>
                            Add Products ({selected.size} selected)
                        </div>
                        <Input 
                            placeholder="Search products..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ marginBottom: 12, height: 36, fontSize: 12 }}
                        />
                        <div style={{ maxHeight: 320, overflowY: "auto" }}>
                            {products.length === 0 ? (
                                <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontFamily: FONT }}>No products available</div>
                            ) : products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase())).map(p => (
                                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                        style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                                    <span style={{ fontSize: 13, color: "#1e293b", fontFamily: FONT }}>{p.productName}</span>
                                </label>
                            ))}
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
export function CollectionList({ collections, loading, onCreateNew }: { collections: Collection[]; loading: boolean; onCreateNew: () => void }) {
    return (
        <div>
            <PageHeader title="All Collections" sub={`${collections.length} collections`}>
                <BtnPrimary onClick={onCreateNew}>+ New Collection</BtnPrimary>
            </PageHeader>
            <Card>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontFamily: FONT, fontSize: 13 }}>Loading...</div>
                ) : collections.length === 0 ? (
                    <EmptyState title="No collections yet" sub="Create a collection to group related products." />
                ) : (
                    <div>
                        {collections.map((c, i) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: i < collections.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#8b5cf6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 14 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{c.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{c.name}</div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{c.productIds?.length ?? 0} products</div>
                                </div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// CREATE ITEM GROUP
// ══════════════════════════════════════════════════════════════
export function CreateItemGroup({ products, onCreated }: { products: { id: string; productName: string }[]; onCreated?: (g: ItemGroup) => void }) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
                <Card>
                    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                        <FormField label="Group Name" required>
                            <Input placeholder="e.g. Seasonal Items" value={name} onChange={e => { setName(e.target.value); setError(""); }}
                                style={error ? { borderColor: "#ef4444" } : {}} />
                            {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                        </FormField>
                        <FormField label="Description">
                            <Textarea placeholder="Optional..." value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                        </FormField>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <BtnGhost onClick={() => { setName(""); setDesc(""); setSelected(new Set()); setError(""); }}>Reset</BtnGhost>
                            <BtnPrimary onClick={handleSave} loading={saving}>Create Group</BtnPrimary>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ padding: "16px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>
                            Add Items ({selected.size} selected)
                        </div>
                        <Input 
                            placeholder="Search items..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ marginBottom: 12, height: 36, fontSize: 12 }}
                        />
                        <div style={{ maxHeight: 320, overflowY: "auto" }}>
                            {products.filter(p => p.productName.toLowerCase().includes(search.toLowerCase())).map(p => (
                                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                        style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                                    <span style={{ fontSize: 13, color: "#1e293b", fontFamily: FONT }}>{p.productName}</span>
                                </label>
                            ))}
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
export function ItemGroupList({ groups, loading, onCreateNew }: { groups: ItemGroup[]; loading: boolean; onCreateNew: () => void }) {
    return (
        <div>
            <PageHeader title="All Item Groups" sub={`${groups.length} groups`}>
                <BtnPrimary onClick={onCreateNew}>+ New Group</BtnPrimary>
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
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{g.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{g.name}</div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{g.productIds?.length ?? 0} items</div>
                                </div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{new Date(g.createdAt).toLocaleDateString("en-IN")}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// INVENTORY ADJUSTMENT
// ══════════════════════════════════════════════════════════════
export function InventoryAdjustment({ products, collections, onDone }: { products: Product[], collections: Collection[], onDone?: () => void }) {
    const [search, setSearch] = useState("");
    const [filterCol, setFilterCol] = useState("all");
    const [filterSize, setFilterSize] = useState("all");
    const [successMsg, setSuccessMsg] = useState("");

    const sizes = Array.from(new Set([
        ...products.map(p => p.unit).filter(Boolean), 
        ...products.map(p => p.size).filter(Boolean),
        "Single", "Double", "King", "Super King"
    ]));

    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(""), 4000);
            return () => clearTimeout(t);
        }
    }, [successMsg]);

    const filtered = products.filter(p => {
        const matchSearch = p.productName.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
        const matchSize = filterSize === "all" || p.unit === filterSize || p.size === filterSize;
        
        let matchCol = true;
        if (filterCol !== "all") {
            const c = collections.find(x => x.id === filterCol);
            if (c) matchCol = c.productIds?.includes(p.id);
            else matchCol = false;
        }

        return matchSearch && matchSize && matchCol;
    });

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
                    fontWeight: 700, 
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
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <Input placeholder="Search product by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: "none", cursor: "pointer", background: "#f8fafc" }}>
                        <option value="all">All Collections</option>
                        {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Product & Info</th>
                                <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: FONT, textTransform: "uppercase" }}>Current Stock</th>
                                <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", textAlign: "right" }}>Adjust Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => <AdjustRow key={p.id} p={p} onRefresh={() => { onDone?.(); setSuccessMsg(`Stock updated for ${p.productName}`); }} />)}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 14 }}>No products match your filters.</div>
                    )}
                </div>
            </Card>
        </div>
    );
}

function AdjustRow({ p, onRefresh }: { p: Product, onRefresh?: () => void }) {
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
            await update(ref(db, `inventory/${p.id}`), { stock: newStock, status: autoStatus, updatedAt: Date.now() });
            setQty(1);
            setConfirm(null);
            onRefresh?.();
        } catch(e) { console.error(e); alert("Update failed"); setConfirm(null); }
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{p.productName}</div>
                        <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>
                            SKU: {p.sku} • {p.unit || "PCS"}{p.size ? ` • ${p.size}` : ""}
                        </div>
                    </div>
                </div>
            </td>
            <td style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontFamily: FONT }}>
                    {p.stock}
                </div>
                {p.stock <= p.minStock && p.stock > 0 && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Low Stock</span>}
            </td>
            <td style={{ padding: "14px 16px", textAlign: "right", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <input 
                        type="number" min="1" value={qty} 
                        onChange={e => setQty(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: 60, padding: "8px", border: "1.5px solid #e2e8f0", borderRadius: 8, textAlign: "center", fontSize: 14, fontWeight: 600, outline: "none" }}
                    />
                    <button onClick={() => setConfirm({ mode: "add" })} disabled={saving} style={{ padding: "8px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add</button>
                    <button onClick={() => setConfirm({ mode: "remove" })} disabled={saving} style={{ padding: "8px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>- Remove</button>
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

                            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 8px", fontFamily: FONT }}>
                                {confirm.mode === "add" ? "Add Stock" : "Remove Stock"}?
                            </h3>
                            <p style={{ fontSize: 15, color: "#64748b", fontWeight: 500, margin: "0 0 24px", fontFamily: FONT, lineHeight: 1.5 }}>
                                You are adjusting <strong>{qty} {p.unit || "units"}</strong> for:<br/>
                                <span style={{ color: "#1e293b", fontWeight: 700 }}>{p.productName}</span>
                            </p>

                            {/* Product Preview Snippet */}
                            <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 30, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                                <div style={{ width: 50, height: 50, borderRadius: 10, background: "#fff", border: "1.5px solid #e2e8f0", overflow: "hidden", flexShrink: 0 }}>
                                    {p.imageUrl && <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Stock</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>
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
                                        fontWeight: 700, 
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
                                        fontWeight: 600, 
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
// ══════════════════════════════════════════════════════════════
export function BarcodeView({ mode }: { mode: "create" | "print" }) {
    return (
        <div>
            <PageHeader title={mode === "create" ? "Create Barcode" : "Print Barcode"} sub={mode === "create" ? "Generate barcodes for your products." : "Print barcodes for selected products."} />
            <Card>
                <div style={{ padding: "60px 32px", textAlign: "center" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                            <rect x="2" y="4" width="3" height="18" rx="1" fill="white" />
                            <rect x="7" y="4" width="2" height="18" rx="1" fill="white" />
                            <rect x="11" y="4" width="4" height="18" rx="1" fill="white" />
                            <rect x="17" y="4" width="2" height="18" rx="1" fill="white" />
                            <rect x="21" y="4" width="3" height="18" rx="1" fill="white" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginBottom: 6, fontFamily: FONT }}>
                        {mode === "create" ? "Barcode Generator" : "Barcode Printer"}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: FONT }}>
                        {mode === "create" ? "Connect a barcode library (e.g. JsBarcode) to enable barcode generation." : "Select products and send barcodes to your printer."}
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW (ALL INVENTORY DASHBOARD)
// ══════════════════════════════════════════════════════════════
export function Overview({ products }: { products: Product[] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    const total = products.length;
    const inStock = products.filter(p => p.stock > 0).length;
    const outStock = products.filter(p => p.stock <= 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    
    const totalVal = products.reduce((s, p) => s + (p.price * p.stock), 0);
    const totalCost = products.reduce((s, p) => s + (p.costPrice * p.stock), 0);

    const byCategory: Record<string, number> = {};
    products.forEach(p => { if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + 1; });

    const recentProducts = [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    const filteredStock = products.filter(p => {
        const matchQ = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        let matchS = true;
        if (filterStatus === "in-stock") matchS = p.stock > p.minStock;
        if (filterStatus === "low-stock") matchS = p.stock > 0 && p.stock <= p.minStock;
        if (filterStatus === "out-stock") matchS = p.stock <= 0;
        return matchQ && matchS;
    });

    return (
        <div>
            <PageHeader title="Inventory Overview" sub="Comprehensive view of your entire stock status." />
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
                {[
                    { label: "Total Products", value: total, color: "#6366f1" },
                    { label: "In Stock Items", value: inStock, color: "#10b981" },
                    { label: "Low Stock Alert", value: lowStock, color: "#f59e0b" },
                    { label: "Out of Stock", value: outStock, color: "#ef4444" },
                    { label: "Total Asset Value", value: `₹${totalVal.toLocaleString("en-IN")}`, color: "#8b5cf6" },
                ].map((s, i) => (
                    <Card key={i}>
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, marginBottom: 10 }} />
                            <div style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", fontFamily: FONT, marginBottom: 3 }}>
                                {s.value}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT, fontWeight: 400 }}>
                                {s.label}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>
                <Card>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Recently Added Products</div>
                        {recentProducts.length === 0 ? (
                            <EmptyState title="No Products" sub="Your inventory is currently empty." />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {recentProducts.map(p => (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <span style={{ fontSize: 16, color: "#cbd5e1" }}>📦</span>
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", fontFamily: FONT }}>{p.productName}</div>
                                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>SKU: {p.sku} • Stock: {p.stock}</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: FONT }}>₹{p.price.toLocaleString("en-IN")}</div>
                                            <div style={{ fontSize: 11, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontWeight: 500, fontFamily: FONT }}>
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
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Products by Category</div>
                        {Object.entries(byCategory).length === 0 ? (
                            <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: FONT, textAlign: "center", padding: "20px 0" }}>No category data.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, count]) => {
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={cat}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 500, color: "#334155", fontFamily: FONT }}>{cat}</span>
                                                <span style={{ fontSize: 11, color: "#64748b", fontFamily: FONT, fontWeight: 400 }}>{count} items ({pct}%)</span>
                                            </div>
                                            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                                                <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 99 }} />
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
                            <div style={{ fontSize: 15, fontWeight: 500, color: "#0f172a", fontFamily: FONT }}>Detailed Stock Levels</div>
                            <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 450, justifyContent: "flex-end" }}>
                                <input
                                    type="text"
                                    placeholder="Search product or SKU..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: FONT, outline: "none", flex: 1 }}
                                />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: FONT, outline: "none", background: "#f8fafc", cursor: "pointer", width: 130 }}
                                >
                                    <option value="all">All Status</option>
                                    <option value="in-stock">In Stock</option>
                                    <option value="low-stock">Low Stock</option>
                                    <option value="out-stock">Out of Stock</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ overflowX: "auto", maxHeight: 400 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                    <tr>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product</th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em" }}>SKU</th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Available Pieces</th>
                                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 500, color: "#64748b", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...filteredStock].sort((a,b) => a.stock - b.stock).map(p => (
                                        <tr key={p.id} style={{ transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b", fontWeight: 400, fontFamily: FONT }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", overflow: "hidden", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                                                        {p.imageUrl ? <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                                                    </div>
                                                    {p.productName}
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", fontFamily: FONT, fontWeight: 400 }}>{p.sku}</td>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontWeight: 500, fontFamily: FONT, textAlign: "right" }}>
                                                {p.stock}
                                                <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8", marginLeft: 4 }}>{p.unit || "PCS"}</span>
                                            </td>
                                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, fontFamily: FONT }}>
                                                <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 20, background: p.stock <= 0 ? "#fef2f2" : p.stock <= p.minStock ? "#fffbeb" : "#f0fdf4", color: p.stock <= 0 ? "#ef4444" : p.stock <= p.minStock ? "#f59e0b" : "#10b981", fontWeight: 500, border: `1px solid ${p.stock <= 0 ? "#fecaca" : p.stock <= p.minStock ? "#fde68a" : "#bbf7d0"}` }}>
                                                    {p.stock <= 0 ? "Out of Stock" : p.stock <= p.minStock ? "Low Stock" : "In Stock"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredStock.length === 0 && (
                                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14, fontFamily: FONT }}>No products match your search/filter.</div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}