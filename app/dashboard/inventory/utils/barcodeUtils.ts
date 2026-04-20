import { Collection, Product } from "../types";

const MIN_COLLECTION_CODE = 1;
const MAX_COLLECTION_CODE = 999;

const toNumeric3 = (value?: string): string | null => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    return digits.slice(-3).padStart(3, "0");
};

const stableHash = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

export const normalizeSkuKey = (sku?: string): string => String(sku || "").trim().toUpperCase();

export const getCollectionCodeFromName = (collectionName: string, collections: Collection[]): string => {
    const lookup = (collectionName || "").trim().toLowerCase();
    const match = collections.find(c => c.name.trim().toLowerCase() === lookup);
    const explicit = toNumeric3(match?.collectionCode);
    if (explicit) return explicit;
    const hashed = (stableHash(lookup || "collection") % 900) + 100;
    return String(hashed).padStart(3, "0");
};

export const getStylePart = (styleId?: string): string => {
    const numeric = toNumeric3(styleId);
    if (numeric) return numeric;
    const fallback = (stableHash(String(styleId || "GEN")) % 900) + 100;
    return String(fallback).padStart(3, "0");
};

export const getSkuPart = (sku?: string): string => {
    const digits = String(sku || "").replace(/\D/g, "");
    return digits.slice(-3).padStart(3, "0");
};

export const generateBarcodeForProduct = (
    product: Pick<Product, "id" | "sku" | "styleId" | "collection">,
    collections: Collection[]
): string => {
    const colPart = getCollectionCodeFromName(product.collection || "", collections);
    const skuPart = getSkuPart(product.sku || "");
    const stylePart = getStylePart(product.styleId || "");
    const entropyBase = `${product.id || ""}:${product.sku || ""}:${product.styleId || ""}:${product.collection || ""}`;
    const randPart = String((stableHash(entropyBase) % 9000) + 1000);
    return `${colPart}${skuPart}${stylePart}${randPart}`;
};

export const getBarcodeMappedFields = (
    product: Pick<Product, "id" | "sku" | "styleId" | "collection">,
    collections: Collection[]
): { barcode: string; barcodeSku: string } => ({
    barcode: generateBarcodeForProduct(product, collections),
    barcodeSku: normalizeSkuKey(product.sku),
});

export const needsBarcodeRefresh = (
    product: Pick<Product, "id" | "sku" | "styleId" | "collection" | "barcode"> & { barcodeSku?: string },
    collections: Collection[]
): boolean => {
    const expected = getBarcodeMappedFields(product, collections);
    if (!product.barcode) return true;
    if (String(product.barcode) !== expected.barcode) return true;
    if (normalizeSkuKey(product.barcodeSku) !== expected.barcodeSku) return true;
    return false;
};

export const allocateUniqueCollectionCode = (
    collections: Collection[],
    preferredCode?: string
): string => {
    const used = new Set(
        collections
            .map(c => toNumeric3(c.collectionCode))
            .filter((c): c is string => Boolean(c))
    );

    const preferred = toNumeric3(preferredCode);
    if (preferred && !used.has(preferred)) return preferred;

    for (let code = MIN_COLLECTION_CODE; code <= MAX_COLLECTION_CODE; code++) {
        const candidate = String(code).padStart(3, "0");
        if (!used.has(candidate)) return candidate;
    }

    const fallback = String((Date.now() % 999) + 1).padStart(3, "0");
    return fallback;
};
