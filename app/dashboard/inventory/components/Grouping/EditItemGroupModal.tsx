"use client";

import React, { useState, useEffect } from "react";
import { ref, update } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../../../lib/firebase";
import { FONT, Product, ItemGroup } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, Card } from "../../ui";
import { touchDataSignal } from "../../../../lib/dataSignals";

export default function EditItemGroupModal({ group, user, allProducts, onClose, isMobile }: { 
    group: ItemGroup; 
    user: { uid: string; name: string }; 
    allProducts: Product[]; 
    onClose: () => void;
    isMobile?: boolean; 
}) {
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
            await touchDataSignal("itemGroups");
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

    const filteredProducts = allProducts.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
    const itemsPerPage = 5;
    const paginated = filteredProducts.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage);

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
                                {paginated.map(p => (
                                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                                            style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {p.imageUrl ? <img src={p.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10 }}>📦</span>}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily: FONT, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</span>
                                            <span style={{ fontSize: 10, color: "#64748b", fontFamily: FONT }}>SKU: {p.sku || "N/A"}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                                <button disabled={itemPage === 1} onClick={() => setItemPage(p => p - 1)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: itemPage === 1 ? "#f8fafc" : "#fff", color: itemPage === 1 ? "#cbd5e1" : "#475569", cursor: itemPage === 1 ? "not-allowed" : "pointer", fontSize: 11 }}>Prev</button>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>Page {itemPage}</span>
                                <button disabled={itemPage * itemsPerPage >= filteredProducts.length} onClick={() => setItemPage(p => p + 1)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: (itemPage * itemsPerPage >= filteredProducts.length) ? "#f8fafc" : "#fff", color: (itemPage * itemsPerPage >= filteredProducts.length) ? "#cbd5e1" : "#475569", cursor: (itemPage * itemsPerPage >= filteredProducts.length) ? "not-allowed" : "pointer", fontSize: 11 }}>Next</button>
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

