// No firestore imports needed

export const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

// ── Product ────────────────────────────────────────────────────
export interface Product {
    id: string;
    productName: string;
    sku: string;
    styleId?: string;
    category: string;
    collection?: string;
    brand: string;
    brandId?: string;
    price: number;
    wholesalePrice: number;
    mrp: number;
    costPrice: number;
    stock: number;
    minStock: number;
    status: "active" | "inactive" | "out-of-stock" | "low-stock";
    imageUrl: string;
    imageUrls?: string[];
    description: string;
    unit: string;
    size?: string;
    hsnCode: string;
    gstRate: number;
    createdAt: number;
    updatedAt: number;
    createdBy?: string;
    createdByName?: string;
    updatedBy?: string;
    updatedByName?: string;
    barcode?: string;
    barcodeSku?: string;
    barcodeVersion?: "v1" | "v2";
}

// ── Category ───────────────────────────────────────────────────
export interface Category {
    id: string;
    name: string;
    description: string;
    createdAt: number;
    createdBy?: string;
    createdByName?: string;
}

// ── Collection ─────────────────────────────────────────────────
export interface Collection {
    id: string;
    name: string;
    collectionCode?: string;
    description: string;
    productIds: string[];
    createdAt: number;
}

// ── Item Group ─────────────────────────────────────────────────
export interface ItemGroup {
    id: string;
    name: string;
    description: string;
    productIds: string[];
    createdAt: number;
}

// ── Active sidebar view ────────────────────────────────────────
export type ActiveView =
    | "category-create" | "category-list"
    | "collections-create" | "collections-list"
    | "product-create" | "product-list"
    | "inventory-adjustment" | "inventory-barcode-create" | "inventory-barcode-print"
    | "overview"
    | "catalog"
    | "inventory-bulk"
    | "grouping-create" | "grouping-list";

// ── Constants ──────────────────────────────────────────────────
// CATEGORIES moved to dynamic DB

export const UNITS = ["PCS", "KG", "BOX", "SET", "MTR", "LTR", "DOZEN", "PACK", "PAIR", "BAG"];

export const GST_RATES = [0, 5, 12, 18, 28];

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
    inactive: { label: "Inactive", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    "low-stock": { label: "Low Stock", color: "#a16207", bg: "rgba(161,98,7,0.13)" },
    "out-of-stock": { label: "Out of Stock", color: "#991b1b", bg: "rgba(153,27,27,0.12)" },
    "in-stock": { label: "In Stock", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

export type StockBucket = "out-of-stock" | "low-stock" | "in-stock";

export const getStockBucket = (stock?: number, minStock?: number): StockBucket => {
    const safeStock = Number(stock);
    const safeMin = Number(minStock);
    const normalizedStock = Number.isFinite(safeStock) ? safeStock : 0;
    const normalizedMin = Number.isFinite(safeMin) ? safeMin : 5;

    if (normalizedStock <= 0) return "out-of-stock";
    if (normalizedStock <= normalizedMin) return "low-stock";
    return "in-stock";
};
