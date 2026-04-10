import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ref, get } from "firebase/database";
import { db } from "../../lib/firebase";

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

// Resolve category & collection from inventory for items missing those fields
const resolveItemFields = async (items: any[]): Promise<any[]> => {
    try {
        const snap = await get(ref(db, "inventory"));
        if (!snap.exists()) return items;

        const invMap: Record<string, any> = {};
        snap.forEach(d => {
            const data = d.val();
            const name = (data.productName || "").trim().toLowerCase();
            invMap[name] = {
                category: data.category || "",
                collection: data.collection || "",
                brand: data.brand || "",
            };
        });

        return items.map(item => {
            const key = (item.productName || "").trim().toLowerCase();
            const inv = invMap[key];
            return {
                ...item,
                category: item.category || inv?.category || "",
                collectionName: item.collectionName || inv?.collection || "",
                brandName: item.brandName || inv?.brand || "",
            };
        });
    } catch (e) {
        console.warn("Could not resolve inventory fields:", e);
        return items;
    }
};

export const generateTemplateDispatchPdf = async (list: any) => {
    try {
        // 1. Load template (Strictly A4: 595.28 x 841.89 pt)
        const response = await fetch("/templates/dispatch_list_template.pdf");
        if (!response.ok) throw new Error("Failed to load PDF template. Please ensure /public/templates/dispatch_list_template.pdf exists.");
        const templateBytes = await response.arrayBuffer();

        const pdfDoc = await PDFDocument.load(templateBytes);
        const page = pdfDoc.getPages()[0];
        const { width, height } = page.getSize();

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

        // ═══════════════════════════════════════════════════════
        // LEFT BOX — Bill To / Ship To
        // ═══════════════════════════════════════════════════════
        const bX = 35; // Calibrated for left margin
        let bY = 168;
        draw("Bill To:", bX, bY, 9, true);

        bY += 15;
        draw(list.partyName || "Unknown Party", bX, bY, 11, true);

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

        // ═══════════════════════════════════════════════════════
        // RIGHT BOX — Dispatch Details
        // ═══════════════════════════════════════════════════════
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
        draw(String(list.bails || 0), valX, rY + rG * 5, 11, true);

        // 7. Transporter Name
        draw(truncate(list.transporter || "-", 20), valX, rY + rG * 6, 10);

        // ═══════════════════════════════════════════════════════
        // TABLE Section
        // ═══════════════════════════════════════════════════════
        const tStartY = 305;
        const tRowH = 20.3; // Height adjustment for grid lines
        const maxRows = 17;

        resolvedItems.forEach((item: any, idx: number) => {
            if (idx >= maxRows) return;
            const rowY = tStartY + (idx * tRowH);

            // Shifted and aligned for template columns
            draw(`${idx + 1}.`, 35, rowY, 10);
            draw(truncate(item.category || "", 18), 70, rowY, 10);
            draw(truncate(item.collectionName || "", 16), 166, rowY, 10);
            draw(truncate(item.sku || "N/A", 12), 258, rowY, 10);
            draw(truncate(item.packagingType || list.packingType || "Box", 12), 305, rowY, 10);
            draw(String(item.quantity || 1), 395, rowY, 10.5, true);
            draw(truncate(item.boxName || "-", 15), 445, rowY, 10);
        });

        // ═══════════════════════════════════════════════════════
        // TOTAL ROW
        // ═══════════════════════════════════════════════════════
        const totalQty = resolvedItems.reduce(
            (acc: number, item: any) => acc + (item.quantity || 1), 0
        );
        draw(String(totalQty), 395, 665, 11, true);

        // ═══════════════════════════════════════════════════════
        // FOOTER Section (Prepared By & System URL)
        // ═══════════════════════════════════════════════════════
        const fY = 708;
        if (list.assignedToName) {
            draw(list.assignedToName, 115, fY, 13, true);
        }

        // Add System URL to bottom left for record reference
        const systemUrl = typeof window !== 'undefined' ? window.location.origin + "/dashboard/retail-dispatch" : "https://euruslifestyle.in/dashboard/retail-dispatch";
        draw(`Generated from: ${systemUrl}`, 35, 815, 7.5);

        // ═══════════════════════════════════════════════════════
        // SAVE & OUTPUT
        // ═══════════════════════════════════════════════════════
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        
        // Open PDF in a new window for printing instead of downloading
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
            newWindow.focus();
        } else {
            // Fallback for popup blockers
            const link = document.createElement("a");
            link.href = url;
            const pName = (list.partyName || "Record").replace(/\s+/g, "_");
            link.download = `Dispatch_List_${pName}.pdf`;
            link.click();
        }

        // Cleanup after a short delay to allow the new tab to load the blob
        setTimeout(() => URL.revokeObjectURL(url), 5000);

    } catch (error) {
        console.error("Template PDF Generation Error:", error);
    }
};
