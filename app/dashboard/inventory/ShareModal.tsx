"use client";

import React, { useState } from "react";
import JSZip from "jszip";
import { Product, FONT } from "./types";
import { BtnPrimary, BtnGhost } from "./ui";
import { generateCatalogPdf } from "./PdfGenerator";

interface ShareModalProps {
    selectedProducts: Product[];
    brands: { id: string, name: string, logoUrl?: string }[];
    collectionName?: string;
    onClose: () => void;
}

/**
 * Robustly processes a product image to add branding overlays.
 * Uses a Blob-first approach to avoid CORS issues as much as possible.
 * ALWAYS resolves, falling back to the original blob if processing fails.
 */
const processProductImage = async (
    imageBlob: Blob, 
    logoUrl?: string, 
    collectionName?: string, 
    sku?: string
): Promise<Blob> => {
    return new Promise((resolve) => {
        const imageUrl = URL.createObjectURL(imageBlob);
        const img = new Image();
        img.crossOrigin = "anonymous"; // CRITICAL: Prevent tainted canvas
        
        const cleanup = () => URL.revokeObjectURL(imageUrl);

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) { cleanup(); return resolve(imageBlob); }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const padding = canvas.width * 0.03;

                // Overlay Text (Collection & SKU) - Left Side
                let currentY = padding;
                ctx.font = `bold ${Math.floor(canvas.width * 0.035)}px ${FONT}`;
                ctx.textBaseline = "middle";

                if (collectionName) {
                    const text = `# ${collectionName.toUpperCase()}`;
                    const metrics = ctx.measureText(text);
                    const h = Math.floor(canvas.width * 0.05);
                    const w = metrics.width + 30;
                    ctx.fillStyle = "rgba(40, 44, 42, 0.9)";
                    ctx.fillRect(padding, currentY, w, h);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(text, padding + 15, currentY + (h / 2));
                    currentY += h + 2;
                }

                if (sku) {
                    ctx.font = `bold ${Math.floor(canvas.width * 0.035)}px ${FONT}`;
                    const skuText = sku.toUpperCase();
                    const skuMetrics = ctx.measureText(skuText);
                    const sh = Math.floor(canvas.width * 0.04);
                    const sw = skuMetrics.width + 30;
                    ctx.fillStyle = "rgba(200, 215, 210, 0.9)";
                    ctx.fillRect(padding, currentY, sw, sh);
                    ctx.fillStyle = "#000000";
                    ctx.fillText(skuText, padding + 15, currentY + (sh / 2));
                }

                const finish = () => {
                    canvas.toBlob(blob => {
                        cleanup();
                        resolve(blob || imageBlob);
                    }, "image/jpeg", 0.92);
                };

                // Add Brand Logo Overlay - Right Side
                if (logoUrl) {
                    const logoImg = new Image();
                    logoImg.crossOrigin = "anonymous";
                    logoImg.onload = () => {
                        try {
                            const logoH = Math.floor(canvas.width * 0.18);
                            const logoW = (logoImg.width / logoImg.height) * logoH;
                            const lx = canvas.width - logoW - padding;
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(lx - 5, padding - 5, logoW + 10, logoH + 10);
                            ctx.drawImage(logoImg, lx, padding, logoW, logoH);
                            finish();
                        } catch (e) { finish(); }
                    };
                    logoImg.onerror = () => finish();
                    logoImg.src = logoUrl;
                } else {
                    finish();
                }
            } catch (e) { 
                console.error("Canvas processing error:", e);
                cleanup(); 
                resolve(imageBlob); 
            }
        };
        img.onerror = () => { 
            console.error("Main image load fail");
            cleanup(); 
            resolve(imageBlob); 
        };
        img.src = imageUrl;
    });
};

