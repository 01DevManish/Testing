import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ref, get, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { renderBarcodeToBase64, generateDispatchBarcode } from "../../lib/barcodeUtils";

/**
 * Generate a Dispatch List PDF by filling data into the user's custom template.
 * 
 * Template: /templates/dispatch_list_template.pdf (A4: 595.28 x 841.89 pt)
 * 
 * For old records that don't have category/collection saved,
 * we do a just-in-time inventory lookup to resolve them.
 */

// Truncate text to fit within a given column width
const truncate = (text: string, maxChars: number): string => {
    if (!text) return "";
    return text.length > maxChars ? text.substring(0, maxChars - 2) + ".." : text;
};

const uploadPdfToS3 = async (pdfBlob: Blob, fileName: string): Promise<string | null> => {
    try {
        const formData = new FormData();
        formData.append("file", new File([pdfBlob], fileName, { type: "application/pdf" }));
        formData.append("folder", "retail-dispatch/dispatch-pdf");

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.secure_url || null;
    } catch {
        return null;
    }
};

// Resolve category & collection from inventory for items missing those fields
const resolveItemFields = async (items: any[]): Promise<any[]> => {
    try {
        const snap = await get(ref(db, "inventory"));
        if (!snap.exists()) return items;

        const invMap: Record<string, any> = {};
        const invSkuMap: Record<string, any> = {};
        snap.forEach(d => {
            const data = d.val();
            const name = (data.productName || "").trim().toLowerCase();
            const sku = (data.sku || "").trim().toUpperCase();
            invMap[name] = {
                category: data.category || "",
                collection: data.collection || "",
                brand: data.brand || "",
                imageUrl: data.imageUrl || "",
                productId: d.key || "",
            };
            if (sku) {
                invSkuMap[sku] = {
                    category: data.category || "",
                    collection: data.collection || "",
                    brand: data.brand || "",
                    imageUrl: data.imageUrl || "",
                    productId: d.key || "",
                };
            }
        });

        return items.map(item => {
            const key = (item.productName || "").trim().toLowerCase();
            const skuKey = (item.sku || "").trim().toUpperCase();
            const invByName = invMap[key];
            const invBySku = invSkuMap[skuKey];
            const inv = invBySku || invByName;
            return {
                ...item,
                category: item.category || inv?.category || "",
                collectionName: item.collectionName || inv?.collection || "",
                brandName: item.brandName || inv?.brand || "",
                imageUrl: item.imageUrl || inv?.imageUrl || "",
                productId: item.productId || inv?.productId || "",
            };
        });
    } catch (e) {
        console.warn("Could not resolve inventory fields:", e);
        return items;
    }
};

const tryEmbedRasterImage = async (pdfDoc: PDFDocument, url: string) => {
    if (!url) return null;
    try {
        const bytes = await fetch(url).then(res => res.arrayBuffer());
        try {
            return await pdfDoc.embedPng(bytes);
        } catch {
            return await pdfDoc.embedJpg(bytes);
        }
    } catch {
        return null;
    }
};

