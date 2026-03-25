import { Order, OrderStatus, Party, Transporter } from "./types";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

// ── Mock Orders (kept for backward compat) ──
const generateMockOrders = (): Order[] => {
  return [
    {
      id: "ORD-1001",
      customer: { name: "John Doe", phone: "+91-9876543210", address: "123 Cyber St, Neo City" },
      paymentStatus: "Paid",
      status: "Pending",
      products: [
        { id: "P1", name: "Wireless Mouse", quantity: 2, price: 49.99, packed: false },
        { id: "P2", name: "Mechanical Keyboard", quantity: 1, price: 129.99, packed: false }
      ],
      logs: [{ status: "Pending", timestamp: new Date(Date.now() - 86400000).toISOString(), user: "System" }]
    },
    {
      id: "ORD-1002",
      customer: { name: "Jane Smith", phone: "+91-8877665544", address: "456 Tech Park, Silicon Valley" },
      paymentStatus: "COD",
      status: "Packed",
      packedNotes: "Fragile items, packed with extra bubble wrap.",
      products: [
        { id: "P3", name: "4K Monitor", quantity: 1, price: 299.99, packed: true }
      ],
      logs: [
        { status: "Pending", timestamp: new Date(Date.now() - 172800000).toISOString(), user: "System" },
        { status: "Packed", timestamp: new Date(Date.now() - 86400000).toISOString(), user: "Admin", note: "Fragile items, packed with extra bubble wrap." }
      ]
    },
    {
      id: "ORD-1003",
      customer: { name: "Alice Johnson", phone: "+91-7766554433", address: "789 Cloud Way, Server Town" },
      paymentStatus: "Paid",
      status: "Dispatched",
      courierPartner: "Delhivery",
      trackingId: "DLV123456789AWB",
      shippingType: "Air",
      dispatchDate: new Date().toISOString().split('T')[0],
      products: [
        { id: "P4", name: "USB-C Hub", quantity: 3, price: 25.00, packed: true }
      ],
      logs: [
        { status: "Pending", timestamp: new Date(Date.now() - 259200000).toISOString(), user: "System" },
        { status: "Packed", timestamp: new Date(Date.now() - 172800000).toISOString(), user: "Admin" },
        { status: "Dispatched", timestamp: new Date(Date.now() - 86400000).toISOString(), user: "Manager" }
      ]
    }
  ];
};

let dbOrders = generateMockOrders();

// ── Firestore Helpers ──

export const firestoreApi = {
  // Parties
  getParties: async (): Promise<Party[]> => {
    try {
      const snap = await getDocs(collection(db, "parties"));
      const list: Party[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Party));
      return list;
    } catch (e) { console.error(e); return []; }
  },

  createParty: async (party: Omit<Party, "id">): Promise<Party> => {
    const ref = await addDoc(collection(db, "parties"), { ...party, createdAt: new Date().toISOString() });
    return { id: ref.id, ...party };
  },

  // Transporters
  getTransporters: async (): Promise<Transporter[]> => {
    try {
      const snap = await getDocs(collection(db, "transporters"));
      const list: Transporter[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Transporter));
      return list;
    } catch (e) { console.error(e); return []; }
  },

  createTransporter: async (t: Omit<Transporter, "id">): Promise<Transporter> => {
    const ref = await addDoc(collection(db, "transporters"), { ...t, createdAt: new Date().toISOString() });
    return { id: ref.id, ...t };
  },

  // Inventory Products
  getInventoryProducts: async (): Promise<{ id: string; productName: string; price: number; stock: number }[]> => {
    try {
      const snap = await getDocs(collection(db, "products"));
      const list: { id: string; productName: string; price: number; stock: number }[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, productName: data.productName || "", price: data.price || 0, stock: data.stock || 0 });
      });
      return list;
    } catch (e) { console.error(e); return []; }
  },

  // Create Dispatch (save to Firestore)
  createDispatch: async (dispatch: Record<string, unknown>): Promise<string> => {
    const ref = await addDoc(collection(db, "dispatches"), {
      ...dispatch,
      createdAt: Timestamp.now(),
      status: "Ready to Print",
    });
    return ref.id;
  },
};

// ── Mock API (existing) ──
export const api = {
  getOrders: async (): Promise<Order[]> => {
    return new Promise(resolve => setTimeout(() => resolve([...dbOrders]), 300));
  },

  getOrderById: async (id: string): Promise<Order | null> => {
    return new Promise(resolve => {
      setTimeout(() => {
        const order = dbOrders.find(o => o.id === id);
        resolve(order ? { ...order } : null);
      }, 200);
    });
  },

  updateOrderStatus: async (id: string, newStatus: OrderStatus, user: string, updates: Partial<Order> = {}): Promise<Order> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = dbOrders.findIndex(o => o.id === id);
        if (index === -1) return reject(new Error("Order not found"));
        const existing = dbOrders[index];
        const newLog = { status: newStatus, timestamp: new Date().toISOString(), user, note: updates.packedNotes };
        dbOrders[index] = { ...existing, ...updates, status: newStatus, logs: [...existing.logs, newLog] };
        resolve({ ...dbOrders[index] });
      }, 400);
    });
  },

  markItemPacked: async (orderId: string, productId: string, packed: boolean): Promise<Order> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = dbOrders.findIndex(o => o.id === orderId);
        if (index === -1) return reject(new Error("Order not found"));
        const existing = dbOrders[index];
        const updatedProducts = existing.products.map(p => p.id === productId ? { ...p, packed } : p);
        dbOrders[index] = { ...existing, products: updatedProducts };
        resolve({ ...dbOrders[index] });
      }, 100);
    });
  },

  createOrder: async (newOrder: Partial<Order>): Promise<Order> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const order: Order = {
          id: newOrder.id || `ORD-${Math.floor(Math.random() * 10000)}`,
          customer: newOrder.customer || { name: "Unknown", phone: "", address: "" },
          paymentStatus: newOrder.paymentStatus || "Paid",
          status: newOrder.status || "Pending",
          products: newOrder.products || [],
          logs: [{ status: "Pending", timestamp: new Date().toISOString(), user: "Admin", note: "Imported into dispatch system" }],
          ...newOrder
        };
        dbOrders.unshift(order);
        resolve(order);
      }, 300);
    });
  }
};
