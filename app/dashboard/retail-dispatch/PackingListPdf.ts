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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Prepare Data
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

    // 2. Exact Template Matching
    // --- Logo (Centered Hero) ---
    const logo = await getBase64Image("/logo.png", 500);
    if (logo) {
        const logoH = 38; // Slightly smaller to fit tighter
        const logoW = (logo.width / logo.height) * logoH;
        doc.addImage(logo.data, "PNG", (pageWidth - logoW) / 2, 0.5, logoW, logoH);
    }

    // --- SR No. (Top Right - Auto Generated) ---
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
    doc.setFontSize(11);
    doc.text(`SR No. ${srNo || "Pending"}`, pageWidth - 14, 10, { align: "right" });



    // --- Address & Contact (Bold Centered) ---
    doc.setFontSize(13);
    doc.text("Plot No 263, Sector 25 Part 2, HUDA Industrial Area, Panipat – 132103", pageWidth / 2, 40, { align: "center" });
    doc.text(`Email ID: sales@euruslifestyle.in| GST NO: 06AAKFE6046J1Z9`, pageWidth / 2, 47, { align: "center" });

    // --- Main Title: PACKAGING LIST ---
    doc.setFontSize(18);
    doc.text("PACKAGING LIST", pageWidth / 2, 58, { align: "center" });

    // --- Information Grid Section ---
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    const infoY = 70;
    const infoLineH = 9;

    // Line 1: Party & Brand
    doc.text(`Party Name  : ___________________________________`, 14, infoY);
    doc.setFont("helvetica", "normal");
    doc.text(list.partyName || "", 42, infoY - 0.5, { maxWidth: 85 });
    
    doc.setFont("helvetica", "bold");
    doc.text(`Brand Name  ____________________`, 125, infoY);

    // Line 2: Address
    doc.text(`Address: _______________________________________`, 14, infoY + infoLineH);
    doc.setFont("helvetica", "normal");
    doc.text(list.partyAddress || "", 35, infoY + infoLineH - 0.5, { maxWidth: 100 });

    // Line 3: Transport
    doc.setFont("helvetica", "bold");
    doc.text(`Transport: ______________________________________`, 14, infoY + infoLineH * 2);
    doc.setFont("helvetica", "normal");
    doc.text(list.transporter || "", 38, infoY + infoLineH * 2 - 0.5);

    // Line 4: Date & Bale No
    doc.setFont("helvetica", "bold");
    const dateStr = new Date(list.createdAt || Date.now()).toLocaleDateString("en-IN");
    doc.text(`Date. ________________ Bale No: ___________________`, 14, infoY + infoLineH * 3);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, 28, infoY + infoLineH * 3 - 0.5);

    // 3. Main Table (Specific Teal Color)
    autoTable(doc, {
        head: [["Sr.No", "Product Category", "Product Name", "SKU ID", "Qty", "Packaging Type", "Additional", "Remarks"]],
        body: tableData,
        startY: infoY + infoLineH * 3 + 8,
        theme: "grid",
        headStyles: { 
            fillColor: [143, 206, 209] as any, // Light Teal/Blue-Green
            textColor: [0, 0, 0],
            fontSize: 11,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        bodyStyles: {
            fontSize: 10,
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            minCellHeight: 10,
            valign: "middle"
        },
        columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 32 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 28 },
            4: { cellWidth: 15, halign: "center" },
            5: { cellWidth: 24, halign: "center" },
            6: { cellWidth: 24 },
            7: { cellWidth: 22 }
        },
        margin: { left: 14, right: 14 },
    });

    // 4. Footer Section (Signatures)
    const finalY = (doc as any).lastAutoTable.finalY || 180;
    const footerY = Math.max(finalY + 25, pageHeight - 50);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    
    doc.text("Packed By: __________________________", 14, footerY);
    doc.text("Checked By: _________________________", 14, footerY + 12);
    doc.text("Authorized Sign: ____________________", 14, footerY + 24);

    if (save) {
        const pName = list.partyName || "Unknown_Party";
        doc.save(`Packaging_List_${pName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
        return null;
    }
    return doc.output("blob");
};