const appendBoxSummaryPages = async (
    pdfDoc: PDFDocument,
    resolvedItems: any[],
    boxBarcodes: Record<string, string> = {}
) => {
    const grouped = resolvedItems.reduce((acc: Record<string, any[]>, item: any) => {
        const box = item.boxName || "UNASSIGNED";
        if (!acc[box]) acc[box] = [];
        acc[box].push(item);
        return acc;
    }, {});

    const boxNames = Object.keys(grouped).filter(n => n !== "UNASSIGNED").sort((a, b) => {
        const an = parseInt((a.match(/\d+/) || ["0"])[0], 10);
        const bn = parseInt((b.match(/\d+/) || ["0"])[0], 10);
        if (an !== bn) return an - bn;
        return a.localeCompare(b);
    });

    if (boxNames.length === 0) return;

    const mergedBarcodes: Record<string, string> = { ...boxBarcodes };
    try {
        const managedSnap = await get(ref(db, "managed_boxes"));
        if (managedSnap.exists()) {
            boxNames.forEach((boxName) => {
                if (mergedBarcodes[boxName]) return;
                const managed = managedSnap.child(boxName);
                const managedCode = managed.exists() ? managed.val()?.barcode : "";
                if (managedCode) mergedBarcodes[boxName] = managedCode;
            });
        }
    } catch (e) {
        console.warn("Could not read managed box barcodes:", e);
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const boxName of boxNames) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const draw = (text: string, x: number, fromTop: number, size = 10, bold = false) => {
            if (!text && text !== "0") return;
            page.drawText(String(text), {
                x,
                y: height - fromTop,
                size,
                font: bold ? fontBold : font,
                color: rgb(0, 0, 0),
            });
        };

        draw(`Box Summary: ${boxName}`, 35, 45, 20, true);
        const boxCode = mergedBarcodes?.[boxName] || "-";
        draw(`Barcode No: ${boxCode}`, 35, 70, 11, true);

        if (boxCode !== "-") {
            try {
                const barcodeDataUrl = renderBarcodeToBase64(boxCode);
                const barcodeBytes = await fetch(barcodeDataUrl).then(res => res.arrayBuffer());
                const barcodeImg = await pdfDoc.embedPng(barcodeBytes);
                page.drawImage(barcodeImg, {
                    x: 35,
                    y: height - 145,
                    width: 180,
                    height: 45
                });
            } catch {
                // ignore barcode image failures
            }
        }

        draw("Products in this box:", 35, 165, 12, true);

        const items = grouped[boxName];
        const cols = 3;
        const cardW = 170;
        const cardH = 185;
        const gapX = 12;
        const gapY = 14;
        const startX = 35;
        const startTop = 190;

        for (let i = 0; i < items.length; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = startX + col * (cardW + gapX);
            const top = startTop + row * (cardH + gapY);
            const bottomY = height - (top + cardH);
            if (bottomY < 30) break;

            page.drawRectangle({
                x,
                y: bottomY,
                width: cardW,
                height: cardH,
                borderWidth: 1,
                borderColor: rgb(0.85, 0.88, 0.92),
                color: rgb(1, 1, 1),
            });

            const item = items[i];
            const image = await tryEmbedRasterImage(pdfDoc, item.imageUrl || "");
            if (image) {
                page.drawImage(image, {
                    x: x + 10,
                    y: bottomY + 62,
                    width: cardW - 20,
                    height: 110
                });
            } else {
                page.drawRectangle({
                    x: x + 10,
                    y: bottomY + 62,
                    width: cardW - 20,
                    height: 110,
                    borderWidth: 1,
                    borderColor: rgb(0.9, 0.92, 0.95),
                    color: rgb(0.97, 0.98, 0.99),
                });
                draw("Image not available", x + 34, top + 72, 8);
            }

            draw(`SKU: ${item.sku || "N/A"}`, x + 10, top + 132, 10, true);
            draw(`Qty: ${item.quantity || 1}`, x + 10, top + 148, 10);
            draw(truncate(item.productName || "-", 28), x + 10, top + 164, 9);
        }
    }
};

