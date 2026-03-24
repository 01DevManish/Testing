"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

// ── Types ──────────────────────────────────────────────────────
interface Product {
  id: string;
  productName: string;
  sku: string;
  category: string;
  brand: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  status: "active" | "inactive" | "out-of-stock";
  imageUrl: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SortKey = "productName" | "category" | "price" | "stock" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const CATEGORIES = ["Electronics", "Clothing", "Accessories", "Home & Kitchen", "Health & Beauty", "Sports", "Books", "Toys", "Food & Grocery", "Other"];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  inactive: { label: "Inactive", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  "out-of-stock": { label: "Out of Stock", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const emptyProduct: {
  productName: string; sku: string; category: string; brand: string;
  price: number; costPrice: number; stock: number; minStock: number;
  status: "active" | "inactive" | "out-of-stock";
  imageUrl: string; description: string;
} = {
  productName: "", sku: "", category: "", brand: "", price: 0, costPrice: 0,
  stock: 0, minStock: 5, status: "active", imageUrl: "", description: "",
};

// ── Responsive Hook ────────────────────────────────────────────
function useWindowSize() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ── Component ──────────────────────────────────────────────────
export default function InventoryPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const width = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "out-of-stock">("all");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");

  // Close sidebar on desktop
  useEffect(() => { if (isDesktop) setSidebarOpen(false); }, [isDesktop]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const isAdminOrManager = userData?.role === "admin" || userData?.role === "manager";
  const currentName = userData?.name || user?.name || "User";
  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };

  const loadProducts = useCallback(async () => {
    setFetching(true);
    try {
      const snap = await getDocs(collection(db, "inventory"));
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as Product));
      setProducts(list);
    } catch (err) { console.error(err); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const openAddModal = () => { setEditingProduct(null); setFormData(emptyProduct); setShowModal(true); };
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({ productName: p.productName, sku: p.sku, category: p.category, brand: p.brand, price: p.price, costPrice: p.costPrice, stock: p.stock, minStock: p.minStock, status: p.status, imageUrl: p.imageUrl || "", description: p.description || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.productName || !formData.sku) return;
    setSaving(true);
    const autoStatus: Product["status"] = formData.stock <= 0 ? "out-of-stock" : formData.status === "out-of-stock" ? "active" : formData.status;
    try {
      if (editingProduct) {
        const updated = { ...formData, status: autoStatus, price: Number(formData.price), costPrice: Number(formData.costPrice), stock: Number(formData.stock), minStock: Number(formData.minStock), updatedAt: Timestamp.now() };
        await updateDoc(doc(db, "inventory", editingProduct.id), updated);
        setProducts(products.map((p) => p.id === editingProduct.id ? { ...p, ...updated } : p));
      } else {
        const newDoc = { ...formData, status: autoStatus, price: Number(formData.price), costPrice: Number(formData.costPrice), stock: Number(formData.stock), minStock: Number(formData.minStock), createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
        const ref = await addDoc(collection(db, "inventory"), newDoc);
        setProducts([{ id: ref.id, ...newDoc } as Product, ...products]);
      }
      setShowModal(false); setFormData(emptyProduct); setEditingProduct(null);
    } catch (err) { console.error(err); alert("Failed to save product."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product permanently?")) return;
    try {
      await deleteDoc(doc(db, "inventory", id));
      setProducts(products.filter((p) => p.id !== id));
      selectedIds.delete(id); setSelectedIds(new Set(selectedIds));
    } catch (err) { console.error(err); }
  };

  const toggleSelect = (id: string) => { const next = new Set(selectedIds); next.has(id) ? next.delete(id) : next.add(id); setSelectedIds(next); };
  const toggleSelectAll = () => { selectedIds.size === filteredProducts.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredProducts.map((p) => p.id))); };

  const executeBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    if (bulkAction === "delete") {
      if (!confirm(`Delete ${selectedIds.size} products?`)) return;
      try { await Promise.all(Array.from(selectedIds).map((id) => deleteDoc(doc(db, "inventory", id)))); setProducts(products.filter((p) => !selectedIds.has(p.id))); setSelectedIds(new Set()); }
      catch (err) { console.error(err); }
    } else {
      try { await Promise.all(Array.from(selectedIds).map((id) => updateDoc(doc(db, "inventory", id), { status: bulkAction, updatedAt: Timestamp.now() }))); setProducts(products.map((p) => selectedIds.has(p.id) ? { ...p, status: bulkAction as Product["status"], updatedAt: Timestamp.now() } : p)); setSelectedIds(new Set()); }
      catch (err) { console.error(err); }
    }
    setBulkAction("");
  };

  const exportCSV = () => {
    const headers = ["Product Name", "SKU", "Category", "Brand", "Price", "Cost Price", "Stock", "Min Stock", "Status"];
    const rows = filteredProducts.map((p) => [p.productName, p.sku, p.category, p.brand, p.price, p.costPrice, p.stock, p.minStock, p.status]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (searchTerm) { const q = searchTerm.toLowerCase(); list = list.filter((p) => p.productName?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)); }
    if (filterCategory !== "all") list = list.filter((p) => p.category === filterCategory);
    if (filterStatus !== "all") list = list.filter((p) => p.status === filterStatus);
    list.sort((a, b) => {
      let va: any = a[sortKey]; let vb: any = b[sortKey];
      if (sortKey === "createdAt") { va = va?.seconds || 0; vb = vb?.seconds || 0; }
      if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [products, searchTerm, filterCategory, filterStatus, sortKey, sortDir]);

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } };

  const stats = {
    total: products.length,
    inStock: products.filter((p) => p.status === "active" && p.stock > 0).length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= (p.minStock || 5)).length,
    outOfStock: products.filter((p) => p.stock <= 0 || p.status === "out-of-stock").length,
  };

  const handleLogout = async () => { await logout(); router.replace("/"); };

  if (loading || !user) return null;

  const SIDEBAR_W = 240;

  // ── Styles ────────────────────────────────────────────────────
  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc" } as React.CSSProperties,

    sidebar: {
      width: SIDEBAR_W,
      background: "linear-gradient(180deg,#0f172a 0%,#1e293b 100%)",
      display: "flex", flexDirection: "column" as const,
      padding: "20px 14px",
      position: "fixed" as const, top: 0, left: 0, bottom: 0,
      zIndex: 200,
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      transform: !isDesktop && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
      overflowY: "auto" as const,
    } as React.CSSProperties,

    overlay: {
      position: "fixed" as const, inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 199, backdropFilter: "blur(4px)",
      display: !isDesktop && sidebarOpen ? "block" : "none",
    } as React.CSSProperties,

    main: {
      flex: 1,
      marginLeft: isDesktop ? SIDEBAR_W : 0,
      padding: isMobile ? "16px 14px 28px" : isTablet ? "20px 20px 28px" : "28px 32px 32px",
      minHeight: "100vh",
      boxSizing: "border-box" as const,
      maxWidth: "100%",
      overflow: "hidden",
    } as React.CSSProperties,

    statsGrid: {
      display: "grid",
      gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
      gap: isMobile ? 10 : 14,
      marginBottom: isMobile ? 16 : 22,
    } as React.CSSProperties,

    statCard: {
      background: "#fff", borderRadius: 14,
      padding: isMobile ? "14px 12px" : "20px 18px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      position: "relative" as const, overflow: "hidden" as const,
    } as React.CSSProperties,

    statStripe: (g: string) => ({ position: "absolute" as const, top: 0, left: 0, right: 0, height: 3, background: g, borderRadius: "14px 14px 0 0" }),

    tableContainer: {
      background: "#fff", borderRadius: 14,
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      overflow: "hidden" as const,
    } as React.CSSProperties,

    th: {
      padding: isMobile ? "10px 12px" : "13px 18px",
      textAlign: "left" as const, fontSize: 11, fontWeight: 500,
      textTransform: "uppercase" as const, letterSpacing: "0.08em",
      color: "#94a3b8", borderBottom: "1px solid #e2e8f0",
      background: "#fafbfc", cursor: "pointer",
      userSelect: "none" as const, whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    td: {
      padding: isMobile ? "12px 12px" : "14px 18px",
      fontSize: 13, color: "#475569",
      borderBottom: "1px solid #f1f5f9",
      verticalAlign: "middle" as const,
    } as React.CSSProperties,

    btnPrimary: {
      padding: isMobile ? "9px 13px" : "9px 18px",
      background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff",
      border: "none", borderRadius: 10,
      fontSize: isMobile ? 13 : 14, fontWeight: 500,
      fontFamily: "inherit", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnSecondary: {
      padding: isMobile ? "8px 12px" : "9px 16px",
      background: "#fff", color: "#475569",
      border: "1px solid #e2e8f0", borderRadius: 10,
      fontSize: isMobile ? 13 : 14, fontWeight: 500,
      fontFamily: "inherit", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnDanger: {
      padding: "6px 12px",
      background: "rgba(239,68,68,0.08)", color: "#ef4444",
      border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8,
      fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 4,
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    btnIcon: {
      minWidth: 36, height: 36, borderRadius: 9,
      background: "#f8fafc", border: "1px solid #e2e8f0",
      color: "#64748b", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontFamily: "inherit", fontWeight: 600, padding: "0 10px",
    } as React.CSSProperties,

    badge: (color: string, bg: string) => ({
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 500, color, background: bg,
      border: `1px solid ${color}20`, whiteSpace: "nowrap" as const,
    }),

    input: {
      width: "100%", padding: isMobile ? "9px 12px" : "10px 13px",
      background: "#f8fafc", border: "1.5px solid #e2e8f0",
      borderRadius: 10, color: "#1e293b",
      fontSize: 14, fontFamily: "inherit", outline: "none",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    label: { display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 5 } as React.CSSProperties,

    modalOverlay: {
      position: "fixed" as const, inset: 0,
      background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)",
      zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
      padding: isMobile ? 10 : 24,
    } as React.CSSProperties,

    modalCard: {
      background: "#fff", borderRadius: 18,
      padding: isMobile ? "20px 16px" : "28px 26px",
      maxWidth: 640, width: "100%",
      boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
      position: "relative" as const, maxHeight: "92vh", overflowY: "auto" as const,
    } as React.CSSProperties,

    navBtn: (active: boolean) => ({
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 9, border: "none",
      background: active ? "rgba(99,102,241,0.15)" : "transparent",
      color: active ? "#a5b4fc" : "#94a3b8",
      fontSize: 14, fontWeight: active ? 600 : 400,
      fontFamily: "inherit", cursor: "pointer", textAlign: "left" as const,
      ...(active ? { borderLeft: "3px solid #818cf8", paddingLeft: 9 } : {}),
    } as React.CSSProperties),
  };

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  // Mobile product card
  const ProductCard = ({ p }: { p: Product }) => {
    const isLow = p.stock > 0 && p.stock <= (p.minStock || 5);
    const sc = statusConfig[p.status] || statusConfig.active;
    return (
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Image */}
          <div style={{ width: 46, height: 46, borderRadius: 10, background: p.imageUrl ? "transparent" : "linear-gradient(135deg,#e2e8f0,#cbd5e1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
            {p.imageUrl ? <img src={p.imageUrl} alt={p.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: 20 }}>📦</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>SKU: {p.sku}{p.brand ? ` · ${p.brand}` : ""}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={S.badge(sc.color, sc.bg)}>{sc.label}</span>
              {isLow && <span style={S.badge("#f59e0b", "rgba(245,158,11,0.1)")}>Low Stock</span>}
              {p.category && <span style={{ padding: "2px 8px", background: "#f1f5f9", borderRadius: 6, fontSize: 11, color: "#475569" }}>{p.category}</span>}
            </div>
          </div>
          {isAdminOrManager && (
            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
              style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer", flexShrink: 0, marginTop: 2 }} />
          )}
        </div>
        {/* Price + Stock row */}
        <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 1 }}>Price</div>
            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 14 }}>₹{Number(p.price || 0).toLocaleString("en-IN")}</div>
            {p.costPrice > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>Cost: ₹{Number(p.costPrice).toLocaleString("en-IN")}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 1 }}>Stock</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: isLow ? "#f59e0b" : p.stock <= 0 ? "#ef4444" : "#1e293b" }}>{p.stock}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Min: {p.minStock || 5}</div>
          </div>
          {isAdminOrManager && (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", paddingBottom: 2 }}>
              <button onClick={() => openEditModal(p)} style={{ ...S.btnSecondary, padding: "5px 10px", fontSize: 12 }}>Edit</button>
              <button onClick={() => handleDelete(p.id)} style={{ ...S.btnDanger, padding: "5px 10px" }}>Del</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }
        input:focus, select:focus, textarea:focus { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .inv-row:hover { background:#f8fafc !important; }
        .inv-th:hover { background:#f1f5f9 !important; }
      `}</style>

      <div style={S.page}>
        {/* Overlay */}
        <div style={S.overlay} onClick={() => setSidebarOpen(false)} />

        {/* =================== SIDEBAR =================== */}
        <aside style={S.sidebar}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px", marginBottom: 28 }}>
            <img src="/logo.png" alt="Logo" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Eurus Lifestyle</div>
              <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Inventory</div>
            </div>
          </div>

          <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 10px", marginBottom: 6 }}>Navigation</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <button onClick={() => { router.push(userData?.role === "admin" ? "/dashboard/admin" : "/dashboard"); if (!isDesktop) setSidebarOpen(false); }} style={S.navBtn(false)}>Dashboard</button>
            <button onClick={() => { router.push("/dashboard/advanced-dispatch"); if (!isDesktop) setSidebarOpen(false); }} style={S.navBtn(false)}>Dispatch</button>
            <button style={S.navBtn(true)}>Inventory</button>
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ padding: "14px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 11, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: roleColors[currentRole] || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 }}>{currentName[0]?.toUpperCase() || "U"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 600, textTransform: "capitalize" }}>{currentRole}</div>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", width: "100%" }}>
            ⎋ Sign Out
          </button>
        </aside>

        {/* =================== MAIN =================== */}
        <main style={S.main}>

          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 16 : 24, gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Inventory</h1>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}>Manage products, stock and pricing</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
              {isAdminOrManager && (
                <button onClick={openAddModal} style={S.btnPrimary}>
                  <span style={{ fontSize: 15 }}>+</span>{!isMobile && " Add Product"}
                </button>
              )}
              {!isMobile && <button onClick={exportCSV} style={S.btnSecondary}>Export CSV</button>}
              <button onClick={loadProducts} style={S.btnSecondary}>↻{!isMobile && " Refresh"}</button>
              {/* Hamburger on non-desktop */}
              {!isDesktop && (
                <button onClick={() => setSidebarOpen(true)} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>☰</button>
              )}
            </div>
          </div>

          {/* ========== STATS ========== */}
          <div style={S.statsGrid}>
            {[
              { label: "Total Products", value: stats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
              { label: "In Stock", value: stats.inStock, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
              { label: "Low Stock", value: stats.lowStock, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
              { label: "Out of Stock", value: stats.outOfStock, gradient: "linear-gradient(135deg,#ef4444,#f97316)" },
            ].map((s, i) => (
              <div key={i} style={S.statCard}>
                <div style={S.statStripe(s.gradient)} />
                <div style={{ width: isMobile ? 32 : 38, height: isMobile ? 32 : 38, borderRadius: 9, background: s.gradient, marginBottom: isMobile ? 8 : 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#1e293b", lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
                <div style={{ fontSize: isMobile ? 10 : 12, color: "#94a3b8", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ========== TABLE CARD ========== */}
          <div style={S.tableContainer}>

            {/* Header row: title + filters */}
            <div style={{ padding: isMobile ? "14px 14px 10px" : "18px 22px 14px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>All Products</h2>
                {isMobile && isAdminOrManager && (
                  <button onClick={exportCSV} style={{ ...S.btnSecondary, padding: "6px 10px", fontSize: 12 }}>Export CSV</button>
                )}
              </div>

              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 10 }}>
                <span style={{ color: "#94a3b8", fontSize: 14, flexShrink: 0 }}>🔍</span>
                <input type="text" placeholder="Search name, SKU, brand..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", color: "#1e293b", fontSize: 13, width: "100%", fontFamily: "inherit" }} />
                {searchTerm && <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>}
              </div>

              {/* Filters row — scrollable on mobile */}
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" as const, alignItems: "center" }}>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                  style={{ padding: "7px 28px 7px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, color: "#475569", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none" as const, flexShrink: 0, minWidth: 130 }}>
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                {(["all", "active", "inactive", "out-of-stock"] as const).map((f) => (
                  <button key={f} onClick={() => setFilterStatus(f)}
                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap", flexShrink: 0, border: `1.5px solid ${filterStatus === f ? "#6366f1" : "#e2e8f0"}`, background: filterStatus === f ? "rgba(99,102,241,0.08)" : "#fff", color: filterStatus === f ? "#6366f1" : "#94a3b8" }}>
                    {f === "all" ? "All" : statusConfig[f]?.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && isAdminOrManager && (
              <div style={{ padding: "10px 16px", background: "rgba(99,102,241,0.04)", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#6366f1" }}>{selectedIds.size} selected</span>
                <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
                  style={{ padding: "6px 24px 6px 10px", fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none" as const }}>
                  <option value="">Choose action...</option>
                  <option value="active">Set Active</option>
                  <option value="inactive">Set Inactive</option>
                  <option value="delete">Delete Selected</option>
                </select>
                <button onClick={executeBulkAction} disabled={!bulkAction} style={{ ...S.btnPrimary, padding: "6px 14px", fontSize: 12, opacity: !bulkAction ? 0.5 : 1 }}>Apply</button>
                <button onClick={() => setSelectedIds(new Set())} style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 12 }}>Clear</button>
              </div>
            )}

            {/* Content */}
            {fetching ? (
              <div style={{ padding: "56px 20px", textAlign: "center", color: "#64748b", fontSize: 14 }}>
                <div style={{ width: 30, height: 30, margin: "0 auto 12px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
                Loading inventory...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: "56px 20px", textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>📦</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>No products found</div>
                <div style={{ fontSize: 13 }}>{products.length === 0 ? "Add your first product to get started." : "Try adjusting your search or filters."}</div>
              </div>
            ) : isMobile ? (
              // ── Mobile card list ──
              <>
                {isAdminOrManager && (
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll}
                      style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Select all</span>
                  </div>
                )}
                {filteredProducts.map((p) => <ProductCard key={p.id} p={p} />)}
              </>
            ) : (
              // ── Tablet / Desktop table ──
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isTablet ? 560 : "auto" }}>
                  <thead>
                    <tr>
                      {isAdminOrManager && (
                        <th style={{ ...S.th, width: 40, textAlign: "center", paddingLeft: 16 }}>
                          <input type="checkbox" checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll}
                            style={{ cursor: "pointer", width: 15, height: 15, accentColor: "#6366f1" }} />
                        </th>
                      )}
                      <th className="inv-th" style={S.th} onClick={() => handleSort("productName")}>Product{sortArrow("productName")}</th>
                      {!isTablet && <th className="inv-th" style={S.th} onClick={() => handleSort("category")}>Category{sortArrow("category")}</th>}
                      <th className="inv-th" style={S.th} onClick={() => handleSort("price")}>Price{sortArrow("price")}</th>
                      <th className="inv-th" style={S.th} onClick={() => handleSort("stock")}>Stock{sortArrow("stock")}</th>
                      <th className="inv-th" style={S.th} onClick={() => handleSort("status")}>Status{sortArrow("status")}</th>
                      {isAdminOrManager && <th style={{ ...S.th, textAlign: "right" }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const isLow = p.stock > 0 && p.stock <= (p.minStock || 5);
                      const sc = statusConfig[p.status] || statusConfig.active;
                      return (
                        <tr key={p.id} className="inv-row">
                          {isAdminOrManager && (
                            <td style={{ ...S.td, textAlign: "center", width: 40, paddingLeft: 16 }}>
                              <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                                style={{ cursor: "pointer", width: 15, height: 15, accentColor: "#6366f1" }} />
                            </td>
                          )}
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: isTablet ? 36 : 42, height: isTablet ? 36 : 42, borderRadius: 9, background: p.imageUrl ? "transparent" : "linear-gradient(135deg,#e2e8f0,#cbd5e1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid #e2e8f0" }}>
                                {p.imageUrl ? <img src={p.imageUrl} alt={p.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: 18 }}>📦</span>}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isTablet ? 140 : 200 }}>{p.productName}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                                  SKU: {p.sku}{p.brand && !isTablet ? ` · ${p.brand}` : ""}
                                </div>
                                {isTablet && p.category && <span style={{ padding: "1px 6px", background: "#f1f5f9", borderRadius: 5, fontSize: 10, color: "#475569", display: "inline-block", marginTop: 2 }}>{p.category}</span>}
                              </div>
                            </div>
                          </td>
                          {!isTablet && (
                            <td style={S.td}>
                              <span style={{ padding: "3px 9px", background: "#f1f5f9", borderRadius: 7, fontSize: 11, fontWeight: 500, color: "#475569" }}>{p.category || "—"}</span>
                            </td>
                          )}
                          <td style={S.td}>
                            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>₹{Number(p.price || 0).toLocaleString("en-IN")}</div>
                            {p.costPrice > 0 && !isTablet && <div style={{ fontSize: 10, color: "#94a3b8" }}>Cost: ₹{Number(p.costPrice).toLocaleString("en-IN")}</div>}
                          </td>
                          <td style={S.td}>
                            <div style={{ fontWeight: 700, color: isLow ? "#f59e0b" : p.stock <= 0 ? "#ef4444" : "#1e293b", fontSize: 14 }}>{p.stock}</div>
                            {isLow && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 500 }}>Low</div>}
                            {p.stock <= 0 && <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 500 }}>Empty</div>}
                          </td>
                          <td style={S.td}>
                            <span style={S.badge(sc.color, sc.bg)}>{sc.label}</span>
                          </td>
                          {isAdminOrManager && (
                            <td style={{ ...S.td, textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                <button onClick={() => openEditModal(p)} style={{ ...S.btnSecondary, padding: "5px 11px", fontSize: 12 }}>Edit</button>
                                <button onClick={() => handleDelete(p.id)} style={S.btnDanger}>Del</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            {!fetching && filteredProducts.length > 0 && (
              <div style={{ padding: isMobile ? "10px 14px" : "12px 22px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#94a3b8", flexWrap: "wrap", gap: 6 }}>
                <span>Showing {filteredProducts.length} of {products.length} products</span>
                <span>Value: ₹{filteredProducts.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.stock) || 0), 0).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        </main>

        {/* =================== ADD / EDIT MODAL =================== */}
        {showModal && (
          <div style={S.modalOverlay} onClick={() => setShowModal(false)}>
            <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowModal(false)}
                style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}>✕</button>

              <h3 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: "#0f172a", margin: "0 0 20px", letterSpacing: "-0.01em" }}>
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>

              {/* Row 1: Name + SKU */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={S.label}>Product Name *</label><input type="text" placeholder="e.g. Wireless Earbuds" value={formData.productName} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>SKU *</label><input type="text" placeholder="e.g. WE-001" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} style={S.input} /></div>
              </div>

              {/* Row 2: Category + Brand */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={S.label}>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ ...S.input, appearance: "none" as const, paddingRight: 32, cursor: "pointer" }}>
                    <option value="">Select Category...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Brand</label><input type="text" placeholder="e.g. Sony" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} style={S.input} /></div>
              </div>

              {/* Row 3: Price + Cost */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={S.label}>Selling Price (₹)</label><input type="number" min="0" step="0.01" placeholder="0" value={formData.price || ""} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                <div><label style={S.label}>Cost Price (₹)</label><input type="number" min="0" step="0.01" placeholder="0" value={formData.costPrice || ""} onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
              </div>

              {/* Row 4: Stock + Min */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={S.label}>Current Stock</label><input type="number" min="0" placeholder="0" value={formData.stock || ""} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} style={S.input} /></div>
                <div><label style={S.label}>Min Stock (Alert)</label><input type="number" min="0" placeholder="5" value={formData.minStock || ""} onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })} style={S.input} /></div>
              </div>

              {/* Row 5: Status + Image */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={S.label}>Status</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["active", "inactive"] as const).map((s) => (
                      <button key={s} onClick={() => setFormData({ ...formData, status: s })}
                        style={{ flex: 1, padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", border: `1.5px solid ${formData.status === s ? statusConfig[s].color : "#e2e8f0"}`, background: formData.status === s ? statusConfig[s].bg : "#fff", color: formData.status === s ? statusConfig[s].color : "#94a3b8" }}>
                        {statusConfig[s].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label style={S.label}>Image URL</label><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} style={S.input} /></div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>Description</label>
                <textarea placeholder="Product description..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" as const }} />
              </div>

              {/* Margin preview */}
              {formData.price > 0 && formData.costPrice > 0 && (
                <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 9, marginBottom: 18, display: "flex", gap: 20, fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>Profit: <strong style={{ color: "#10b981" }}>₹{(formData.price - formData.costPrice).toLocaleString("en-IN")}</strong></span>
                  <span style={{ color: "#64748b" }}>Margin: <strong style={{ color: "#10b981" }}>{(((formData.price - formData.costPrice) / formData.price) * 100).toFixed(1)}%</strong></span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowModal(false)} style={S.btnSecondary}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !formData.productName || !formData.sku}
                  style={{ ...S.btnPrimary, opacity: (saving || !formData.productName || !formData.sku) ? 0.5 : 1 }}>
                  {saving ? <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite", display: "inline-block" }} /> : (editingProduct ? "Update Product" : "Add Product")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}