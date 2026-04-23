"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { db } from "../lib/firebase";
import { ref, onValue, off, get, DataSnapshot } from "firebase/database";
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

const HIDDEN_ADMIN_EMAIL = "01devmanish@gmail.com";
const HIDDEN_ADMIN_NAME = "dev manish";
const VALID_USER_ROLES = new Set(["admin", "manager", "employee", "user"]);

type EntityPath =
  | "inventory"
  | "partyRates"
  | "users"
  | "brands"
  | "categories"
  | "collections"
  | "itemGroups"
  | "dispatches"
  | "packingLists"
  | "parties"
  | "transporters";

const HEAVY_NODE_POLL_MS = 10 * 60 * 1000; // fallback safety poll (10 min)
const DATA_SIGNAL_ROOT = "syncSignals";
const SIGNAL_FETCH_COOLDOWN_MS = 4000;

const NODE_DEFS: Array<{
  path: EntityPath;
  cacheKey: string;
  realtime: boolean;
  pollMs?: number;
  aliases: string[];
}> = [
  { path: "inventory", cacheKey: CACHE_KEYS.PRODUCTS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["inventory", "products"] },
  { path: "partyRates", cacheKey: CACHE_KEYS.PARTIES, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["partyRates", "party-rates"] },
  { path: "users", cacheKey: CACHE_KEYS.USERS, realtime: true, aliases: ["users"] },
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
]);

// These entities should not hit Firebase in normal read flow once Dynamo responds successfully.
// Keeps Firebase bandwidth/cost low for heavy datasets like inventory.
const DYNAMO_AUTHORITATIVE_PATHS = new Set<EntityPath>([
  "inventory",
]);

// Keep inventory on-demand only (no automatic signal/poll fetch) to control Firebase/Dynamo churn and UI flicker.
const ON_DEMAND_ONLY_PATHS = new Set<EntityPath>([
  "inventory",
]);

const FIREBASE_RECONCILE_PATHS = new Set<EntityPath>([
  "partyRates",
  "parties",
  "collections",
  "packingLists",
]);

const normalizeSnapshotToList = (path: EntityPath, val: unknown): Array<Record<string, unknown>> => {
  if (!val || typeof val !== "object") return [];

  const entries = Object.entries(val as Record<string, unknown>);

  if (path === "users") {
    return entries.flatMap(([
      key,
      record,
    ]): Array<Record<string, unknown>> => {
        if (!record || typeof record !== "object") return [];
        const safeRecord = record as Record<string, unknown>;

        const uid = typeof safeRecord.uid === "string" && safeRecord.uid.trim()
          ? safeRecord.uid.trim()
          : key;
        const email = typeof safeRecord.email === "string" ? safeRecord.email.trim() : "";
        const name = typeof safeRecord.name === "string" ? safeRecord.name.trim() : "";
        const roleRaw = typeof safeRecord.role === "string" ? safeRecord.role.trim().toLowerCase() : "employee";
        const role = VALID_USER_ROLES.has(roleRaw) ? roleRaw : "employee";

        const isHidden = email.toLowerCase() === HIDDEN_ADMIN_EMAIL || name.toLowerCase() === HIDDEN_ADMIN_NAME;
        if (!uid || !email || !name || isHidden) return [];

        return [{
          ...safeRecord,
          id: key,
          uid,
          email,
          name,
          role,
        }];
      });
  }

  return entries.map(([key, record]) => {
    const safeRecord = (record && typeof record === "object")
      ? (record as Record<string, unknown>)
      : {};
    return {
      ...safeRecord,
      id: key,
      uid: typeof safeRecord.uid === "string" ? safeRecord.uid : key,
    };
  });
};

const castEntityList = <T,>(data: Array<Record<string, unknown>>): T[] =>
  data as unknown as T[];

const getMaxUpdatedAt = (rows: Array<Record<string, unknown>>): number => {
  return rows.reduce((max, row) => {
    const ts = typeof row.updatedAt === "number" ? row.updatedAt : 0;
    return ts > max ? ts : max;
  }, 0);
};

const countRowsWithImage = (rows: Array<Record<string, unknown>>): number =>
  rows.reduce((count, row) => {
    const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";
    return imageUrl ? count + 1 : count;
  }, 0);

