"use client";

import React, { useState } from "react";
import { Product, FONT } from "../../types";
import { BtnPrimary, BtnGhost } from "../../ui";
import { generateCatalogPdf } from "./PdfGenerator";
import { resolveS3Url } from "../Products/imageService";

const CATALOG_SHARE_LOGO_URL = "https://epanelimages.s3.ap-south-1.amazonaws.com/Cloudinary_Archive_2026-04-10_10_27_479_Originals/logo.webp";

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
    sku?: string,
    totalImages: number = 1
): Promise<Blob> => {
    return new Promise((resolve) => {
        const imageUrl = URL.createObjectURL(imageBlob);
        const img = new Image();
        img.crossOrigin = "anonymous"; // CRITICAL: Prevent tainted canvas
        
        const cleanup = () => URL.revokeObjectURL(imageUrl);

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                // Standard compression/resizing for high quality sharing
                const MAX_WIDTH = 800; 
                let scale = 1;
                if (img.width > MAX_WIDTH) { scale = MAX_WIDTH / img.width; }
                
                canvas.width = Math.floor(img.width * scale);
                canvas.height = Math.floor(img.height * scale);
                const ctx = canvas.getContext("2d");
                if (!ctx) return cleanup();
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const hPadding = canvas.width * 0.005; // Minimal side gap
                const vPadding = canvas.width * 0.10;  // Large top gap as requested
                
                let currentY = vPadding;
                ctx.font = `bold ${Math.floor(canvas.width * 0.035)}px ${FONT}`;
                ctx.textBaseline = "middle";

                if (collectionName) {
                    const text = `# ${collectionName.toUpperCase()}`;
                    const metrics = ctx.measureText(text);
                    const h = Math.floor(canvas.width * 0.05);
                    const w = metrics.width + 30;
                    ctx.fillStyle = "rgba(40, 44, 42, 0.9)";
                    ctx.fillRect(hPadding, currentY, w, h);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(text, hPadding + 15, currentY + (h / 2));
                    currentY += h + 2;
                }

                if (sku) {
                    ctx.font = `bold ${Math.floor(canvas.width * 0.035)}px ${FONT}`;
                    const skuText = sku.toUpperCase();
                    const skuMetrics = ctx.measureText(skuText);
                    const sh = Math.floor(canvas.width * 0.04);
                    const sw = skuMetrics.width + 30;
                    ctx.fillStyle = "rgba(200, 215, 210, 0.9)";
                    ctx.fillRect(hPadding, currentY, sw, sh);
                    ctx.fillStyle = "#000000";
                    ctx.fillText(skuText, hPadding + 15, currentY + (sh / 2));
                }

                const finish = () => {
                    // Standard JPEG compression
                    const quality = 0.85;
                    canvas.toBlob(blob => {
                        cleanup();
                        resolve(blob || imageBlob);
                    }, "image/jpeg", quality);
                };

                // Add Brand Logo Overlay - Right Side
                if (logoUrl) {
                    const logoImg = new Image();
                    logoImg.crossOrigin = "anonymous";
                    logoImg.onload = () => {
                        try {
                            const logoH = Math.floor(canvas.width * 0.08);
                            const logoW = (logoImg.width / logoImg.height) * logoH;
                            const lx = canvas.width - logoW - hPadding;
                            ctx.fillStyle = "#ffffff";
                            // Tighter background box for more focus on logo, positioned from top
                            ctx.fillRect(lx - 3, vPadding - 3, logoW + 6, logoH + 6);
                            ctx.drawImage(logoImg, lx, vPadding, logoW, logoH);
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

    const handleShareBatch = async (batchFiles: File[]) => {
        try {
            if (navigator.share && navigator.canShare && navigator.canShare({ files: batchFiles })) {
                await navigator.share({
                    files: batchFiles,
                    title: "Eurus Lifestyle Catalog",
                    text: `Check out these ${batchFiles.length} items from Eurus Lifestyle!`
                });
            } else {
                alert("Browser cannot natively share this batch (OS file size or count limit exceeded).");
            }
        } catch (err: any) {
            if (err.name === "AbortError") return;
            console.warn("Native share failed", err);
            alert("Sharing this batch failed on your device's sharing menu.");
        }
    };

    const handleShareImages = async () => {
        if (processedFiles) return;

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
            const files: { blob: Blob, fileName: string }[] = [];
            const CHUNK_SIZE = 6; // Process in small batches for stability
            
            for (let i = 0; i < allImages.length; i += CHUNK_SIZE) {
                const chunk = allImages.slice(i, i + CHUNK_SIZE);
                const batchResults = await Promise.allSettled(chunk.map(async (img, chunkIdx) => {
                    const idx = i + chunkIdx;
                    const product = selectedProducts.find(p => p.sku === img.sku);
                    const brand = brands?.find(b => b.id === product?.brandId || b.name === product?.brand);
                    const logoUrl = brand?.logoUrl;
                    const prodCollection = product?.collection || collectionName || "";

                    const resolvedUrl = resolveS3Url(img.url);
                    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(resolvedUrl)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`HTTP ${response.status} for ${resolvedUrl} via proxy`);

                    const originalBlob = await response.blob();
                    const processedBlob = await processProductImage(originalBlob, logoUrl, prodCollection, img.sku, allImages.length);
                    
                    const fileName = `${img.productName.replace(/[^a-z0-9]/gi, '_')}_${img.sku}_${idx}.jpg`;
                    return { blob: processedBlob, fileName };
                }));

                batchResults.forEach(r => {
                    if (r.status === "fulfilled" && r.value) {
                        files.push(r.value);
                    }
                });
            }

            if (files.length === 0) throw new Error("No images could be processed.");

            const fileObjects = files.map(f => new File([f.blob], f.fileName, { type: "image/jpeg" }));
            setProcessedFiles(fileObjects);
        } catch (err: any) {
            console.error("Critical Sharing Error:", err);
            alert(`Sharing Failed: ${err.message || "Unknown error"}\n\nCheck if the S3 bucket is public and CORS is configured.`);
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
                    <div style={{ width: 64, height: 64, borderRadius: 12, background: "#fff", border: "1px solid #f1f5f9", padding: 8, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img 
                            src={CATALOG_SHARE_LOGO_URL} 
                            alt="Logo" 
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = resolveS3Url("logo.png");
                            }}
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} 
                        />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", margin: "0 0 6px", fontFamily: FONT }}>Share Catalog</h3>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0, fontFamily: FONT }}>
                        {processedFiles ? "Images are ready!" : `Select how you want to share ${selectedProducts.length} items.`}
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                    {!processedFiles ? (
                        <button 
                            onClick={handleShareImages}
                            disabled={sharingImages}
                            style={{ 
                                padding: "16px", background: "#f8fafc", 
                                border: `1.5px solid #e2e8f0`, 
                                borderRadius: 12, textAlign: "left", cursor: sharingImages ? "not-allowed" : "pointer", 
                                transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14,
                                opacity: sharingImages ? 0.6 : 1, color: "inherit"
                            }}
                            onMouseEnter={e => !sharingImages && (e.currentTarget.style.borderColor = "#6366f1")}
                            onMouseLeave={e => !sharingImages && (e.currentTarget.style.borderColor = "#e2e8f0")}
                        >
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 15 15" fill="none"><path d="M1.5 1.5h12v12h-12v-12zM1.5 9.5l3-3 3.5 3.5 3-3 2.5 2.5M4 4.5a.5.5 0 110-1 .5.5 0 010 1z" stroke="#6366f1" strokeWidth="1.2" /></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 400, fontFamily: FONT }}>
                                    {sharingImages ? "Processing..." : "Share Branded Images"}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>
                                    Processes images with your logo & SKU first.
                                </div>
                            </div>
                        </button>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4, fontFamily: FONT }}>
                                {processedFiles.length > 10 ? "We've split your images into batches to prevent your phone from blocking the share." : "Ready to share!"}
                            </div>
                            {Array.from({ length: Math.ceil(processedFiles.length / 10) }).map((_, i) => {
                                const start = i * 10;
                                const end = Math.min(start + 10, processedFiles.length);
                                const batchFiles = processedFiles.slice(start, end);
                                return (
                                    <button 
                                        key={i}
                                        onClick={() => handleShareBatch(batchFiles)}
                                        style={{ padding: "14px 16px", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "0.2s" }}
                                    >
                                        <span style={{ fontWeight: 600, fontSize: 14, fontFamily: FONT, display: "flex", alignItems: "center", gap: 8 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            Share Batch {i + 1}
                                        </span>
                                        <span style={{ fontSize: 12, opacity: 0.9, fontFamily: FONT }}>Items {start + 1} to {end}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

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
