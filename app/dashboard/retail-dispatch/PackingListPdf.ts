import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const getBase64Image = async (url: string, maxWidth = 600): Promise<{ data: string, width: number, height: number } | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
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
                if (ctx) {
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                }
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

export const generatePackingListPdf = async (list: any, save = true): Promise<Blob | null> => {
    // 1. Initialize A4 in points (Standard: 595.28 x 841.89 pt)
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 2. Prepare Data
    const tableData: any[][] = (list.items || []).map((item: any, index: number) => [
        index + 1,
        item.category || item.collectionName || "-",
        item.productName,
        item.sku,
        item.quantity,
        item.packagingType || list.packagingType || "Box",
        "", // Additional
        ""  // Remarks
    ]);

    // 3. Exact Layout Reconstruction
    // --- Logo (Centered Hero) ---
    const logo = await getBase64Image("/logo.png", 600);
    if (logo) {
        const logoH = 80; // Significantly increased for better prominence
        const logoW = (logo.width / logo.height) * logoH;
        doc.addImage(logo.data, "JPEG", (pageWidth - logoW) / 2, 10, logoW, logoH);

    }

    // --- SR No. (Top Right) ---
    const rawId = list.id || "";
    let srNo = "";
    if (rawId) {
        let hash = 0;
        for (let i = 0; i < rawId.length; i++) {
            hash = ((hash << 5) - hash) + rawId.charCodeAt(i);
            hash |= 0;
        }
        srNo = "PKG-" + String(Math.abs(hash) % 10000).padStart(4, "0");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`SR No. ${srNo || "Pending"}`, pageWidth - 40, 35, { align: "right" });

    // --- Header Contact Info --- (Shifted down for larger logo)
    doc.setFontSize(12);
    doc.text("Plot No 263, Sector 25 Part 2, HUDA Industrial Area, Panipat – 132103", pageWidth / 2, 110, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Email ID: sales@euruslifestyle.in | GST NO: 06AAKFE6046J1Z9`, pageWidth / 2, 125, { align: "center" });

    // --- Main Title ---
    doc.setFontSize(18);
    doc.text("PACKAGING LIST", pageWidth / 2, 150, { align: "center" });


    // --- Information Section ---
    doc.setFontSize(10);
    const infoY = 175; // Shifted down
    const infoLineH = 20;
    const col2X = 380;

    // Helper: draw field with clean line
    const drawField = (label: string, value: string, x: number, y: number, width: number) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, x, y);
        const labelW = doc.getTextWidth(label);
        doc.setFont("helvetica", "normal");
        doc.text(value || "", x + labelW + 5, y, { maxWidth: width - labelW - 5 });
        // Draw vector line instead of underscores
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(x + labelW + 2, y + 3, x + width, y + 3);
    };

    drawField("Party Name:", list.partyName || "", 40, infoY, 300);
    drawField("Brand Name:", list.brandName || "", col2X, infoY, 175);
    
    drawField("Address:", list.partyAddress || "", 40, infoY + infoLineH, 300);
    drawField("Transport:", list.transporter || "", 40, infoY + infoLineH * 2, 300);

    const dateStr = new Date(list.createdAt || Date.now()).toLocaleDateString("en-IN");
    drawField("Date:", dateStr, 40, infoY + infoLineH * 3, 150);
    drawField("Bale No:", String(list.baleNo || "-"), 220, infoY + infoLineH * 3, 120);

    // 4. Main Table
    autoTable(doc, {
        head: [["Sr.No", "Category", "Product Name", "SKU ID", "Qty", "Packaging", "Additional", "Remarks"]],
        body: tableData,
        startY: infoY + infoLineH * 3 + 25,

        theme: "grid",
        headStyles: { 
            fillColor: [143, 206, 209] as any, 
            textColor: [0, 0, 0],
            fontSize: 10,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            lineWidth: 0.5,
            lineColor: [40, 40, 40]
        },
        bodyStyles: {
            fontSize: 9,
            textColor: [0, 0, 0],
            lineWidth: 0.5,
            lineColor: [60, 60, 60],
            minCellHeight: 22,
            valign: "middle"
        },
        columnStyles: {
            0: { cellWidth: 30, halign: "center" },
            1: { cellWidth: 70 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 60 },
            4: { cellWidth: 35, halign: "center" },
            5: { cellWidth: 60, halign: "center" },
            6: { cellWidth: 50 },
            7: { cellWidth: 50 }
        },
        margin: { left: 40, right: 40 },
    });

    // 5. Footer (Signatures)
    const finalY = (doc as any).lastAutoTable.finalY || 180;
    const footerY = Math.min(finalY + 60, pageHeight - 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    
    doc.text("Packed By: __________________________", 40, footerY);
    doc.text("Checked By: _________________________", 40, footerY + 25);
    doc.text("Authorized Sign: ____________________", col2X, footerY + 25);

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);

    if (save) {
        // Open PDF in a new window for printing instead of downloading
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
            newWindow.focus();
        } else {
            // Fallback for popup blockers
            const pName = list.partyName || "Unknown_Party";
            doc.save(`Packaging_List_${pName.replace(/\s+/g, '_')}.pdf`);
        }
        
        // Cleanup after a short delay to allow the new tab to load the blob
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return null;
    }
    return blob;

};
