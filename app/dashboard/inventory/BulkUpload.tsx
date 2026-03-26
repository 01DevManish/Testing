"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { ref, get, push, set as rtdbSet, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../../lib/firebase";
import { FONT, Product, Category, Collection } from "./types";
import {
    BtnPrimary, BtnGhost, Card, PageHeader, SuccessBanner, Spinner
} from "./ui";
import { logActivity } from "../../lib/activityLogger";

interface BulkUploadProps {
    categories: Category[];
    collections: Collection[];
    user: { uid: string; name: string; role: string };
    onDone: () => void;
}

export default function BulkUpload({ categories, collections, user, onDone }: BulkUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
    const [fileStats, setFileStats] = useState<{ name: string; size: number; rows: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = () => {
        const headers = [
            "Product Name", "SKU", "Category", "Collection", "Brand", 
            "Price", "Cost Price", "Stock", "Min Stock", "Unit", 
            "Size", "HSN Code", "GST Rate", "Description"
        ];
        const sampleData = [
            ["Sample Bed Sheet", "BS-001", "Bedsheets", "Summer 2024", "Eurus", 1299, 800, 50, 10, "PCS", "King", "6304", 12, "High quality cotton bedsheet"]
        ];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Inventory_Template.xlsx");
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as any[];

            setFileStats({
                name: file.name,
                size: file.size,
                rows: data.length
            });
            setResults(null);
        };
        reader.readAsBinaryString(file);
    };

    const startUpload = async () => {
        if (!fileInputRef.current?.files?.[0]) return;
        setUploading(true);
        const errors: string[] = [];
        let successCount = 0;

        try {
            const file = fileInputRef.current.files[0];
            const data: any[] = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const wb = XLSX.read(e.target?.result, { type: "binary" });
                    resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
                };
                reader.readAsBinaryString(file);
            });

            // Iterate and upload
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const rowNum = i + 2; // 1-indexed + header row
                
                const productName = row["Product Name"]?.toString().trim();
                const sku = row["SKU"]?.toString().trim();
                
                if (!productName || !sku) {
                    errors.push(`Row ${rowNum}: Product Name and SKU are required.`);
                    continue;
                }

                // SKU Uniqueness check
                const skuQuery = query(ref(db, "inventory"), orderByChild("sku"), equalTo(sku));
                const skuSnap = await get(skuQuery);
                if (skuSnap.exists()) {
                    errors.push(`Row ${rowNum}: SKU "${sku}" already exists in database.`);
                    continue;
                }

                // Prepare data
                const timestamp = Date.now();
                const productData: Omit<Product, "id"> = {
                    productName,
                    sku,
                    category: row["Category"]?.toString() || "",
                    collection: row["Collection"]?.toString() || "",
                    brand: row["Brand"]?.toString() || "",
                    price: Number(row["Price"]) || 0,
                    costPrice: Number(row["Cost Price"]) || 0,
                    stock: Number(row["Stock"]) || 0,
                    minStock: Number(row["Min Stock"]) || 5,
                    unit: row["Unit"]?.toString() || "PCS",
                    size: row["Size"]?.toString() || "",
                    hsnCode: row["HSN Code"]?.toString() || "",
                    gstRate: Number(row["GST Rate"]) || 18,
                    description: row["Description"]?.toString() || "",
                    imageUrl: "", // Manual upload later
                    status: (Number(row["Stock"]) || 0) > 0 ? "active" : "out-of-stock",
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    createdBy: user.uid,
                    createdByName: user.name,
                    updatedBy: user.uid,
                    updatedByName: user.name
                };

                const newRef = push(ref(db, "inventory"));
                await rtdbSet(newRef, productData);
                successCount++;
            }

            if (successCount > 0) {
                await logActivity({
                    type: "inventory",
                    action: "create",
                    title: "Bulk Inventory Upload",
                    description: `Successfully uploaded ${successCount} products via Excel.`,
                    userId: user.uid,
                    userName: user.name,
                    userRole: user.role,
                    metadata: { count: successCount }
                });
            }

            setResults({ success: successCount, errors });
        } catch (err) {
            console.error(err);
            errors.push("An unexpected error occurred during upload.");
            setResults({ success: successCount, errors });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <PageHeader title="Bulk Inventory Upload" sub="Upload multiple items at once using an Excel file." />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Card>
                        <div style={{ padding: 24, textAlign: "center" }}>
                            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>Upload your Excel File</h3>
                            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.5 }}>
                                Make sure your file follows the required format. <br/>
                                You can download the template on the right side.
                            </p>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFile}
                                accept=".xlsx, .xls, .csv"
                                style={{ display: "none" }}
                            />

                            <div 
                                onClick={() => !uploading && fileInputRef.current?.click()}
                                style={{
                                    border: "2px dashed #e2e8f0",
                                    borderRadius: 12,
                                    padding: "40px 20px",
                                    background: "#f8fafc",
                                    cursor: uploading ? "not-allowed" : "pointer",
                                    transition: "all 0.2s",
                                    marginBottom: 20,
                                    borderColor: fileStats ? "#6366f1" : "#e2e8f0"
                                }}
                            >
                                {fileStats ? (
                                    <div style={{ color: "#1e293b" }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{fileStats.name}</div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                                            {(fileStats.size / 1024).toFixed(1)} KB • {fileStats.rows} products found
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: "#94a3b8" }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>Click to select Excel file</div>
                                        <div style={{ fontSize: 11, marginTop: 4 }}>Supports .xlsx, .xls, .csv</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                                {fileStats && !results && (
                                    <BtnPrimary onClick={startUpload} loading={uploading} disabled={uploading}>
                                        Start Import
                                    </BtnPrimary>
                                )}
                                <BtnGhost onClick={() => { setFileStats(null); if(fileInputRef.current) fileInputRef.current.value = ""; setResults(null); }} disabled={uploading}>
                                    Clear
                                </BtnGhost>
                            </div>
                        </div>
                    </Card>

                    {results && (
                        <Card>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#d1fae5", color: "#065f46", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Import Summary</h3>
                                </div>
                                
                                <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                                    <div style={{ flex: 1, padding: 16, background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", marginBottom: 4 }}>Success</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: "#166534" }}>{results.success}</div>
                                        <div style={{ fontSize: 12, color: "#16a34a" }}>Products Imported</div>
                                    </div>
                                    <div style={{ flex: 1, padding: 16, background: results.errors.length > 0 ? "#fef2f2" : "#f8fafc", borderRadius: 10, border: `1px solid ${results.errors.length > 0 ? "#fecaca" : "#e2e8f0"}` }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: results.errors.length > 0 ? "#991b1b" : "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Errors</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: results.errors.length > 0 ? "#991b1b" : "#64748b" }}>{results.errors.length}</div>
                                        <div style={{ fontSize: 12, color: results.errors.length > 0 ? "#ef4444" : "#94a3b8" }}>Issues Found</div>
                                    </div>
                                </div>

                                {results.errors.length > 0 && (
                                    <div style={{ maxHeight: 200, overflowY: "auto", padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Error Details:</div>
                                        {results.errors.map((err, i) => (
                                            <div key={i} style={{ fontSize: 11, color: "#ef4444", marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid #f1f5f9" }}>
                                                • {err}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ marginTop: 20, textAlign: "right" }}>
                                    <BtnPrimary onClick={onDone}>View All Items</BtnPrimary>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Card>
                        <div style={{ padding: 20 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>How to use:</h4>
                            <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 700 }}>1.</span>
                                    <span>Download the Excel template using the button below.</span>
                                </li>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 700 }}>2.</span>
                                    <span>Fill in your product details. SKU and Name are required.</span>
                                </li>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 700 }}>3.</span>
                                    <span>Upload the file and click "Start Import".</span>
                                </li>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 700 }}>4.</span>
                                    <span>Once done, go to "All Items" to manually add images for each item.</span>
                                </li>
                            </ul>
                            
                            <button
                                onClick={downloadTemplate}
                                style={{
                                    marginTop: 20, width: "100%", padding: "10px",
                                    background: "#f1f5f9", border: "1px solid #e2e8f0",
                                    borderRadius: 8, color: "#475569", fontSize: 12,
                                    fontWeight: 600, cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center", gap: 8
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                                    <path d="M7.5 10.5v-7M10.5 7.5L7.5 10.5 4.5 7.5M2.5 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Download Template
                            </button>
                        </div>
                    </Card>

                    <Card>
                        <div style={{ padding: 20 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Important Notes:</h4>
                            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                                • Duplicate SKUs will be automatically skipped. <br/>
                                • Prices and Stock must be numbers. <br/>
                                • Large files might take a few moments to process.
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
