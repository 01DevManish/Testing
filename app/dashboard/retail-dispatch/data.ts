import { Order, OrderStatus, Party, Transporter, ManagedBox } from "./types";
import { ref, get, push, set, update, remove } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";
import { getBarcodeMappedFields, normalizeSkuKey } from "../inventory/utils/barcodeUtils";
import type { Collection } from "../inventory/types";
import { touchDataSignal } from "../../lib/dataSignals";

type InventoryDispatchProduct = {
  id: string;
  productName: string;
  price: number;
  stock: number;
  sku?: string;
  barcode?: string;
  barcodeSku?: string;
  styleId?: string;
  unit?: string;
  collection?: string;
  brand?: string;
  brandId?: string;
  category?: string;
  imageUrl?: string;
  imageUrls?: string[];
};

const INVENTORY_CACHE_TTL_MS = 45 * 1000;
const BARCODE_SYNC_INTERVAL_MS = 10 * 60 * 1000;

let inventoryCache: { ts: number; data: InventoryDispatchProduct[] } | null = null;
let inventoryFetchPromise: Promise<InventoryDispatchProduct[]> | null = null;
let lastBarcodeSyncAt = 0;

const cloneInventory = (rows: InventoryDispatchProduct[]): InventoryDispatchProduct[] =>
  rows.map((row) => ({
    ...row,
    imageUrls: Array.isArray(row.imageUrls) ? [...row.imageUrls] : [],
  }));

const normalizeImageUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((img): img is string => typeof img === "string")
      .map((img) => img.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((img): img is string => typeof img === "string")
            .map((img) => img.trim())
            .filter(Boolean);
        }
      } catch {
        // fallback below
      }
    }
    return [trimmed];
  }
  return [];
};

const mapInventoryRow = (id: string, data: Record<string, any>): InventoryDispatchProduct => {
  const imageUrls = normalizeImageUrls(data.imageUrls);
  const imageUrl =
    String(data.imageUrl || "").trim() ||
    String(data.image || "").trim() ||
    imageUrls[0] ||
    "";

  return {
    id,
    productName: data.productName || "Unknown",
    price: Number(data.price) || 0,
    stock: Number(data.stock) || 0,
    sku: data.sku || "N/A",
    barcode: String(data.barcode || "").trim(),
    barcodeSku: normalizeSkuKey(data.barcodeSku || data.sku),
    styleId: data.styleId || "",
    unit: data.unit || "PCS",
    collection: data.collection || "",
    brand: data.brand || "",
    brandId: data.brandId || "",
    category: data.category || "",
    imageUrl,
    imageUrls,
  };
};

const loadCollectionsForBarcode = async (): Promise<Collection[]> => {
  try {
    const res = await fetch("/api/data/collections", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.items) && json.items.length > 0) {
        return json.items.map((item: any) => ({
          id: item.id || "",
          name: item.name || "",
          collectionCode: item.collectionCode || "",
          description: item.description || "",
          productIds: Array.isArray(item.productIds) ? item.productIds : [],
          createdAt: Number(item.createdAt) || 0,
        }));
      }
    }
  } catch (err) {
    console.warn("[RetailDispatch] Failed to load collections from Dynamo API.", err);
  }

  const snap = await get(ref(db, "collections"));
  const collections: Collection[] = [];
  if (snap.exists()) {
    snap.forEach((child) => {
      const data = child.val() || {};
      collections.push({
        id: child.key as string,
        name: data.name || "",
        collectionCode: data.collectionCode || "",
        description: data.description || "",
        productIds: Array.isArray(data.productIds) ? data.productIds : [],
        createdAt: Number(data.createdAt) || 0,
      });
    });
  }
  return collections;
};

const maybeSyncBarcodes = async (rows: InventoryDispatchProduct[]): Promise<InventoryDispatchProduct[]> => {
  const now = Date.now();
  if (now - lastBarcodeSyncAt < BARCODE_SYNC_INTERVAL_MS) {
    return rows;
  }

  const collections = await loadCollectionsForBarcode();
  const updates: Record<string, string> = {};
  const nextRows = rows.map((row) => {
    const expected = getBarcodeMappedFields(
      {
        id: row.id,
        sku: row.sku || "",
        styleId: row.styleId || "",
        collection: row.collection || "",
      },
      collections
    );

    const currentBarcode = String(row.barcode || "").trim();
    const currentBarcodeSku = normalizeSkuKey(row.barcodeSku || row.sku);
    const needsRefresh = !currentBarcode || currentBarcode !== expected.barcode || currentBarcodeSku !== expected.barcodeSku;

    if (needsRefresh) {
      updates[`inventory/${row.id}/barcode`] = expected.barcode;
      updates[`inventory/${row.id}/barcodeSku`] = expected.barcodeSku;
      return { ...row, barcode: expected.barcode, barcodeSku: expected.barcodeSku };
    }

    return row;
  });

  if (Object.keys(updates).length > 0) {
    try {
      await update(ref(db), updates);
      await touchDataSignal("inventory");
    } catch (err) {
      console.warn("[RetailDispatch] Barcode sync write failed.", err);
    }
  }

  lastBarcodeSyncAt = now;
  return nextRows;
};

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
    snap.forEach((child) => {
      const data = child.val() || {};
      rows.push(mapInventoryRow(child.key as string, data));
    });
  }
  return rows;
};

