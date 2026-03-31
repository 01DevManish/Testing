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
import ImageGallery from "./ImageGallery";
import { uploadToCloudinary } from "./cloudinary";
import { logActivity } from "../../lib/activityLogger";

const EMPTY: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
    productName: "", sku: "", styleId: "", category: "", collection: "", brand: "", brandId: "",
    price: 0, wholesalePrice: 0, mrp: 0, costPrice: 0, stock: 0, minStock: 5,
    status: "active", imageUrl: "", description: "",
    unit: "PCS", size: "", hsnCode: "", gstRate: 18,
};

export default function CreateProduct({ 
    categories, 
    collections,
    brands = [],
    user: currentUser, 
    onCreated,
    isMobile,
    isDesktop
}: { 
    categories: Category[], 
    collections: Collection[],
    brands?: { id: string, name: string, logoUrl?: string }[],
    user: { uid: string; name: string; role: string },
    onCreated?: (p: Product) => void,
    isMobile?: boolean,
    isDesktop?: boolean
}) {
    const [form, setForm] = useState({ ...EMPTY });
    const [sizeOption, setSizeOption] = useState("");
    const [customSize, setCustomSize] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [imagePreview, setImagePreview] = useState("");
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
    const [brandSearch, setBrandSearch] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const brandRef = useRef<HTMLDivElement>(null);

    // Auto close brand dropdown on click outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
                setBrandDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
            // Also add to gallery if not already there
            if (!galleryImages.includes(result)) {
                setGalleryImages(prev => [result, ...prev]);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGalleryChange = (imgs: string[]) => {
        setGalleryImages(imgs);
        // If the main image is removed from gallery, update it
        if (imgs.length > 0 && !imgs.includes(form.imageUrl)) {
            // keep it if it's external, or update to first gallery image
            if (form.imageUrl.startsWith("data:")) {
                 set("imageUrl", imgs[0]);
                 setImagePreview(imgs[0]);
            }
        } else if (imgs.length === 0) {
            set("imageUrl", "");
            setImagePreview("");
        }
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
            let finalImageUrls: string[] = [];
            
            // Upload all gallery images to Cloudinary
            if (galleryImages.length > 0) {
                const uploadPromises = galleryImages.map(img => uploadToCloudinary(img));
                finalImageUrls = await Promise.all(uploadPromises);
                
                // Set first image as main thumbnail if main image was one of the uploaded ones
                if (form.imageUrl.startsWith("data:")) {
                    const idx = galleryImages.indexOf(form.imageUrl);
                    finalImageUrl = idx !== -1 ? finalImageUrls[idx] : finalImageUrls[0];
                }
            }

            let autoStatus = form.status;
            if (form.status === "active") {
                 if (Number(form.stock) <= 0) autoStatus = "out-of-stock";
                 else if (Number(form.stock) <= Number(form.minStock)) autoStatus = "low-stock";
            }
            
            const docData = {
                ...form,
                imageUrl: finalImageUrl,
                imageUrls: finalImageUrls,
                status: autoStatus,
                price: Number(form.price),
                wholesalePrice: Number(form.wholesalePrice || 0),
                mrp: Number(form.mrp || 0),
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

            const newRef = push(ref(db, "inventory"));
            await rtdbSet(newRef, docData);
            
            // Log activity
            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Product Created",
                description: `Product "${docData.productName}" (SKU: ${docData.sku}) was created by ${currentUser.name}.`,
                userId: currentUser.uid,
                userName: currentUser.name,
                userRole: "admin",
                metadata: { productId: newRef.key }
            });

            console.log("DEBUG: create success, ID:", newRef.key);
            
            const created = { id: newRef.key as string, ...docData } as Product;
            
            // Re-fetch to ensure sync as per user request
            onCreated?.(created);
            
            setForm({ ...EMPTY });
            setSizeOption("");
            setCustomSize("");
            setImagePreview("");
            setGalleryImages([]);
            setSuccess(`Product "${created.productName}" created successfully.`);
            alert(`Product "${created.productName}" created successfully!`);
        } catch (err: any) {
            console.error("Save Error:", err);
            alert(err.message || "Failed to create product.");
        } finally {
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

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "start" }}>

                {/* ── Left column — main fields ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Basic Info */}
                    <Card>
                        <div style={{ padding: isMobile ? "16px" : "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 16, fontFamily: FONT }}>Basic Information</div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
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
                                <FormField label="Style ID (3 Digits)">
                                    <Input
                                        value={form.styleId || ""}
                                        maxLength={3}
                                        onChange={e => set("styleId", e.target.value.replace(/\D/g, ""))}
                                    />
                                </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
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
                             <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <FormField label="Brand">
                                    <div ref={brandRef} style={{ position: "relative" }}>
                                        <div 
                                            onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                                            style={{ 
                                                width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", 
                                                borderRadius: 10, fontSize: 14, background: "#fff", cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                minHeight: 44, transition: "all 0.2s"
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                {form.brandId ? (
                                                    <>
                                                        {brands.find(b => b.id === form.brandId)?.logoUrl && (
                                                            <img 
                                                                src={brands.find(b => b.id === form.brandId)?.logoUrl} 
                                                                alt="logo" 
                                                                style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 4, background: "#f8fafc", padding: 2 }} 
                                                            />
                                                        )}
                                                        <span style={{ color: "#0f172a" }}>{form.brand}</span>
                                                    </>
                                                ) : (
                                                    <span style={{ color: "#94a3b8" }}>Select Brand...</span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: 10, color: "#94a3b8", transform: brandDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                                        </div>

                                        {brandDropdownOpen && (
                                            <div style={{ 
                                                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6,
                                                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                                                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 100,
                                                maxHeight: 280, overflowY: "auto", padding: 6,
                                                display: "flex", flexDirection: "column"
                                            }}>
                                                <div style={{ position: "sticky", top: 0, background: "#fff", padding: "4px 4px 6px", zIndex: 1 }}>
                                                    <input 
                                                        type="text" 
                                                        value={brandSearch}
                                                        autoFocus
                                                        onChange={e => setBrandSearch(e.target.value)}
                                                        style={{ 
                                                            width: "100%", padding: "8px 10px", border: "1px solid #f1f5f9", 
                                                            borderRadius: 8, fontSize: 13, outline: "none", background: "#f8fafc",
                                                            fontFamily: FONT
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div 
                                                    onClick={() => { set("brandId", ""); set("brand", ""); setBrandDropdownOpen(false); setBrandSearch(""); }}
                                                    style={{ 
                                                        padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                                                        color: "#64748b", transition: "all 0.2s"
                                                    }}
                                                    className="brand-opt"
                                                >
                                                    No Brand
                                                </div>
                                                {brands
                                                    .filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                                                    .map(b => (
                                                    <div 
                                                        key={b.id}
                                                        onClick={() => { set("brandId", b.id); set("brand", b.name); setBrandDropdownOpen(false); setBrandSearch(""); }}
                                                        style={{ 
                                                            padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 14,
                                                            display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s",
                                                            background: form.brandId === b.id ? "rgba(99,102,241,0.05)" : "transparent",
                                                            color: form.brandId === b.id ? "#6366f1" : "#1e293b"
                                                        }}
                                                        className="brand-opt"
                                                    >
                                                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            {b.logoUrl ? (
                                                                <img src={b.logoUrl} alt={b.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                                            ) : (
                                                                <span style={{ fontSize: 14 }}>🏷️</span>
                                                            )}
                                                        </div>
                                                        <span style={{ fontWeight: form.brandId === b.id ? 500 : 400 }}>{b.name}</span>
                                                    </div>
                                                ))}
                                                {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                                                    <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No brands found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <style>{`
                                        .brand-opt:hover { background: #f8fafc !important; }
                                    `}</style>
                                </FormField>
                                {!isMobile && <div />}
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
                        <div style={{ padding: isMobile ? "16px" : "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 16, fontFamily: FONT }}>Pricing & Tax</div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                                <FormField label="Selling Price (Rs.)" required>
                                    <Input
                                        type="number" min="0" step="0.01"
                                        value={form.price === 0 ? "" : form.price}
                                        onChange={e => set("price", Number(e.target.value) || 0)}
                                        style={fieldStyle("price")}
                                    />
                                    {errors.price && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{errors.price}</div>}
                                </FormField>
                                <FormField label="Wholesale Price (Rs.)">
                                    <Input
                                        type="number" min="0" step="0.01"
                                        value={form.wholesalePrice === 0 ? "" : form.wholesalePrice}
                                        onChange={e => set("wholesalePrice", Number(e.target.value) || 0)}
                                    />
                                </FormField>
                                <FormField label="MRP (Rs.)">
                                    <Input
                                        type="number" min="0" step="0.01"
                                        value={form.mrp === 0 ? "" : form.mrp}
                                        onChange={e => set("mrp", Number(e.target.value) || 0)}
                                    />
                                </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                                {currentUser?.role === "admin" && (
                                    <FormField label="Cost Price (Rs.)">
                                        <Input
                                            type="number" min="0" step="0.01"
                                            value={form.costPrice === 0 ? "" : form.costPrice}
                                            onChange={e => set("costPrice", Number(e.target.value) || 0)}
                                        />
                                    </FormField>
                                )}
                                <FormField label="GST Rate">
                                    <Select value={form.gstRate} onChange={e => set("gstRate", Number(e.target.value))}>
                                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                    </Select>
                                </FormField>
                                <FormField label="HSN Code">
                                    <Input
                                        value={form.hsnCode}
                                        onChange={e => set("hsnCode", e.target.value)}
                                    />
                                </FormField>
                            </div>

                            {/* Margin calculator */}
                            {profit !== null && (
                                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, marginTop: 14, padding: "10px 14px", background: profit >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${profit >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 9 }}>
                                    <span style={{ fontSize: 13, color: "#64748b", fontFamily: FONT }}>
                                        Profit: <span style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 400 }}>
                                            Rs.{profit.toLocaleString("en-IN")}
                                        </span>
                                    </span>
                                    <span style={{ fontSize: 13, color: "#64748b", fontFamily: FONT }}>
                                        Margin: <span style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 400 }}>{margin}%</span>
                                    </span>
                                    {gstAmt && (
                                        <span style={{ fontSize: 13, color: "#64748b", fontFamily: FONT }}>
                                            GST ({form.gstRate}%): <span style={{ color: "#6366f1", fontWeight: 400 }}>Rs.{gstAmt}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Stock & Unit */}
                    <Card>
                        <div style={{ padding: isMobile ? "16px" : "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 16, fontFamily: FONT }}>Stock & Unit</div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
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
                            <div style={{ display: "grid", gridTemplateColumns: (sizeOption === "Other" && !isMobile) ? "1fr 1fr" : "1fr", gap: 14, marginTop: 14 }}>
                                <FormField label="Select Size">
                                    <Select value={sizeOption} onChange={e => handleSizeOption(e.target.value)}>
                                        <option value="">No specific size</option>
                                        <option value="Single">Single</option>
                                        <option value="Double">Double</option>
                                        <option value="King">King</option>
                                        <option value="Super King">Super King</option>
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
                        <div style={{ padding: isMobile ? "16px" : "18px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Product Images</div>

                            {/* Main Preview box */}
                            <div
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    width: isMobile ? "160px" : "100%", aspectRatio: "1 / 1", maxHeight: 220,
                                    borderRadius: 10, border: "2px dashed #e2e8f0",
                                    background: "#f8fafc", display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", overflow: "hidden", marginBottom: 16,
                                    transition: "border-color 0.2s",
                                    margin: isMobile ? "0 auto 16px" : "0 0 16px"
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
                                        <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: FONT }}>Principal Thumbnail</div>
                                    </div>
                                )}
                            </div>

                            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={handleFileChange} style={{ display: "none" }} />
                            
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>Image Gallery</div>
                            <ImageGallery 
                                images={galleryImages} 
                                onImagesChange={handleGalleryChange} 
                                maxImages={6} 
                            />

                            <div style={{ marginTop: 16 }}>
                                <FormField label="Main Image URL (Optional fallback)">
                                    <Input
                                        value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
                                        onChange={e => handleImageUrl(e.target.value)}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </Card>

                    {/* Status */}
                    {!isMobile && (
                        <Card>
                            <div style={{ padding: "18px 20px" }}>
                                <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 14, fontFamily: FONT }}>Status</div>
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
                                                <span style={{ fontSize: 13, fontWeight: 400, color: isSelected ? c.color : "#94a3b8", fontFamily: FONT }}>{c.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Summary */}
                    <Card>
                        <div style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 12, fontFamily: FONT }}>Summary</div>
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
                                    <span style={{ fontSize: 12, fontWeight: 400, color: "#1e293b", fontFamily: FONT, maxWidth: 140, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
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