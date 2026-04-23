import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { firestoreApi } from "./data";

interface PackingPdfItem {
  category?: string;
  collectionName?: string;
  productName?: string;
  sku?: string;
  quantity?: number;
  packagingType?: string;
  packingType?: string;
}

interface PackingPdfPayload {
  id?: string;
  partyName?: string;
 
  partyAddress?: string;
  transporter?: string;
  createdAt?: number;
 
  packagingType?: string;
  packingType?: string;
  items?: PackingPdfItem[];
}

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const compactAddressForPdf = (value: unknown, maxTextWidth: number, doc: jsPDF): string => {
  const text = toText(value);
  if (!text) return "";

  // If full address fits, keep it unchanged.
  if (doc.getTextWidth(text) <= maxTextWidth) return text;

  // Build segment-by-segment and keep only up to the last comma that still fits.
  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) return "";

  let fitted = "";
  for (const part of parts) {
    const next = fitted ? `${fitted}, ${part}` : part;
    if (doc.getTextWidth(next) <= maxTextWidth) {
      fitted = next;
    } else {
      break;
    }
  }

  // Fallback: if even first comma-part doesn't fit, clip by characters.
  if (!fitted) {
    let out = "";
    for (const ch of parts[0]) {
      const next = out + ch;
      if (doc.getTextWidth(next) <= maxTextWidth) out = next;
      else break;
    }
    return out.trim();
  }

  return fitted;
};

const resolveItemCategoriesFromInventory = async (items: PackingPdfItem[]): Promise<PackingPdfItem[]> => {
  if (!items.length) return items;

  try {
    const inventoryRows = await firestoreApi.getInventoryProducts();
    if (!inventoryRows.length) return items;

    const bySku: Record<string, string> = {};
    const byName: Record<string, string> = {};

    inventoryRows.forEach((inv) => {
      const sku = toText(inv.sku).toLowerCase();
      const name = toText(inv.productName).toLowerCase();
      const category = toText(inv.category);
      if (!category) return;

      if (sku) bySku[sku] = category;
      if (name) byName[name] = category;
    });

    return items.map((item) => {
      if (toText(item.category)) return item;
      const sku = toText(item.sku).toLowerCase();
      const name = toText(item.productName).toLowerCase();
      const resolvedCategory = bySku[sku] || byName[name] || "";

      return {
        ...item,
        category: resolvedCategory || item.collectionName || "-",
      };
    });
  } catch (error) {
    console.warn("Packing PDF category resolve failed:", error);
    return items;
  }
};

const getBase64Image = async (
  url: string,
  maxWidth = 1000
): Promise<{ data: string; width: number; height: number } | null> => {
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
          height,
        });
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
};

export const generatePackingListPdf = async (
  list: PackingPdfPayload,
  saveOrOptions: boolean | { save?: boolean; targetWindow?: Window | null } = true
): Promise<Blob | null> => {
  const save =
    typeof saveOrOptions === "boolean"
      ? saveOrOptions
      : (saveOrOptions.save ?? true);
  const targetWindow =
    typeof saveOrOptions === "boolean"
      ? null
      : (saveOrOptions.targetWindow ?? null);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const resolvedItems = await resolveItemCategoriesFromInventory(list.items || []);

  const tableData = resolvedItems.map((item, index) => [
    index + 1,
    item.category || item.collectionName || "-",
    item.productName || "-",
    item.sku || "N/A",
    item.quantity || 0,
    item.packagingType || item.packingType || list.packagingType || list.packingType || "Box",
    "",
    "",
  ]);

  const logo = await getBase64Image("/logo.png", 600);
  if (logo) {
    const logoH = 100;
    const logoW = (logo.width / logo.height) * logoH;
    doc.addImage(logo.data, "JPEG", (pageWidth - logoW) / 2, 8, logoW, logoH);
  }

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

  doc.setFontSize(12);
  doc.text("Plot No 263, Sector 25 Part 2, HUDA Industrial Area, Panipat - 132103", pageWidth / 2, 124, { align: "center" });
  doc.setFontSize(11);
  doc.text("Email ID: sales@euruslifestyle.in | GST NO: 06AAKFE6046J1Z9", pageWidth / 2, 139, { align: "center" });

  doc.setFontSize(18);
  doc.text("PACKAGING LIST", pageWidth / 2, 164, { align: "center" });

  doc.setFontSize(10);
  const infoY = 188;
  const infoLineH = 20;
  const col2X = 380;

  const drawField = (label: string, value: string, x: number, y: number, width: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value || "", x + labelW + 5, y, { maxWidth: width - labelW - 5 });
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(x + labelW + 2, y + 3, x + width, y + 3);
  };

  drawField("Party Name:", list.partyName || "", 40, infoY, 300);
  const addressLabel = "Address:";
  const addressValue = compactAddressForPdf(
    list.partyAddress,
    300 - doc.getTextWidth(addressLabel) - 5,
    doc
  );
  drawField(addressLabel, addressValue, 40, infoY + infoLineH, 300);
  drawField("Transport:", list.transporter || "", 40, infoY + infoLineH * 2, 300);

  const dateStr = new Date(list.createdAt || Date.now()).toLocaleDateString("en-IN");
  drawField("Date:", dateStr, 40, infoY + infoLineH * 3, 150);

  autoTable(doc, {
    head: [["Sr.No", "Product Category", "Product Name", "SKU ID", "Qty", "Packaging Type", "Additional", "Remarks"]],
    body: tableData,
    startY: infoY + infoLineH * 3 + 25,
    theme: "grid",
    headStyles: {
      fillColor: [143, 206, 209],
      textColor: [0, 0, 0],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineWidth: 0.5,
      lineColor: [40, 40, 40],
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      lineWidth: 0.5,
      lineColor: [60, 60, 60],
      minCellHeight: 22,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 60 },
      4: { cellWidth: 35, halign: "center" },
      5: { cellWidth: 60, halign: "center" },
      6: { cellWidth: 50 },
      7: { cellWidth: 50 },
    },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 180;
  const footerY = Math.min(finalY + 60, pageHeight - 80);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Packed By: __________________________", 40, footerY);
  doc.text("Checked By: _________________________", 40, footerY + 25);
  doc.text("Authorized Sign: ____________________", col2X, footerY + 25);

  if (save) {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const newWindow = targetWindow || window.open(url, "_blank");
    if (newWindow) {
      if (targetWindow) {
        targetWindow.location.href = url;
      }
      newWindow.focus();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } else {
      alert("Popup blocked. Please allow popups to open packing PDF.");
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    return null;
  }

  return doc.output("blob");
};
