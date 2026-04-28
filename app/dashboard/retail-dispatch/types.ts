export type OrderStatus = "Pending" | "Packed" | "Dispatched" | "In Transit" | "Delivered";

export interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
  packed: boolean;
}

export interface Customer {
  name: string;
  phone: string;
  address: string;
}

export interface DispatchLog {
  status: OrderStatus;
  timestamp: string;
  user: string;
  note?: string;
}

export interface Order {
  id: string;
  customer: Customer;
  products: Product[];
  paymentStatus: "Paid" | "COD";
  status: OrderStatus;
  shippingType?: "Air" | "Surface";
  courierPartner?: string;
  trackingId?: string;
  dispatchDate?: string;
  logs: DispatchLog[];
  packedNotes?: string;
  // Dispatch-specific fields
  partyId?: string;
  partyName?: string;
  transporterId?: string;
  transporterName?: string;
  packagingType?: string;
  bails?: number;
  transporter?: string;
  lrNo?: string;
  invoiceNo?: string;
  remarks?: string;
  confirmedByPin?: boolean;
  dispatchType?: "retail" | "ecom";
  dispatchRef?: string;
  items?: any[];
  createdAt?: number;
  updatedAt?: number;
  stockDeducted?: boolean;
}

// ── New Dispatch Types ──

export interface Party {
  id: string;
  name: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  gstin?: string;
  createdAt?: string;
}

export interface Transporter {
  id: string;
  name: string;
  phone?: string;
  vehicleType?: string;
  createdAt?: string;
}

export type PackagingType = "Box" | "Bale" | "Carton" | "Loose" | "Custom";

export interface DispatchFormData {
  // Step 1
  party: Party | null;
  // Step 2
  selectedProducts: { id: string; name: string; price: number; availableStock: number; selectedQty: number }[];
  // Step 3
  packagingType: PackagingType | "";
  customPackaging?: string;
  // Step 4
  remarks: string;
  // Step 5 — quantities are inside selectedProducts
  // Step 6
  transporter: Transporter | null;
  // Step 7
  bails: number;
  // Step 8
  pin: string;
}

export interface PackingList {
  id: string;
  partyId: string;
  partyName: string;
  partyAddress?: string;
  partyCity?: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    collectionName?: string;
    brandName?: string;
    quantity: number;
    rate: number;
    packagingType?: string;
  }[];
  transporter: string;
  assignedTo: string; // User ID
  assignedToName: string;
  status: "Pending" | "In Progress" | "Packed" | "Completed" | "Cancelled";
  invoiceNo?: string;
  lrNo?: string;
  dispatchId?: string;
  dispatchedAt?: number;
  dispatchedBy?: string;
  bails?: number;
  partyPhone?: string;
  packingPdfUrl?: string; // Stored packing list PDF URL
  dispatchPdfUrl?: string; // Stored dispatch list PDF URL
  pdfUrl?: string; // Legacy mixed field (kept for backward compatibility)
  createdAt: number;
  createdBy: string;
  stockDeducted?: boolean;
  dispatchBarcode?: string;
  boxBarcodes?: Record<string, string>;
  cancelledAt?: number;
}

export const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

export type ActiveView = 
  | "overview" 
  | "create-dispatch" 
  | "order-list" 
  | "add-order" 
  | "scanner"
  | "create-packing-list"
  | "all-packing-lists"
  | "packing-transporters"
  | "create-dispatch-list"
  | "all-dispatch-lists"
  | "box-management"
  | "dispatch-box"
  | "all-box-dispatches"
  | "catalog"
  | "messages";

export interface ManagedBox {
  id: string; // e.g. D1
  barcode: string; // 13 digits
  partyId?: string;
  partyName?: string;
  capacity: number;
  totalBoxes?: number; // e.g. 60 physical labels under the same box group
  items: { 
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
  }[];
  status: "Available" | "Filled" | "In-Transit";
  createdAt: number;
}

