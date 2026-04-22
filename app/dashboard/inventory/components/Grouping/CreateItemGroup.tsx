"use client";

import React, { useState, useEffect } from "react";
import { ref, push, set } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { FONT, Product, ItemGroup } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, SuccessBanner, Card, PageHeader } from "../../ui";
import { touchDataSignal } from "../../../../lib/dataSignals";

export default function CreateItemGroup({ products, user, onCreated, isMobile }: {
    products: Product[];
    user: { uid: string; name: string };
    onCreated?: (g: ItemGroup) => void;
    isMobile?: boolean;
}) {
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
        if (saving) return;
        if (!name.trim()) { setError("Group name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), productIds: Array.from(selected), createdAt: Date.now() };
            const newRef = push(ref(db, "itemGroups"));
            await set(newRef, d);
            await touchDataSignal("itemGroups");

            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Item Group Created",
                description: `Item Group "${name}" was created by ${user.name} with ${selected.size} products.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { groupId: newRef.key }
            });

            onCreated?.({ id: newRef.key as string, ...d } as ItemGroup);
            setSuccess(`Group "${name}" created.`);
            setName(""); setDesc(""); setSelected(new Set()); setError("");
        } catch (e) { console.error(e); alert("Failed to create group."); }
        finally { setSaving(false); }
    };

    const filteredProducts = products.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
    const itemsPerPage = 5;
    const paginated = filteredProducts.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage);

    return (
        <div>
            <PageHeader title="Create Item Group" sub="Group products together for easier management and cataloging." />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <Card>
                <div style={{ padding: "20px 22px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 30 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <FormField label="Group Name" required>
                                <Input value={name} onChange={e => { setName(e.target.value); setError(""); }} style={error ? { borderColor: "#ef4444" } : {}} />
                                {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                            </FormField>
                            <FormField label="Description">
                                <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} />
                            </FormField>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Select Products ({selected.size})</div>
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Product / SKU" />
                            <div style={{ maxHeight: 310, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
                                {paginated.map(p => (
                                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer" }} />
                                        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {p.imageUrl ? <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10 }}>📦</span>}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.productName}</span>
                                            <span style={{ fontSize: 10, color: "#64748b", fontFamily: FONT }}>SKU: {p.sku || "N/A"}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {/* Pagination */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                <button disabled={itemPage === 1} onClick={() => setItemPage(p => p - 1)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: itemPage === 1 ? "#f8fafc" : "#fff", color: itemPage === 1 ? "#cbd5e1" : "#475569", cursor: itemPage === 1 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500 }}>Prev</button>
                                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>Page {itemPage}</span>
                                <button disabled={itemPage * itemsPerPage >= filteredProducts.length} onClick={() => setItemPage(p => p + 1)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: (itemPage * itemsPerPage >= filteredProducts.length) ? "#f8fafc" : "#fff", color: (itemPage * itemsPerPage >= filteredProducts.length) ? "#cbd5e1" : "#475569", cursor: (itemPage * itemsPerPage >= filteredProducts.length) ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500 }}>Next</button>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 30, borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
                        <BtnGhost onClick={() => { setName(""); setDesc(""); setSelected(new Set()); setError(""); }}>Reset Form</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Create Item Group</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}
