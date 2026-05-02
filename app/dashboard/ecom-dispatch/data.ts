import { Order, OrderStatus, Party, Transporter } from "./types";
import { logActivity } from "../../lib/activityLogger";
import { touchDataSignal } from "../../lib/dataSignals";
import { deleteDataItemById, fetchDataItems, upsertDataItems } from "../../lib/dynamoDataApi";
import { appendInventoryAdjustmentLog } from "../../lib/inventoryAdjustmentLogs";

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
  const items = await fetchDataItems<Record<string, any>>("inventory");
  return items
    .map((item: Record<string, any>) => {
      const id = typeof item.id === "string" ? item.id : "";
      if (!id) return null;
      return mapInventoryRow(id, item);
    })
    .filter((row: InventoryDispatchProduct | null): row is InventoryDispatchProduct => Boolean(row));
};

// ── Firebase API for Dispatch ──

export const firestoreApi = {
  // Parties
  getParties: async (): Promise<Party[]> => {
    try {
      const rows = await fetchDataItems<Party>("parties");
      return rows.filter((row) => typeof (row as any)?.id === "string");
    } catch (e) { console.error(e); return []; }
  },

  createParty: async (party: Omit<Party, "id">): Promise<Party> => {
    const normalizeGst = (value: unknown) => String(value || "").trim().toUpperCase();
    const incomingGst = normalizeGst((party as any)?.gst || (party as any)?.gstin);
    if (incomingGst) {
      const existing = await fetchDataItems<Party>("parties");
      const duplicate = existing.find((row) => {
        const rowGst = normalizeGst((row as any)?.gst || (row as any)?.gstin);
        return rowGst && rowGst === incomingGst;
      });
      if (duplicate) {
        throw new Error(`Party already exists with GST ${incomingGst}. Duplicate GST is not allowed.`);
      }
    }

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
        const rows = await fetchInventoryFromDynamoApi();
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
  deductStock: async (
    productId: string,
    quantityToDeduct: number,
    force: boolean = false,
    context?: { reason?: string; note?: string; userName?: string; userUid?: string; dispatchId?: string; partyName?: string }
  ): Promise<boolean> => {
    try {
      const inventoryRows = await fetchDataItems<Record<string, any>>("inventory");
      const productData = inventoryRows.find((row) => String(row.id) === String(productId));
      if (!productData) return false;

      const currentStock = Number(productData.stock) || 0;
      const minStock = Number(productData.minStock) || 5;
      const newStock = force ? (currentStock - quantityToDeduct) : Math.max(0, currentStock - quantityToDeduct);

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
      await appendInventoryAdjustmentLog({
        sku: String(productData.sku || ""),
        productId: String(productData.id),
        productName: String(productData.productName || "Unknown"),
        mode: quantityToDeduct >= 0 ? "remove" : "add",
        source: quantityToDeduct >= 0 ? "dispatch" : "dispatch_return",
        quantity: Math.abs(Number(quantityToDeduct) || 0),
        previousStock: currentStock,
        newStock,
        reason: context?.reason || (quantityToDeduct >= 0 ? "Dispatch" : "Dispatch Return"),
        note: (context?.note || "").slice(0, 120),
        partyName: context?.partyName || "",
        dispatchId: context?.dispatchId || "",
        createdByUid: context?.userUid || "",
        createdByName: context?.userName || "System",
      });
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
          console.log(`Deducting stock for ecom order ${id}...`);
          for (const prod of existing.products) {
            await firestoreApi.deductStock(prod.id, prod.quantity, false, {
              reason: "Dispatch",
              note: `Dispatch ${id}`,
              userName: actor?.name || user,
              userUid: actor?.uid || "",
              dispatchId: id,
              partyName: existing.partyName || existing.customer?.name || "",
            });
          }
          updatedOrder.stockDeducted = true;
        }
      }
      
      // Cancel/reset rollback: restore inventory when a dispatched order is moved back to Pending.
      if (existing.status === "Dispatched" && newStatus === "Pending" && existing.stockDeducted) {
        if (existing.products && existing.products.length > 0) {
          console.log(`Restoring stock for cancelled ecom order ${id}...`);
          for (const prod of existing.products) {
            await firestoreApi.deductStock(prod.id, -Math.abs(Number(prod.quantity) || 0), true, {
              reason: "Dispatch Cancelled",
              note: `Dispatch ${id} cancelled - stock restored`,
              userName: actor?.name || user,
              userUid: actor?.uid || "",
              dispatchId: id,
              partyName: existing.partyName || existing.customer?.name || "",
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
      await deleteDataItemById("dispatches", orderId);
      await touchDataSignal("dispatches");

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
