"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Product, Category, Collection, ItemGroup } from "../dashboard/inventory/types";
import { PartyRate, UserRecord, Brand } from "../dashboard/admin/types";
import { Order, Party, Transporter } from "../dashboard/ecom-dispatch/types";
import { PackingList } from "../dashboard/retail-dispatch/types";

interface DataContextType {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  partyRates: PartyRate[];
  setPartyRates: React.Dispatch<React.SetStateAction<PartyRate[]>>;
  users: UserRecord[];
  setUsers: React.Dispatch<React.SetStateAction<UserRecord[]>>;
  brands: Brand[];
  setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  collections: Collection[];
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
  groups: ItemGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ItemGroup[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  parties: Party[];
  setParties: React.Dispatch<React.SetStateAction<Party[]>>;
  transporters: Transporter[];
  setTransporters: React.Dispatch<React.SetStateAction<Transporter[]>>;
  packingLists: PackingList[];
  setPackingLists: React.Dispatch<React.SetStateAction<PackingList[]>>;
  loading: boolean;
  realtimeStatus: "disabled" | "connecting" | "connected" | "reconnecting";
  lastSyncAt: number | null;
  refreshData: (entity?: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

// Storage keys
const CACHE_KEYS = {
  PRODUCTS: "eurus_cache_products",
  PARTIES: "eurus_cache_parties",
  USERS: "eurus_cache_users",
  BRANDS: "eurus_cache_brands",
  CATEGORIES: "eurus_cache_categories",
  COLLECTIONS: "eurus_cache_collections",
  GROUPS: "eurus_cache_groups",
  ORDERS: "eurus_cache_orders",
  PACKING_LISTS: "eurus_cache_packing_lists",
  PARTIES_MASTER: "eurus_cache_parties_master",
  TRANSPORTERS: "eurus_cache_transporters",
};

const VALID_USER_ROLES = new Set(["admin", "manager", "employee", "user"]);
const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";

type EntityPath =
  | "inventory"
  | "partyRates"
  | "users"
  | "usersMeta"
  | "brands"
  | "categories"
  | "collections"
  | "itemGroups"
  | "dispatches"
  | "packingLists"
  | "parties"
  | "transporters";

const HEAVY_NODE_POLL_MS = 10 * 60 * 1000; // fallback safety poll (10 min)
const WS_ENTITY_REFRESH_COOLDOWN_MS = 2500;
const ENTITY_FETCH_COOLDOWN_MS = 2000;
const WS_FLUSH_INTERVAL_MS = 1200;

const NODE_DEFS: Array<{
  path: EntityPath;
  cacheKey: string;
  realtime: boolean;
  pollMs?: number;
  aliases: string[];
}> = [
  { path: "inventory", cacheKey: CACHE_KEYS.PRODUCTS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["inventory", "products"] },
  { path: "partyRates", cacheKey: CACHE_KEYS.PARTIES, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["partyRates", "party-rates"] },
  { path: "usersMeta", cacheKey: CACHE_KEYS.USERS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["users", "usersMeta"] },
  { path: "brands", cacheKey: CACHE_KEYS.BRANDS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["brands"] },
  { path: "categories", cacheKey: CACHE_KEYS.CATEGORIES, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["categories"] },
  { path: "collections", cacheKey: CACHE_KEYS.COLLECTIONS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["collections"] },
  { path: "itemGroups", cacheKey: CACHE_KEYS.GROUPS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["groups", "itemGroups"] },
  { path: "dispatches", cacheKey: CACHE_KEYS.ORDERS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["dispatches", "orders"] },
  { path: "packingLists", cacheKey: CACHE_KEYS.PACKING_LISTS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["packingLists", "packing-lists"] },
  { path: "parties", cacheKey: CACHE_KEYS.PARTIES_MASTER, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["parties"] },
  { path: "transporters", cacheKey: CACHE_KEYS.TRANSPORTERS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["transporters"] },
];

const DYNAMO_PRIMARY_PATHS = new Set<EntityPath>([
  "inventory",
  "partyRates",
  "brands",
  "categories",
  "collections",
  "itemGroups",
  "dispatches",
  "packingLists",
  "parties",
  "transporters",
  "usersMeta",
]);

// Keep this empty unless an entity must be strictly manual-refresh only.
const ON_DEMAND_ONLY_PATHS = new Set<EntityPath>([]);

const castEntityList = <T,>(data: Array<Record<string, unknown>>): T[] =>
  data as unknown as T[];

const sanitizeCachedUsers = (rows: unknown[]): UserRecord[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const user = row as Record<string, unknown>;
      const uid = typeof user.uid === "string" ? user.uid.trim() : "";
      const email = typeof user.email === "string" ? user.email.trim() : "";
      if (email.toLowerCase() === HIDDEN_ADMIN_EMAIL) return null;
      const nameRaw = typeof user.name === "string" ? user.name.trim() : "";
      const fallbackFromEmail = email ? email.split("@")[0] : "";
      const name = nameRaw || fallbackFromEmail || `User ${uid.slice(0, 6)}`;
      const roleRaw = typeof user.role === "string" ? user.role.trim().toLowerCase() : "employee";
      const role = VALID_USER_ROLES.has(roleRaw) ? roleRaw : "employee";

      if (!uid) return null;

      return {
        ...user,
        uid,
        email,
        name,
        role,
      } as UserRecord;
    })
    .filter((user): user is UserRecord => Boolean(user));
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [partyRates, setPartyRates] = useState<PartyRate[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<"disabled" | "connecting" | "connected" | "reconnecting">("disabled");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const entityLastFetchAtRef = useRef<Partial<Record<EntityPath, number>>>({});
  const entityInFlightRef = useRef<Partial<Record<EntityPath, Promise<void>>>>({});

  // 1. Initial Load from LocalStorage (Instant 0ms feel)
  useEffect(() => {
    const loadFromCache = <T,>(
      key: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      transform?: (rows: unknown[]) => T[]
    ) => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const next = transform ? transform(parsed as unknown[]) : (parsed as T[]);
            setter(next);
            return true;
          } else {
            console.warn(`Cache for ${key} is invalid type. Clearing.`);
            localStorage.removeItem(key);
          }
        } catch (e) {
          console.error(`Failed to parse cache for ${key}`, e);
          localStorage.removeItem(key);
        }
      }
      return false;
    };

