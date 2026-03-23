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
  id: string; // Order ID e.g., ORD-1001
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
}
