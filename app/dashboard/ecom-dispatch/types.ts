export type OrderStatus = "Pending" | "Packed" | "Dispatched" | "In Transit" | "Delivered";

export interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
  packed: boolean;
  sku?: string;
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
  remarks?: string;
  confirmedByPin?: boolean;
  dispatchType?: "retail" | "ecom";
  dispatchRef?: string;
  platform?: string;
  awb?: string;
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

export const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

export type ActiveView = "overview" | "create-dispatch" | "rapid-dispatch" | "order-list" | "add-order" | "scanner" | "catalog" | "messages";

