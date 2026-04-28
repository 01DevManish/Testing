import { Order, OrderStatus, Party, Transporter, ManagedBox } from "./types";
import { logActivity } from "../../lib/activityLogger";
import { getBarcodeMappedFields, needsBarcodeRefresh, normalizeSkuKey } from "../inventory/utils/barcodeUtils";
import type { Collection } from "../inventory/types";
import { touchDataSignal } from "../../lib/dataSignals";
import { deleteDataItemById, fetchDataItems, upsertDataItems } from "../../lib/dynamoDataApi";

type InventoryDispatchProduct = {
  id: string;
  productName: string;
  price: number;
  stock: number;
  sku?: string;
  barcode?: string;
  barcodeSku?: string;
  barcodeVersion?: string;
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
    const rows = await fetchDataItems<any>("collections");
    if (rows.length > 0) {
      return rows.map((item: any) => ({
        id: item.id || "",
        name: item.name || "",
        collectionCode: item.collectionCode || "",
        description: item.description || "",
        productIds: Array.isArray(item.productIds) ? item.productIds : [],
        createdAt: Number(item.createdAt) || 0,
      }));
    }
  } catch (err) {
    console.warn("[RetailDispatch] Failed to load collections from Dynamo.", err);
  }
  return [];
};

const maybeSyncBarcodes = async (rows: InventoryDispatchProduct[]): Promise<InventoryDispatchProduct[]> => {
  const now = Date.now();
  if (now - lastBarcodeSyncAt < BARCODE_SYNC_INTERVAL_MS) {
    return rows;
  }

  const collections = await loadCollectionsForBarcode();
  const rowsToUpsert: Array<Record<string, unknown> & { id: string }> = [];
  const nextRows = rows.map((row) => {
    const shouldRefresh = needsBarcodeRefresh({
      id: row.id,
      sku: row.sku || "",
      styleId: row.styleId || "",
      collection: row.collection || "",
      barcode: row.barcode,
      barcodeSku: row.barcodeSku,
    });

    if (shouldRefresh) {
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
      const nextBarcode = currentBarcode || expected.barcode;
      rowsToUpsert.push({
        id: row.id,
        barcode: nextBarcode,
        barcodeSku: expected.barcodeSku,
        barcodeVersion: expected.barcodeVersion,
        updatedAt: now,
      });
      return { ...row, barcode: nextBarcode, barcodeSku: expected.barcodeSku, barcodeVersion: expected.barcodeVersion };
    }

    return row;
  });

  if (rowsToUpsert.length > 0) {
    try {
      await upsertDataItems("inventory", rowsToUpsert);
      await touchDataSignal("inventory");
    } catch (err) {
      console.warn("[RetailDispatch] Barcode sync write failed.", err);
    }
  }

  lastBarcodeSyncAt = now;
  return nextRows;
};

const fetchInventoryFromDynamoApi = async (): Promise<InventoryDispatchProduct[]> => {
  const rows = await fetchDataItems<Record<string, any>>("inventory");
  return rows
    .map((item: Record<string, any>) => {
      const id = typeof item.id === "string" ? item.id : "";
      if (!id) return null;
      return mapInventoryRow(id, item);
    })
    .filter((row: InventoryDispatchProduct | null): row is InventoryDispatchProduct => Boolean(row));
};

// â”€â”€ Firebase API for Dispatch â”€â”€

