import { Timestamp } from "firebase/firestore";

export const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

// ── Product ────────────────────────────────────────────────────
export interface Product {
    id: string;
    productName: string;
    sku: string;
    category: string;
    brand: string;
    price: number;
    costPrice: number;
    stock: number;
    minStock: number;
    status: "active" | "inactive" | "out-of-stock";
    imageUrl: string;
    description: string;
    unit: string;
    hsnCode: string;
    gstRate: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ── Category ───────────────────────────────────────────────────
export interface Category {
    id: string;
    name: string;
    description: string;
    createdAt: Timestamp;
}

// ── Collection ─────────────────────────────────────────────────
export interface Collection {
    id: string;
    name: string;
    description: string;
    productIds: string[];
    createdAt: Timestamp;
}

// ── Item Group ─────────────────────────────────────────────────
export interface ItemGroup {
    id: string;
    name: string;
    description: string;
    productIds: string[];
    createdAt: Timestamp;
}

// ── Active sidebar view ────────────────────────────────────────
export type ActiveView =
    | "category-create" | "category-list"
    | "collections-create" | "collections-list"
    | "product-create" | "product-list"
    | "inventory-add" | "inventory-remove" | "inventory-barcode-create" | "inventory-barcode-print"
    | "reports"
    | "grouping-create" | "grouping-list";

// ── Constants ──────────────────────────────────────────────────
export const CATEGORIES = [
    "Electronics", "Clothing", "Accessories", "Home & Kitchen",
    "Health & Beauty", "Sports", "Books", "Toys", "Food & Grocery", "Other",
];

export const UNITS = ["PCS", "KG", "BOX", "SET", "MTR", "LTR", "DOZEN", "PACK", "PAIR", "BAG"];

export const GST_RATES = [0, 5, 12, 18, 28];

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
    inactive: { label: "Inactive", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    "out-of-stock": { label: "Out of Stock", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};