"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "../lib/firebase";
import { ref, onValue, off, get, DataSnapshot } from "firebase/database";
import { Product, Category, Collection, ItemGroup } from "../dashboard/inventory/types";
import { PartyRate, UserRecord, Brand } from "../dashboard/admin/types";
import { Order, Party, Transporter } from "../dashboard/ecom-dispatch/types";

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
  PARTIES_MASTER: "eurus_cache_parties_master",
  TRANSPORTERS: "eurus_cache_transporters",
};

type EntityPath =
  | "inventory"
  | "partyRates"
  | "users"
  | "brands"
  | "categories"
  | "collections"
  | "itemGroups"
  | "dispatches"
  | "parties"
  | "transporters";

const HEAVY_NODE_POLL_MS = 2 * 60 * 1000; // 2 minutes

const NODE_DEFS: Array<{
  path: EntityPath;
  cacheKey: string;
  realtime: boolean;
  pollMs?: number;
  aliases: string[];
}> = [
  { path: "inventory", cacheKey: CACHE_KEYS.PRODUCTS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["inventory", "products"] },
  { path: "partyRates", cacheKey: CACHE_KEYS.PARTIES, realtime: true, aliases: ["partyRates", "party-rates"] },
  { path: "users", cacheKey: CACHE_KEYS.USERS, realtime: true, aliases: ["users"] },
  { path: "brands", cacheKey: CACHE_KEYS.BRANDS, realtime: true, aliases: ["brands"] },
  { path: "categories", cacheKey: CACHE_KEYS.CATEGORIES, realtime: true, aliases: ["categories"] },
  { path: "collections", cacheKey: CACHE_KEYS.COLLECTIONS, realtime: true, aliases: ["collections"] },
  { path: "itemGroups", cacheKey: CACHE_KEYS.GROUPS, realtime: true, aliases: ["groups", "itemGroups"] },
  { path: "dispatches", cacheKey: CACHE_KEYS.ORDERS, realtime: false, pollMs: HEAVY_NODE_POLL_MS, aliases: ["dispatches", "orders"] },
  { path: "parties", cacheKey: CACHE_KEYS.PARTIES_MASTER, realtime: true, aliases: ["parties"] },
  { path: "transporters", cacheKey: CACHE_KEYS.TRANSPORTERS, realtime: true, aliases: ["transporters"] },
];

const normalizeSnapshotToList = (val: unknown): Array<Record<string, unknown>> => {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val as Record<string, unknown>).map(([key, record]) => {
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

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [partyRates, setPartyRates] = useState<PartyRate[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Initial Load from LocalStorage (Instant 0ms feel)
  useEffect(() => {
    const loadFromCache = <T,>(key: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setter(parsed as T[]);
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
    loadFromCache(CACHE_KEYS.USERS, setUsers);
    loadFromCache(CACHE_KEYS.BRANDS, setBrands);
    loadFromCache(CACHE_KEYS.CATEGORIES, setCategories);
    loadFromCache(CACHE_KEYS.COLLECTIONS, setCollections);
    loadFromCache(CACHE_KEYS.GROUPS, setGroups);
    loadFromCache(CACHE_KEYS.ORDERS, setOrders);
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
      const snapshot = await get(ref(db, path));
      const data = snapshot.exists() ? normalizeSnapshotToList(snapshot.val()) : [];
      applyEntityData(path, data);
      localStorage.setItem(def.cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error(`[DataContext] Failed to fetch ${path}:`, error);
    }
  }, [applyEntityData]);

  // 2. Hybrid Sync: lightweight nodes in realtime, heavy nodes in polling mode.
  useEffect(() => {
    const activeListeners: Array<{ refPath: EntityPath; listener: (snapshot: DataSnapshot) => void }> = [];
    const pollers: number[] = [];

    Promise.all(NODE_DEFS.map((node) => fetchEntity(node.path))).finally(() => setLoading(false));

    NODE_DEFS.forEach((node) => {
      if (node.realtime) {
        const dbRef = ref(db, node.path);
        const listener = onValue(dbRef, (snapshot) => {
          const data = snapshot.exists() ? normalizeSnapshotToList(snapshot.val()) : [];
          applyEntityData(node.path, data);
          localStorage.setItem(node.cacheKey, JSON.stringify(data));
          setLoading(false);
        });
        activeListeners.push({ refPath: node.path, listener });
      }

      if (!node.realtime && node.pollMs) {
        const id = window.setInterval(() => {
          fetchEntity(node.path);
        }, node.pollMs);
        pollers.push(id);
      }
    });

    return () => {
      activeListeners.forEach(({ refPath, listener }) => off(ref(db, refPath), "value", listener));
      pollers.forEach((id) => window.clearInterval(id));
    };
  }, [applyEntityData, fetchEntity]);

  const refreshData = useCallback((entity?: string) => {
    if (!entity) {
      NODE_DEFS.forEach((node) => {
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
