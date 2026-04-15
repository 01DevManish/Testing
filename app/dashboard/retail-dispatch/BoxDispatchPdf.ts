import jsPDF from "jspdf";
import { renderBarcodeToBase64 } from "../../lib/barcodeUtils";
import { resolveS3Url } from "../inventory/components/Products/imageService";

interface DispatchPdfItem {
  productId?: string;
  productName?: string;
  sku?: string;
  quantity?: number;
}

interface DispatchPdfList {
  sourceBoxId?: string;
  sourceBoxBarcode?: string;
  partyName?: string;
  items?: DispatchPdfItem[];
}

export interface ProductLookup {
  id?: string;
  sku?: string;
  productName?: string;
  imageUrl?: string;
}

interface BoxPdfOptions {
  mode?: "view" | "print";
  targetWindow?: Window | null;
}

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const normalizeImageDataUrl = async (blob: Blob): Promise<string | null> => {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const normalized = canvas.toDataURL("image/jpeg", 0.9);
        URL.revokeObjectURL(objectUrl);
        resolve(normalized);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
};

const fetchImageDataUrl = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const res = await fetch(resolveS3Url(url));
    if (!res.ok) return null;
    const blob = await res.blob();
    const normalized = await normalizeImageDataUrl(blob);
    if (normalized) return normalized;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
};

const openPdfForView = (url: string, targetWindow?: Window | null) => {
  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = url;
    targetWindow.focus();
    return;
  }
  window.open(url, "_blank");
};

const openPdfForPrint = (url: string, targetWindow?: Window | null) => {
  const win = targetWindow && !targetWindow.closed ? targetWindow : window.open("", "_blank");
  if (!win) {
    window.open(url, "_blank");
    return;
  }
  win.location.href = url;
  // Let the browser's native PDF viewer load first, then trigger print dialog.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // ignore and let user print manually if browser blocks programmatic print
    }
  }, 1600);
  win.focus();
};

const getImageFormat = (dataUrl: string): "PNG" | "JPEG" => {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
};

export const generateBoxDispatchPdf = async (list: DispatchPdfList, allProducts: ProductLookup[], options: BoxPdfOptions = {}) => {
  const mode = options.mode || "view";
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const boxId = list.sourceBoxId || "D1";
  const boxBarcode = list.sourceBoxBarcode || "";
  const barcodeImg = boxBarcode ? renderBarcodeToBase64(boxBarcode) : "";

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(46);
    doc.text(String(boxId), 40, 72);

    const barcodeW = 220;
    const barcodeH = 56;
    const barcodeX = pageW - barcodeW - 40;
    const barcodeY = 28;

    if (barcodeImg) {
      doc.addImage(barcodeImg, "PNG", barcodeX, barcodeY, barcodeW, barcodeH);
      doc.setFont("courier", "bold");
      doc.setFontSize(12);
      doc.text(boxBarcode, barcodeX + barcodeW / 2, barcodeY + barcodeH + 14, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Party: ${list.partyName || "-"}`, pageW / 2, 150, { align: "center" });

    doc.setDrawColor(220, 226, 234);
    doc.line(40, 134, pageW - 40, 134);
  };

  const cols = 4;
  const maxRowsPerPage = 5;
  const itemsPerPage = cols * maxRowsPerPage;
  const gapX = 12;
  const gapY = 8;
  const startX = 40;
  const startY = 176;
  const endY = pageH - 40;
  const cardW = (pageW - 80 - (cols - 1) * gapX) / cols;

  const items = list.items || [];
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (pageIndex > 0) doc.addPage();
    drawHeader();

    const pageStart = pageIndex * itemsPerPage;
    const pageItems = items.slice(pageStart, pageStart + itemsPerPage);
    const rows = Math.max(1, Math.ceil(pageItems.length / cols));
    const cardH = (endY - startY - (rows - 1) * gapY) / rows;

    for (let i = 0; i < pageItems.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const item = pageItems[i];

      doc.setDrawColor(226, 232, 240);
      doc.rect(x, y, cardW, cardH);

      const product = allProducts.find((p) => p.id === item.productId || (p.sku && item.sku && String(p.sku).toUpperCase() === String(item.sku).toUpperCase()));

      const imageDataUrl = await fetchImageDataUrl(product?.imageUrl || "");
      const imageX = x + 6;
      const imageY = y + 6;
      const imageW = cardW - 12;
      const imageH = Math.max(36, cardH - 24);

      if (imageDataUrl) {
        try {
          doc.addImage(imageDataUrl, getImageFormat(imageDataUrl), imageX, imageY, imageW, imageH);
        } catch {
          doc.setFillColor(248, 250, 252);
          doc.rect(imageX, imageY, imageW, imageH, "F");
        }
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(imageX, imageY, imageW, imageH, "F");
      }

      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      doc.text(String(item.sku || "N/A"), x + cardW / 2, y + cardH - 8, { align: "center" });
    }
  }

  if (items.length === 0) {
    drawHeader();
  }

  const pdfBlob = doc.output("blob");
  const localBlobUrl = URL.createObjectURL(pdfBlob);
  const openUrl = localBlobUrl;
  if (mode === "print") {
    openPdfForPrint(openUrl, options.targetWindow);
  } else {
    openPdfForView(openUrl, options.targetWindow);
  }

  if (mode === "view") {
    setTimeout(() => URL.revokeObjectURL(localBlobUrl), 8000);
  } else {
    setTimeout(() => URL.revokeObjectURL(localBlobUrl), 30000);
  }
};
