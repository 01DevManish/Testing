"use client";

import React, { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../lib/firebase";
import type { AdminStyles } from "./styles";
import type { Product as InventoryProduct } from "../inventory/types";
import type { Order } from "../ecom-dispatch/types";

type DispatchChannel = "retail" | "ecom";

interface DispatchItemLike {
  id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  sku?: string;
  quantity?: number;
  price?: number;
  rate?: number;
}

interface DispatchOrderLike extends Partial<Order> {
  items?: DispatchItemLike[];
  dispatchedAt?: number;
}

interface PackingListItem {
  productId?: string;
  productName?: string;
  sku?: string;
  quantity?: number;
  rate?: number;
}

interface PackingListRecord {
  id: string;
  status?: string;
  dispatchedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  items?: PackingListItem[];
}

interface ChannelMetrics {
  dispatches: number;
  units: number;
  sales: number;
  cost: number;
  profit: number;
}

interface TrendPoint {
  label: string;
  retailDispatches: number;
  ecomDispatches: number;
  sales: number;
  profit: number;
}

interface TopProductRow {
  key: string;
  name: string;
  sku: string;
  qty: number;
  sales: number;
  profit: number;
}

interface ReportsTabProps {
  S: AdminStyles;
  isMobile: boolean;
  isTablet: boolean;
  products: InventoryProduct[];
  orders: Order[];
}

interface ReportStatCardProps {
  S: AdminStyles;
  isMobile: boolean;
  title: string;
  value: string;
  subtitle: string;
  stripe: string;
}

const DISPATCHED_STATUSES = new Set(["packed", "completed", "dispatched", "in transit", "delivered"]);

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const startOfDay = (timestamp: number): number => {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const toTimestamp = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return value;
    if (value > 1_000_000_000) return value * 1000;
    return null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
};

const normalizeKey = (value: unknown): string => String(value || "").trim().toLowerCase();
const normalizeSku = (value: unknown): string => String(value || "").trim().toUpperCase();

const formatMoney = (value: number): string => `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
const formatNumber = (value: number): string => Math.round(value).toLocaleString("en-IN");

function ReportStatCard({ S, isMobile, title, value, subtitle, stripe }: ReportStatCardProps) {
  return (
    <div style={{ ...S.statCard, minHeight: 118 }}>
      <div style={S.statStripe(stripe)} />
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{subtitle}</div>
    </div>
  );
}

export default function ReportsTab({ S, isMobile, isTablet, products, orders }: ReportsTabProps) {
  const [packingLists, setPackingLists] = useState<PackingListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);

  useEffect(() => {
    const packingListsRef = ref(db, "packingLists");
    const unsubscribe = onValue(
      packingListsRef,
      (snapshot) => {
        const rows: PackingListRecord[] = [];
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            rows.push({ id: child.key || "", ...child.val() });
          });
        }
        setPackingLists(rows);
        setLastUpdatedAt(Date.parse(new Date().toISOString()));
        setLoading(false);
      },
      () => {
        setLastUpdatedAt(Date.parse(new Date().toISOString()));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const report = useMemo(() => {
    const byId = new Map<string, InventoryProduct>();
    const bySku = new Map<string, InventoryProduct>();
    const byName = new Map<string, InventoryProduct>();

    products.forEach((p) => {
      if (p.id) byId.set(String(p.id), p);
      const sku = normalizeSku(p.sku);
      if (sku) bySku.set(sku, p);
      const name = normalizeKey(p.productName);
      if (name) byName.set(name, p);
    });

    const resolveInventoryProduct = (item: DispatchItemLike | PackingListItem): InventoryProduct | undefined => {
      const id = String((item as DispatchItemLike).productId || (item as DispatchItemLike).id || "").trim();
      if (id && byId.has(id)) return byId.get(id);

      const sku = normalizeSku(item.sku);
      if (sku && bySku.has(sku)) return bySku.get(sku);

      const name = normalizeKey((item as DispatchItemLike).productName || (item as DispatchItemLike).name);
      if (name && byName.has(name)) return byName.get(name);

      return undefined;
    };

    const now = lastUpdatedAt;
    const dayStarts: number[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      dayStarts.push(startOfDay(now - i * 24 * 60 * 60 * 1000));
    }
    const dayToIndex = new Map<number, number>(dayStarts.map((day, index) => [day, index]));

    const trend: TrendPoint[] = dayStarts.map((day) => ({
      label: new Date(day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      retailDispatches: 0,
      ecomDispatches: 0,
      sales: 0,
      profit: 0,
    }));

    const channels: Record<DispatchChannel, ChannelMetrics> = {
      retail: { dispatches: 0, units: 0, sales: 0, cost: 0, profit: 0 },
      ecom: { dispatches: 0, units: 0, sales: 0, cost: 0, profit: 0 },
    };

    const topProducts = new Map<string, TopProductRow>();

    const updateTrend = (timestamp: number, update: (point: TrendPoint) => void) => {
      const idx = dayToIndex.get(startOfDay(timestamp));
      if (idx === undefined) return;
      update(trend[idx]);
    };

    const pushItem = (channel: DispatchChannel, timestamp: number, item: DispatchItemLike | PackingListItem) => {
      const qty = safeNumber(item.quantity);
      if (qty <= 0) return;

      const linked = resolveInventoryProduct(item);
      const explicitRate = safeNumber((item as DispatchItemLike).rate);
      const explicitPrice = safeNumber((item as DispatchItemLike).price);
      const sellRate = explicitRate > 0 ? explicitRate : explicitPrice > 0 ? explicitPrice : safeNumber(linked?.price);
      const costRate = safeNumber(linked?.costPrice);

      const sales = sellRate * qty;
      const cost = costRate * qty;
      const profit = sales - cost;

      channels[channel].units += qty;
      channels[channel].sales += sales;
      channels[channel].cost += cost;
      channels[channel].profit += profit;

      updateTrend(timestamp, (day) => {
        day.sales += sales;
        day.profit += profit;
      });

      const sku = normalizeSku(item.sku || linked?.sku || "");
      const name = String((item as DispatchItemLike).productName || (item as DispatchItemLike).name || linked?.productName || "Unnamed Item");
      const key = sku || normalizeKey(name);
      const existing = topProducts.get(key);

      if (existing) {
        existing.qty += qty;
        existing.sales += sales;
        existing.profit += profit;
      } else {
        topProducts.set(key, {
          key,
          name,
          sku: sku || "N/A",
          qty,
          sales,
          profit,
        });
      }
    };

    const pushDispatchCount = (channel: DispatchChannel, timestamp: number) => {
      channels[channel].dispatches += 1;
      updateTrend(timestamp, (day) => {
        if (channel === "retail") day.retailDispatches += 1;
        else day.ecomDispatches += 1;
      });
    };

    orders.forEach((rawOrder) => {
      const order = rawOrder as DispatchOrderLike;
      const channel: DispatchChannel = order.dispatchType === "ecom" ? "ecom" : "retail";
      const orderTimestamp =
        toTimestamp(order.dispatchedAt) ||
        toTimestamp(order.updatedAt) ||
        toTimestamp(order.createdAt) ||
        toTimestamp(order.dispatchDate) ||
        now;

      pushDispatchCount(channel, orderTimestamp);

      const productsItems = Array.isArray(order.products) ? (order.products as DispatchItemLike[]) : [];
      const dynamicItems = Array.isArray(order.items) ? order.items : [];
      const sourceItems = productsItems.length > 0 ? productsItems : dynamicItems;
      sourceItems.forEach((item) => pushItem(channel, orderTimestamp, item));
    });

    packingLists.forEach((list) => {
      const normalizedStatus = normalizeKey(list.status);
      const dispatchLike = DISPATCHED_STATUSES.has(normalizedStatus) || !!toTimestamp(list.dispatchedAt);
      if (!dispatchLike) return;

      const listTimestamp = toTimestamp(list.dispatchedAt) || toTimestamp(list.updatedAt) || toTimestamp(list.createdAt) || now;
      pushDispatchCount("retail", listTimestamp);

      const items = Array.isArray(list.items) ? list.items : [];
      items.forEach((item) => pushItem("retail", listTimestamp, item));
    });

    const inventorySummary = products.reduce(
      (acc, p) => {
        const stock = safeNumber(p.stock);
        const sell = safeNumber(p.price);
        const cost = safeNumber(p.costPrice);
        const minStock = safeNumber(p.minStock);

        acc.totalSkus += 1;
        acc.totalUnits += stock;
        if (stock <= minStock) acc.lowStockSkus += 1;
        acc.costValue += cost * stock;
        acc.sellValue += sell * stock;
        return acc;
      },
      { totalSkus: 0, totalUnits: 0, lowStockSkus: 0, costValue: 0, sellValue: 0 }
    );

    const totalSales = channels.retail.sales + channels.ecom.sales;
    const totalCost = channels.retail.cost + channels.ecom.cost;
    const totalProfit = totalSales - totalCost;

    const topRows = Array.from(topProducts.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    return {
      channels,
      trend,
      inventorySummary,
      totalSales,
      totalCost,
      totalProfit,
      topRows,
    };
  }, [packingLists, products, orders, lastUpdatedAt]);

  if (loading) {
    return (
      <div style={{ ...S.activityCard, textAlign: "center", padding: 28, color: "#64748b" }}>
        Loading report data...
      </div>
    );
  }

  const dispatchMax = Math.max(
    1,
    ...report.trend.map((point) => Math.max(point.retailDispatches, point.ecomDispatches))
  );
  const financeMax = Math.max(1, ...report.trend.map((point) => Math.max(point.sales, Math.abs(point.profit))));
  const inventoryPotential = report.inventorySummary.sellValue - report.inventorySummary.costValue;
  const columnLayout = isMobile ? "1fr" : isTablet ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  return (
    <div style={S.tabContent}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24, color: "#0f172a", fontWeight: 700 }}>Reports</h2>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "#64748b" }}>
          Inventory, dispatch, sales and profit analytics. Last sync:{" "}
          {new Date(lastUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: columnLayout, gap: 14, marginBottom: 20 }}>
        <ReportStatCard
          S={S}
          isMobile={isMobile}
          title="Total Sales"
          value={formatMoney(report.totalSales)}
          subtitle={`Cost tracked: ${formatMoney(report.totalCost)}`}
          stripe="linear-gradient(90deg, #0ea5e9, #2563eb)"
        />
        <ReportStatCard
          S={S}
          isMobile={isMobile}
          title="Gross Profit"
          value={formatMoney(report.totalProfit)}
          subtitle={`Margin: ${report.totalSales > 0 ? ((report.totalProfit / report.totalSales) * 100).toFixed(1) : "0.0"}%`}
          stripe="linear-gradient(90deg, #10b981, #059669)"
        />
        <ReportStatCard
          S={S}
          isMobile={isMobile}
          title="Retail Dispatch"
          value={formatNumber(report.channels.retail.dispatches)}
          subtitle={`Units moved: ${formatNumber(report.channels.retail.units)}`}
          stripe="linear-gradient(90deg, #6366f1, #4f46e5)"
        />
        <ReportStatCard
          S={S}
          isMobile={isMobile}
          title="Ecom Dispatch"
          value={formatNumber(report.channels.ecom.dispatches)}
          subtitle={`Units moved: ${formatNumber(report.channels.ecom.units)}`}
          stripe="linear-gradient(90deg, #f97316, #ea580c)"
        />
        <ReportStatCard
          S={S}
          isMobile={isMobile}
          title="Inventory SKU"
          value={formatNumber(report.inventorySummary.totalSkus)}
          subtitle={`Total units: ${formatNumber(report.inventorySummary.totalUnits)}`}
          stripe="linear-gradient(90deg, #22c55e, #15803d)"
        />
        <ReportStatCard
          S={S}
          isMobile={isMobile}
          title="Low Stock"
          value={formatNumber(report.inventorySummary.lowStockSkus)}
          subtitle="Based on current min stock threshold"
          stripe="linear-gradient(90deg, #ef4444, #b91c1c)"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 20 }}>
        <div style={S.activityCard}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Dispatch Trend (7 Days)</h3>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Retail vs ecom dispatch count by day</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 420, display: "flex", gap: 12, alignItems: "flex-end", height: 190 }}>
              {report.trend.map((point) => {
                const retailHeight = Math.max(6, Math.round((point.retailDispatches / dispatchMax) * 120));
                const ecomHeight = Math.max(6, Math.round((point.ecomDispatches / dispatchMax) * 120));
                return (
                  <div key={point.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 128 }}>
                      <div title={`Retail: ${point.retailDispatches}`} style={{ width: 14, height: retailHeight, borderRadius: 4, background: "#4f46e5" }} />
                      <div title={`Ecom: ${point.ecomDispatches}`} style={{ width: 14, height: ecomHeight, borderRadius: 4, background: "#f97316" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{point.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#64748b" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#4f46e5" }} />
              Retail
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316" }} />
              Ecom
            </span>
          </div>
        </div>

        <div style={S.activityCard}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Revenue vs Profit (7 Days)</h3>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Sales and gross profit trend</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 420, display: "flex", gap: 12, alignItems: "flex-end", height: 190 }}>
              {report.trend.map((point) => {
                const salesHeight = Math.max(6, Math.round((point.sales / financeMax) * 120));
                const profitHeight = Math.max(6, Math.round((Math.abs(point.profit) / financeMax) * 120));
                const profitColor = point.profit >= 0 ? "#16a34a" : "#dc2626";
                return (
                  <div key={point.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 128 }}>
                      <div title={`Sales: ${formatMoney(point.sales)}`} style={{ width: 14, height: salesHeight, borderRadius: 4, background: "#0ea5e9" }} />
                      <div title={`Profit: ${formatMoney(point.profit)}`} style={{ width: 14, height: profitHeight, borderRadius: 4, background: profitColor }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{point.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#64748b" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#0ea5e9" }} />
              Sales
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#16a34a" }} />
              Profit
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr", gap: 18 }}>
        <div style={S.activityCard}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, color: "#0f172a" }}>Inventory Valuation</h3>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#eff6ff" }}>
              <div style={{ fontSize: 11, color: "#2563eb" }}>At Cost</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1e3a8a", marginTop: 6 }}>{formatMoney(report.inventorySummary.costValue)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dcfce7", background: "#f0fdf4" }}>
              <div style={{ fontSize: 11, color: "#15803d" }}>At Sell Price</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#14532d", marginTop: 6 }}>{formatMoney(report.inventorySummary.sellValue)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid #fef3c7", background: "#fffbeb" }}>
              <div style={{ fontSize: 11, color: "#a16207" }}>Potential Margin</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#854d0e", marginTop: 6 }}>{formatMoney(inventoryPotential)}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            Profit report is calculated from dispatch quantities using item sell rate/price and inventory cost price.
          </div>
        </div>

        <div style={S.activityCard}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, color: "#0f172a" }}>Top Dispatched Products</h3>
          {report.topRows.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, padding: "10px 0" }}>No dispatch product data available yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {report.topRows.map((row, index) => (
                <div key={row.key} style={{ display: "grid", gridTemplateColumns: "30px 1fr auto", gap: 10, alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "#eef2ff", color: "#4338ca", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {row.sku} | Qty: {formatNumber(row.qty)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#0369a1", fontWeight: 700 }}>{formatMoney(row.sales)}</div>
                    <div style={{ fontSize: 11, color: row.profit >= 0 ? "#15803d" : "#b91c1c", marginTop: 2 }}>{formatMoney(row.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

