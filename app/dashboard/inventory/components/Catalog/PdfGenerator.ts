import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product } from "../../types";
import { resolveS3Url } from "../Products/imageService";

const getBase64Image = async (url: string, maxWidth = 600): Promise<{ data: string, width: number, height: number } | null> => {
    try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            console.error(`[S3-Fetch-Fail] HTTP ${response.status} for ${url} via proxy`);
            return null;
        }
        const blob = await response.blob();

        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                resolve({ 
                    data: canvas.toDataURL("image/jpeg", 0.7),
                    width,
                    height
                });
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(blob);
        });
    } catch (e) {
        return null;
    }
};

export const generateCatalogPdf = async (products: Product[], collectionName: string = "Product Catalog", save = false): Promise<Blob | null> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Prepare Data & Images
    const tableData: any[][] = [];
    const images: Record<number, string> = {};

    // Determine collection name if not provided or if generic
    let finalCollectionName = collectionName;
    if (!collectionName || collectionName === "Product Catalog") {
        const uniqueColl = Array.from(new Set(products.map(p => p.collection).filter(Boolean)));
        if (uniqueColl.length === 1) finalCollectionName = uniqueColl[0] as string;
        else if (uniqueColl.length > 1) finalCollectionName = "Various Collections";
        else finalCollectionName = "Product Catalog";
    }

    // 1. Prepare Data & Images - Parallel chunks for speed
    const CHUNK_SIZE = 8;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
        const chunk = products.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (p, chunkIdx) => {
            const globalIdx = i + chunkIdx;
            const imgUrl = p.imageUrl || (p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls[0] : null);
            if (imgUrl) {
                const result = await getBase64Image(resolveS3Url(imgUrl));
                if (result) images[globalIdx] = result.data;
            }
        }));
    }

    products.forEach((p, i) => {
        tableData.push([
            i + 1,
            "", // Placeholder for image
            `${p.productName}\nSKU: ${p.sku}${p.collection ? `\nCollection: ${p.collection}` : ""}${p.size ? `\nSize: ${p.size}` : ""}${p.description ? `\n\n${p.description}` : ""}`,
            `Rs. ${Number(p.price || 0).toLocaleString("en-IN")}`
        ]);
    });

    // 2. Header
    const drawHeader = async (d: jsPDF) => {
        const COMPANY_LOGO = "https://epanelimages.s3.ap-south-1.amazonaws.com/Cloudinary_Archive_2026-04-10_10_27_479_Originals/logo.png";
        const logo = await getBase64Image(COMPANY_LOGO, 200);

        if (logo) {
            const logoH = 22;
            const logoW = (logo.width / logo.height) * logoH;
            
            // Premium White Box for Logo
            d.setFillColor(255, 255, 255);
            d.setDrawColor(241, 245, 249); // Slate 100
            d.setLineWidth(0.1);
            // Draw a generous white card for the logo
            const boxW = logoW + 8;
            const boxH = logoH + 8;
            d.roundedRect(14, 8, boxW, boxH, 2, 2, 'FD');
            
            // Center logo in the box
            d.addImage(logo.data, "PNG", 14 + 4, 8 + 4, logoW, logoH);
        }

        
        d.setFont("helvetica", "bold");
        d.setFontSize(9.5);
        d.setTextColor(0, 0, 0);
        d.text("Plot No. 263, Sector 25 Part 2, HUDA Industrial Area, Panipat, Haryana - 132103", pageWidth / 2, 28, { align: "center" });
        d.setFontSize(8.5);
        d.text("Contact No: 9779143994 | Email ID: sales@euruslifestyle.in", pageWidth / 2, 34, { align: "center" });

        d.setFont("helvetica", "bold");
        d.setFontSize(16);
        d.setTextColor(0, 0, 0);
        // Using the dynamically determined collection name
        d.text(finalCollectionName.toUpperCase(), pageWidth / 2, 42, { align: "center" });

        d.setFont("helvetica", "normal");
        d.setFontSize(9);
        d.setTextColor(100, 116, 139);
        const dateStr = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
        d.text(`Ref: EL-${new Date().getTime().toString().slice(-6)} | Date: ${dateStr}`, pageWidth / 2, 48, { align: "center" });
        
        d.setDrawColor(226, 232, 240);
        d.setLineWidth(0.5);
        d.line(14, 54, pageWidth - 14, 54);
    };

    await drawHeader(doc);

    // 3. Table
    autoTable(doc, {
        head: [["Sr.No.", "Product Image", "Product Detail", "Wholesale Price"]],
        body: tableData,
        startY: 58,
        theme: "plain",
        headStyles: { 
            fillColor: [248, 250, 252], 
            textColor: [15, 23, 42], 
            fontSize: 10, 
            fontStyle: "bold",
            lineWidth: 0.1,
            lineColor: [226, 232, 240],
            minCellHeight: 10, // More compact header
            cellPadding: 4,
            halign: "center"
        },
        bodyStyles: { 
            fontSize: 10, 
            cellPadding: 6,
            lineWidth: 0.1,
            lineColor: [226, 232, 240],
            valign: "middle",
            minCellHeight: 45 // Product rows keep the height
        },
        columnStyles: {
            0: { cellWidth: 22, halign: "center" }, // Increased width to prevent wrapping
            1: { cellWidth: 42 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 32, halign: "right", fontStyle: "bold" }
        },
        didDrawCell: (data) => {
            if (data.column.index === 1 && data.cell.section === "body") {
                const rowIndex = data.row.index;
                const imgBase64 = images[rowIndex];
                if (imgBase64) {
                    const padding = 2;
                    doc.addImage(
                        imgBase64, 
                        "JPEG", 
                        data.cell.x + padding, 
                        data.cell.y + padding, 
                        data.cell.width - (padding * 2), 
                        data.cell.height - (padding * 2),
                        undefined,
                        'FAST'
                    );
                }
            }
        },
        didDrawPage: (data) => {
            // Footer
            const totalPages = (doc as any).internal.getNumberOfPages();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(99, 102, 241);
            doc.text("www.euruslifestyle.in", pageWidth / 2, pageHeight - 12, { align: "center" });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Generated on ${new Date().toLocaleDateString()} | Page ${data.pageNumber}`, pageWidth - 14, pageHeight - 12, { align: "right" });
        },
        rowPageBreak: "avoid"
    });

    if (save) {
        doc.save(`${collectionName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
        return null;
    }
    return doc.output("blob");
};

export const generatePartyRatePdf = async (party: any, ratesToShare: any[], products: Product[], save = false): Promise<Blob | null> => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const tableData: any[][] = [];
    const images: Record<number, string> = {};

    // Process images in parallel chunks
    const CHUNK_SIZE = 8;
    for (let i = 0; i < ratesToShare.length; i += CHUNK_SIZE) {
        const chunk = ratesToShare.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (r, chunkIdx) => {
            const globalIdx = i + chunkIdx;
            const product = products.find(p => p.productName === r.productName);
            const imgUrl = product?.imageUrl || (product?.imageUrls && product?.imageUrls.length > 0 ? product.imageUrls[0] : null);
            if (imgUrl) {
                const result = await getBase64Image(resolveS3Url(imgUrl));
                if (result) images[globalIdx] = result.data;
            }
        }));
    }

    ratesToShare.forEach((r, i) => {
        const product = products.find(p => p.productName === r.productName);
        const sku = product?.sku || "N/A";
        const pkgCost = r.packagingCost || 0;
        
        const base = Number(r.rate || 0) + Number(pkgCost);
        const disc = r.discountType === "percentage" ? (base * (r.discount || 0) / 100) : Number(r.discount || 0);
        const subtotal = Math.max(0, base - disc);
        const gstAmt = (subtotal * (r.gstRate || 0)) / 100;
        const total = subtotal + gstAmt;

        tableData.push([
            i + 1,
            "", // Placeholder for image
            `${r.productName}\nSKU: ${sku}`,
            r.packagingType || "-",
            pkgCost > 0 ? `Rs. ${pkgCost}` : "-",
            `Rs. ${r.rate}`,
            r.discount > 0 ? (r.discountType === "percentage" ? `${r.discount}%` : `Rs. ${r.discount}`) : "-",
            `${r.gstRate || 0}%`,
            `Rs. ${total.toFixed(2)}`
        ]);
    });

    const drawHeader = async (d: jsPDF) => {
        // --- Logo (Centered Hero) ---
        const COMPANY_LOGO = "https://epanelimages.s3.ap-south-1.amazonaws.com/Cloudinary_Archive_2026-04-10_10_27_479_Originals/logo.png";
        const logo = await getBase64Image(COMPANY_LOGO, 600);
        if (logo) {
            const logoH = 80;
            const logoW = (logo.width / logo.height) * logoH;
            d.addImage(logo.data, "JPEG", (pageWidth - logoW) / 2, 10, logoW, logoH);
        }

        // --- Header Contact Info ---
        d.setFont("helvetica", "bold");
        d.setFontSize(11);
        d.setTextColor(0, 0, 0);
        d.text("Plot No 263, Sector 25 Part 2, HUDA Industrial Area, Panipat – 132103", pageWidth / 2, 110, { align: "center" });
        d.setFontSize(10);
        d.text("Contact No: 9779143994 | Email ID: sales@euruslifestyle.in", pageWidth / 2, 125, { align: "center" });

        const dateStr = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.text(`Date: ${dateStr}`, pageWidth - 40, 25, { align: "right" });

        // Party Address Section
        d.setFontSize(10);
        d.setFont("helvetica", "bold");
        d.text("BILL TO:", 40, 150);
        d.text("SHIP TO:", pageWidth / 2 + 20, 150);

        d.setFont("helvetica", "normal");
        const billTo = party.billTo || {};
        const billAddr = `${billTo.companyName || ""}\n${billTo.address || ""}\n${billTo.district || ""}, ${billTo.state || ""} - ${billTo.pincode || ""}\nContact: ${billTo.contactNo || ""}`;
        d.text(billAddr, 40, 165, { maxWidth: 220 });

        const shipTo = party.sameAsBillTo ? billTo : (party.shipTo || {});
        const shipAddr = `${shipTo.companyName || ""}\n${shipTo.address || ""}\n${shipTo.district || ""}, ${shipTo.state || ""} - ${shipTo.pincode || ""}\nContact: ${shipTo.contactNo || ""}`;
        d.text(shipAddr, pageWidth / 2 + 20, 165, { maxWidth: 220 });

        // RATE LIST Title
        d.setFont("helvetica", "bold");
        d.setFontSize(16);
        d.text("RATE LIST", pageWidth / 2, 230, { align: "center" });
        d.setFontSize(12);
        d.text(`${party.partyName.toUpperCase()}`, pageWidth / 2, 245, { align: "center" });

        return 260; // Start table here
    };

    const tableStartY = await drawHeader(doc);

    // 3. Table
    autoTable(doc, {
        head: [["Sr. No.", "Image", "Product & SKU", "Pkg Type", "Pkg Price", "Rate", "Disc.", "GST", "Total Price"]],
        body: tableData,
        startY: tableStartY,
        theme: "grid",
        headStyles: { 
            fillColor: [143, 206, 209] as any, 
            textColor: [0, 0, 0], 
            fontSize: 9, 
            fontStyle: "bold",
            lineWidth: 0.5,
            lineColor: [40, 40, 40],
            halign: "center",
            valign: "middle"
        },
        bodyStyles: { 
            fontSize: 8, 
            textColor: [0, 0, 0],
            lineWidth: 0.5,
            lineColor: [60, 60, 60],
            valign: "middle",
            minCellHeight: 40
        },
        columnStyles: {
            0: { cellWidth: 25, halign: "center" },
            1: { cellWidth: 50, halign: "center" },
            2: { cellWidth: "auto" },
            3: { cellWidth: 40 },
            4: { cellWidth: 40, halign: "right" },
            5: { cellWidth: 40, halign: "right" },
            6: { cellWidth: 40, halign: "right" },
            7: { cellWidth: 25, halign: "right" },
            8: { cellWidth: 50, halign: "right", fontStyle: "bold" }
        },
        didDrawCell: (data) => {
            if (data.column.index === 1 && data.cell.section === "body") {
                const rowIndex = data.row.index;
                const imgBase64 = images[rowIndex];
                if (imgBase64) {
                    const padding = 2;
                    doc.addImage(
                        imgBase64, 
                        "JPEG", 
                        data.cell.x + padding, 
                        data.cell.y + padding, 
                        data.cell.width - (padding * 2), 
                        data.cell.height - (padding * 2),
                        undefined,
                        'FAST'
                    );
                }
            }
        },
        margin: { left: 40, right: 40 },
        didDrawPage: (data) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text("www.euruslifestyle.in", pageWidth / 2, pageHeight - 20, { align: "center" });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`Page ${data.pageNumber}`, pageWidth - 40, pageHeight - 20, { align: "right" });
        },
        rowPageBreak: "avoid"
    });

    if (save) {
        doc.save(`Rate_List_${party.partyName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
        return null;
    }
    return doc.output("blob");
};
