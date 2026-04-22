import React, { useState } from "react";
import { PartyRate } from "../../types";
import { Product, GST_RATES } from "../../../inventory/types";
import { 
    Input, Select, FormField, BtnPrimary, BtnSecondary, BtnGhost, 
    Card, Badge, PageHeader, Spinner 
} from "../../ui";

interface RateCatalogViewProps {
    party: PartyRate;
    products: Product[];
    onBack: () => void;
    onUpdateRates: (updated: any[]) => void;
    onShare: (party: PartyRate, selections: any[]) => void;
    isAdmin: boolean;
    isMobile: boolean;
}

export default function RateCatalogView({
    party, products, onBack, onUpdateRates, onShare, isAdmin, isMobile
}: RateCatalogViewProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    const normalize = (value: unknown) =>
        String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    const getStockStatus = (stockValue: unknown) => {
        const stock = Number(stockValue || 0);
        if (stock <= 0) return { label: `Out of stock (${stock})`, color: "#7f1d1d", bg: "#fee2e2" };
        if (stock < 10) return { label: `Low stock (${stock})`, color: "#78350f", bg: "#fef3c7" };
        return { label: `In stock (${stock})`, color: "#14532d", bg: "#dcfce7" };
    };

    const findProductForRate = (rate: any) => {
        const rateSku = normalize(rate?.sku);
        if (rateSku) {
            const bySku = products.find((p) => normalize(p.sku) === rateSku);
            if (bySku) return bySku;
        }
        const rateName = normalize(rate?.productName);
        if (!rateName) return undefined;
        return products.find((p) => normalize(p.productName) === rateName);
    };

    // Filter Logic
    const rates = party.rates || [];
    const normalizedSkuSearch = productSearch.trim().toLowerCase();
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchesSkuPrefix = (skuValue: string | undefined, query: string) => {
        const sku = (skuValue || "").trim().toLowerCase();
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return true;
        if (!sku) return false;

        // Business rule:
        // plain prefix like "FK"/"CLR" should match only "FK-123"/"CLR-123" series,
        // not extended families like "FKFT-73" or "CLR-SB-401".
        if (!normalizedQuery.includes("-")) {
            const numericSeriesPattern = new RegExp(`^${escapeRegExp(normalizedQuery)}-\\d+$`);
            return numericSeriesPattern.test(sku);
        }

        // If query already includes "-", treat it as an explicit sub-prefix.
        return sku.startsWith(normalizedQuery);
    };

    const skuMatchedProducts = products
        .filter((p) => {
            const sku = (p.sku || "").trim().toLowerCase();
            if (!sku) return false;
            return matchesSkuPrefix(sku, normalizedSkuSearch);
        })
        .sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));

    const filteredRates = rates.map((r, i) => ({ ...r, originalIdx: i })).filter(r => 
        r.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (r.sku || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
    const getRateKey = (item: { sku?: string; productName?: string }) =>
        (item.sku || "").trim().toLowerCase() || `name:${(item.productName || "").trim().toLowerCase()}`;

    const handleAddRate = () => {
        const rateVal = (document.getElementById("new-rate-val") as HTMLInputElement)?.value;
        const pkgType = (document.getElementById("new-pkg-type") as HTMLSelectElement)?.value;
        const pkgCost = (document.getElementById("new-pkg-cost") as HTMLInputElement)?.value;
        const discVal = (document.getElementById("new-discount-val") as HTMLInputElement)?.value;
        const discType = (document.getElementById("new-discount-type") as HTMLSelectElement)?.value as "amount" | "percentage";
        const gstRate = (document.getElementById("new-gst-rate") as HTMLSelectElement)?.value;

        if (!selectedProduct || !rateVal) {
            alert("Please select a product and enter a rate.");
            return;
        }

        const pName = selectedProduct.productName || "";
        const selectedKey = getRateKey(selectedProduct);
        const updated = [...rates.filter(r => getRateKey(r) !== selectedKey), {
            productName: pName,
            sku: selectedProduct.sku || "",
            rate: parseFloat(rateVal),
            packagingType: pkgType || "",
            packagingCost: parseFloat(pkgCost || "0"),
            discount: parseFloat(discVal || "0"),
            discountType: discType || "amount",
            gstRate: parseInt(gstRate || "0")
        }];

        onUpdateRates(updated);
        setSelectedProduct(null);
        setProductSearch("");
    };

    const handleBulkAssign = () => {
        const pPrefix = productSearch.trim().toLowerCase();
        if (!pPrefix) return;

        const rateVal = (document.getElementById("new-rate-val") as HTMLInputElement)?.value;
        if (!rateVal) {
            alert("Please enter a rate for bulk assignment.");
            return;
        }

        const matched = products.filter(p => {
            return matchesSkuPrefix(p.sku, pPrefix);
        });

        if (matched.length === 0) {
            alert(`No products found with SKU prefix "${pPrefix.toUpperCase()}"`);
            return;
        }

        const uniqueMatched = matched.reduce<Product[]>((acc, prod) => {
            const key = getRateKey(prod);
            if (!acc.some(p => getRateKey(p) === key)) acc.push(prod);
            return acc;
        }, []);

        if (!confirm(`Assign rate to ${uniqueMatched.length} products with SKU prefix "${pPrefix.toUpperCase()}"?`)) return;

        const pkgType = (document.getElementById("new-pkg-type") as HTMLSelectElement)?.value;
        const pkgCost = (document.getElementById("new-pkg-cost") as HTMLInputElement)?.value;
        const discVal = (document.getElementById("new-discount-val") as HTMLInputElement)?.value;
        const discType = (document.getElementById("new-discount-type") as HTMLSelectElement)?.value as "amount" | "percentage";
        const gstRate = (document.getElementById("new-gst-rate") as HTMLSelectElement)?.value;

        let updated = [...rates];
        uniqueMatched.forEach(prod => {
            const pName = prod.productName || "";
            const key = getRateKey(prod);
            updated = updated.filter(r => getRateKey(r) !== key);
            updated.push({
                productName: pName,
                sku: prod.sku || "",
                rate: parseFloat(rateVal),
                packagingType: pkgType || "",
                packagingCost: parseFloat(pkgCost || "0"),
                discount: parseFloat(discVal || "0"),
                discountType: discType || "amount",
                gstRate: parseInt(gstRate || "0")
            });
        });

        onUpdateRates(updated);
        setProductSearch("");
    };

    const handleBulkDeleteSelected = () => {
        if (selectedIndices.length === 0) {
            alert("Please select at least one product rate to delete.");
            return;
        }
        if (!confirm(`Delete ${selectedIndices.length} selected rate(s)?`)) return;
        onUpdateRates(rates.filter((_, idx) => !selectedIndices.includes(idx)));
        setSelectedIndices([]);
    };

    const toggleSelect = (idx: number) => {
        setSelectedIndices(prev => 
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    return (
        <div style={{ animation: "fadeIn 0.3s ease-out", maxWidth: "100%", overflowX: "hidden" }}>
            <PageHeader 
                title={`${party.partyName} Catalog`} 
                sub="Manage specific product pricing and share customized catalogs"
            >
                <div style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 8,
                    width: isMobile ? "100%" : "auto",
                    overflowX: isMobile ? "auto" : "visible",
                    whiteSpace: isMobile ? "nowrap" : "normal",
                    paddingBottom: isMobile ? 2 : 0
                }}>
                    <BtnGhost onClick={onBack} style={{ width: "auto", justifyContent: "center", flexShrink: 0 }}>
                        Back to List
                    </BtnGhost>
                    {isAdmin && (
                        <BtnSecondary
                            onClick={handleBulkDeleteSelected}
                            disabled={selectedIndices.length === 0}
                            style={{
                                width: "auto",
                                justifyContent: "center",
                                background: "#fff1f2",
                                borderColor: "#fecdd3",
                                color: "#be123c",
                                flexShrink: 0
                            }}
                        >
                            Delete Selected {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ""}
                        </BtnSecondary>
                    )}
                    {isAdmin && (
                        <BtnPrimary 
                            onClick={() => onShare(party, selectedIndices.length > 0 ? rates.filter((_, i) => selectedIndices.includes(i)) : rates)}
                            style={{ background: "#10b981", width: "auto", justifyContent: "center", flexShrink: 0 }}
                            disabled={rates.length === 0}
                        >
                            Share PDF {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ""}
                        </BtnPrimary>
                    )}
                </div>
            </PageHeader>

            {/* Assignment Form */}
            {isAdmin && (
                <Card style={{ padding: isMobile ? 16 : 24, marginBottom: 24, background: "#f8fafc", borderStyle: "dashed", borderColor: "#cbd5e1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                            Register Product Rate
                            <Badge color="#6366f1" bg="#e0e7ff">Custom Pricing</Badge>
                        </h4>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, alignItems: "flex-end" }}>
                        <div style={{ gridColumn: isMobile ? "span 1" : "span 1", position: "relative" }}>
                            <FormField label="SKU Search">
                                <div style={{ position: "relative" }}>
                                    <Input 
                                        value={selectedProduct ? (selectedProduct.productName || "") : productSearch}
                                        onChange={e => { setProductSearch(e.target.value); if (selectedProduct) setSelectedProduct(null); }}
                                        placeholder="Search SKU"
                                        style={{ paddingRight: selectedProduct ? 30 : 12 }}
                                    />
                                    {selectedProduct && <button onClick={() => setSelectedProduct(null)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "#f1f5f9", borderRadius: "50%", width: 22, height: 22, fontSize: 10, cursor: "pointer" }}>✕</button>}
                                </div>
                                {Boolean(normalizedSkuSearch) && !selectedProduct && (
                                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, marginTop: 4, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: 180, overflowY: "auto" }}>
                                        {skuMatchedProducts.map(p => (
                                            <div key={p.id} onClick={() => {
                                                setSelectedProduct(p);
                                                (document.getElementById("new-rate-val") as HTMLInputElement).value = (p.wholesalePrice || p.price || 0).toString();
                                                (document.getElementById("new-gst-rate") as HTMLSelectElement).value = (p.gstRate || 18).toString();
                                            }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.productName}</div>
                                                <div style={{ fontSize: 11, color: "#94a3b8" }}>SKU: {p.sku} | Price: ₹{p.wholesalePrice || p.price || 0}</div>
                                                <div style={{ marginTop: 4 }}>
                                                    {(() => {
                                                        const stockStatus = getStockStatus(p.stock);
                                                        return (
                                                            <span style={{
                                                                display: "inline-block",
                                                                fontSize: 10,
                                                                fontWeight: 600,
                                                                color: stockStatus.color,
                                                                background: stockStatus.bg,
                                                                padding: "2px 8px",
                                                                borderRadius: 999
                                                            }}>
                                                                {stockStatus.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                        {skuMatchedProducts.length === 0 && (
                                            <div style={{ padding: "10px 12px", fontSize: 12, color: "#94a3b8" }}>
                                                No inventory item found for this SKU prefix.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </FormField>
                            {selectedProduct && (
                                <div style={{ position: "absolute", top: 0, right: 0, fontSize: 12, pointerEvents: "none" }}>
                                    {(() => {
                                        const stockStatus = getStockStatus(selectedProduct.stock);
                                        return (
                                            <span style={{
                                                display: "inline-block",
                                                color: stockStatus.color,
                                                background: stockStatus.bg,
                                                padding: "3px 10px",
                                                borderRadius: 999,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap"
                                            }}>
                                                {stockStatus.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <FormField label="Assign Rate (₹)">
                            <Input id="new-rate-val" type="number" placeholder="0.00" />
                        </FormField>

                        <div style={{ display: "flex", gap: 10 }}>
                            <BtnPrimary onClick={handleAddRate} style={{ flex: 1, justifyContent: "center", height: 41 }}>
                                Assign Rate
                            </BtnPrimary>
                            <button 
                                onClick={handleBulkAssign}
                                title="Apply to all products matching SKU prefix"
                                style={{ 
                                    flex: 1,
                                    padding: "0 14px", height: 41, background: "#f5f3ff", color: "#6d28d9", 
                                    border: "1px solid #ddd6fe", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 500,
                                    display: "flex", justifyContent: "center", alignItems: "center"
                                }}
                            >
                                Bulk Rate Assign
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                        <FormField label="Pkg Type">
                            <Select id="new-pkg-type">
                                <option value="">No Packaging</option>
                                <option value="PVC">PVC</option>
                                <option value="PVC Zip">PVC Zip</option>
                                <option value="Bookfold">Bookfold</option>
                                <option value="Envolope Fold">Envolope Fold</option>
                                <option value="HOMCOT Bag">HOMCOT Bag</option>
                                <option value="Comfy Bag">Comfy Bag</option>
                                <option value="Comfy set Bag">Comfy set Bag</option>
                            </Select>
                        </FormField>
                        <FormField label="Pkg Cost (₹)">
                            <Input id="new-pkg-cost" type="number" defaultValue="0" />
                        </FormField>
                        <div style={{ display: "flex", gap: 8 }}>
                            <FormField label="Disc">
                                <Input id="new-discount-val" type="number" defaultValue="0" />
                            </FormField>
                            <FormField label="Unit">
                                <Select id="new-discount-type">
                                    <option value="amount">₹</option>
                                    <option value="percentage">%</option>
                                </Select>
                            </FormField>
                        </div>
                        <FormField label="GST (%)">
                            <Select id="new-gst-rate">
                                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </Select>
                        </FormField>
                    </div>
                </Card>
            )}

            {/* List Table */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ 
                    padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex",
                    justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center",
                    flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0
                }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#475569" }}>Assigned Rates ({rates.length})</h4>
                    <div style={{ width: isMobile ? "100%" : 240, position: "relative" }}>
                        <input 
                            type="text" 
                            placeholder="Search SKU" 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ 
                                width: "100%", padding: "6px 10px 6px 30px", fontSize: isMobile ? 11 : 12, 
                                border: "1px solid #e2e8f0", borderRadius: 8, outline: "none" 
                            }}
                        />
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                        >
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                                <th style={{ padding: "12px 20px", textAlign: "left", width: 40 }}>
                                    <input type="checkbox" onChange={e => setSelectedIndices(e.target.checked ? rates.map((_, i) => i) : [])} checked={selectedIndices.length === rates.length && rates.length > 0} />
                                </th>
                                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Product Name</th>
                                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>SKU</th>
                                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Pkg Price (₹)</th>
                                {isAdmin && <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Rate (₹)</th>}
                                {isAdmin && <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Discount</th>}
                                {isAdmin && <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Final Total</th>}
                                {isAdmin && <th style={{ padding: "12px 20px", textAlign: "center", width: 60 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRates.map((r) => {
                                const linkedProduct = findProductForRate(r);
                                const stockStatus = getStockStatus(linkedProduct?.stock);
                                const pkgPrice = Number(r.packagingCost || 0);
                                const base = Number(r.rate || 0) + pkgPrice;
                                const disc = (r.discountType || "amount") === "percentage" ? (base * (r.discount || 0) / 100) : Number(r.discount || 0);
                                const subtotal = Math.max(0, base - disc);
                                const total = subtotal + (subtotal * (r.gstRate || 0) / 100);

                                return (
                                    <tr key={r.originalIdx} style={{ borderBottom: "1px solid #f8fafc" }}>
                                        <td style={{ padding: "12px 20px" }}>
                                            <input type="checkbox" checked={selectedIndices.includes(r.originalIdx)} onChange={() => toggleSelect(r.originalIdx)} />
                                        </td>
                                        <td style={{ padding: "12px 20px", fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
                                            <div>{r.productName}</div>
                                            <div style={{
                                                marginTop: 4,
                                                display: "inline-block",
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: stockStatus.color,
                                                background: stockStatus.bg,
                                                padding: "2px 8px",
                                                borderRadius: 999
                                            }}>
                                                {stockStatus.label}
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 20px", fontSize: 12, color: "#94a3b8" }}>{r.sku || "—"}</td>
                                        <td style={{ padding: "12px 20px", fontSize: 12, color: "#64748b" }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>₹{pkgPrice.toFixed(2)}</div>
                                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                                {r.packagingType || "No Packaging"}
                                            </div>
                                        </td>
                                        {isAdmin && <td style={{ padding: "12px 20px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>₹{r.rate}</td>}
                                        {isAdmin && <td style={{ padding: "12px 20px", textAlign: "right", color: "#ef4444", fontSize: 12 }}>
                                            {(r.discount || 0) > 0 ? (r.discountType === "percentage" ? `-${r.discount}%` : `-₹${r.discount}`) : "—"}
                                        </td>}
                                        {isAdmin && <td style={{ padding: "12px 20px", textAlign: "right", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>₹{total.toFixed(2)}</td>}
                                        {isAdmin && (
                                            <td style={{ padding: "12px 20px", textAlign: "center" }}>
                                                <button 
                                                    onClick={() => onUpdateRates(rates.filter((_, i) => i !== r.originalIdx))}
                                                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredRates.length === 0 && (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 4} style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                                        No products found in the assigned rate list.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

