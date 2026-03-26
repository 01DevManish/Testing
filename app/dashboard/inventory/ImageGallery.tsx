"use client";

import React, { useRef } from "react";
import { FONT } from "./types";

interface ImageGalleryProps {
    images: string[]; // Can be URLs or base64 strings
    onImagesChange: (newImages: string[]) => void;
    maxImages?: number;
}

export default function ImageGallery({ images, onImagesChange, maxImages = 10 }: ImageGalleryProps) {
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const remainingSlots = maxImages - images.length;
        const filesToProcess = files.slice(0, remainingSlots);

        filesToProcess.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = ev.target?.result as string;
                onImagesChange([...images, result]);
            };
            reader.readAsDataURL(file);
        });

        // Reset input
        if (fileRef.current) fileRef.current.value = "";
    };

    const removeImage = (index: number) => {
        const next = [...images];
        next.splice(index, 1);
        onImagesChange(next);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", 
                gap: 10 
            }}>
                {images.map((img, idx) => (
                    <div key={idx} style={{ 
                        position: "relative", 
                        aspectRatio: "1/1", 
                        borderRadius: 8, 
                        overflow: "hidden", 
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc"
                    }}>
                        <img 
                            src={img} 
                            alt={`Gallery ${idx}`} 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                        <button
                            onClick={() => removeImage(idx)}
                            style={{
                                position: "absolute", top: 4, right: 4,
                                width: 20, height: 20, borderRadius: "50%",
                                background: "rgba(239, 68, 68, 0.9)", color: "#fff",
                                border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: "bold"
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}

                {images.length < maxImages && (
                    <div
                        onClick={() => fileRef.current?.click()}
                        style={{
                            aspectRatio: "1/1", borderRadius: 8,
                            border: "2px dashed #cbd5e1", background: "#f1f5f9",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", transition: "all 0.2s"
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
                            <path d="M7.5 3V7.5M7.5 7.5V12M7.5 7.5H12M7.5 7.5H3" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <input 
                            ref={fileRef} 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            onChange={handleFileChange} 
                            style={{ display: "none" }} 
                        />
                    </div>
                )}
            </div>
            {images.length >= maxImages && (
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: FONT }}>
                    Maximum {maxImages} images reached.
                </div>
            )}
        </div>
    );
}
