import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product } from "./types";

const getBase64Image = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
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

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const imgUrl = p.imageUrl || (p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls[0] : null);
        if (imgUrl) {
            const base64 = await getBase64Image(imgUrl);
            if (base64) images[i] = base64;
        }

        tableData.push([
            i + 1,
            "", // Placeholder for image
            `${p.productName}\nSKU: ${p.sku}${p.size ? `\nSize: ${p.size}` : ""}${p.description ? `\n\n${p.description}` : ""}`,
            `Rs. ${Number(p.price || 0).toLocaleString("en-IN")}`
        ]);
    }

    // 2. Header
    const drawHeader = async (d: jsPDF) => {
        // Logo (Attempt to fetch /logo.png)
        const logoBase64 = await getBase64Image("/logo.png");
        if (logoBase64) {
            d.addImage(logoBase64, "PNG", 14, 10, 15, 15);
        }
        
        d.setFont("helvetica", "bold");
        d.setFontSize(16);
        d.setTextColor(0, 0, 0);
        d.text("EURUS LIFESTYLE", 34, 20);

        d.setFontSize(18);
        d.text(collectionName, pageWidth / 2, 35, { align: "center" });

        d.setFont("helvetica", "normal");
        d.setFontSize(10);
        d.setTextColor(60, 60, 60);
        const dateStr = new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
        d.text(`Date: ${dateStr}`, pageWidth - 14, 20, { align: "right" });
        
        d.setDrawColor(0, 0, 0);
        d.setLineWidth(0.5);
        d.line(14, 42, pageWidth - 14, 42);
    };

    await drawHeader(doc);

    // 3. Table
    autoTable(doc, {
        head: [["No.", "Product", "Detail", "Price"]],
        body: tableData,
        startY: 45,
        theme: "plain",
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            fontSize: 11, 
            fontStyle: "bold",
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        bodyStyles: { 
            fontSize: 10, 
            cellPadding: 8,
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            valign: "middle"
        },
        columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 45 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 35, halign: "right", fontStyle: "bold" }
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
                        data.cell.height - (padding * 2)
                    );
                }
            }
        },
        didDrawPage: (data) => {
            // Footer
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text("euruslifestyle.in", pageWidth / 2, pageHeight - 10, { align: "center" });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page ${(doc as any).getNumberOfPages()}`, pageWidth - 14, pageHeight - 10, { align: "right" });
        },
        rowPageBreak: "avoid",
        styles: { minCellHeight: 40 }
    });

    if (save) {
        doc.save(`${collectionName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
        return null;
    }
    return doc.output("blob");
};
