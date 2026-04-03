"use client";

import React, { useState, useRef } from "react";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { ref, get, push, update, set as rtdbSet } from "firebase/database";

import { db } from "../../lib/firebase";
import { FONT, Product, Category, Collection, UNITS, GST_RATES } from "./types";
import { SuccessBanner, BtnPrimary, BtnGhost, Card, PageHeader } from "./ui";
import { logActivity } from "../../lib/activityLogger";
import { uploadToCloudinary } from "./cloudinary";

interface BulkUploadProps {
    categories: Category[];
    collections: Collection[];
    brands: { id: string; name: string }[];
    user: { uid: string; name: string; role: string };
    onDone: () => void;
    isMobile?: boolean;
    isDesktop?: boolean;
}

export default function BulkUpload({ categories, collections, brands, user, onDone, isMobile, isDesktop }: BulkUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [results, setResults] = useState<{ success: number; updated: number; errors: string[] } | null>(null);
    const [fileStats, setFileStats] = useState<{ name: string; size: number; rows: number } | null>(null);
    const [progress, setProgress] = useState(0);
    const [totalRows, setTotalRows] = useState(0);


    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = async () => {
        try {
            setDownloading(true);
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Template");
            const dataSheet = workbook.addWorksheet("DataLists");
            dataSheet.state = "hidden";

            // Define Headers
            const headers = [
                "Product Name*", "SKU*", "Category", "Collection", "Brand",
                "Description", "Selling Price (Rs.)*", "Wholesale Price (Rs.)", "MRP (Rs.)", "Cost Price (Rs.)",
                "GST Rate", "HSN Code", "Opening Stock", "Min Stock (Alert)", "Unit",
                "Size", "Thumbnail URL", "Status"
            ];

            sheet.addRow(headers);

            // Header Styling
            sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
            sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
            sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
            sheet.getRow(1).height = 25;

            // Column Widths
            sheet.columns = headers.map(() => ({ width: 22 }));

            // Prepare Dropdown Lists - DYNAMICALLY fetching latest data
            const catNames = categories.map(c => c.name);
            const colNames = collections.map(c => c.name);
            const brandNames = brands.map(b => b.name);
            const unitList = UNITS;
            const statusList = ["Active", "Inactive", "Low Stock", "Out of Stock"];
            const gstList = GST_RATES.map(r => `${r}%`);
            const sizeList = [
                "Single", "Double", "Queen", "King", "Super King",
                "Single Fitted", "Double Fitted", "Queen Fitted", "King Fitted"
            ];

            // Add lists to hidden sheet for data validation referencing
            if (catNames.length > 0) dataSheet.getColumn(1).values = catNames;
            if (colNames.length > 0) dataSheet.getColumn(2).values = colNames;
            if (brandNames.length > 0) dataSheet.getColumn(3).values = brandNames;
            dataSheet.getColumn(4).values = unitList;
            dataSheet.getColumn(5).values = statusList;
            dataSheet.getColumn(6).values = gstList;
            dataSheet.getColumn(7).values = sizeList;

            // Apply Data Validation (Dropdowns) to first 500 rows
            for (let i = 2; i <= 500; i++) {
                // Category (C)
                if (catNames.length > 0) {
                    sheet.getCell(`C${i}`).dataValidation = {
                        type: "list",
                        allowBlank: true,
                        formulae: [`'DataLists'!$A$1:$A$${catNames.length}`]
                    };
                }
                // Collection (D)
                if (colNames.length > 0) {
                    sheet.getCell(`D${i}`).dataValidation = {
                        type: "list",
                        allowBlank: true,
                        formulae: [`'DataLists'!$B$1:$B$${colNames.length}`]
                    };
                }
                // Brand (E)
                if (brandNames.length > 0) {
                    sheet.getCell(`E${i}`).dataValidation = {
                        type: "list",
                        allowBlank: true,
                        formulae: [`'DataLists'!$C$1:$C$${brandNames.length}`]
                    };
                }
                // Unit (O)
                sheet.getCell(`O${i}`).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`'DataLists'!$D$1:$D$${unitList.length}`]
                };
                // Status (R)
                sheet.getCell(`R${i}`).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`'DataLists'!$E$1:$E$${statusList.length}`]
                };
                // GST Rate (K)
                sheet.getCell(`K${i}`).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`'DataLists'!$F$1:$F$${gstList.length}`]
                };
                // Size (P)
                sheet.getCell(`P${i}`).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`'DataLists'!$G$1:$G$${sizeList.length}`]
                };
            }

            // Write and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "Eurus_Inventory_Template.xlsx";
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating template:", error);
            alert("Failed to generate template. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(ws) as any[];

            // Strict Filter: Only rows that have a name or SKU are products
            const filteredData = rawData.filter(row => {
                const name = row["Product Name*"]?.toString().trim();
                const sku = row["SKU*"]?.toString().trim();
                return !!(name || sku);
            });

            setFileStats({
                name: file.name,
                size: file.size,
                rows: filteredData.length
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
        let updateCount = 0;
        setProgress(0);



        try {
            const file = fileInputRef.current.files[0];
            const data: any[] = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const wb = XLSX.read(e.target?.result, { type: "binary" });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const raw = XLSX.utils.sheet_to_json(ws);
                    // Strict filtering
                    const filtered = (raw as any[]).filter(row => {
                        const name = row["Product Name*"]?.toString().trim();
                        const sku = row["SKU*"]?.toString().trim();
                        return !!(name || sku);
                    });
                    resolve(filtered);
                };
                reader.readAsBinaryString(file);
            });

            setTotalRows(data.length);


            if (data.length === 0) {
                errors.push("No valid products found in the file. Please check if Name and SKU columns are present.");
                setResults({ success: 0, updated: 0, errors });

                setUploading(false);
                return;
            }

            const inventorySnap = await get(ref(db, "inventory"));
            const skuMap = new Map<string, string>(); // sku -> id
            if (inventorySnap.exists()) {
                inventorySnap.forEach(snap => {
                    const val = snap.val();
                    if (val.sku) skuMap.set(val.sku.toString().trim().toLowerCase(), snap.key!);
                });
            }


            for (let i = 0; i < data.length; i++) {
                setProgress(i + 1);
                const row = data[i];

                const rowNum = i + 2;
                
                try {
                    const productName = row["Product Name*"]?.toString().trim();
                    const sku = row["SKU*"]?.toString().trim();
                    
                    if (!productName || !sku) {
                        errors.push(`Row ${rowNum}: Product Name and SKU are both required.`);
                        continue;
                    }

                    // Skip the sample row
                    if (sku === "SKU-001" && productName === "Sample Product") {
                        continue;
                    }

                    const existingId = skuMap.get(sku.toLowerCase());


                    const brandName = row["Brand"]?.toString().trim() || "";
                    const matchedBrand = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());

                    const timestamp = Date.now();
                    const stock = Number(row["Opening Stock"]) || 0;
                    const minStock = Number(row["Min Stock (Alert)"]) || 5;
                    const reqStatus = row["Status"]?.toString().trim().toLowerCase().replace(/\s+/g, "-");

                    // Image processing
                    let finalImageUrl = "";
                    let rawImageUrl = row["Thumbnail URL"]?.toString().trim() || "";
                    if (rawImageUrl) {
                        try {
                            // Dropbox Fix: dl=0 points to a webpage, dl=1 points to the file itself
                            if (rawImageUrl.includes("dropbox.com")) {
                                rawImageUrl = rawImageUrl.replace("dl=0", "dl=1").replace("raw=0", "raw=1");
                            }
                            finalImageUrl = await uploadToCloudinary(rawImageUrl);
                        } catch (imgErr: any) {
                            console.warn(`Row ${rowNum}: Image upload failed, continuing without image.`, imgErr);
                            // We don't fail the whole product for one image, just warn and continue with empty
                        }
                    }

                    const productData: Omit<Product, "id"> = {
                        productName,
                        sku,
                        category: row["Category"]?.toString().trim() || "",
                        collection: row["Collection"]?.toString().trim() || "",
                        brand: brandName,
                        brandId: matchedBrand?.id || "",
                        price: Number(row["Selling Price (Rs.)*"]) || 0,
                        wholesalePrice: Number(row["Wholesale Price (Rs.)"]) || 0,
                        mrp: Number(row["MRP (Rs.)"]) || 0,
                        costPrice: Number(row["Cost Price (Rs.)"]) || 0,
                        stock: stock,
                        minStock: minStock,
                        unit: row["Unit"]?.toString().trim() || "PCS",
                        size: row["Size"]?.toString().trim() || "",
                        hsnCode: row["HSN Code"]?.toString().trim() || "",
                        gstRate: parseInt(row["GST Rate"]?.toString().replace("%", "").trim()) || 18,
                        description: row["Description"]?.toString().trim() || "",
                        imageUrl: finalImageUrl,
                        imageUrls: [],
                        status: (reqStatus === "active" || reqStatus === "inactive" || reqStatus === "low-stock" || reqStatus === "out-of-stock") 
                            ? reqStatus 
                            : (stock <= 0 ? "out-of-stock" : (stock <= minStock ? "low-stock" : "active")),
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        createdBy: user.uid,
                        createdByName: user.name,
                        updatedBy: user.uid,
                        updatedByName: user.name
                    };

                    if (existingId) {
                        // UPDATE Existing Product
                        const { createdAt, createdBy, createdByName, ...updateData } = productData as any;
                        await update(ref(db, `inventory/${existingId}`), {
                            ...updateData,
                            updatedAt: timestamp
                        });
                        updateCount++;
                    } else {
                        // CREATE New Product
                        const newRef = push(ref(db, "inventory"));
                        await rtdbSet(newRef, productData);
                        successCount++;
                        skuMap.set(sku.toLowerCase(), newRef.key!);
                    }

                } catch (innerErr: any) {
                    console.error(`Error in row ${rowNum}:`, innerErr);
                    errors.push(`Row ${rowNum}: ${innerErr.message || "Failed to save product."}`);
                }
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
                    metadata: { created: successCount, updated: updateCount }
                });
            }

            setResults({ success: successCount, updated: updateCount, errors });
        } catch (err) {
            console.error(err);
            errors.push("An unexpected error occurred during upload.");
            setResults({ success: successCount, updated: updateCount, errors });
        } finally {

            setUploading(false);
        }
    };

    return (
        <div>
            <PageHeader title="Bulk Inventory Upload" sub="Upload multiple items at once using an Excel file." />

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: 24, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Card>
                        <div style={{ padding: 24, textAlign: "center" }}>
                            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                            <h3 style={{ fontSize: 18, fontWeight: 400, color: "#1e293b", margin: "0 0 8px" }}>Upload your Excel File</h3>
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
                                    borderColor: fileStats ? "#6366f1" : "#e2e8f0",
                                    position: "relative",
                                    overflow: "hidden"
                                }}
                            >
                                {uploading && (
                                    <div style={{
                                        position: "absolute", bottom: 0, left: 0, height: 4,
                                        background: "#6366f1", width: `${(progress / totalRows) * 100}%`,
                                        transition: "width 0.3s ease"
                                    }} />
                                )}

                                {uploading ? (
                                    <div style={{ color: "#1e293b" }}>
                                        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                                            Processing... {progress} / {totalRows}
                                        </div>
                                        <div style={{ fontSize: 13, color: "#64748b" }}>
                                            Please don't close this tab until finished.
                                        </div>
                                    </div>
                                ) : fileStats ? (

                                    <div style={{ color: "#1e293b" }}>
                                        <div style={{ fontWeight: 400, fontSize: 15 }}>{fileStats.name}</div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                                            {(fileStats.size / 1024).toFixed(1)} KB • {fileStats.rows} products found
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: "#94a3b8" }}>
                                        <div style={{ fontSize: 13, fontWeight: 400 }}>Click to select Excel file</div>
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
                                <BtnGhost onClick={() => { setFileStats(null); if(fileInputRef.current) fileInputRef.current.value = ""; setResults(null); setProgress(0); }} disabled={uploading}>
                                    Clear
                                </BtnGhost>

                            </div>
                        </div>
                    </Card>

                    {results && (
                        <Card>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#d1fae5", color: "#065f46", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400 }}>✓</div>
                                    <h3 style={{ fontSize: 16, fontWeight: 400, color: "#0f172a", margin: 0 }}>Import Summary</h3>
                                </div>
                                
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                                    <div style={{ padding: 16, background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", textAlign: "center" }}>
                                        <div style={{ fontSize: 10, fontWeight: 500, color: "#166534", textTransform: "uppercase", marginBottom: 4 }}>Created</div>
                                        <div style={{ fontSize: 24, fontWeight: 600, color: "#166534" }}>{results.success}</div>
                                    </div>
                                    <div style={{ padding: 16, background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", textAlign: "center" }}>
                                        <div style={{ fontSize: 10, fontWeight: 500, color: "#1e40af", textTransform: "uppercase", marginBottom: 4 }}>Updated</div>
                                        <div style={{ fontSize: 24, fontWeight: 600, color: "#1e40af" }}>{results.updated}</div>
                                    </div>
                                    <div style={{ padding: 16, background: results.errors.length > 0 ? "#fef2f2" : "#f8fafc", borderRadius: 10, border: `1px solid ${results.errors.length > 0 ? "#fecaca" : "#e2e8f0"}`, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, fontWeight: 500, color: results.errors.length > 0 ? "#991b1b" : "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Errors</div>
                                        <div style={{ fontSize: 24, fontWeight: 600, color: results.errors.length > 0 ? "#991b1b" : "#64748b" }}>{results.errors.length}</div>
                                    </div>
                                </div>


                                {results.errors.length > 0 && (
                                    <div style={{ maxHeight: 200, overflowY: "auto", padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: 12, fontWeight: 400, color: "#475569", marginBottom: 8 }}>Error Details:</div>
                                        {results.errors.map((err: string, i: number) => (
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
                            <h4 style={{ fontSize: 13, fontWeight: 400, color: "#1e293b", margin: "0 0 12px" }}>How to use:</h4>
                            <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 400 }}>1.</span>
                                    <span>Download the Excel template using the button below.</span>
                                </li>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 400 }}>2.</span>
                                    <span>Fill in your product details. SKU and Name are required.</span>
                                </li>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 400 }}>3.</span>
                                    <span>Upload the file and click "Start Import".</span>
                                </li>
                                <li style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                                    <span style={{ color: "#6366f1", fontWeight: 400 }}>4.</span>
                                    <span>Once done, go to "All Items" to manually add images for each item.</span>
                                </li>
                            </ul>
                            
                            <button
                                onClick={downloadTemplate}
                                disabled={downloading}
                                style={{
                                    marginTop: 20, width: "100%", padding: "10px",
                                    background: downloading ? "#e2e8f0" : "#f1f5f9", 
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 8, color: downloading ? "#94a3b8" : "#475569", fontSize: 12,
                                    fontWeight: 400, cursor: downloading ? "not-allowed" : "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
                                }}
                            >
                                {downloading ? (
                                    <>
                                        <div className="animate-spin" style={{ width: 14, height: 14, border: "2px solid #cbd5e1", borderTopColor: "#6366f1", borderRadius: "50%" }} />
                                        Generating Dynamic Template...
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                                            <path d="M7.5 10.5v-7M10.5 7.5L7.5 10.5 4.5 7.5M2.5 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Download Template
                                    </>
                                )}
                            </button>
                        </div>
                    </Card>

                    <Card>
                        <div style={{ padding: 20 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 400, color: "#ef4444", margin: "0 0 8px" }}>Important Notes:</h4>
                            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                                • Existing SKUs will be updated with new values. <br/>
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
