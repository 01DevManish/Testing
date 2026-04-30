import { fetchDataItems, upsertDataItems } from "./dynamoDataApi";

export type InventoryAdjustmentLog = {
  id: string;
  skuKey: string;
  sku: string;
  productId: string;
  productName: string;
  mode: "add" | "remove";
  source: "manual" | "dispatch" | "dispatch_return";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  note: string;
  partyName?: string;
  dispatchId?: string;
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
};

export type InventoryAdjustmentLogInput = Omit<InventoryAdjustmentLog, "id" | "skuKey" | "createdAt"> & {
  createdAt?: number;
};

const normalizeSkuKey = (sku: string): string => String(sku || "").trim().toLowerCase();

export const appendInventoryAdjustmentLog = async (input: InventoryAdjustmentLogInput): Promise<void> => {
  const createdAt = Number(input.createdAt || Date.now());
  const sku = String(input.sku || "").trim();
  if (!sku) return;

  const id = `ial_${createdAt}_${Math.random().toString(36).slice(2, 8)}`;
  const row: InventoryAdjustmentLog = {
    ...input,
    id,
    sku,
    skuKey: normalizeSkuKey(sku),
    createdAt,
    note: String(input.note || "").trim().slice(0, 120),
    reason: String(input.reason || "").trim().slice(0, 80),
  };

  await upsertDataItems("inventoryAdjustments", [row]);
};

export const fetchInventoryAdjustmentLogsBySku = async (sku: string): Promise<InventoryAdjustmentLog[]> => {
  const skuKey = normalizeSkuKey(sku);
  if (!skuKey) return [];

  const rows = await fetchDataItems<InventoryAdjustmentLog>("inventoryAdjustments");
  return rows
    .filter((row) => String(row?.skuKey || "").trim() === skuKey)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
};

