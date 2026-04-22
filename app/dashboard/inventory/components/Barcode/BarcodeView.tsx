"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ref, update } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { FONT, Product, Collection } from "../../types";
import { Card, PageHeader } from "../../ui";
import BarcodeSVG from "./BarcodeSVG";
import SmartImage from "../../../../components/SmartImage";
import { generateBarcodeForProduct, getCollectionCodeFromName, needsBarcodeRefresh, normalizeSkuKey } from "../../utils/barcodeUtils";
import { touchDataSignal } from "../../../../lib/dataSignals";

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

    const getCollectionCode = (collectionName: string) => getCollectionCodeFromName(collectionName, collections);

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
            if (needsBarcodeRefresh(p, collections)) {
                const code = generateBarcodeForProduct(p, collections);
                try {
                    await update(ref(db, `inventory/${p.id}`), { barcode: code, barcodeSku: normalizeSkuKey(p.sku) });
                    await touchDataSignal("inventory");
                } catch (e) { console.error(e); }
            }
        }
        setIsBulkPrint(true);
        setPrintModalOpen(true);
    };

    const handleGenerate = async (p: Product) => {
        const currentP = products.find(x => x.id === p.id) || p;
        setSelectedProduct(currentP);
        if (needsBarcodeRefresh(currentP, collections)) {
            const code = generateBarcodeForProduct(currentP, collections);
            try {
                await update(ref(db, `inventory/${currentP.id}`), { barcode: code, barcodeSku: normalizeSkuKey(currentP.sku) });
                await touchDataSignal("inventory");
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
                                            <td style={{ padding: "8px 14px" }}><div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>{p.imageUrl ? <SmartImage src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} {...({ priority: paginatedItems.indexOf(p) < 4 } as any)} /> : <span style={{ fontSize: 10, color: "#cbd5e1" }}>📦</span>}</div></td>
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
                                <BarcodeSVG value={p.barcode || generateBarcodeForProduct(p, collections)} height={selectedSize === "100x150" ? 170 : 48} width={selectedSize === "50x25" ? 1.4 : selectedSize === "38x25" ? 1.0 : 3.0} fontSize={selectedSize === "100x150" ? 30 : 16} />
                                <div style={{ fontSize: selectedSize === "100x150" ? "26pt" : selectedSize === "50x25" ? "9pt" : "7.5pt", letterSpacing: selectedSize === "100x150" ? 4 : selectedSize === "50x25" ? 1.5 : 1.0, fontWeight: "700", marginTop: "0.5mm" }}>{p.barcode || generateBarcodeForProduct(p, collections)}</div>
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
