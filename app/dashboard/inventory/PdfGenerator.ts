import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product } from "./types";

const getBase64Image = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
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

export const generateCatalogPdf = async (products: Product[], save = false): Promise<Blob | null> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text("Product Catalog", 14, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleDateString()} · ${products.length} Items`, 14, 28);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text("euruslifestyle.in", pageWidth - 14, 22, { align: "right" });

    const tableData = products.map((p, index) => [
        index + 1,
        p.productName,
        p.sku,
        p.category || "-",
        p.size || "-",
        `Rs.${Number(p.price || 0).toLocaleString("en-IN")}`,
        p.hsnCode || "-"
    ]);

    autoTable(doc, {
        head: [["#", "Product Name", "SKU", "Category", "Size", "Price", "HSN"]],
        body: tableData,
        startY: 35,
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fontSize: 9, cellPadding: 5 },
        alternateRowStyles: { fillColor: [248, 250, 255] },
        margin: { top: 35 },
        didDrawPage: (data) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(99, 102, 241);
            doc.text("Visit: euruslifestyle.in", pageWidth / 2, pageHeight - 10, { align: "center" });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page ${(doc as any).getNumberOfPages()}`, pageWidth - 14, pageHeight - 10, { align: "right" });
        }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    for (const p of products) {
        if (currentY > pageHeight - 75) {
            doc.addPage();
            currentY = 20;
        }

        // Product Card
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, currentY, pageWidth - 28, 65, 3, 3);
        
        // Product Image (if exists)
        let imageX = 18;
        let textX = 18;
        const displayImage = p.imageUrl || (p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls[0] : null);
        if (displayImage) {
            const imgData = await getBase64Image(displayImage);
            if (imgData) {
                try {
                    doc.addImage(imgData, "JPEG", 18, currentY + 5, 45, 55);
                    textX = 70;
                } catch (e) {
                    console.error("Image draw error", e);
                }
            }
        }

        // Product Details
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(p.productName, textX, currentY + 12);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`SKU: ${p.sku}`, textX, currentY + 18);
        doc.text(`Cat: ${p.category || "-"} | Size: ${p.size || "-"}`, textX, currentY + 23);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(99, 102, 241);
        doc.text(`Price: Rs.${Number(p.price || 0).toLocaleString("en-IN")}`, textX, currentY + 32);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        if (p.description) {
            const splitContent = doc.splitTextToSize(p.description, pageWidth - textX - 10);
            doc.text(splitContent, textX, currentY + 40);
        }

        currentY += 75;
    }

    if (save) {
        doc.save(`Catalog_${new Date().getTime()}.pdf`);
        return null;
    }
    return doc.output("blob");
};
