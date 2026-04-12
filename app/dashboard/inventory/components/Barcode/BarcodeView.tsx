"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ref, update } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { FONT, Product, Collection } from "../../types";
import { Card, PageHeader } from "../../ui";
import BarcodeSVG from "./BarcodeSVG";

export default function BarcodeView({
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
        const colObj = collections.find(c => c.name.toLowerCase() === prodCol);
        if (colObj?.collectionCode) return colObj.collectionCode;
        const matchedColKey = Object.keys(collectionCodes).find(k => k.toLowerCase() === prodCol);
        if (matchedColKey) return collectionCodes[matchedColKey];
        let titleHash = 0;
        for (let i = 0; i < prodCol.length; i++) {
            titleHash = ((titleHash << 5) - titleHash) + prodCol.charCodeAt(i);
            titleHash |= 0;
        }
        const dynamicCode = Math.abs(titleHash % 892 + 108).toString().padStart(3, "0");
        return dynamicCode;
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
                try { await update(ref(db, `inventory/${p.id}`), { barcode: code }); } catch (e) { console.error(e); }
            }
        }
        setIsBulkPrint(true);
        setPrintModalOpen(true);
    };

    const handleGenerate = async (p: Product) => {
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
            if (existingCol !== expectedColPart || existingSku !== expectedSkuPart || existingStyle !== expectedStylePart) {
                needsNew = true;
            }
        }
        if (needsNew) {
            const code = generateBarcodeNumber(currentP);
            try {
                await update(ref(db, `inventory/${currentP.id}`), { barcode: code });
                setGeneratedBarcode(code);
            } catch (e) { console.error(e); alert("Failed to save barcode to database."); }
        } else {
            setGeneratedBarcode(currentP.barcode!);
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

    useEffect(() => { setCurrentPage(1); }, [search]);

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
                                    type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Product / SKU"
                                    style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 13, width: "100%", fontFamily: FONT, fontWeight: 400, boxShadow: "none" }}
                                />
                                {search && (
                                    <button onClick={() => setSearch("")} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", padding: 4, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                                            <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
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
                                            <td style={{ padding: "12px 14px" }}><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ cursor: "pointer" }} /></td>
                                            <td style={{ padding: "8px 14px" }}><div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#cbd5e1" }}>📦</span>}</div></td>
                                            <td style={{ padding: "12px 14px", fontSize: 13, color: "#1e293b", fontWeight: 400, fontFamily: FONT }}>{p.sku}</td>
                                            <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", fontFamily: FONT }}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span>{p.collection || "—"}</span><span style={{ fontSize: 10, color: "#94a3b8" }}>#{getCollectionCode(p.collection || "")}</span></div></td>
                                            <td style={{ padding: "12px 14px", textAlign: "right" }}><button onClick={() => handleGenerate(p)} style={{ padding: "6px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", transition: "0.2s" }}>Generate</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: 14 }}>No products found.</div>}
                        </div>
                        {filtered.length > 0 && (
                            <div style={{ padding: "16px 0 0", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}</div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: currentPage === 1 ? "#f8fafc" : "#fff", color: currentPage === 1 ? "#cbd5e1" : "#475569", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, transition: "0.2s" }}>Prev</button>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#1e293b", padding: "0 10px", fontWeight: 600 }}>{currentPage} / {totalPages}</div>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: currentPage === totalPages ? "#f8fafc" : "#fff", color: currentPage === totalPages ? "#cbd5e1" : "#475569", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, transition: "0.2s" }}>Next</button>
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
                                <div style={{ background: "#fff", padding: "10px", borderRadius: 8, display: "flex", justifyContent: "center", width: "100%", marginBottom: 15 }}>
                                    <BarcodeSVG value={generatedBarcode} height={120} width={2.5} displayHeight={120} />
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: "#000", fontFamily: "'Courier New', Courier, monospace", letterSpacing: 5, marginTop: 5 }}>{generatedBarcode}</div>
                                <div style={{ marginTop: 24, display: "flex", gap: 10, width: "100%" }}>
                                    <button onClick={() => { setIsBulkPrint(false); setPrintModalOpen(true); }} style={{ flex: 1, padding: "12px", background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, cursor: "pointer" }}>Print Barcode</button>
                                    <button onClick={() => { navigator.clipboard.writeText(generatedBarcode); alert("Barcode number copied to clipboard!"); }} style={{ flex: 1, padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, cursor: "pointer" }}>Copy Code</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: "40px 20px", color: "#94a3b8", fontSize: 14, fontFamily: FONT }}>Select a product to generate its barcode.</div>
                        )}
                    </div>
                </Card>
            </div>

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
                                <button key={size.id} onClick={() => setSelectedSize(size.id as any)} style={{ padding: "14px", border: "1.5px solid", borderRadius: 12, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, borderColor: selectedSize === size.id ? "#6366f1" : "#e2e8f0", background: selectedSize === size.id ? "rgba(99,102,241,0.05)" : "#fff", color: selectedSize === size.id ? "#6366f1" : "#475569", transition: "all 0.2s" }}>
                                    <span style={{ fontSize: 18 }}>{size.icon}</span><span style={{ fontWeight: selectedSize === size.id ? 500 : 400 }}>{size.label}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                            <button onClick={() => setPrintModalOpen(false)} style={{ flex: 1, padding: "12px", background: "transparent", border: "none", color: "#64748b", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => { setPrintModalOpen(false); setTimeout(() => window.print(), 800); }} style={{ flex: 2, padding: "12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Confirm & Print</button>
                        </div>
                    </div>
                </div>
            )}

            {typeof document !== "undefined" && createPortal(
                <div id="print-area" className="print-only">
                    <style>{`
                        @media print {
                            html, body { margin: 0 !important; padding: 0 !important; }
                            body > *:not(#print-area) { display: none !important; }
                            #print-area { display: block !important; position: relative !important; width: 100% !important; background: #fff !important; padding: 0 !important; margin: 0 !important; visibility: visible !important; z-index: 99999; }
                            .barcode-label-container { width: ${selectedSize === "50x25" ? "50mm" : selectedSize === "38x25" ? "38mm" : "100mm"} !important; height: ${selectedSize === "50x25" ? "25mm" : selectedSize === "38x25" ? "25mm" : "150mm"} !important; display: flex !important; flex-direction: column; align-items: center; justify-content: center; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important; break-inside: avoid !important; }
                            @page { margin: 0; size: ${selectedSize === "50x25" ? "50mm 25mm" : selectedSize === "38x25" ? "38mm 25mm" : "100mm 150mm"}; }
                            .page-break { page-break-after: always !important; break-after: page !important; }
                        }
                        .print-only { display: none; }
                    `}</style>

                    {isBulkPrint ? (
                        products.filter(p => selectedIds.has(p.id)).map(p => (
                            <div key={p.id} className="barcode-label-container page-break" style={{ width: selectedSize === "50x25" ? "50mm" : selectedSize === "38x25" ? "38mm" : "100mm", height: selectedSize === "50x25" ? "25mm" : selectedSize === "38x25" ? "25mm" : "150mm", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "'Inter', sans-serif", fontWeight: "600", color: "#000", background: "#fff", padding: "2.5mm", boxSizing: "border-box", overflow: "hidden" }}>
                                <BarcodeSVG value={p.barcode || generateBarcodeNumber(p)} height={selectedSize === "100x150" ? 170 : 48} width={selectedSize === "50x25" ? 1.4 : selectedSize === "38x25" ? 1.0 : 3.0} fontSize={selectedSize === "100x150" ? 30 : 16} />
                                <div style={{ fontSize: selectedSize === "100x150" ? "26pt" : selectedSize === "50x25" ? "9pt" : "7.5pt", letterSpacing: selectedSize === "100x150" ? 4 : selectedSize === "50x25" ? 1.5 : 1.0, fontWeight: "700", marginTop: "0.5mm" }}>{p.barcode || generateBarcodeNumber(p)}</div>
                                <div style={{ fontSize: selectedSize === "100x150" ? "14pt" : selectedSize === "50x25" ? "7pt" : "6pt", fontWeight: "700", marginTop: "0.3mm" }}>{p.sku}</div>
                            </div>
                        ))
                    ) : selectedProduct && generatedBarcode && (
                        <div className="barcode-label-container" style={{ width: selectedSize === "50x25" ? "50mm" : selectedSize === "38x25" ? "38mm" : "100mm", height: selectedSize === "50x25" ? "25mm" : selectedSize === "38x25" ? "25mm" : "150mm", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "'Inter', sans-serif", fontWeight: "600", color: "#000", background: "#fff", padding: "2.5mm", boxSizing: "border-box", overflow: "hidden" }}>
                            <BarcodeSVG value={generatedBarcode} height={selectedSize === "100x150" ? 170 : 48} width={selectedSize === "50x25" ? 1.4 : selectedSize === "38x25" ? 1.0 : 3.0} fontSize={selectedSize === "100x150" ? 30 : 16} />
                            <div style={{ fontSize: selectedSize === "100x150" ? "26pt" : selectedSize === "50x25" ? "9pt" : "7.5pt", letterSpacing: selectedSize === "100x150" ? 4 : selectedSize === "50x25" ? 1.5 : 1.0, fontWeight: "700", marginTop: "0.5mm" }}>{generatedBarcode}</div>
                            <div style={{ fontSize: selectedSize === "100x150" ? "14pt" : selectedSize === "50x25" ? "7pt" : "6pt", fontWeight: "700", marginTop: "0.3mm" }}>{selectedProduct.sku}</div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