export const generateTemplateDispatchPdf = async (
    list: any,
    options?: { uploadToS3?: boolean; preferUploadedUrl?: boolean }
) => {
    try {
        // 1. Load template (Strictly A4: 595.28 x 841.89 pt)
        const response = await fetch("/templates/dispatch_list_template.pdf");
        if (!response.ok) throw new Error("Failed to load PDF template. Please ensure /public/templates/dispatch_list_template.pdf exists.");
        const templateBytes = await response.arrayBuffer();

        const pdfDoc = await PDFDocument.load(templateBytes);
        const page = pdfDoc.getPages()[0];
        const { width, height } = page.getSize();

        // 3. Generate Dispatch Barcode Image
        const normalizedBoxNames = (list.items || [])
            .map((i: any) => String(i?.boxName || "").trim())
            .filter((name: string) => !!name && name !== "-" && name.toUpperCase() !== "UNASSIGNED");
        const boxesFromItems = new Set(normalizedBoxNames).size;
        const explicitBoxes = Number(list.bails || 0);
        // Prefer actual boxes present in item rows; fallback to stored bails for legacy records.
        const totalBoxes = boxesFromItems > 0 ? boxesFromItems : explicitBoxes;
        const totalItems = (list.items || []).reduce((acc: number, i: any) => acc + (i.quantity || 1), 0);
        const dispCode = list.dispatchBarcode || generateDispatchBarcode(list.dispatchNo || list.dispatchId || "0000", totalBoxes, totalItems);
        const dispBarcodeDataUrl = renderBarcodeToBase64(dispCode);
        let dispBarcodeImg = null;
        if (dispBarcodeDataUrl) {
            const dispBarcodeBytes = await fetch(dispBarcodeDataUrl).then(res => res.arrayBuffer());
            dispBarcodeImg = await pdfDoc.embedPng(dispBarcodeBytes);
        }

        // 2. Resolve category/collection for all items (Just-in-time)
        const resolvedItems = await resolveItemFields(list.items || []);

        // 3. Embed Fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Helper: draw text using precise "from-top" Y coordinate
        // We use pure black rgb(0,0,0) for laser sharp printing
        const draw = (
            text: string,
            x: number,
            fromTop: number,
            size = 9.5,
            useBold = false
        ) => {
            if (!text && text !== "0") return;
            page.drawText(String(text), {
                x,
                y: height - fromTop,
                size,
                font: useBold ? fontBold : font,
                color: rgb(0, 0, 0), // Pure Black for best print results
            });
        };
        const fromTopToY = (fromTop: number) => height - fromTop;

        // Keep original template look, but apply two requested structural tweaks:
        // 1) Remove "Remark" column visually.
        // 2) Increase SKU ID column width by shifting its right divider.
        const tableTopFromTop = 265;
        const tableBottomFromTop = 668;

        // Remove old SKU divider at x=305 and redraw new divider at x=330.
        page.drawRectangle({
            x: 304,
            y: fromTopToY(tableBottomFromTop),
            width: 2.2,
            height: tableBottomFromTop - tableTopFromTop,
            color: rgb(1, 1, 1),
        });
        page.drawLine({
            start: { x: 330, y: fromTopToY(tableTopFromTop) },
            end: { x: 330, y: fromTopToY(tableBottomFromTop) },
            thickness: 0.7,
            color: rgb(0, 0, 0),
        });

        // Remove "Remark" column divider (x=520) to merge it with Box/Bail column.
        page.drawRectangle({
            x: 519,
            y: fromTopToY(tableBottomFromTop),
            width: 2.2,
            height: tableBottomFromTop - tableTopFromTop,
            color: rgb(1, 1, 1),
        });
        // Remove header label "Remark" so option is visually gone.
        page.drawRectangle({
            x: 521,
            y: fromTopToY(286),
            width: 56,
            height: 14,
            color: rgb(1, 1, 1),
        });

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // LEFT BOX â€” Bill To / Ship To
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const bX = 35; // Calibrated for left margin
        let bY = 168;
        draw("Bill To:", bX, bY, 9, true);

        bY += 15;
        draw(list.partyName || "Unknown Party", bX, bY, 11, true);

        // Draw Dispatch Barcode Image (Restored alignment)
        if (dispBarcodeImg) {
            page.drawImage(dispBarcodeImg, {
                x: 185,
                y: height - (bY - 5),
                width: 100,
                height: 25,
            });
            // Draw sharp vector text close to bottom edge of barcode (Centering adjustment)
            draw(dispCode, 198, bY + 1, 9, true);
        }

        if (list.traderName) {
            bY += 12;
            draw(`Trader: ${list.traderName}`, bX, bY, 9.5);
        }

        bY += 12;
        draw(truncate(list.partyAddress || "", 55), bX, bY, 9.5);

        bY += 12;
        const region = [
            list.district || list.partyCity,
            list.state,
            list.pincode ? `- ${list.pincode}` : ""
        ].filter(Boolean).join(", ");
        draw(truncate(region, 55), bX, bY, 9.5);

        if (list.contactNo || list.partyPhone) {
            bY += 12;
            draw(`Contact: ${list.contactNo || list.partyPhone}`, bX, bY, 9.5);
        }

        if (list.gstNo || list.panNo) {
            bY += 12;
            const ids = [
                list.gstNo ? `GST: ${list.gstNo}` : "",
                list.panNo ? `PAN: ${list.panNo}` : ""
            ].filter(Boolean).join(" | ");
            draw(ids, bX, bY, 9.5, true);
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // RIGHT BOX â€” Dispatch Details
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const valX = 430;
        const rY = 175;  // Aligned with labels of the template
        const rG = 11.2; // Row gap calibrated for template lines

        // 1. Dispatch No
        draw(list.dispatchNo || list.dispatchId || "-", valX, rY, 10, true);

        // 2. Date
        const dateObj = new Date(list.dispatchedAt || list.createdAt || Date.now());
        draw(dateObj.toLocaleDateString("en-IN"), valX, rY + rG, 10);

        // 3. Time
        draw(dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), valX, rY + rG * 2, 10);

        // 4. Invoice No
        draw(list.invoiceNo || "-", valX, rY + rG * 3, 10);

        // 5. Dispatched By
        draw(list.assignedToName || "-", valX, rY + rG * 4, 10);

        // 6. Box / Bail Count
        draw(String(totalBoxes || 0), valX, rY + rG * 5, 11, true);

        // 7. Transporter Name
        draw(truncate(list.transporter || "-", 20), valX, rY + rG * 6, 10);

        // 8. LR No
        draw(list.lrNo || "-", valX, rY + rG * 7, 10);

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // TABLE Section
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const tStartY = 305;
        const tRowH = 20.0;
        const tTextNudge = -5.2; // move text up so template row lines don't strike through
        const maxRows = 17;

        resolvedItems.forEach((item: any, idx: number) => {
            if (idx >= maxRows) return;
            const rowY = tStartY + (idx * tRowH) + tTextNudge;

            // Shifted and aligned for template columns
            draw(`${idx + 1}.`, 35, rowY, 10);
            draw(truncate(item.category || "", 18), 70, rowY, 10);
            draw(truncate(item.collectionName || "", 16), 166, rowY, 10);
            draw(truncate(item.sku || "N/A", 18), 252, rowY, 10);
            draw(truncate(item.packagingType || item.packingType || list.packagingType || list.packingType || "Box", 10), 333, rowY, 10);
            draw(String(item.quantity || 1), 395, rowY, 10, true);
            draw(truncate(item.boxName || "-", 15), 445, rowY, 10);
        });

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // TOTAL ROW
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const totalQty = resolvedItems.reduce(
            (acc: number, item: any) => acc + (item.quantity || 1), 0
        );
        draw(String(totalQty), 395, 665, 11, true);

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // FOOTER Section (Prepared By & System URL)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const fY = 708;
        if (list.assignedToName) {
            draw(list.assignedToName, 102, fY, 13, true);
        }

        // Add System URL to bottom left for record reference
        const systemUrl = typeof window !== 'undefined' ? window.location.origin + "/dashboard/retail-dispatch" : "https://euruslifestyle.in/dashboard/retail-dispatch";
        draw(`Generated from: ${systemUrl}`, 35, 815, 7.5);

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // SAVE & OUTPUT
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const localBlobUrl = URL.createObjectURL(blob);

        const shouldUploadToS3 = options?.uploadToS3 ?? true;
        const preferUploadedUrl = options?.preferUploadedUrl ?? true;
        let uploadedUrl: string | null = null;

        if (shouldUploadToS3) {
            const fileName = `Dispatch_List_${(list.partyName || "Record").replace(/\s+/g, "_")}_${Date.now()}.pdf`;
            uploadedUrl = await uploadPdfToS3(blob, fileName);

            if (uploadedUrl && list.id) {
                try {
                    await update(ref(db, `packingLists/${list.id}`), { dispatchPdfUrl: uploadedUrl });
                } catch {
                    // non-blocking db sync failure
                }
            }
        }

        const viewUrl = preferUploadedUrl ? (uploadedUrl || localBlobUrl) : localBlobUrl;
        const newWindow = window.open(viewUrl, '_blank');
        if (newWindow) newWindow.focus();
        else alert("Popup blocked. Please allow popups to view the PDF.");

        setTimeout(() => URL.revokeObjectURL(localBlobUrl), 8000);

    } catch (error) {
        console.error("Template PDF Generation Error:", error);
    }
};
