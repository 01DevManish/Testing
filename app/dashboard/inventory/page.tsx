"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ref, get, update, query, orderByChild, equalTo, remove } from "firebase/database";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { logActivity } from "../../lib/activityLogger";
import { hasPermission } from "../../lib/permissions";

import InventorySidebar from "./InventorySidebar";
import CreateProduct from "./CreateProduct";
import ProductList from "./ProductList";
import {
  CreateCategory, CategoryList,
  CreateCollection, CollectionList,
  CreateItemGroup, ItemGroupList,
  InventoryAdjustment, BarcodeView, Overview,
} from "./subviews";
import BulkUpload from "./BulkUpload";
import ShareModal from "./ShareModal";
import CatalogTab from "./CatalogTab";
import ImageGallery from "./ImageGallery";
import { uploadToCloudinary } from "./cloudinary";

// ── Types ─────────────────────────────────────────────────────
import { ActiveView, Product, Category, Collection, ItemGroup } from "./types";

// ── Shared UI ─────────────────────────────────────────────────
import { FONT } from "./types";

// ── Edit Product modal (lightweight wrapper) ──────────────────
import { Input, Textarea, Select, FormField, BtnPrimary, BtnGhost } from "./ui";
import { UNITS, GST_RATES, STATUS_CONFIG } from "./types";

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

  // ── Data from Global Cache ────────────────────────────────
  const { 
    products, setProducts,
    categories, setCategories,
    collections, setCollections,
    groups, setGroups,
    brands, setBrands,
    loading: fetching, refreshData 
  } = useData();

  // ── Edit modal ────────────────────────────────────────────
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editGallery, setEditGallery] = useState<string[]>([]);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [editSizeOption, setEditSizeOption] = useState("");
  const [editCustomSize, setEditCustomSize] = useState("");
  const [sharingProducts, setSharingProducts] = useState<Product[] | null>(null);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const brandRef = useRef<HTMLDivElement>(null);

  // Close brand dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { if (!loading && !user) router.replace("/"); }, [loading, user, router]);
  useEffect(() => { if (isDesktop) setSidebarOpen(false); }, [isDesktop]);

  // Permission check: only admin or users with "inventory_view" permission can access
  const hasAccess = hasPermission(userData, "inventory_view");
  useEffect(() => {
    if (!loading && user && !hasAccess) {
      const timer = setTimeout(() => router.replace("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, user, hasAccess, router]);

  const canCreate = hasPermission(userData, "inventory_create");
  const canEdit = hasPermission(userData, "inventory_edit");
  const canDelete = hasPermission(userData, "inventory_delete");

  const isAdminOrManager = userData?.role === "admin" || userData?.role === "manager";
  const currentName = userData?.name || user?.name || "User";
  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };

  const loadAll = useCallback(async () => {
    refreshData();
  }, [refreshData]);

  const productStubs = useMemo(() => 
    products.map(p => ({ 
      id: p.id, 
      productName: p.productName, 
      stock: p.stock, 
      unit: p.unit || "PCS", 
      minStock: p.minStock, 
      status: p.status,
      collection: p.collection,
      category: p.category
    })), 
    [products]
  );

  const handleLogout = async () => { await logout(); router.replace("/"); };

  const openEdit = (p: Product) => {
    if (!canEdit) return alert("You do not have permission to edit products.");
    setEditProduct(p);
    const standardSizes = ["Single", "Double", "King", "Super King"];
    const isStandard = standardSizes.includes(p.size || "");
    const sizeOpt = p.size ? (isStandard ? p.size : "Other") : "";
    
    setEditSizeOption(sizeOpt);
    setEditCustomSize(isStandard ? "" : (p.size || ""));

    setEditForm({
      productName: p.productName, sku: p.sku, styleId: p.styleId || "", category: p.category, collection: p.collection || "", brand: p.brand, brandId: p.brandId || "",
      price: p.price, wholesalePrice: p.wholesalePrice || 0, mrp: p.mrp || 0, costPrice: p.costPrice, stock: p.stock, minStock: p.minStock,
      status: p.status, imageUrl: p.imageUrl || "", description: p.description || "",
      unit: p.unit || "PCS", hsnCode: p.hsnCode || "", gstRate: p.gstRate ?? 18, size: p.size || "",
    });
    setEditGallery(p.imageUrls || (p.imageUrl ? [p.imageUrl] : []));
  };

  const handleEditSave = async () => {
    if (!editProduct || !editForm) return;
    setEditSaving(true);
    try {
      // SKU uniqueness check (if SKU changed)
      const sanitizedSku = editForm.sku.trim();
      if (sanitizedSku !== editProduct.sku) {
        const skuQuery = query(ref(db, "inventory"), orderByChild("sku"), equalTo(sanitizedSku));
        const skuSnap = await get(skuQuery);
        if (skuSnap.exists()) {
          alert("This SKU already exists for another product. Please use a unique SKU.");
          setEditSaving(false);
          return;
        }
      }

    let autoStatus = editForm.status;
    if (editForm.status === "active" || editForm.status === "low-stock" || editForm.status === "out-of-stock") {
         if (Number(editForm.stock) <= 0) autoStatus = "out-of-stock";
         else if (Number(editForm.stock) <= Number(editForm.minStock)) autoStatus = "low-stock";
         else autoStatus = "active";
    }

    let finalImageUrl = editForm.imageUrl;
    let finalImageUrls = editGallery;

    // Check if any gallery images are new (base64)
    const hasNewImages = editGallery.some(img => img.startsWith("data:"));
    if (hasNewImages) {
        const uploadPromises = editGallery.map(img => uploadToCloudinary(img));
        finalImageUrls = await Promise.all(uploadPromises);
        
        // Update main thumbnail if it was a base64 from gallery
        if (editForm.imageUrl.startsWith("data:")) {
            const idx = editGallery.indexOf(editForm.imageUrl);
            finalImageUrl = idx !== -1 ? finalImageUrls[idx] : finalImageUrls[0];
        }
    }
    
    const updated = { 
      ...editForm, 
      imageUrl: finalImageUrl,
      imageUrls: finalImageUrls,
      status: autoStatus, 
      price: Number(editForm.price), 
      wholesalePrice: Number(editForm.wholesalePrice || 0),
      mrp: Number(editForm.mrp || 0),
      costPrice: Number(editForm.costPrice), 
      stock: Number(editForm.stock), 
      minStock: Number(editForm.minStock), 
      gstRate: Number(editForm.gstRate), 
      updatedAt: Date.now(),
      updatedBy: user?.uid || "unknown",
      updatedByName: currentName
    };
      if (!user) throw new Error("User not authenticated");
      await update(ref(db, `inventory/${editProduct.id}`), updated);

      // Log activity
      await logActivity({
        type: "inventory",
        action: "update",
        title: "Product Updated",
        description: `Product "${updated.productName}" (SKU: ${updated.sku}) was updated by ${currentName}.`,
        userId: user.uid,
        userName: currentName,
        userRole: userData?.role || "staff",
        metadata: { productId: editProduct.id, oldStock: editProduct.stock, newStock: updated.stock }
      });

      const finalProducts = products.map(p => p.id === editProduct.id ? { ...p, ...updated } : p);
      setProducts(finalProducts);
      setEditProduct(null); setEditForm(null);
    } catch (err: any) {
      console.error("Update Error:", err);
      alert(err.message || "Failed to update product.");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading || !user) return null;

  // Show access denied UI if no inventory permission
  if (!hasAccess) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5", fontFamily: FONT }}>
        <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: "0 0 8px" }}>Access Denied</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>You do not have permission to access the Inventory page.</p>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }


  // ── Route view ─────────────────────────────────────────────
  const navigate = (view: ActiveView) => {
    setActiveView(view);
    if (!isDesktop) setSidebarOpen(false);
  };

  const renderView = () => {
    const commonProps = { isMobile, isDesktop };
    switch (activeView) {
      // ── Products ──────────────────────────────────────────
      case "product-create":
        return (
          <CreateProduct 
            categories={categories}
            collections={collections}
            brands={brands}
            user={{ uid: user.uid, name: currentName, role: currentRole }}
            onCreated={() => { 
                loadAll(); 
                setActiveView("product-list"); 
            }}
            {...commonProps}
          />
        );
      case "product-list":
        return (
          <ProductList
            products={products}
            categories={categories}
            collections={collections}
            user={{ uid: user.uid, name: currentName, role: currentRole }}
            loading={fetching}
            isAdminOrManager={isAdminOrManager}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEdit}
            onRefresh={loadAll}
            onCreateNew={() => navigate("product-create")}
            onProductsChange={setProducts}
            onShareCatalog={setSharingProducts}
            {...commonProps}
          />
        );
      // ── Categories ────────────────────────────────────────
      case "category-create":
        return <CreateCategory user={{ uid: user.uid, name: currentName }} onCreated={c => { setCategories(prev => [c, ...prev]); navigate("category-list"); }} {...commonProps} />;
      case "category-list":
        return <CategoryList categories={categories} user={{ uid: user.uid, name: currentName }} loading={fetching} canCreate={canCreate} canDelete={canDelete} onCreateNew={() => navigate("category-create")} {...commonProps} />;
      // ── Collections ───────────────────────────────────────
      case "collections-create":
        return <CreateCollection products={products} user={{ uid: user.uid, name: currentName }} onCreated={c => { setCollections(prev => [c, ...prev]); navigate("collections-list"); }} {...commonProps} />;
      case "collections-list":
        return <CollectionList collections={collections} user={{ uid: user.uid, name: currentName }} loading={fetching} products={products} canCreate={canCreate} canDelete={canDelete} onCreateNew={() => navigate("collections-create")} {...commonProps} />;
      // ── Inventory actions ─────────────────────────────────
      case "inventory-adjustment":
        return <InventoryAdjustment products={products} collections={collections} user={{ uid: user.uid, name: currentName }} onDone={loadAll} {...commonProps} />;
      case "inventory-barcode-create":
        return <BarcodeView products={products} collections={collections} user={{ uid: user.uid, name: currentName }} {...commonProps} />;
      case "inventory-barcode-print":
        return <BarcodeView products={products} collections={collections} user={{ uid: user.uid, name: currentName }} {...commonProps} />;
      // ── Overview ──────────────────────────────────────────
      case "overview":
        return <Overview products={products} categories={categories} collections={collections} loading={fetching} onNavigate={navigate} currentName={currentName} userRole={currentRole} canCreate={canCreate} {...commonProps} />;
      // ── Item Grouping ─────────────────────────────────────
      case "grouping-create":
        return <CreateItemGroup products={products} user={{ uid: user.uid, name: currentName }} onCreated={g => { setGroups(prev => [g, ...prev]); navigate("grouping-list"); }} {...commonProps} />;
      case "grouping-list":
        return <ItemGroupList groups={groups} user={{ uid: user.uid, name: currentName }} loading={fetching} products={products} canCreate={canCreate} canDelete={canDelete} onCreateNew={() => navigate("grouping-create")} {...commonProps} />;
      case "catalog":
        return <CatalogTab products={products} categories={categories} collections={collections} brands={brands} loading={fetching} {...commonProps} />;
      case "inventory-bulk":
        return <BulkUpload categories={categories} collections={collections} brands={brands} user={{ uid: user.uid, name: currentName, role: currentRole }} onDone={() => { loadAll(); navigate("product-list"); }} {...commonProps} />;
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
              <span style={{ fontSize: 15, fontWeight: 400, color: "#0f172a", fontFamily: FONT }}>Inventory</span>
            </div>
          )}

          {renderView()}
        </main>
      </div>

      {editProduct && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "26px 24px", maxWidth: 640, width: "100%", maxHeight: "92vh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>

            <button onClick={() => setEditProduct(null)} style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: 7, background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>

            <h3 style={{ fontSize: 17, fontWeight: 400, color: "#0f172a", margin: "0 0 20px", fontFamily: FONT }}>Edit Product</h3>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Item Name" required><Input value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })} /></FormField>
              <FormField label="SKU" required><Input value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} /></FormField>
              <FormField label="Style ID (3 Digits)">
                <Input
                  value={editForm.styleId || ""}
                  maxLength={3}
                  onChange={e => setEditForm({ ...editForm, styleId: e.target.value.replace(/\D/g, "") })}
                />
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Category"><Select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}><option value="">Select...</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</Select></FormField>
              <FormField label="Collection"><Select value={editForm.collection || ""} onChange={e => setEditForm({ ...editForm, collection: e.target.value })}><option value="">Select...</option>{collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</Select></FormField>
              <FormField label="Brand">
                <div ref={brandRef} style={{ position: "relative" }}>
                  <div 
                    onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                    style={{ 
                      width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", 
                      borderRadius: 10, fontSize: 14, background: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      minHeight: 44, transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {editForm.brandId ? (
                        <>
                          {brands.find(b => b.id === editForm.brandId)?.logoUrl && (
                            <img 
                              src={brands.find(b => b.id === editForm.brandId)?.logoUrl} 
                              alt="logo" 
                              style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4, background: "#f8fafc", padding: 2 }} 
                            />
                          )}
                          <span style={{ color: "#1e293b" }}>{editForm.brand}</span>
                        </>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Select Brand...</span>
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: "#94a3b8", transform: brandDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                  </div>

                  {brandDropdownOpen && (
                    <div style={{ 
                      position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 100,
                      maxHeight: 220, overflowY: "auto", padding: 4,
                      display: "flex", flexDirection: "column"
                    }}>
                      <div style={{ position: "sticky", top: 0, background: "#fff", padding: "2px 2px 4px", zIndex: 1 }}>
                        <input 
                          type="text" 
                          value={brandSearch}
                          autoFocus
                          onChange={e => setBrandSearch(e.target.value)}
                          style={{ 
                            width: "100%", padding: "6px 8px", border: "1px solid #f1f5f9", 
                            borderRadius: 6, fontSize: 12, outline: "none", background: "#f8fafc",
                            fontFamily: FONT
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div 
                        onClick={() => { setEditForm({ ...editForm, brandId: "", brand: "" }); setBrandDropdownOpen(false); setBrandSearch(""); }}
                        style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#64748b" }}
                        className="brand-opt"
                      >
                        No Brand
                      </div>
                      {brands
                        .filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                        .map(b => (
                        <div 
                          key={b.id}
                          onClick={() => { setEditForm({ ...editForm, brandId: b.id, brand: b.name }); setBrandDropdownOpen(false); setBrandSearch(""); }}
                          style={{ 
                            padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                            display: "flex", alignItems: "center", gap: 10,
                            background: editForm.brandId === b.id ? "rgba(99,102,241,0.05)" : "transparent",
                            color: editForm.brandId === b.id ? "#6366f1" : "#1e293b"
                          }}
                          className="brand-opt"
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 5, background: "#f8fafc", padding: 3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {b.logoUrl ? (
                              <img src={b.logoUrl} alt={b.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                            ) : (
                              <span style={{ fontSize: 12 }}>🏷️</span>
                            )}
                          </div>
                          <span style={{ fontWeight: editForm.brandId === b.id ? 500 : 400 }}>{b.name}</span>
                        </div>
                      ))}
                      {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: 15, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>No results</div>
                      )}
                    </div>
                  )}
                  <style>{`.brand-opt:hover { background: #f8fafc !important; }`}</style>
                </div>
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Selling Price"><Input type="number" min="0" value={editForm.price || ""} onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} /></FormField>
              <FormField label="Wholesale Price"><Input type="number" min="0" value={editForm.wholesalePrice || ""} onChange={e => setEditForm({ ...editForm, wholesalePrice: parseFloat(e.target.value) || 0 })} /></FormField>
              <FormField label="MRP"><Input type="number" min="0" value={editForm.mrp || ""} onChange={e => setEditForm({ ...editForm, mrp: parseFloat(e.target.value) || 0 })} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              {userData?.role === "admin" && (
                <FormField label="Cost Price"><Input type="number" min="0" value={editForm.costPrice || ""} onChange={e => setEditForm({ ...editForm, costPrice: Number(e.target.value) || 0 })} /></FormField>
              )}
              <FormField label="GST Rate"><Select value={editForm.gstRate} onChange={e => setEditForm({ ...editForm, gstRate: Number(e.target.value) })}>{GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</Select></FormField>
              <FormField label="Stock"><Input type="number" min="0" value={editForm.stock || ""} onChange={e => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Min Stock"><Input type="number" min="0" value={editForm.minStock || ""} onChange={e => setEditForm({ ...editForm, minStock: parseInt(e.target.value) || 0 })} /></FormField>
              <FormField label="Unit"><Select value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</Select></FormField>
              <FormField label="HSN Code"><Input value={editForm.hsnCode} onChange={e => setEditForm({ ...editForm, hsnCode: e.target.value })} /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px 1fr", gap: 20, marginBottom: 18 }}>
              {/* Main Thumbnail Section */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 10, fontFamily: FONT }}>Main Thumbnail</div>
                <div
                  onClick={() => editFileRef.current?.click()}
                  style={{
                    width: isMobile ? "160px" : "100%", aspectRatio: "1/1", borderRadius: 12, border: "2px dashed #e2e8f0",
                    background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", overflow: "hidden", position: "relative",
                    margin: isMobile ? "0 auto" : "0"
                  }}
                >
                  {editForm.imageUrl ? (
                    <img src={editForm.imageUrl} alt="Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center", padding: 10 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 4 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Set Primary</div>
                    </div>
                  )}
                  <input 
                    ref={editFileRef} 
                    type="file" 
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png" 
                    style={{ display: "none" }} 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          setEditForm({ ...editForm, imageUrl: result });
                          if (!editGallery.includes(result)) {
                            setEditGallery([result, ...editGallery]);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Gallery Section */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 400, color: "#0f172a", marginBottom: 10, fontFamily: FONT }}>Gallery Images</div>
                <ImageGallery 
                  images={editGallery} 
                  onImagesChange={(imgs) => {
                    setEditGallery(imgs);
                    if (imgs.length > 0 && editForm.imageUrl.startsWith("data:") && !imgs.includes(editForm.imageUrl)) {
                      setEditForm({ ...editForm, imageUrl: imgs[0] });
                    } else if (imgs.length === 0) {
                      setEditForm({ ...editForm, imageUrl: "" });
                    }
                  }} 
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="HSN Code"><Input value={editForm.hsnCode} onChange={e => setEditForm({ ...editForm, hsnCode: e.target.value })} /></FormField>
              <FormField label="Main Image URL (Manual)"><Input type="url" value={editForm.imageUrl.startsWith("data:") ? "" : editForm.imageUrl} onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })} /></FormField>
              <FormField label="Status">
                <Select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as Product["status"] })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="low-stock">Low Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                </Select>
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: editSizeOption === "Other" ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
              <FormField label="Size">
                <Select value={editSizeOption} onChange={e => {
                  const opt = e.target.value;
                  setEditSizeOption(opt);
                  if (opt !== "Other") {
                    setEditForm({ ...editForm, size: opt });
                    setEditCustomSize("");
                  } else {
                    setEditForm({ ...editForm, size: editCustomSize });
                  }
                }}>
                  <option value="">No specific size</option>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Queen">Queen</option>
                  <option value="King">King</option>
                  <option value="Super King">Super King</option>
                  <option value="Single Fitted">Single Fitted</option>
                  <option value="Double Fitted">Double Fitted</option>
                  <option value="Queen Fitted">Queen Fitted</option>
                  <option value="King Fitted">King Fitted</option>
                  <option value="Other">Other / Custom</option>
                </Select>
              </FormField>
              {editSizeOption === "Other" && (
                <FormField label="Custom Size">
                  <Input value={editCustomSize} onChange={e => {
                    setEditCustomSize(e.target.value);
                    setEditForm({ ...editForm, size: e.target.value });
                  }} />
                </FormField>
              )}
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

      {/* ── Share Catalog Modal ───────────────────────────────── */}
      {sharingProducts && (
        <ShareModal 
          selectedProducts={sharingProducts} 
          brands={brands}
          onClose={() => setSharingProducts(null)} 
        />
      )}
    </>
  );
}