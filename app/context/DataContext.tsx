"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "../lib/firebase";
import { ref, onValue, off } from "firebase/database";
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
    const loadFromCache = (key: string, setter: (data: any) => void) => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setter(parsed);
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

    const pCached = loadFromCache(CACHE_KEYS.PRODUCTS, setProducts);
    const paCached = loadFromCache(CACHE_KEYS.PARTIES, setPartyRates);
    const uCached = loadFromCache(CACHE_KEYS.USERS, setUsers);
    const bCached = loadFromCache(CACHE_KEYS.BRANDS, setBrands);
    const cCached = loadFromCache(CACHE_KEYS.CATEGORIES, setCategories);
    const colCached = loadFromCache(CACHE_KEYS.COLLECTIONS, setCollections);
    const gCached = loadFromCache(CACHE_KEYS.GROUPS, setGroups);
    const oCached = loadFromCache(CACHE_KEYS.ORDERS, setOrders);
    const parCached = loadFromCache(CACHE_KEYS.PARTIES_MASTER, setParties);
    const tCached = loadFromCache(CACHE_KEYS.TRANSPORTERS, setTransporters);

    // If we have some cached data, we can stop "initial" loading immediately
    if (pCached || paCached || uCached || oCached) {
      setLoading(false);
    }
  }, []);

  // 2. Real-time Listeners (Background Sync)
  useEffect(() => {
    const listeners: { path: string; setter: (data: any) => void; cacheKey: string }[] = [
      { path: "inventory", setter: setProducts, cacheKey: CACHE_KEYS.PRODUCTS },
      { path: "partyRates", setter: setPartyRates, cacheKey: CACHE_KEYS.PARTIES },
      { path: "users", setter: setUsers, cacheKey: CACHE_KEYS.USERS },
      { path: "brands", setter: setBrands, cacheKey: CACHE_KEYS.BRANDS },
      { path: "categories", setter: setCategories, cacheKey: CACHE_KEYS.CATEGORIES },
      { path: "collections", setter: setCollections, cacheKey: CACHE_KEYS.COLLECTIONS },
      { path: "itemGroups", setter: setGroups, cacheKey: CACHE_KEYS.GROUPS },
      { path: "dispatches", setter: setOrders, cacheKey: CACHE_KEYS.ORDERS },
      { path: "parties", setter: setParties, cacheKey: CACHE_KEYS.PARTIES_MASTER },
      { path: "transporters", setter: setTransporters, cacheKey: CACHE_KEYS.TRANSPORTERS },
    ];

    const activeListeners: any[] = [];

    listeners.forEach(({ path, setter, cacheKey }) => {
      const dbRef = ref(db, path);
      const listener = onValue(dbRef, (snapshot) => {
        const val = snapshot.val();
        let data: any[] = [];
        
        if (snapshot.exists() && val) {
          data = Object.entries(val).map(([key, record]: [string, any]) => ({
            ...record,
            id: key,
            uid: record.uid || key // Force UID if missing
          }));
        }
        
        setter(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        setLoading(false);
      });
      activeListeners.push({ ref: dbRef, listener });
    });

    return () => {
      activeListeners.forEach(({ ref: r, listener: l }) => off(r, "value", l));
    };
  }, []);

  const refreshData = (entity?: string) => {
    // This could trigger a manual re-fetch if needed, 
    // but onValue handles it automatically.
    console.log("Data auto-synced by Firebase real-time listeners.");
  };

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
