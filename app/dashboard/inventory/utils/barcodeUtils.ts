import { Collection, Product } from "../types";

const MIN_COLLECTION_CODE = 1;
const MAX_COLLECTION_CODE = 999;
const BARCODE_TOTAL_LENGTH = 13;
const BARCODE_V1 = "v1";
const BARCODE_V2 = "v2";

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

export const normalizeSkuKey = (sku?: string): string =>
    String(sku || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

const isV2SkuPattern = (sku?: string): boolean => {
    const normalized = normalizeSkuKey(sku);
    return /^[A-Z]{2,4}[0-9]{2,4}$/.test(normalized);
};

const getBarcodeVersion = (sku?: string): "v1" | "v2" => (isV2SkuPattern(sku) ? BARCODE_V2 : BARCODE_V1);

const buildNumericEntropy = (seed: string, length: number): string => {
    let value = "";
    let index = 0;
    while (value.length < length) {
        value += String(stableHash(`${seed}:${index}`)).replace(/\D/g, "");
        index++;
    }
    return value.slice(0, length);
};

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
    const version = getBarcodeVersion(product.sku || "");
    const colPart = getCollectionCodeFromName(product.collection || "", collections);

    if (version === BARCODE_V2) {
        const fullSku = normalizeSkuKey(product.sku || "");
        const usedLength = colPart.length + fullSku.length;
        const randLength = Math.max(2, BARCODE_TOTAL_LENGTH - usedLength);
        const entropyBase = `${product.id || ""}:${product.sku || ""}:${product.styleId || ""}:${product.collection || ""}:${BARCODE_V2}`;
        const randPart = buildNumericEntropy(entropyBase, randLength);
        return `${colPart}${fullSku}${randPart}`;
    }

    const skuPart = getSkuPart(product.sku || "");
    const stylePart = getStylePart(product.styleId || "");
    const entropyBase = `${product.id || ""}:${product.sku || ""}:${product.styleId || ""}:${product.collection || ""}:${BARCODE_V1}`;
    const randPart = String((stableHash(entropyBase) % 9000) + 1000);
    return `${colPart}${skuPart}${stylePart}${randPart}`;
};

export const getBarcodeMappedFields = (
    product: Pick<Product, "id" | "sku" | "styleId" | "collection">,
    collections: Collection[]
): { barcode: string; barcodeSku: string; barcodeVersion: "v1" | "v2" } => {
    const barcodeVersion = getBarcodeVersion(product.sku);
    return {
        barcode: generateBarcodeForProduct(product, collections),
        barcodeSku: normalizeSkuKey(product.sku),
        barcodeVersion,
    };
};

export const needsBarcodeRefresh = (
    product: Pick<Product, "id" | "sku" | "styleId" | "collection" | "barcode"> & { barcodeSku?: string }
): boolean => {
    if (!product.barcode) return true;
    if (!normalizeSkuKey(product.barcodeSku)) return true;
    if (normalizeSkuKey(product.barcodeSku) !== normalizeSkuKey(product.sku)) return true;
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