export default function ShareModal({ selectedProducts, brands, collectionName, onClose }: ShareModalProps) {
    const [sharing, setSharing] = useState(false);
    const [sharingImages, setSharingImages] = useState(false);
    const [processedFiles, setProcessedFiles] = useState<File[] | null>(null);

    const handleShareImages = async () => {
        if (processedFiles) {
            // STEP 2: Actual Share (Direct user activation)
            try {
                if (navigator.share && navigator.canShare && navigator.canShare({ files: processedFiles })) {
                    await navigator.share({
                        files: processedFiles,
                        title: "Eurus Lifestyle Catalog",
                        text: `Check out these ${processedFiles.length} items from Eurus Lifestyle!`
                    });
                    onClose(); // Auto-close on successful share
                    return;
                }
            } catch (err: any) {
                if (err.name === "AbortError") return;
                console.warn("Native share failed", err);
            }
            // If share fails or unsupported, fall back to ZIP handled in STEP 1
            return;
        }

        // STEP 1: Process Images
        const allImages: { url: string, productName: string, sku: string }[] = [];
        selectedProducts.forEach(p => {
            if (p.imageUrls && p.imageUrls.length > 0) {
                p.imageUrls.forEach(url => allImages.push({ url, productName: p.productName, sku: p.sku }));
            } else if (p.imageUrl) {
                allImages.push({ url: p.imageUrl, productName: p.productName, sku: p.sku });
            }
        });

        if (allImages.length === 0) {
            alert("None of the selected products have images.");
            return;
        }

        setSharingImages(true);
        try {
            const zip = new JSZip();
            const folder = zip.folder("Eurus_Lifestyle_Images");
            
            const fetchPromises = allImages.map(async (img, idx) => {
                const product = selectedProducts.find(p => p.sku === img.sku);
                const brand = brands?.find(b => b.id === product?.brandId || b.name === product?.brand);
                const logoUrl = brand?.logoUrl;
                const prodCollection = product?.collection || collectionName || "";

                try {
                    const response = await fetch(img.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const originalBlob = await response.blob();
                    const processedBlob = await processProductImage(originalBlob, logoUrl, prodCollection, img.sku);
                    
                    const fileName = `${img.productName.replace(/[^a-z0-9]/gi, '_')}_${img.sku}_${idx}.jpg`;
                    folder?.file(fileName, processedBlob);
                    return { blob: processedBlob, fileName };
                } catch (err) {
                    console.error("Image share item failed", img.url, err);
                    return null;
                }
            });

            const settled = await Promise.allSettled(fetchPromises);
            const files = settled
                .filter((r): r is PromiseFulfilledResult<{ blob: Blob; fileName: string } | null> => r.status === "fulfilled")
                .map(r => r.value)
                .filter((f): f is { blob: Blob; fileName: string } => f !== null);

            if (files.length === 0) throw new Error("No images could be processed.");

            const fileObjects = files.map(f => new File([f.blob], f.fileName, { type: "image/jpeg" }));
            
            // Limit to 5 for maximum compatibility on first try
            const finalFiles = fileObjects.length > 10 ? fileObjects.slice(0, 10) : fileObjects;
            
            const canShareFiles = typeof (navigator as any).canShare === 'function' && (navigator as any).canShare({ files: finalFiles });
            if (typeof (navigator as any).share === 'function' && canShareFiles) {
                setProcessedFiles(finalFiles);
                // We'll show a "Share Now" button to the user
            } else {
                // Fallback to ZIP immediately if native share definitely not supported
                const content = await zip.generateAsync({ type: "blob" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(content);
                link.download = `Eurus_Images_${new Date().getTime()}.zip`;
                link.click();
                URL.revokeObjectURL(link.href);
                alert("Direct sharing not supported on this browser. Downloading images as a ZIP instead.");
            }
        } catch (err: any) {
            alert(`Failed: ${err.message}`);
        } finally {
            setSharingImages(false);
        }
    };

    const handleGeneratePdf = async () => {
        setSharing(true);
        try {
            const blob = await generateCatalogPdf(selectedProducts, collectionName, false);
            if (!blob) return;
            const fileName = `Eurus_Lifestyle_Catalog_${new Date().getTime()}.pdf`;
            const file = new File([blob], fileName, { type: "application/pdf" });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Eurus Lifestyle Catalog",
                    text: "Please find our latest product catalog attached."
                });
            } else {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(link.href);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to share PDF catalog.");
        } finally {
            setSharing(false);
        }
    };

    return (
        <div 
            style={{ 
                position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", 
                backdropFilter: "blur(8px)", zIndex: 400, display: "flex", 
                alignItems: "center", justifyContent: "center", padding: 20 
            }}
            onClick={onClose}
        >
            <div 
                style={{ 
                    background: "#fff", borderRadius: 16, padding: "26px 24px", 
                    maxWidth: 500, width: "100%", maxHeight: "85vh", 
                    overflowY: "auto", position: "relative", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" 
                }}
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    style={{ 
                        position: "absolute", top: 14, right: 14, width: 28, height: 28, 
                        borderRadius: 7, background: "#f1f5f9", border: "none", 
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" 
                    }}
                >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1 1l9 9M10 1L1 10" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </button>

                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="24" height="24" viewBox="0 0 15 15" fill="none">
                            <path d="M12.5 10.5V12.5H2.5V2.5H4.5M12.5 7.5V10.5M12.5 10.5H9.5M12.5 10.5L8.5 6.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", margin: "0 0 6px", fontFamily: FONT }}>Share Catalog</h3>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0, fontFamily: FONT }}>
                        {processedFiles ? "Images are ready!" : `Select how you want to share ${selectedProducts.length} items.`}
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                    <button 
                        onClick={handleShareImages}
                        disabled={sharingImages}
                        style={{ 
                            padding: "16px", background: processedFiles ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#f8fafc", 
                            border: `1.5px solid ${processedFiles ? "#22c55e" : "#e2e8f0"}`, 
                            borderRadius: 12, textAlign: "left", cursor: sharingImages ? "not-allowed" : "pointer", 
                            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14,
                            opacity: sharingImages ? 0.6 : 1, color: processedFiles ? "#fff" : "inherit"
                        }}
                        onMouseEnter={e => !sharingImages && !processedFiles && (e.currentTarget.style.borderColor = "#6366f1")}
                        onMouseLeave={e => !sharingImages && !processedFiles && (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: processedFiles ? "rgba(255,255,255,0.2)" : "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 15 15" fill="none"><path d="M1.5 1.5h12v12h-12v-12zM1.5 9.5l3-3 3.5 3.5 3-3 2.5 2.5M4 4.5a.5.5 0 110-1 .5.5 0 010 1z" stroke={processedFiles ? "#fff" : "#6366f1"} strokeWidth="1.2" /></svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: processedFiles ? 600 : 400, fontFamily: FONT }}>
                                {sharingImages ? "Processing..." : processedFiles ? "✅ CLICK TO SHARE NOW" : "Share Branded Images"}
                            </div>
                            <div style={{ fontSize: 11, color: processedFiles ? "rgba(255,255,255,0.8)" : "#64748b", fontFamily: FONT }}>
                                {processedFiles ? "Tap here to open WhatsApp/Email" : "Processes images with your logo & SKU first."}
                            </div>
                        </div>
                    </button>

                    {!processedFiles && (
                        <button 
                            onClick={handleGeneratePdf}
                            disabled={sharing}
                            style={{ 
                                padding: "16px", background: "#f8fafc", border: "1.5px solid #e2e8f0", 
                                borderRadius: 12, textAlign: "left", cursor: sharing ? "not-allowed" : "pointer", 
                                transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14,
                                opacity: sharing ? 0.6 : 1
                            }}
                            onMouseEnter={e => !sharing && (e.currentTarget.style.borderColor = "#6366f1")}
                            onMouseLeave={e => !sharing && (e.currentTarget.style.borderColor = "#e2e8f0")}
                        >
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 15 15" fill="none"><path d="M1.5 1.5h9l3 3v9h-12v-12z" stroke="#ef4444" strokeWidth="1.2" /><path d="M10.5 1.5v3h3" stroke="#ef4444" strokeWidth="1.2" /></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 400, color: "#1e293b", fontFamily: FONT }}>{sharing ? "Generating PDF..." : "Generate PDF Catalog"}</div>
                                <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>Creates a professional PDF with details.</div>
                            </div>
                        </button>
                    )}
                </div>

                <div style={{ padding: "12px 14px", background: "#fdf4ff", border: "1px solid #f5d0fe", borderRadius: 10, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#d946ef", textTransform: "uppercase", marginBottom: 4, fontFamily: FONT }}>Premium Cataloging</div>
                    <div style={{ fontSize: 12, color: "#a21caf", fontFamily: FONT }}>Professional sharing enabled. Powered by <strong>euruslifestyle.in</strong>.</div>
                </div>

                <div style={{ textAlign: "right" }}>
                    <BtnGhost onClick={onClose} style={{ fontSize: 13 }}>Cancel</BtnGhost>
                </div>
            </div>
        </div>
    );
}
