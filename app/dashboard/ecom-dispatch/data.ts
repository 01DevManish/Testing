import { Order, OrderStatus, Party, Transporter } from "./types";
import { ref, get, push, set, update, remove } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";

type InventoryDispatchProduct = {
  id: string;
  productName: string;
  price: number;
  stock: number;
  sku?: string;
  unit?: string;
};

const INVENTORY_CACHE_TTL_MS = 45 * 1000;
let inventoryCache: { ts: number; data: InventoryDispatchProduct[] } | null = null;
let inventoryFetchPromise: Promise<InventoryDispatchProduct[]> | null = null;

const cloneInventory = (rows: InventoryDispatchProduct[]): InventoryDispatchProduct[] =>
  rows.map((row) => ({ ...row }));

const mapInventoryRow = (id: string, data: Record<string, any>): InventoryDispatchProduct => ({
  id,
  productName: data.productName || "Unknown",
  price: Number(data.price) || 0,
  stock: Number(data.stock) || 0,
  sku: data.sku || "N/A",
  unit: data.unit || "PCS",
});

const fetchInventoryFromDynamoApi = async (): Promise<InventoryDispatchProduct[]> => {
  const res = await fetch("/api/data/inventory", { cache: "no-store" });
  if (!res.ok) throw new Error(`Inventory API failed: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.items)) return [];
  return json.items
    .map((item: Record<string, any>) => {
      const id = typeof item.id === "string" ? item.id : "";
      if (!id) return null;
      return mapInventoryRow(id, item);
    })
    .filter((row: InventoryDispatchProduct | null): row is InventoryDispatchProduct => Boolean(row));
};

const fetchInventoryFromFirebase = async (): Promise<InventoryDispatchProduct[]> => {
  const snap = await get(ref(db, "inventory"));
  const rows: InventoryDispatchProduct[] = [];
  if (snap.exists()) {
    snap.forEach((d) => {
      rows.push(mapInventoryRow(d.key as string, d.val() || {}));
    });
  }
  return rows;
};

// ── Firebase API for Dispatch ──

export const firestoreApi = {
  // Parties
  getParties: async (): Promise<Party[]> => {
    try {
      const snap = await get(ref(db, "parties"));
      const list: Party[] = [];
      if (snap.exists()) {
        snap.forEach(d => { list.push({ id: d.key as string, ...d.val() } as Party); });
      }
      return list;
    } catch (e) { console.error(e); return []; }
  },

  createParty: async (party: Omit<Party, "id">): Promise<Party> => {
    const newRef = push(ref(db, "parties"));
    await set(newRef, { ...party, createdAt: new Date().toISOString() });
    return { id: newRef.key as string, ...party };
  },

  deleteParty: async (id: string): Promise<void> => {
    try {
      await remove(ref(db, `parties/${id}`));
    } catch (e) {
      console.error("Failed to delete party:", e);
      throw e;
    }
  },

  // Transporters
  getTransporters: async (): Promise<Transporter[]> => {
    try {
      const snap = await get(ref(db, "transporters"));
      const list: Transporter[] = [];
      if (snap.exists()) {
        snap.forEach(d => { list.push({ id: d.key as string, ...d.val() } as Transporter); });
      }
      return list;
    } catch (e) { console.error(e); return []; }
  },

  createTransporter: async (t: Omit<Transporter, "id">): Promise<Transporter> => {
    const newRef = push(ref(db, "transporters"));
    await set(newRef, { ...t, createdAt: new Date().toISOString() });
    return { id: newRef.key as string, ...t };
  },

  // Inventory - Dynamo-first + short cache
  getInventoryProducts: async (opts?: { forceFresh?: boolean }): Promise<InventoryDispatchProduct[]> => {
    const forceFresh = Boolean(opts?.forceFresh);
    const now = Date.now();
    if (!forceFresh && inventoryCache && (now - inventoryCache.ts) < INVENTORY_CACHE_TTL_MS) {
      return cloneInventory(inventoryCache.data);
    }
    if (!forceFresh && inventoryFetchPromise) {
      return inventoryFetchPromise;
    }

    const fetcher = (async (): Promise<InventoryDispatchProduct[]> => {
      try {
        let rows: InventoryDispatchProduct[] = [];
        try {
          rows = await fetchInventoryFromDynamoApi();
        } catch (apiErr) {
          console.warn("[EcomDispatch] Inventory API unavailable, falling back to Firebase.", apiErr);
        }
        if (rows.length === 0) rows = await fetchInventoryFromFirebase();
        inventoryCache = { ts: Date.now(), data: rows };
        return cloneInventory(rows);
      } catch (e) {
        console.error(e);
        return [];
      } finally {
        inventoryFetchPromise = null;
      }
    })();

    if (!forceFresh) inventoryFetchPromise = fetcher;
    return fetcher;
  },

  invalidateInventoryCache: () => {
    inventoryCache = null;
    inventoryFetchPromise = null;
  },

  // Atomic Stock Deduction & Status Update
  deductStock: async (productId: string, quantityToDeduct: number, force: boolean = false): Promise<boolean> => {
    try {
      const productRef = ref(db, `inventory/${productId}`);
      const snap = await get(productRef);
      
      if (snap.exists()) {
        const productData = snap.val();
        const currentStock = Number(productData.stock) || 0;
        const minStock = Number(productData.minStock) || 5;
        
        // If not force, and stock is too low, we could return false (but user wants to allow it in rapid mode)
        const newStock = force ? (currentStock - quantityToDeduct) : Math.max(0, currentStock - quantityToDeduct);
        
        // Auto-calculate new status
        let newStatus = productData.status || "active";
        if (newStatus === "active" || newStatus === "low-stock" || newStatus === "out-of-stock") {
          if (newStock <= 0) newStatus = "out-of-stock";
          else if (newStock <= minStock) newStatus = "low-stock";
          else newStatus = "active";
        }

        await update(productRef, { 
          stock: newStock, 
          status: newStatus,
          updatedAt: Date.now() 
        });
        firestoreApi.invalidateInventoryCache();
        
        console.log(`Deducted ${quantityToDeduct} from ${productId}. New stock: ${newStock}, Status: ${newStatus}`);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to deduct stock:", e);
      return false;
    }
  }
};

export const api = {
  getOrders: async (): Promise<Order[]> => {
    try {
      const snap = await get(ref(db, "dispatches"));
      const list: Order[] = [];
      if (snap.exists()) {
        snap.forEach(d => { list.push({ id: d.key as string, ...d.val() } as Order); });
      }
      return list.sort((a,b) => {
        const dateA = a.logs?.[a.logs.length - 1]?.timestamp || a.dispatchDate || "";
        const dateB = b.logs?.[b.logs.length - 1]?.timestamp || b.dispatchDate || "";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    } catch (e) { console.error(e); return []; }
  },

  getOrderById: async (id: string): Promise<Order | null> => {
    try {
      const snap = await get(ref(db, `dispatches/${id}`));
      if (snap.exists()) {
        return { id: snap.key as string, ...snap.val() } as Order;
      }
      return null;
    } catch (e) { console.error(e); return null; }
  },

  updateOrderStatus: async (id: string, newStatus: OrderStatus, user: string, updates: Partial<Order> = {}, actor?: { uid: string; name: string; role: string }): Promise<Order> => {
    try {
      const orderRef = ref(db, `dispatches/${id}`);
      const snap = await get(orderRef);
      if (!snap.exists()) throw new Error("Order not found");
      
      const existing = snap.val() as Order;
      const newLog = { status: newStatus, timestamp: new Date().toISOString(), user, note: updates.packedNotes };
      const updatedLogs = existing.logs ? [...existing.logs, newLog] : [newLog];
      
      const updatedOrder = { ...existing, ...updates, status: newStatus, logs: updatedLogs, updatedAt: Date.now() };

      // Automatic Stock Deduction
      if (newStatus === "Dispatched" && !existing.stockDeducted) {
        if (existing.products && existing.products.length > 0) {
          console.log(`Deducting stock for ecom order ${id}...`);
          for (const prod of existing.products) {
            await firestoreApi.deductStock(prod.id, prod.quantity);
          }
          updatedOrder.stockDeducted = true;
        }
      }

      await set(orderRef, updatedOrder);

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "status_change",
        title: "Order Status Updated",
        description: `Ecommerce dispatch ${id} status changed to ${newStatus} by ${actor?.name || user}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || user,
        userRole: (actor?.role as any) || "staff",
        metadata: { orderId: id, status: newStatus }
      });

      return { ...updatedOrder } as Order;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  markItemPacked: async (orderId: string, productId: string, packed: boolean): Promise<Order> => {
    try {
      const orderRef = ref(db, `dispatches/${orderId}`);
      const snap = await get(orderRef);
      if (!snap.exists()) throw new Error("Order not found");
      
      const existing = snap.val();
      const updatedProducts = existing.products?.map((p: any) => p.id === productId ? { ...p, packed } : p) || [];
      
      await update(orderRef, { products: updatedProducts });
      return { id: orderId, ...existing, products: updatedProducts } as Order;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  createOrder: async (newOrder: Partial<Order>, actor?: { uid: string; name: string; role: string }): Promise<Order> => {
    try {
      const orderId = newOrder.id || `ORD-${Math.floor(Math.random() * 10000)}`;
      const orderRef = ref(db, `dispatches/${orderId}`);
      
      const order: Order = {
        id: orderId,
        customer: newOrder.customer || { name: "Unknown", phone: "", address: "" },
        paymentStatus: newOrder.paymentStatus || "Paid",
        status: newOrder.status || "Pending",
        products: newOrder.products || [],
        logs: [{ status: "Pending", timestamp: new Date().toISOString(), user: "Admin", note: "Imported into dispatch system" }],
        ...newOrder,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await set(orderRef, order);

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "create",
        title: "New Ecommerce Dispatch Created",
        description: `Ecommerce dispatch ${orderId} created for ${order.customer.name} by ${actor?.name || "Admin"}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || "Admin",
        userRole: (actor?.role as any) || "admin",
        metadata: { orderId }
      });

      return order;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  deleteOrder: async (orderId: string, actor?: { uid: string; name: string; role: string }): Promise<void> => {
    try {
      await remove(ref(db, `dispatches/${orderId}`));

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "delete",
        title: "Ecommerce Dispatch Deleted",
        description: `Ecommerce dispatch ${orderId} was permanently removed by ${actor?.name || "Admin"}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || "Admin",
        userRole: (actor?.role as any) || "admin",
        metadata: { orderId }
      });
    } catch (e) {
      console.error("Failed to delete order:", e);
      throw e;
    }
  }
};