export const firestoreApi = {
  // Parties
  getParties: async (): Promise<Party[]> => {
    try {
      const rows = await fetchDataItems<Party>("parties");
      return rows.filter((row) => typeof (row as any)?.id === "string");
    } catch (e) { console.error(e); return []; }
  },

  createParty: async (party: Omit<Party, "id">): Promise<Party> => {
    const created: Party = {
      id: `PTY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...party,
      createdAt: (party as any)?.createdAt || new Date().toISOString(),
    } as Party;
    await upsertDataItems("parties", [created as Party & { id: string }]);
    await touchDataSignal("parties");
    return created;
  },

  deleteParty: async (id: string): Promise<void> => {
    try {
      await deleteDataItemById("parties", id);
      await touchDataSignal("parties");
    } catch (e) {
      console.error("Failed to delete party:", e);
      throw e;
    }
  },

  // Transporters
  getTransporters: async (): Promise<Transporter[]> => {
    try {
      const rows = await fetchDataItems<Transporter>("transporters");
      return rows.filter((row) => typeof (row as any)?.id === "string");
    } catch (e) { console.error(e); return []; }
  },

  createTransporter: async (t: Omit<Transporter, "id">): Promise<Transporter> => {
    const created: Transporter = {
      id: `TRN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...t,
      createdAt: (t as any)?.createdAt || new Date().toISOString(),
    } as Transporter;
    await upsertDataItems("transporters", [created as Transporter & { id: string }]);
    await touchDataSignal("transporters");
    return created;
  },

  deleteTransporter: async (id: string): Promise<void> => {
    try {
      await deleteDataItemById("transporters", id);
      await touchDataSignal("transporters");
    } catch (e) {
      console.error("Failed to delete transporter:", e);
      throw e;
    }
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
        const rows = await fetchInventoryFromDynamoApi();

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
  deductStock: async (
    productId: string,
    quantityToDeduct: number,
    context?: { reason?: string; note?: string; userName?: string }
  ): Promise<boolean> => {
    try {
      const inventoryRows = await fetchDataItems<Record<string, any>>("inventory");
      const productData = inventoryRows.find((row) => String(row.id) === String(productId));
      if (!productData) return false;

      const currentStock = Number(productData.stock) || 0;
      const minStock = Number(productData.minStock) || 5;
      const newStock = Math.max(0, currentStock - quantityToDeduct);
      
      let newStatus = productData.status || "active";
      if (newStatus === "active" || newStatus === "low-stock" || newStatus === "out-of-stock") {
        if (newStock <= 0) newStatus = "out-of-stock";
        else if (newStock <= minStock) newStatus = "low-stock";
        else newStatus = "active";
      }

      await upsertDataItems("inventory", [{
        ...productData,
        id: String(productData.id),
        stock: newStock,
        status: newStatus,
        lastAdjustmentReason: context?.reason || "Dispatch",
        lastAdjustmentNote: (context?.note || "").slice(0, 60),
        lastAdjustmentByName: context?.userName || "System",
        lastAdjustmentAt: Date.now(),
        updatedAt: Date.now(),
      }]);
      await touchDataSignal("inventory");
      firestoreApi.invalidateInventoryCache();
      
      console.log(`Deducted ${quantityToDeduct} from ${productId}. New stock: ${newStock}, Status: ${newStatus}`);
      return true;
    } catch (e) {
      console.error("Failed to deduct stock:", e);
      return false;
    }
  }
};

export const api = {
  getOrders: async (): Promise<Order[]> => {
    try {
      const list = await fetchDataItems<Order>("dispatches");
      return list.sort((a,b) => {
        const dateA = a.logs?.[a.logs.length - 1]?.timestamp || a.dispatchDate || "";
        const dateB = b.logs?.[b.logs.length - 1]?.timestamp || b.dispatchDate || "";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    } catch (e) { console.error(e); return []; }
  },

  getOrderById: async (id: string): Promise<Order | null> => {
    try {
      const rows = await fetchDataItems<Order>("dispatches");
      return rows.find((row) => String((row as any).id) === String(id)) || null;
    } catch (e) { console.error(e); return null; }
  },

  updateOrderStatus: async (id: string, newStatus: OrderStatus, user: string, updates: Partial<Order> = {}, actor?: { uid: string; name: string; role: string }): Promise<Order> => {
    try {
      const existing = await api.getOrderById(id);
      if (!existing) throw new Error("Order not found");
      const newLog = { status: newStatus, timestamp: new Date().toISOString(), user, note: updates.packedNotes };
      const updatedLogs = existing.logs ? [...existing.logs, newLog] : [newLog];
      
      const updatedOrder = { ...existing, ...updates, status: newStatus, logs: updatedLogs, updatedAt: Date.now() };

      // Automatic Stock Deduction
      if (newStatus === "Dispatched" && !existing.stockDeducted) {
        if (existing.products && existing.products.length > 0) {
          console.log(`Deducting stock for retail order ${id}...`);
          for (const prod of existing.products) {
            await firestoreApi.deductStock(prod.id, prod.quantity, {
              reason: "Dispatch",
              note: `Dispatch ${id}`,
              userName: actor?.name || user,
            });
          }
          updatedOrder.stockDeducted = true;
        }
      }
      
      // Cancel/reset rollback: restore inventory when a dispatched order is moved back to Pending.
      if (existing.status === "Dispatched" && newStatus === "Pending" && existing.stockDeducted) {
        if (existing.products && existing.products.length > 0) {
          console.log(`Restoring stock for cancelled retail order ${id}...`);
          for (const prod of existing.products) {
            await firestoreApi.deductStock(prod.id, -Math.abs(Number(prod.quantity) || 0), {
              reason: "Dispatch Return",
              note: `Return from dispatch ${id}`,
              userName: actor?.name || user,
            });
          }
          updatedOrder.stockDeducted = false;
        }
      }
      
      await upsertDataItems("dispatches", [updatedOrder as Order & { id: string }]);
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
      const existing = await api.getOrderById(orderId);
      if (!existing) throw new Error("Order not found");
      const updatedProducts = existing.products?.map((p: any) => p.id === productId ? { ...p, packed } : p) || [];
      
      await upsertDataItems("dispatches", [{ ...existing, products: updatedProducts, updatedAt: Date.now() } as Order & { id: string }]);
      await touchDataSignal("dispatches");
      return { ...existing, products: updatedProducts } as Order;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  createOrder: async (newOrder: Partial<Order>, actor?: { uid: string; name: string; role: string }): Promise<Order> => {
    try {
      const orderId = newOrder.id || `ORD-${Math.floor(Math.random() * 10000)}`;
      
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
      
      await upsertDataItems("dispatches", [order as Order & { id: string }]);
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
      await deleteDataItemById("dispatches", orderId);
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
      await deleteDataItemById("packingLists", id);
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
      console.warn("Managed boxes fetch from DynamoDB failed.", e);
    }
    return [];
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