const sanitizeCachedUsers = (rows: unknown[]): UserRecord[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const user = row as Record<string, unknown>;
      const uid = typeof user.uid === "string" ? user.uid.trim() : "";
      const email = typeof user.email === "string" ? user.email.trim() : "";
      const name = typeof user.name === "string" ? user.name.trim() : "";
      const roleRaw = typeof user.role === "string" ? user.role.trim().toLowerCase() : "employee";
      const role = VALID_USER_ROLES.has(roleRaw) ? roleRaw : "employee";
      const isHidden = email.toLowerCase() === HIDDEN_ADMIN_EMAIL || name.toLowerCase() === HIDDEN_ADMIN_NAME;

      if (!uid || !email || !name || isHidden) return null;

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
  const lastSignalRef = useRef<Record<string, string>>({});
  const lastSignalFetchAtRef = useRef<Record<string, number>>({});

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

    try {
      let dynamoRows: Array<Record<string, unknown>> | null = null;

      if (DYNAMO_PRIMARY_PATHS.has(path)) {
        try {
          const res = await fetch(`/api/data/${path}`, { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json?.items)) {
              dynamoRows = json.items as Array<Record<string, unknown>>;
              const isDynamoAuthoritative = DYNAMO_AUTHORITATIVE_PATHS.has(path);
              if (isDynamoAuthoritative) {
                // For cost-sensitive heavy nodes, avoid Firebase node reads when Dynamo has responded.
                applyEntityData(path, dynamoRows);
                localStorage.setItem(def.cacheKey, JSON.stringify(dynamoRows));
                return;
              }
              const shouldReconcileWithFirebase = FIREBASE_RECONCILE_PATHS.has(path);
              if (dynamoRows.length > 0 && !shouldReconcileWithFirebase) {
                // Non-reconcile entities are Dynamo-first and can be applied immediately.
                applyEntityData(path, dynamoRows);
                localStorage.setItem(def.cacheKey, JSON.stringify(dynamoRows));
                return;
              }
            }
          }
        } catch (dynamoErr) {
          console.warn(`[DataContext] Dynamo primary fetch failed for ${path}, falling back to Firebase.`, dynamoErr);
        }
      }

      const snapshot = await get(ref(db, path));
      const data = snapshot.exists() ? normalizeSnapshotToList(path, snapshot.val()) : [];

      let rowsToApply = data;
      let shouldSyncDynamo = DYNAMO_PRIMARY_PATHS.has(path) && data.length > 0;

      if (FIREBASE_RECONCILE_PATHS.has(path) && dynamoRows && dynamoRows.length > 0) {
        const firebaseImageCount = countRowsWithImage(data);
        const dynamoImageCount = countRowsWithImage(dynamoRows);
        
        const fbMaxTs = getMaxUpdatedAt(data);
        const dynMaxTs = getMaxUpdatedAt(dynamoRows);
        
        const shouldPreferFirebase = path === "inventory"
          ? (data.length !== dynamoRows.length || firebaseImageCount > dynamoImageCount || fbMaxTs > dynMaxTs + 2000)
          : (data.length !== dynamoRows.length || fbMaxTs > dynMaxTs + 2000);

        if (!shouldPreferFirebase) {
          rowsToApply = dynamoRows;
          shouldSyncDynamo = false;
        } else {
          console.info(
            `[DataContext] ${path} reconciled with Firebase (fbTs=${fbMaxTs}, dynTs=${dynMaxTs}, fbLength=${data.length}, dynLength=${dynamoRows.length}).`
          );
        }
      }

      applyEntityData(path, rowsToApply);
      localStorage.setItem(def.cacheKey, JSON.stringify(rowsToApply));

      // Important: never push full-entity sync writes from client runtime.
      // This can create a feedback loop:
      // client fetch -> client replace POST -> server signal -> client fetch again.
      // Background synchronization should be handled by server-side jobs/scripts only.
      void shouldSyncDynamo;
    } catch (error) {
      console.error(`[DataContext] Failed to fetch ${path}:`, error);
    }
  }, [applyEntityData]);

  // 2. Hybrid Sync:
  // - lightweight nodes stay realtime as-is
  // - heavy nodes use tiny realtime signals + Dynamo fetch
  // - very slow fallback poll keeps data safe if a signal is ever missed
  useEffect(() => {
    const activeListeners: Array<{ refPath: EntityPath; listener: (snapshot: DataSnapshot) => void }> = [];
    const signalListeners: Array<{ refPath: string; listener: (snapshot: DataSnapshot) => void }> = [];
    const pollers: number[] = [];

    Promise.all(
      NODE_DEFS
        .filter((node) => !node.realtime && !ON_DEMAND_ONLY_PATHS.has(node.path))
        .map((node) => fetchEntity(node.path))
    ).finally(() => setLoading(false));

    NODE_DEFS.forEach((node) => {
      if (node.realtime) {
        const dbRef = ref(db, node.path);
        const listener = onValue(dbRef, (snapshot) => {
          const data = snapshot.exists() ? normalizeSnapshotToList(node.path, snapshot.val()) : [];
          applyEntityData(node.path, data);
          localStorage.setItem(node.cacheKey, JSON.stringify(data));
          setLoading(false);
        });
        activeListeners.push({ refPath: node.path, listener });
      }

      if (!node.realtime) {
        const signalPath = `${DATA_SIGNAL_ROOT}/${node.path}`;
        const signalRef = ref(db, signalPath);
        const signalListener = onValue(signalRef, (snapshot) => {
          if (ON_DEMAND_ONLY_PATHS.has(node.path)) return;
          const signalValueRaw = snapshot.val();
          const signalValue = signalValueRaw == null ? "" : String(signalValueRaw);
          const lastValue = lastSignalRef.current[node.path] || "";
          if (signalValue && signalValue !== lastValue) {
            const now = Date.now();
            const lastFetchAt = lastSignalFetchAtRef.current[node.path] || 0;
            if (now - lastFetchAt < SIGNAL_FETCH_COOLDOWN_MS) {
              lastSignalRef.current[node.path] = signalValue;
              return;
            }
            lastSignalRef.current[node.path] = signalValue;
            lastSignalFetchAtRef.current[node.path] = now;
            fetchEntity(node.path);
          }
        });
        signalListeners.push({ refPath: signalPath, listener: signalListener });
      }

      if (!node.realtime && node.pollMs) {
        if (ON_DEMAND_ONLY_PATHS.has(node.path)) return;
        const id = window.setInterval(() => {
          fetchEntity(node.path);
        }, node.pollMs);
        pollers.push(id);
      }
    });

    return () => {
      activeListeners.forEach(({ refPath, listener }) => off(ref(db, refPath), "value", listener));
      signalListeners.forEach(({ refPath, listener }) => off(ref(db, refPath), "value", listener));
      pollers.forEach((id) => window.clearInterval(id));
    };
  }, [applyEntityData, fetchEntity]);

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