    loadFromCache(CACHE_KEYS.PRODUCTS, setProducts);
    loadFromCache(CACHE_KEYS.PARTIES, setPartyRates);
    loadFromCache(CACHE_KEYS.USERS, setUsers, sanitizeCachedUsers);
    loadFromCache(CACHE_KEYS.BRANDS, setBrands);
    loadFromCache(CACHE_KEYS.CATEGORIES, setCategories);
    loadFromCache(CACHE_KEYS.COLLECTIONS, setCollections);
    loadFromCache(CACHE_KEYS.GROUPS, setGroups);
    loadFromCache(CACHE_KEYS.ORDERS, setOrders);
    loadFromCache(CACHE_KEYS.PACKING_LISTS, setPackingLists);
    loadFromCache(CACHE_KEYS.PARTIES_MASTER, setParties);
    loadFromCache(CACHE_KEYS.TRANSPORTERS, setTransporters);
  }, []);

  const applyEntityData = useCallback((path: EntityPath, data: Array<Record<string, unknown>>) => {
    switch (path) {
      case "inventory":
        setProducts(castEntityList<Product>(data));
        break;
      case "partyRates":
        setPartyRates(castEntityList<PartyRate>(data));
        break;
      case "usersMeta":
      case "users":
        setUsers(castEntityList<UserRecord>(data));
        break;
      case "brands":
        setBrands(castEntityList<Brand>(data));
        break;
      case "categories":
        setCategories(castEntityList<Category>(data));
        break;
      case "collections":
        setCollections(castEntityList<Collection>(data));
        break;
      case "itemGroups":
        setGroups(castEntityList<ItemGroup>(data));
        break;
      case "dispatches":
        setOrders(castEntityList<Order>(data));
        break;
      case "packingLists":
        setPackingLists(castEntityList<PackingList>(data));
        break;
      case "parties":
        setParties(castEntityList<Party>(data));
        break;
      case "transporters":
        setTransporters(castEntityList<Transporter>(data));
        break;
      default:
        break;
    }
  }, []);

  const fetchEntity = useCallback(async (path: EntityPath) => {
    const def = NODE_DEFS.find((n) => n.path === path);
    if (!def) return;

    const now = Date.now();
    const lastFetchAt = entityLastFetchAtRef.current[path] || 0;
    if (now - lastFetchAt < ENTITY_FETCH_COOLDOWN_MS) return;
    const inFlight = entityInFlightRef.current[path];
    if (inFlight) return inFlight;

    const task = (async () => {
      try {
        if (!DYNAMO_PRIMARY_PATHS.has(path)) return;
        const res = await fetch(`/api/data/${path}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch ${path}: ${res.status}`);
        }
        const json = await res.json();
        const rows = Array.isArray(json?.items) ? (json.items as Array<Record<string, unknown>>) : [];
        applyEntityData(path, rows);
        localStorage.setItem(def.cacheKey, JSON.stringify(rows));
        setLastSyncAt(Date.now());
      } catch (error) {
        console.error(`[DataContext] Failed to fetch ${path}:`, error);
      } finally {
        entityLastFetchAtRef.current[path] = Date.now();
        delete entityInFlightRef.current[path];
      }
    })();

    entityInFlightRef.current[path] = task;
    return task;
  }, [applyEntityData]);

  // 2. Dynamo-only Sync:
  // - initial fetch all entities from Dynamo
  // - interval polling as fallback
  // - websocket entity updates trigger targeted refresh
  useEffect(() => {
    const pollers: number[] = [];

    Promise.all(
      NODE_DEFS
        .filter((node) => !node.realtime && !ON_DEMAND_ONLY_PATHS.has(node.path))
        .map((node) => fetchEntity(node.path))
    ).finally(() => setLoading(false));

    NODE_DEFS.forEach((node) => {
      if (node.pollMs) {
        if (ON_DEMAND_ONLY_PATHS.has(node.path)) return;
        const id = window.setInterval(() => {
          if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
          fetchEntity(node.path);
        }, node.pollMs);
        pollers.push(id);
      }
    });

    return () => {
      pollers.forEach((id) => window.clearInterval(id));
    };
  }, [fetchEntity]);

  const refreshData = useCallback((entity?: string) => {
    if (!entity) {
      NODE_DEFS.forEach((node) => {
        if (ON_DEMAND_ONLY_PATHS.has(node.path)) return;
        fetchEntity(node.path);
      });
      return;
    }

    const normalized = entity.trim().toLowerCase();
    const matched = NODE_DEFS.find((node) =>
      node.aliases.some((alias) => alias.toLowerCase() === normalized)
    );

    if (matched) {
      fetchEntity(matched.path);
      return;
    }

    console.warn(`[DataContext] Unknown refresh entity: ${entity}`);
  }, [fetchEntity]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const enableWsInDev = process.env.NEXT_PUBLIC_ENABLE_REALTIME_WS === "true";
    const isProd = process.env.NODE_ENV === "production";
    if (!wsUrl) {
      setRealtimeStatus("disabled");
      return;
    }
    if (!isProd && !enableWsInDev) {
      setRealtimeStatus("disabled");
      return;
    }

    let ws: WebSocket | null = null;
    let retryDelayMs = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const lastRefreshByEntity: Record<string, number> = {};
    const pendingEntities = new Set<string>();

    const flushPendingEntities = () => {
      flushTimer = null;
      if (disposed) return;
      pendingEntities.forEach((entity) => refreshData(entity));
      pendingEntities.clear();
    };

    const queueEntityRefresh = (entity: string) => {
      pendingEntities.add(entity);
      if (flushTimer) return;
      flushTimer = setTimeout(flushPendingEntities, WS_FLUSH_INTERVAL_MS);
    };

    const connect = () => {
      if (disposed) return;
      setRealtimeStatus(reconnectTimer ? "reconnecting" : "connecting");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        retryDelayMs = 1000;
        setRealtimeStatus("connected");
        ws?.send(JSON.stringify({
          action: "subscribe",
          channels: ["inventory", "partyRates", "dispatches", "packingLists", "usersMeta", "parties", "transporters"],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message?.type === "entity_update" && message?.entity) {
            if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
            const entity = String(message.entity || "").trim().toLowerCase();
            if (!entity) return;
            setLastSyncAt(Date.now());
            const now = Date.now();
            const last = lastRefreshByEntity[entity] || 0;
            if (now - last < WS_ENTITY_REFRESH_COOLDOWN_MS) return;
            lastRefreshByEntity[entity] = now;
            queueEntityRefresh(entity);
          }
        } catch {
          // Ignore malformed websocket payloads
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (disposed) return;
        setRealtimeStatus("reconnecting");
        reconnectTimer = setTimeout(connect, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 30000);
      };
    };

    connect();

    return () => {
      disposed = true;
      setRealtimeStatus("disabled");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer) clearTimeout(flushTimer);
      pendingEntities.clear();
      ws?.close();
    };
  }, [refreshData]);

  return (
    <DataContext.Provider value={{
      products,
      setProducts,
      partyRates,
      setPartyRates,
      users,
      setUsers,
      brands,
      setBrands,
      categories,
      setCategories,
      collections,
      setCollections,
      groups,
      setGroups,
      orders,
      setOrders,
      packingLists,
      setPackingLists,
      parties,
      setParties,
      transporters,
      setTransporters,
      loading,
      realtimeStatus,
      lastSyncAt,
      refreshData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
