import { Order, OrderStatus, Party, Transporter, ManagedBox } from "./types";
import { ref, get, push, set, update, remove } from "firebase/database";
import { db } from "../../lib/firebase";
import { logActivity } from "../../lib/activityLogger";

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

  // Inventory - Fetch real items from inventory node
  getInventoryProducts: async (): Promise<{ id: string; productName: string; price: number; stock: number; sku?: string; barcode?: string; unit?: string; collection?: string; brand?: string; brandId?: string; category?: string }[]> => {
    try {
      const snap = await get(ref(db, "inventory"));
      const list: { id: string; productName: string; price: number; stock: number; sku?: string; barcode?: string; unit?: string; collection?: string; brand?: string; brandId?: string; category?: string }[] = [];
      if (snap.exists()) {
        snap.forEach(d => {
          const data = d.val();
          list.push({ 
            id: d.key as string, 
            productName: data.productName || "Unknown", 
            price: data.price || 0, 
            stock: data.stock || 0,
            sku: data.sku || "N/A",
            barcode: data.barcode || "",
            unit: data.unit || "PCS",
            collection: data.collection || "",
            brand: data.brand || "",
            brandId: data.brandId || "",
            category: data.category || ""
          });
        });
      }
      return list;
    } catch (e) { console.error(e); return []; }
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


