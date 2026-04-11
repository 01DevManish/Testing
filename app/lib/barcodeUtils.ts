import JsBarcode from "jsbarcode";

/**
 * Generates a 15-digit unique barcode for a box.
 * Structure: 
 * [1-6]:   Collection IDs (Two 3-digit codes)
 * [7]:     Flag (1 if > 2 collections, else 0)
 * [8-9]:   Box Identifier (e.g. B1, B2)
 * [10-12]: Unique SKU count in box (3 digits)
 * [13-15]: Total Quantity (3 digits)
 */
export const generateBoxBarcode = (
  boxName: string,
  collectionCodes: string[],
  uniqueSkuCount: number,
  totalQty: number
): string => {
  // 1. Collection Codes
  const c1 = (collectionCodes[0] || "000").substring(0, 3).padStart(3, "0");
  const c2 = (collectionCodes[1] || "000").substring(0, 3).padStart(3, "0");

  // 2. Flag (> 2 collections)
  const flag = collectionCodes.length > 2 ? "1" : "0";

  // 3. Box Identifier (B1, B2...)
  const boxPart = boxName.substring(0, 2).toUpperCase().padStart(2, "0");

  // 4. Unique SKU Count
  const skuPart = String(uniqueSkuCount).padStart(3, "0").slice(-3);

  // 5. Quantity (001 - 999)
  const qtyPart = String(totalQty).padStart(3, "0").slice(-3);

  return `${c1}${c2}${flag}${boxPart}${skuPart}${qtyPart}`;
};

/**
 * Generates a 15-digit unique barcode for a Dispatch List.
 * Structure: 23 (Prefix) + Total Boxes (2) + Total Items (3) + Dispatch ID (8)
 */
export const generateDispatchBarcode = (
  dispatchId: string, 
  totalBoxes = 0, 
  totalItems = 0
): string => {
  const boxPart = String(totalBoxes).padStart(2, "0").slice(-2);
  const qtyPart = String(totalItems).padStart(3, "0").slice(-3);
  const idPart = dispatchId.replace(/\D/g, "").padStart(8, "0").slice(-8);
  
  return `23${boxPart}${qtyPart}${idPart}`;
};

/**
 * Renders a barcode to a Base64 Data URL (PNG).
 * Uses Code 128 for reliability with 15 digits.
 */
export const renderBarcodeToBase64 = (code: string): string => {
  if (typeof document === "undefined") return ""; // SSR safety

  const canvas = document.createElement("canvas");
  JsBarcode(canvas, code, {
    format: "CODE128",
    width: 3, // Increased for better resolution
    height: 80, // Increased for better resolution
    displayValue: false, // Disable raster text to use vector text instead
    margin: 10,
    background: "#ffffff",
    lineColor: "#000000",
  });

  return canvas.toDataURL("image/png");
};
