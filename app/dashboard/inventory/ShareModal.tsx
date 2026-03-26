"use client";

import React, { useState } from "react";
import JSZip from "jszip";
import { Product, FONT } from "./types";
import { BtnPrimary, BtnGhost, Card } from "./ui";
import { generateCatalogPdf } from "./PdfGenerator";

interface ShareModalProps {
    selectedProducts: Product[];
    onClose: () => void;
}

export default function ShareModal({ selectedProducts, onClose }: ShareModalProps) {
    const [sharing, setSharing] = useState(false);
    const [sharingImages, setSharingImages] = useState(false);

    const handleShareImages = async () => {
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
                const response = await fetch(img.url);
                const blob = await response.blob();
                const extension = img.url.split('.').pop()?.split('?')[0] || "jpg";
                const fileName = `${img.productName.replace(/[^a-z0-9]/gi, '_')}_${img.sku}_${idx}.${extension}`;
                folder?.file(fileName, blob);
                return { blob, fileName };
            });

            const files = await Promise.all(fetchPromises);

            // Attempt native share if available and it's a small number of files
            if (navigator.share && navigator.canShare && allImages.length <= 5) {
                const fileObjects = files.map(f => new File([f.blob], f.fileName, { type: f.blob.type }));
                if (navigator.canShare({ files: fileObjects })) {
                    await navigator.share({
                        files: fileObjects,
                        title: "Eurus Lifestyle Catalog Images",
                        text: "Check out these items from Eurus Lifestyle!"
                    });
                    setSharingImages(false);
                    return;
                }
            }

            // Fallback to ZIP download
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `Eurus_Lifestyle_Images_${new Date().getTime()}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error(err);
            alert("Failed to share images. Please try again.");
        } finally {
            setSharingImages(false);
        }
    };

    const handleGeneratePdf = async () => {
        setSharing(true);
        try {
            const blob = await generateCatalogPdf(selectedProducts, false);
            if (!blob) return;

            const fileName = `Eurus_Lifestyle_Catalog_${new Date().getTime()}.pdf`;
            const file = new File([blob], fileName, { type: "application/pdf" });

            // Attempt native share
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Eurus Lifestyle Catalog",
                    text: "Please find our latest product catalog attached."
                });
            } else {
                // Fallback to direct download
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
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 6px", fontFamily: FONT }}>Share Catalog</h3>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0, fontFamily: FONT }}>
                        Select how you want to share the <strong>{selectedProducts.length}</strong> selected items.
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                    <button 
                        onClick={handleShareImages}
                        disabled={sharingImages}
                        style={{ 
                            padding: "16px", background: "#f8fafc", border: "1.5px solid #e2e8f0", 
                            borderRadius: 12, textAlign: "left", cursor: sharingImages ? "not-allowed" : "pointer", 
                            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14,
                            opacity: sharingImages ? 0.6 : 1
                        }}
                        onMouseEnter={e => !sharingImages && (e.currentTarget.style.borderColor = "#6366f1")}
                        onMouseLeave={e => !sharingImages && (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 15 15" fill="none"><path d="M1.5 1.5h12v12h-12v-12zM1.5 9.5l3-3 3.5 3.5 3-3 2.5 2.5M4 4.5a.5.5 0 110-1 .5.5 0 010 1z" stroke="#6366f1" strokeWidth="1.2" /></svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{sharingImages ? "Preparing Images..." : "Share / Download All Images"}</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>Shares files directly or downloads them as a ZIP.</div>
                        </div>
                    </button>

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
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: FONT }}>{sharing ? "Generating PDF..." : "Generate PDF Catalog"}</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: FONT }}>Creates a professional PDF with photos and details.</div>
                        </div>
                    </button>
                </div>

                <div style={{ padding: "12px 14px", background: "#fdf4ff", border: "1px solid #f5d0fe", borderRadius: 10, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#d946ef", textTransform: "uppercase", marginBottom: 4, fontFamily: FONT }}>Branding Included</div>
                    <div style={{ fontSize: 12, color: "#a21caf", fontFamily: FONT }}>All shared catalogs will include a link to <strong>euruslifestyle.in</strong>.</div>
                </div>

                <div style={{ textAlign: "right" }}>
                    <BtnGhost onClick={onClose} style={{ fontSize: 13 }}>Cancel</BtnGhost>
                </div>
            </div>
        </div>
    );
}
