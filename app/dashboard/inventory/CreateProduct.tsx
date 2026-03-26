"use client";

import React, { useState, useRef } from "react";
import { ref, push, set as rtdbSet, get, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../../lib/firebase";
import {
    FONT, UNITS, GST_RATES, Product, Category, Collection
} from "./types";
import {
    Input, Textarea, Select, FormField, SectionDivider,
    BtnPrimary, BtnGhost, SuccessBanner, Card, PageHeader,
} from "./ui";

const EMPTY: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
    productName: "", sku: "", category: "", collection: "", brand: "",
    price: 0, costPrice: 0, stock: 0, minStock: 5,
    status: "active", imageUrl: "", description: "",
    unit: "PCS", size: "", hsnCode: "", gstRate: 18,
};

export default function CreateProduct({ 
    categories, 
    collections,
    user: currentUser, 
    onCreated 
}: { 
    categories: Category[], 
    collections: Collection[],
    user: { uid: string; name: string },
    onCreated?: (p: Product) => void 
}) {
    const [form, setForm] = useState({ ...EMPTY });
    const [sizeOption, setSizeOption] = useState("");
    const [customSize, setCustomSize] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [imagePreview, setImagePreview] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const set = (k: keyof typeof EMPTY, v: any) => {
        setForm(f => ({ ...f, [k]: v }));
        setErrors(e => { const ne = { ...e }; delete ne[k as string]; return ne; });
    };

    const handleSizeOption = (opt: string) => {
        setSizeOption(opt);
        if (opt !== "Other") {
            set("size", opt);
            setCustomSize("");
        } else {
            set("size", customSize);
        }
    };

    const handleCustomSize = (val: string) => {
        setCustomSize(val);
        set("size", val);
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.productName.trim()) e.productName = "Product name is required";
        if (!form.sku.trim()) e.sku = "SKU is required";
        if (form.price <= 0) e.price = "Selling price must be greater than 0";
        return e;
    };

    const handleImageUrl = (url: string) => {
        set("imageUrl", url);
        setImagePreview(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const result = ev.target?.result as string;
            setImagePreview(result);
            set("imageUrl", result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSaving(true);
        console.log("DEBUG: Starting handleSave for product:", form.productName);
        try {
            // SKU uniqueness check
            const skuQuery = query(ref(db, "inventory"), orderByChild("sku"), equalTo(form.sku.trim()));
            const skuSnap = await get(skuQuery);
            if (skuSnap.exists()) {
                setErrors(prev => ({ ...prev, sku: "This SKU already exists. Please use a unique SKU." }));
                setSaving(false);
                return;
            }

            let finalImageUrl = form.imageUrl;
            
            // Upload to Cloudinary if it's a local file (base64)
            if (finalImageUrl && finalImageUrl.startsWith("data:image")) {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: finalImageUrl })
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || "Failed to upload image to Cloudinary");
                }
                finalImageUrl = data.secure_url;
            }

            let autoStatus = form.status;
            if (form.status === "active") {
                 if (Number(form.stock) <= 0) autoStatus = "out-of-stock";
                 else if (Number(form.stock) <= Number(form.minStock)) autoStatus = "low-stock";
            }
            
            const docData = {
                ...form,
                imageUrl: finalImageUrl,
                status: autoStatus,
                price: Number(form.price),
                costPrice: Number(form.costPrice),
                stock: Number(form.stock),
                minStock: Number(form.minStock),
                gstRate: Number(form.gstRate),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: currentUser.uid,
                createdByName: currentUser.name,
                updatedBy: currentUser.uid,
                updatedByName: currentUser.name,
            };

            // Removed size check since image is now safely hosted on Cloudinary

            console.log("DEBUG: Calling push/set...");
            const newRef = push(ref(db, "inventory"));
            await rtdbSet(newRef, docData);
            console.log("DEBUG: create success, ID:", newRef.key);
            
            const created = { id: newRef.key as string, ...docData } as Product;
            
            // Re-fetch to ensure sync as per user request
            onCreated?.(created);
            
            setForm({ ...EMPTY });
            setSizeOption("");
            setCustomSize("");
            setImagePreview("");
            setSuccess(`Product "${created.productName}" created successfully.`);
            alert(`Product "${created.productName}" created successfully!`);
        } catch (err) {
            console.error("DEBUG: Error in handleSave:", err);
            const msg = err instanceof Error ? err.message : "Possible network issue or missing permissions.";
            alert("Failed to save product: " + msg);
        } finally {
            console.log("DEBUG: handleSave flow completed.");
            setSaving(false);
        }
    };

    const handleReset = () => { setForm({ ...EMPTY }); setSizeOption(""); setCustomSize(""); setImagePreview(""); setErrors({}); };

    const fieldStyle = (key: string): React.CSSProperties =>
        errors[key] ? { borderColor: "#ef4444" } : {};

    const profit = form.price > 0 && form.costPrice > 0 ? form.price - form.costPrice : null;
    const margin = profit !== null ? ((profit / form.price) * 100).toFixed(1) : null;
    const gstAmt = form.price > 0 ? ((form.price * form.gstRate) / 100).toFixed(2) : null;

    return (
        <div>
            <PageHeader title="Create Item" sub="Add a new item to your inventory." />

            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>

                {/* ── Left column — main fields ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Basic Info */}
                    <Card>
                        <div style={{ padding: "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 16, fontFamily: FONT }}>Basic Information</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <FormField label="Item Name" required>
                                    <Input
                                        value={form.productName}
                                        onChange={e => set("productName", e.target.value)}
                                        style={fieldStyle("productName")}
                                    />
                                    {errors.productName && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{errors.productName}</div>}
                                </FormField>
                                <FormField label="SKU" required>
                                    <Input
                                        value={form.sku}
                                        onChange={e => set("sku", e.target.value)}
                                        style={fieldStyle("sku")}
                                    />
                                    {errors.sku && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{errors.sku}</div>}
                                </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <FormField label="Category">
                                    <Select value={form.category} onChange={e => set("category", e.target.value)}>
                                        <option value="">Select Category...</option>
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </Select>
                                </FormField>
                                <FormField label="Collection">
                                    <Select value={form.collection || ""} onChange={e => set("collection", e.target.value)}>
                                        <option value="">Select Collection...</option>
                                        {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </Select>
                                </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <FormField label="Brand">
                                    <Input value={form.brand} onChange={e => set("brand", e.target.value)} />
                                </FormField>
                                <div />
                            </div>
                            <FormField label="Product Description">
                                <Textarea
                                    value={form.description}
                                    onChange={e => set("description", e.target.value)}
                                    rows={3}
                                />
                            </FormField>
                        </div>
                    </Card>

                    {/* Pricing */}
                    <Card>
                        <div style={{ padding: "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 16, fontFamily: FONT }}>Pricing & Tax</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <FormField label="Selling Price (Rs.)" required>
                                    <Input
                                        type="number" min="0" step="0.01"
                                        value={form.price === 0 ? "" : form.price}
                                        onChange={e => set("price", Number(e.target.value) || 0)}
                                        style={fieldStyle("price")}
                                    />
                                    {errors.price && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{errors.price}</div>}
                                </FormField>
                                <FormField label="Cost Price (Rs.)">
                                    <Input
                                        type="number" min="0" step="0.01"
                                        value={form.costPrice === 0 ? "" : form.costPrice}
                                        onChange={e => set("costPrice", Number(e.target.value) || 0)}
                                    />
                                </FormField>
                                <FormField label="GST Rate">
                                    <Select value={form.gstRate} onChange={e => set("gstRate", Number(e.target.value))}>
                                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                    </Select>
                                </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <FormField label="HSN Code">
                                    <Input
                                        value={form.hsnCode}
                                        onChange={e => set("hsnCode", e.target.value)}
                                    />
                                </FormField>
                                <div />
                            </div>

                            {/* Margin calculator */}
                            {profit !== null && (
                                <div style={{ display: "flex", gap: 16, marginTop: 14, padding: "10px 14px", background: profit >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${profit >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 9 }}>
                                    <span style={{ fontSize: 13, color: "#64748b", fontFamily: FONT }}>
                                        Profit: <span style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                                            Rs.{profit.toLocaleString("en-IN")}
                                        </span>
                                    </span>
                                    <span style={{ fontSize: 13, color: "#64748b", fontFamily: FONT }}>
                                        Margin: <span style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{margin}%</span>
                                    </span>
                                    {gstAmt && (
                                        <span style={{ fontSize: 13, color: "#64748b", fontFamily: FONT }}>
                                            GST ({form.gstRate}%): <span style={{ color: "#6366f1", fontWeight: 600 }}>Rs.{gstAmt}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Stock & Unit */}
                    <Card>
                        <div style={{ padding: "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 16, fontFamily: FONT }}>Stock & Unit</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                                <FormField label="Opening Stock">
                                    <Input
                                        type="number" min="0"
                                        value={form.stock === 0 ? "" : form.stock}
                                        onChange={e => set("stock", Number(e.target.value) || 0)}
                                    />
                                </FormField>
                                <FormField label="Min Stock (Alert)">
                                    <Input
                                        type="number" min="0"
                                        value={form.minStock === 0 ? "" : form.minStock}
                                        onChange={e => set("minStock", Number(e.target.value) || 0)}
                                    />
                                </FormField>
                                <FormField label="Unit">
                                    <Select value={form.unit} onChange={e => set("unit", e.target.value)}>
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </Select>
                                </FormField>
                            </div>

                            {/* Size Selection */}
                            <div style={{ display: "grid", gridTemplateColumns: sizeOption === "Other" ? "1fr 1fr" : "1fr", gap: 14, marginTop: 14 }}>
                                <FormField label="Select Size">
                                    <Select value={sizeOption} onChange={e => handleSizeOption(e.target.value)}>
                                        <option value="">No specific size</option>
                                        <option value="Single">Single</option>
                                        <option value="Double">Double</option>
                                        <option value="King">King</option>
                                        <option value="Super">Super</option>
                                        <option value="Other">Other / Custom</option>
                                    </Select>
                                </FormField>
                                {sizeOption === "Other" && (
                                    <FormField label="Enter Custom Size">
                                        <Input
                                            value={customSize}
                                            onChange={e => handleCustomSize(e.target.value)}
                                        />
                                    </FormField>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── Right column — image + status ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Product Image */}
                    <Card>
                        <div style={{ padding: "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Product Image</div>

                            {/* Preview box */}
                            <div
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    width: "100%", aspectRatio: "1 / 1", maxHeight: 220,
                                    borderRadius: 10, border: "2px dashed #e2e8f0",
                                    background: "#f8fafc", display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", overflow: "hidden", marginBottom: 12,
                                    transition: "border-color 0.2s",
                                }}
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        onError={() => setImagePreview("")} />
                                ) : (
                                    <div style={{ textAlign: "center", padding: 16 }}>
                                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: "0 auto 8px", color: "#cbd5e1" }}>
                                            <rect x="3" y="3" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" />
                                            <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                                            <path d="M3 22l7-5 5 4 5-6 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>Click to upload image</div>
                                        <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 3, fontFamily: FONT }}>PNG, JPG, WEBP</div>
                                    </div>
                                )}
                            </div>

                            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

                            <FormField label="Or paste image URL">
                                <Input
                                    value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
                                    onChange={e => handleImageUrl(e.target.value)}
                                />
                            </FormField>

                            {imagePreview && (
                                <button
                                    onClick={() => { setImagePreview(""); set("imageUrl", ""); }}
                                    style={{ marginTop: 8, fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, padding: 0 }}
                                >
                                    Remove image
                                </button>
                            )}
                        </div>
                    </Card>

                    {/* Status */}
                    <Card>
                        <div style={{ padding: "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Status</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(["active", "inactive", "low-stock", "out-of-stock"] as const).map(s => {
                                    const colors: Record<string, { label: string; color: string; bg: string }> = {
                                        active: { label: "Active", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
                                        inactive: { label: "Inactive", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
                                        "low-stock": { label: "Low Stock", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
                                        "out-of-stock": { label: "Out of Stock", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
                                    };
                                    const c = colors[s];
                                    const isSelected = form.status === s;
                                    return (
                                        <button key={s} onClick={() => set("status", s)} style={{
                                            padding: "10px 14px", borderRadius: 9, textAlign: "left",
                                            border: `1.5px solid ${isSelected ? c.color : "#e2e8f0"}`,
                                            background: isSelected ? c.bg : "#fff", cursor: "pointer",
                                            display: "flex", alignItems: "center", gap: 10,
                                            transition: "all 0.15s",
                                        }}>
                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isSelected ? c.color : "#e2e8f0", flexShrink: 0 }} />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? c.color : "#94a3b8", fontFamily: FONT }}>{c.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>

                    {/* Summary */}
                    <Card>
                        <div style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>Summary</div>
                            {[
                                ["Name", form.productName || "—"],
                                ["SKU", form.sku || "—"],
                                ["Unit", form.unit],
                                ["Stock", `${form.stock} ${form.unit}`],
                                ["Price", form.price > 0 ? `Rs.${form.price}` : "—"],
                                ["GST", `${form.gstRate}%`],
                                ["HSN", form.hsnCode || "—"],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                                    <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>{k}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", fontFamily: FONT, maxWidth: 140, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Action bar */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
                <BtnGhost onClick={handleReset}>Reset</BtnGhost>
                <BtnPrimary onClick={handleSave} loading={saving} disabled={saving}>
                    Create Item
                </BtnPrimary>
            </div>
        </div>
    );
}