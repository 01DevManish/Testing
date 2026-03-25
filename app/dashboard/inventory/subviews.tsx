"use client";

import React, { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { FONT, Category, Collection, ItemGroup } from "./types";
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
            const d = { name: name.trim(), description: desc.trim(), createdAt: Timestamp.now() };
            const ref = await addDoc(collection(db, "categories"), d);
            onCreated?.({ id: ref.id, ...d } as Category);
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
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{c.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{c.name}</div>
                                    {c.description && <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{c.description}</div>}
                                </div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{c.createdAt?.toDate?.().toLocaleDateString("en-IN") ?? ""}</div>
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

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError("Collection name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), productIds: Array.from(selected), createdAt: Timestamp.now() };
            const ref = await addDoc(collection(db, "collections"), d);
            onCreated?.({ id: ref.id, ...d } as Collection);
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>
                            Add Products ({selected.size} selected)
                        </div>
                        <div style={{ maxHeight: 320, overflowY: "auto" }}>
                            {products.length === 0 ? (
                                <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontFamily: FONT }}>No products available</div>
                            ) : products.map(p => (
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
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{c.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{c.name}</div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{c.productIds?.length ?? 0} products</div>
                                </div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{c.createdAt?.toDate?.().toLocaleDateString("en-IN") ?? ""}</div>
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

    const toggle = (id: string) => {
        const s = new Set(selected);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelected(s);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError("Group name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), productIds: Array.from(selected), createdAt: Timestamp.now() };
            const ref = await addDoc(collection(db, "itemGroups"), d);
            onCreated?.({ id: ref.id, ...d } as ItemGroup);
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>
                            Add Items ({selected.size} selected)
                        </div>
                        <div style={{ maxHeight: 320, overflowY: "auto" }}>
                            {products.map(p => (
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
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{g.name[0]?.toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{g.name}</div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{g.productIds?.length ?? 0} items</div>
                                </div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: FONT }}>{g.createdAt?.toDate?.().toLocaleDateString("en-IN") ?? ""}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// INVENTORY STOCK ACTIONS (Add / Remove)
// ══════════════════════════════════════════════════════════════
interface StockActionProps {
    products: { id: string; productName: string; stock: number; unit: string }[];
    mode: "add" | "remove";
    onDone?: () => void;
}

export function StockAction({ products, mode, onDone }: StockActionProps) {
    const [productId, setProductId] = useState("");
    const [qty, setQty] = useState(1);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");

    const selected = products.find(p => p.id === productId);

    const handleSubmit = async () => {
        if (!productId) { alert("Select a product"); return; }
        if (qty <= 0) { alert("Quantity must be at least 1"); return; }
        if (mode === "remove" && selected && qty > selected.stock) { alert("Cannot remove more than available stock"); return; }
        setSaving(true);
        try {
            const { updateDoc, doc, Timestamp } = await import("firebase/firestore");
            const newStock = mode === "add" ? (selected?.stock || 0) + qty : (selected?.stock || 0) - qty;
            const autoStatus = newStock <= 0 ? "out-of-stock" : "active";
            await updateDoc(doc(db, "inventory", productId), { stock: newStock, status: autoStatus, updatedAt: Timestamp.now() });
            setSuccess(`${mode === "add" ? "Added" : "Removed"} ${qty} ${selected?.unit || "units"} ${mode === "add" ? "to" : "from"} "${selected?.productName}".`);
            setProductId(""); setQty(1); setReason(""); onDone?.();
        } catch (e) { console.error(e); alert("Failed to update stock."); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <PageHeader
                title={mode === "add" ? "Add Stock" : "Remove Stock"}
                sub={mode === "add" ? "Increase inventory quantity for a product." : "Decrease inventory quantity for a product."}
            />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <Card style={{ maxWidth: 520 }}>
                <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <FormField label="Select Product" required>
                        <select value={productId} onChange={e => setProductId(e.target.value)}
                            style={{ width: "100%", padding: "10px 13px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, color: "#1e293b", fontSize: 13, fontFamily: FONT, outline: "none", cursor: "pointer" }}>
                            <option value="">Choose product...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.productName} (Stock: {p.stock} {p.unit})</option>
                            ))}
                        </select>
                    </FormField>

                    {selected && (
                        <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: FONT }}>
                            Current Stock: <strong style={{ color: "#6366f1" }}>{selected.stock} {selected.unit}</strong>
                            {mode === "remove" && <span style={{ color: "#94a3b8" }}> → After removal: <strong style={{ color: selected.stock - qty <= 0 ? "#ef4444" : "#10b981" }}>{Math.max(0, selected.stock - qty)} {selected.unit}</strong></span>}
                            {mode === "add" && <span style={{ color: "#94a3b8" }}> → After addition: <strong style={{ color: "#10b981" }}>{selected.stock + qty} {selected.unit}</strong></span>}
                        </div>
                    )}

                    <FormField label="Quantity" required>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 18, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                            <Input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ textAlign: "center", fontWeight: 700, fontSize: 16 }} />
                            <button onClick={() => setQty(q => q + 1)} style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 18, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                    </FormField>

                    <FormField label="Reason / Notes">
                        <Input placeholder={mode === "add" ? "e.g. Purchase from supplier" : "e.g. Damaged goods, customer return"} value={reason} onChange={e => setReason(e.target.value)} />
                    </FormField>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                        <BtnGhost onClick={() => { setProductId(""); setQty(1); setReason(""); }}>Reset</BtnGhost>
                        <BtnPrimary onClick={handleSubmit} loading={saving}
                            style={{ background: mode === "remove" ? "#ef4444" : "#6366f1" }}>
                            {mode === "add" ? "Add Stock" : "Remove Stock"}
                        </BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
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
// REPORTS PLACEHOLDER
// ══════════════════════════════════════════════════════════════
export function Reports({ products }: { products: { price: number; stock: number; status: string; category: string }[] }) {
    const total = products.length;
    const inStock = products.filter(p => p.stock > 0).length;
    const outStock = products.filter(p => p.stock <= 0).length;
    const totalVal = products.reduce((s, p) => s + (p.price * p.stock), 0);

    const byCategory: Record<string, number> = {};
    products.forEach(p => { if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + 1; });

    return (
        <div>
            <PageHeader title="Reports" sub="Inventory overview and analytics." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                {[
                    { label: "Total Products", value: total, color: "#6366f1" },
                    { label: "In Stock", value: inStock, color: "#10b981" },
                    { label: "Out of Stock", value: outStock, color: "#ef4444" },
                    { label: "Total Value", value: `Rs.${totalVal.toLocaleString("en-IN")}`, color: "#f59e0b" },
                ].map(s => (
                    <Card key={s.label}>
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, marginBottom: 10 }} />
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", fontFamily: FONT, marginBottom: 3 }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>{s.label}</div>
                        </div>
                    </Card>
                ))}
            </div>
            <Card>
                <div style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Products by Category</div>
                    {Object.entries(byCategory).length === 0 ? (
                        <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: FONT }}>No category data.</div>
                    ) : Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                        const pct = Math.round((count / total) * 100);
                        return (
                            <div key={cat} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, color: "#374151", fontFamily: FONT }}>{cat}</span>
                                    <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{count} ({pct}%)</span>
                                </div>
                                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 99 }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}