// â”€â”€ Firebase API for Dispatch â”€â”€

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
    await touchDataSignal("parties");
    return { id: newRef.key as string, ...party };
  },

  deleteParty: async (id: string): Promise<void> => {
    try {
      await remove(ref(db, `parties/${id}`));
      await touchDataSignal("parties");
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
    await touchDataSignal("transporters");
    return { id: newRef.key as string, ...t };
  },

  // Inventory - Dynamo-first + short-lived in-memory cache (reduces Firebase reads heavily)
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
          console.warn("[RetailDispatch] Inventory API unavailable, falling back to Firebase.", apiErr);
        }

        if (rows.length === 0) {
          rows = await fetchInventoryFromFirebase();
        }

        const syncedRows = await maybeSyncBarcodes(rows);
        inventoryCache = { ts: Date.now(), data: syncedRows };
        return cloneInventory(syncedRows);
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
  deductStock: async (productId: string, quantityToDeduct: number): Promise<boolean> => {
    try {
      const productRef = ref(db, `inventory/${productId}`);
      const snap = await get(productRef);
      
      if (snap.exists()) {
        const productData = snap.val();
        const currentStock = Number(productData.stock) || 0;
        const minStock = Number(productData.minStock) || 5;
        const newStock = Math.max(0, currentStock - quantityToDeduct);
        
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
        await touchDataSignal("inventory");
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
          console.log(`Deducting stock for retail order ${id}...`);
          for (const prod of existing.products) {
            await firestoreApi.deductStock(prod.id, prod.quantity);
          }
          updatedOrder.stockDeducted = true;
        }
      }
      
      await set(orderRef, updatedOrder);
      await touchDataSignal("dispatches");

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "status_change",
        title: "Order Status Updated",
        description: `Retail dispatch ${id} status changed to ${newStatus} by ${actor?.name || user}.`,
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
      await touchDataSignal("dispatches");
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
      await touchDataSignal("dispatches");

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "create",
        title: "New Retail Dispatch Created",
        description: `Retail dispatch ${orderId} created for ${order.customer.name} by ${actor?.name || "Admin"}.`,
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
      await touchDataSignal("dispatches");

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "delete",
        title: "Retail Dispatch Deleted",
        description: `Retail dispatch ${orderId} was permanently removed by ${actor?.name || "Admin"}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || "Admin",
        userRole: (actor?.role as any) || "admin",
        metadata: { orderId }
      });
    } catch (e) {
      console.error("Failed to delete order:", e);
      throw e;
    }
  },

  deletePackingList: async (id: string, actor?: { uid: string; name: string; role: string }): Promise<void> => {
    try {
      await remove(ref(db, `packingLists/${id}`));
      await touchDataSignal("packingLists");

      // Log activity
      await logActivity({
        type: "dispatch",
        action: "delete",
        title: "Packing List Deleted",
        description: `Packing list ${id} was permanently removed by ${actor?.name || "Admin"}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || "Admin",
        userRole: (actor?.role as any) || "admin",
        metadata: { id }
      });
    } catch (e) {
      console.error("Failed to delete packing list:", e);
      throw e;
    }
  },

  // â”€â”€ Managed Boxes API â”€â”€
  getManagedBoxes: async (): Promise<ManagedBox[]> => {
    try {
      const res = await fetch("/api/managed-boxes", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.boxes)) return json.boxes as ManagedBox[];
      }
    } catch (e) {
      console.warn("Managed boxes fetch from DynamoDB failed. Falling back to Firebase.", e);
    }

    const snap = await get(ref(db, "managed_boxes"));
    if (!snap.exists()) return [];

    const list: ManagedBox[] = [];
    snap.forEach((child) => {
      list.push({ id: child.key as string, ...child.val() });
    });
    return list;
  },

  getNextManagedBoxId: async (): Promise<string> => {
    const allBoxes = await api.getManagedBoxes();
    let max = 0;
    allBoxes.forEach((box) => {
      const id = box.id;
      const match = id.match(/^D(\d+)$/i);
      const num = match ? parseInt(match[1], 10) : NaN;
      if (!isNaN(num) && num > max) max = num;
    });
    return `D${max + 1}`;
  },

  createManagedBox: async (box: ManagedBox, actor?: { uid: string; name: string }): Promise<void> => {
    if (!box.id) throw new Error("Box ID is required");
    try {
      const res = await fetch("/api/managed-boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ box }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to write managed box to DynamoDB");
      }

      await set(ref(db, `managed_boxes/${box.id}`), box);
      
      // Log activity
      await logActivity({
        type: "dispatch",
        action: "create",
        title: "Box Created",
        description: `Managed box ${box.id} was created with capacity ${box.capacity}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || "System",
        userRole: "staff",
        metadata: { boxId: box.id, barcode: box.barcode }
      });
    } catch (e) {
      console.error("Failed to create box:", e);
      throw e;
    }
  },

  deleteManagedBox: async (id: string, actor?: { uid: string; name: string }): Promise<void> => {
    try {
      const res = await fetch(`/api/managed-boxes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to delete managed box from DynamoDB");
      }

      await remove(ref(db, `managed_boxes/${id}`));
      
      // Log activity
      await logActivity({
        type: "dispatch",
        action: "delete",
        title: "Box Deleted",
        description: `Managed box ${id} was deleted by ${actor?.name || "Admin"}.`,
        userId: actor?.uid || "unknown",
        userName: actor?.name || "Admin",
        userRole: "admin",
        metadata: { id }
      });
    } catch (e) {
      console.error("Failed to delete box:", e);
      throw e;
    }
  },

  createBoxDispatchRecord: async (payload: Record<string, unknown>): Promise<void> => {
    const res = await fetch("/api/box-dispatches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to write box dispatch record to DynamoDB");
    }
  }
};


