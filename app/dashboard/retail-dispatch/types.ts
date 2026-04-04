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
}

// ── New Dispatch Types ──

export interface Party {
  id: string;
  name: string;
  phone: string;
  address: string;
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
  items: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    rate: number;
  }[];
  transporter: string;
  assignedTo: string; // User ID
  assignedToName: string;
  status: "Pending" | "In Progress" | "Completed" | "Cancelled";
  invoiceNo?: string;
  lrNo?: string;
  createdAt: number;
  createdBy: string;
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
  | "create-dispatch-list"
  | "all-dispatch-lists"
  | "messages";

