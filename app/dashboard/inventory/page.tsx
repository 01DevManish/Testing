"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ref, get, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

// ── Local components ──────────────────────────────────────────
import InventorySidebar from "./InventorySidebar";
import CreateProduct from "./CreateProduct";
import ProductList from "./ProductList";
import {
  CreateCategory, CategoryList,
  CreateCollection, CollectionList,
  CreateItemGroup, ItemGroupList,
  InventoryAdjustment, BarcodeView, Overview,
} from "./subviews";

// ── Types ─────────────────────────────────────────────────────
import { ActiveView, Product, Category, Collection, ItemGroup } from "./types";

// ── Shared UI ─────────────────────────────────────────────────
import { FONT } from "./types";

// ── Edit Product modal (lightweight wrapper) ──────────────────
import { Input, Textarea, Select, FormField, BtnPrimary, BtnGhost } from "./ui";
import { CATEGORIES, UNITS, GST_RATES, STATUS_CONFIG } from "./types";

// ── Responsive hook ───────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ═══════════════════════════════════════════════════════════════
export default function InventoryPage() {
  const { user, userData, logout, loading } = useAuth();
  const router = useRouter();
  const width = useWindowWidth();
  const isMobile = width < 640;
  const isDesktop = width >= 1024;

  // ── Sidebar ───────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("overview");

  // ── Data ──────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [fetching, setFetching] = useState(true);

  // ── Edit modal ────────────────────────────────────────────
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/"); }, [loading, user, router]);
  useEffect(() => { if (isDesktop) setSidebarOpen(false); }, [isDesktop]);

  // Permission check: only admin or users with "inventory" permission can access
  const hasAccess = userData?.role === "admin" || userData?.permissions?.includes("inventory");
  useEffect(() => {
    if (!loading && user && !hasAccess) {
      const timer = setTimeout(() => router.replace("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, user, hasAccess, router]);

  const isAdminOrManager = userData?.role === "admin" || userData?.role === "manager";
  const currentName = userData?.name || user?.name || "User";
  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };

  const loadAll = useCallback(async () => {
    setFetching(true);
    try {
      const [pSnap, cSnap, colSnap, gSnap] = await Promise.all([
        get(ref(db, "inventory")),
        get(ref(db, "categories")),
        get(ref(db, "collections")),
        get(ref(db, "itemGroups")),
      ]);
      const toList = (snap: any) => {
        const arr: any[] = [];
        if (snap.exists()) {
          snap.forEach((d: any) => { arr.push({ id: d.key, ...d.val() }); });
        }
        return arr;
      };
      setProducts(toList(pSnap));
      setCategories(toList(cSnap));
      setCollections(toList(colSnap));
      setGroups(toList(gSnap));
    } catch (err) { console.error(err); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLogout = async () => { await logout(); router.replace("/"); };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      productName: p.productName, sku: p.sku, category: p.category, brand: p.brand,
      price: p.price, costPrice: p.costPrice, stock: p.stock, minStock: p.minStock,
      status: p.status, imageUrl: p.imageUrl || "", description: p.description || "",
      unit: p.unit || "PCS", hsnCode: p.hsnCode || "", gstRate: p.gstRate ?? 18,
    });
  };

  const handleEditSave = async () => {
    if (!editProduct || !editForm) return;
    setEditSaving(true);
    try {
      let autoStatus = editForm.status;
      if (editForm.status === "active" || editForm.status === "low-stock" || editForm.status === "out-of-stock") {
           if (Number(editForm.stock) <= 0) autoStatus = "out-of-stock";
           else if (Number(editForm.stock) <= Number(editForm.minStock)) autoStatus = "low-stock";
           else autoStatus = "active";
      }
      
      const updated = { ...editForm, status: autoStatus, price: Number(editForm.price), costPrice: Number(editForm.costPrice), stock: Number(editForm.stock), minStock: Number(editForm.minStock), gstRate: Number(editForm.gstRate), updatedAt: Date.now() };
      await update(ref(db, `inventory/${editProduct.id}`), updated);
      setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...updated } : p));
      setEditProduct(null); setEditForm(null);
    } catch (err) { console.error(err); alert("Failed to update."); }
    finally { setEditSaving(false); }
  };

  if (loading || !user) return null;

  // Show access denied UI if no inventory permission
  if (!hasAccess) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5", fontFamily: FONT }}>
        <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>Access Denied</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>You do not have permission to access the Inventory page.</p>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const productStubs = products.map(p => ({ id: p.id, productName: p.productName, stock: p.stock, unit: p.unit || "PCS", minStock: p.minStock, status: p.status }));

  // ── Route view ─────────────────────────────────────────────
  const navigate = (view: ActiveView) => {
    setActiveView(view);
    if (!isDesktop) setSidebarOpen(false);
  };

  const renderView = () => {
    switch (activeView) {
      // ── Products ──────────────────────────────────────────
      case "product-create":
        return (
          <CreateProduct 
            onCreated={() => { 
                loadAll(); 
                setActiveView("product-list"); 
            }} 
          />
        );
      case "product-list":
        return (
          <ProductList
            products={products}
            loading={fetching}
            isAdminOrManager={isAdminOrManager}
            onEdit={openEdit}
            onRefresh={loadAll}
            onCreateNew={() => navigate("product-create")}
            onProductsChange={setProducts}
          />
        );
      // ── Categories ────────────────────────────────────────
      case "category-create":
        return <CreateCategory onCreated={c => { setCategories(prev => [c, ...prev]); navigate("category-list"); }} />;
      case "category-list":
        return <CategoryList categories={categories} loading={fetching} onCreateNew={() => navigate("category-create")} />;
      // ── Collections ───────────────────────────────────────
      case "collections-create":
        return <CreateCollection products={productStubs} onCreated={c => { setCollections(prev => [c, ...prev]); navigate("collections-list"); }} />;
      case "collections-list":
        return <CollectionList collections={collections} loading={fetching} onCreateNew={() => navigate("collections-create")} />;
      // ── Inventory actions ─────────────────────────────────
      case "inventory-adjustment":
        return <InventoryAdjustment products={products} collections={collections} onDone={loadAll} />;
      case "inventory-barcode-create":
        return <BarcodeView mode="create" />;
      case "inventory-barcode-print":
        return <BarcodeView mode="print" />;
      // ── Overview ──────────────────────────────────────────
      case "overview":
        return <Overview products={products} />;
      // ── Item Grouping ─────────────────────────────────────
      case "grouping-create":
        return <CreateItemGroup products={productStubs} onCreated={g => { setGroups(prev => [g, ...prev]); navigate("grouping-list"); }} />;
      case "grouping-list":
        return <ItemGroupList groups={groups} loading={fetching} onCreateNew={() => navigate("grouping-create")} />;
      default:
        return null;
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", fontFamily: FONT, background: "#f0f2f5" }}>

        {/* Mobile overlay */}
        {!isDesktop && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199, backdropFilter: "blur(3px)" }} />
        )}

        {/* Sidebar — fixed on desktop, sliding on mobile */}
        <div style={{
          position: isDesktop ? "fixed" : "fixed",
          top: 0, left: 0, bottom: 0, zIndex: 200,
          transform: !isDesktop && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <InventorySidebar
            activeView={activeView}
            onNavigate={navigate}
            currentName={currentName}
            currentRole={currentRole}
            onLogout={handleLogout}
            userRoleColor={roleColors[currentRole] || "#6366f1"}
            onDashboardBack={() => router.push(userData?.role === "admin" ? "/dashboard/admin" : "/dashboard")}
          />
        </div>

        {/* Main content */}
        <main style={{
          flex: 1,
          marginLeft: isDesktop ? 260 : 0,
          padding: isMobile ? "16px 14px 32px" : "28px 32px 32px",
          minHeight: "100vh", maxWidth: "100%", overflow: "hidden",
        }}>
          {/* Mobile top bar */}
          {!isDesktop && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <button onClick={() => setSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h12M2 12h8" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: FONT }}>Inventory</span>
            </div>
          )}

          {renderView()}
        </main>
      </div>

      {/* ── Edit Product Modal ─────────────────────────────────── */}
      {editProduct && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setEditProduct(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "26px 24px", maxWidth: 640, width: "100%", maxHeight: "92vh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>

            <button onClick={() => setEditProduct(null)} style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: 7, background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>

            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "0 0 20px", fontFamily: FONT }}>Edit Product</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Product Name" required><Input value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })} /></FormField>
              <FormField label="SKU" required><Input value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Category"><Select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></FormField>
              <FormField label="Brand"><Input value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Selling Price"><Input type="number" min="0" value={editForm.price || ""} onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} /></FormField>
              <FormField label="Cost Price"><Input type="number" min="0" value={editForm.costPrice || ""} onChange={e => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) || 0 })} /></FormField>
              <FormField label="GST Rate"><Select value={editForm.gstRate} onChange={e => setEditForm({ ...editForm, gstRate: Number(e.target.value) })}>{GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</Select></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Stock"><Input type="number" min="0" value={editForm.stock || ""} onChange={e => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })} /></FormField>
              <FormField label="Min Stock"><Input type="number" min="0" value={editForm.minStock || ""} onChange={e => setEditForm({ ...editForm, minStock: parseInt(e.target.value) || 0 })} /></FormField>
              <FormField label="Unit"><Select value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</Select></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="HSN Code"><Input placeholder="e.g. 6205" value={editForm.hsnCode} onChange={e => setEditForm({ ...editForm, hsnCode: e.target.value })} /></FormField>
              <FormField label="Image URL"><Input type="url" placeholder="https://..." value={editForm.imageUrl} onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })} /></FormField>
              <FormField label="Status">
                <Select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as Product["status"] })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="low-stock">Low Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                </Select>
              </FormField>
            </div>
            <div style={{ marginBottom: 18 }}>
              <FormField label="Description"><Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={2} /></FormField>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <BtnGhost onClick={() => setEditProduct(null)}>Cancel</BtnGhost>
              <BtnPrimary onClick={handleEditSave} loading={editSaving}>Update Product</BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </>
  );
}