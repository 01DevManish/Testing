"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { api } from "./data";
import { Order, OrderStatus, ActiveView } from "./types";
import OrderList from "./components/Items/OrderList";
import Scanner from "./components/Box/Scanner";
import OrderDetailsModal from "./components/Items/OrderDetailsModal";
import AddOrderModal from "./components/Items/AddOrderModal";
import CreateDispatchModal from "./components/Dispatch/Createdispatchmodal";
import CreatePackingList from "./components/Packaging/CreatePackingList";
import AllPackingLists from "./components/Packaging/AllPackingLists";
import TransportersTab from "./components/Packaging/TransportersTab";
import CreateDispatchList from "./components/Dispatch/CreateDispatchList";
import AllDispatchLists from "./components/Dispatch/AllDispatchLists";
import BoxManagementTab from "./components/Box/BoxManagementTab";
import DispatchBoxTab from "./components/Box/DispatchBoxTab";
import AllBoxDispatchesTab from "./components/Box/AllBoxDispatchesTab";
import PackingListDetailsModal from "./components/Packaging/PackingListDetailsModal";
import NotificationBell from "../../components/NotificationBell";
import MobileTopBar from "../../components/MobileTopBar";
import DispatchSidebar from "./components/Layout/DispatchSidebar";
import { PageHeader, Card } from "./components/ui";
import RetailDispatchOverviewDesktop from "./components/desktop/RetailDispatchOverview";
import RetailDispatchOverviewMobile from "./components/mobile/RetailDispatchOverview";
import type { RetailDispatchOverviewStats } from "./components/overviewTypes";
import { hasPermission } from "../../lib/permissions";
import MessagingTab from "../../components/MessagingTab";
import CatalogTab from "../inventory/components/Catalog/CatalogTab";

// Responsive hook
function useWindowSize() {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 1200 });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

function AdvancedDispatchDashboardContent() {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isDesktop = width >= 1024;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("retailDispatchSidebarCollapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("retailDispatchSidebarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  const {
    orders: allOrders, setOrders,
    packingLists, setPackingLists,
    products,
    users,
    categories, collections, brands,
    loading: fetchingGlobal, refreshData: loadOrders
  } = useData();

  const orders = useMemo(() => allOrders.filter(o => o.dispatchType === "retail" || !o.dispatchType), [allOrders]);
  const visiblePackingLists = useMemo(() => {
    const isAdmin = userData?.role === "admin";
    if (isAdmin) return packingLists;
    const currentUid = String(userData?.uid || user?.uid || "").trim();
    if (!currentUid) return [];
    return packingLists.filter((list) => String(list.assignedTo || "").trim() === currentUid);
  }, [packingLists, userData?.role, userData?.uid, user?.uid]);
  const fetching = fetchingGlobal;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "All">("All");
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [scannedUnknownId, setScannedUnknownId] = useState("");
  const [editingPackingList, setEditingPackingList] = useState<any>(null);
  const [viewingPackingList, setViewingPackingList] = useState<any>(null);
  const [statsDate, setStatsDate] = useState(new Date().toISOString().split('T')[0]);
  const viewQueryMap: Record<string, ActiveView> = useMemo(() => ({
    overview: "overview",
    "create-dispatch": "create-dispatch",
    "order-list": "order-list",
    "add-order": "add-order",
    scanner: "scanner",
    "create-packing-list": "create-packing-list",
    "all-packing-lists": "all-packing-lists",
    "packing-transporters": "packing-transporters",
    "create-dispatch-list": "create-dispatch-list",
    "all-dispatch-lists": "all-dispatch-lists",
    "box-management": "box-management",
    "dispatch-box": "dispatch-box",
    "all-box-dispatches": "all-box-dispatches",
    catalog: "catalog",
    messages: "messages",
  }), []);

  useEffect(() => {
    const raw = (searchParams.get("view") || "").trim().toLowerCase();
    const mapped = viewQueryMap[raw] || "overview";
    setActiveView((prev) => (prev === mapped ? prev : mapped));
  }, [searchParams, viewQueryMap]);

  const debugMode = searchParams.get("debug") === "1";

  const goToView = (nextView: ActiveView) => {
    setActiveView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    router.replace(`/dashboard/retail-dispatch?${params.toString()}`);
  };

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const handleScan = async (code: string) => {
    const order = orders.find(o => o.id.toUpperCase() === code.toUpperCase());
    if (order) {
      setSelectedOrder(order);
    } else {
      setScannedUnknownId(code);
      goToView("add-order");
    }
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
  };

  const handleOrderAdded = (newOrder: Order) => {
    setOrders([newOrder, ...orders]);
    goToView("overview");
    setScannedUnknownId("");
    setSelectedOrder(newOrder);
  };

  const handleDeleteOrder = async (id: string) => {
    if (!user) return;
    try {
      await api.deleteOrder(id, { uid: user.uid, name: currentName, role: currentRole });
      setOrders(orders.filter(o => o.id !== id));
      if (selectedOrder?.id === id) setSelectedOrder(null);
    } catch (e) {
      alert("Failed to delete dispatch record.");
    }
  };

  const handleDeletePackingList = async (id: string) => {
    if (!user) return;
    try {
      await api.deletePackingList(id, { uid: user.uid, name: currentName, role: currentRole });
      setPackingLists(packingLists.filter(l => l.id !== id));
    } catch (e) {
      alert("Failed to delete packing list.");
    }
  };

  // ── Granular Sub-Module Permissions ──────────────────────────
  const canViewPacking = hasPermission(userData, "retail_packing_view");
  const canCreatePacking = hasPermission(userData, "retail_packing_create");
  const canEditPacking = hasPermission(userData, "retail_packing_edit");

  const canViewDispatch = hasPermission(userData, "retail_dispatch_view");
  const canCreateDispatch = hasPermission(userData, "retail_dispatch_create");
  const canEditDispatch = hasPermission(userData, "retail_dispatch_edit");

  const canViewBox = hasPermission(userData, "retail_box_view");
  const canCreateBox = hasPermission(userData, "retail_box_create");
  const canEditBox = hasPermission(userData, "retail_box_edit");

  useEffect(() => {
    if (!debugMode) return;
    console.log("[RetailDispatch Debug]", {
      activeView,
      role: userData?.role,
      uid: userData?.uid || user?.uid || null,
      permissions: userData?.permissions || [],
      canViewPacking,
      canCreatePacking,
      canEditPacking,
      canViewDispatch,
      canCreateDispatch,
      canEditDispatch,
      canViewBox,
      canCreateBox,
      canEditBox,
    });
  }, [
    debugMode,
    activeView,
    userData,
    user,
    canViewPacking,
    canCreatePacking,
    canEditPacking,
    canViewDispatch,
    canCreateDispatch,
    canEditDispatch,
    canViewBox,
    canCreateBox,
    canEditBox,
  ]);

  // Legacy aliases for existing components
  const canView = canViewPacking || canViewDispatch || canViewBox || hasPermission(userData, "retail_view");
  const canCreate = canCreatePacking || canCreateDispatch || hasPermission(userData, "retail_create");
  const canEdit = canEditPacking || canEditDispatch || hasPermission(userData, "retail_edit");
  const canDelete = userData?.role === "admin"; // Delete is admin-only
  const hasAccess = canView;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && !hasAccess) {
      const timer = setTimeout(() => router.replace("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, user, hasAccess, router]);

  const overviewDispatches = useMemo(() => (
    visiblePackingLists
      .filter((list) => {
        const matchesStatus = list.status === "Packed" || list.status === "Completed";
        const matchesDate = Boolean(list.dispatchedAt) && new Date(list.dispatchedAt || 0).toISOString().split('T')[0] === statsDate;
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const matchesSearch = !normalizedSearch ||
          list.partyName?.toLowerCase().includes(normalizedSearch) ||
          list.dispatchId?.toLowerCase().includes(normalizedSearch) ||
          list.id?.toLowerCase().includes(normalizedSearch) ||
          list.lrNo?.toLowerCase().includes(normalizedSearch);

        return matchesStatus && matchesDate && matchesSearch;
      })
      .sort((first, second) => (Number(second.dispatchedAt) || 0) - (Number(first.dispatchedAt) || 0))
  ), [visiblePackingLists, searchQuery, statsDate]);

  if (loading) return null;
  if (!user) return null;
  if (!loading && user && !hasAccess) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "inherit" }}>
        <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.45)", border: "1px solid #e2e8f0", maxWidth: 420 }}>
          <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "#1e293b", margin: "0 0 10px" }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 20px" }}>You do not have the required permissions to access the Retail Dispatch dashboard.</p>
          <div style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  const todayDate = new Date().toISOString().split('T')[0];
  const stats: RetailDispatchOverviewStats = {
    todayPacking: visiblePackingLists.filter(l => new Date(l.createdAt).toISOString().split('T')[0] === todayDate).length,
    todayDispatch: visiblePackingLists.filter(l => (l.status === "Packed" || l.status === "Completed") && l.dispatchedAt && new Date(l.dispatchedAt).toISOString().split('T')[0] === todayDate).length,
    totalDispatch: visiblePackingLists.filter(l => (l.status === "Packed" || l.status === "Completed") && l.dispatchedAt).length,
    pending: visiblePackingLists.filter((list) => {
      const isCancelled = list.status === "Cancelled";
      const isDispatched = Boolean(list.dispatchedAt);
      return !isCancelled && !isDispatched;
    }).length,
  };

  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };
  const currentName = userData?.name || user?.name || "User";

  const handleOrderStatusNavigate = (status: OrderStatus | "All") => {
    setFilterStatus(status);
    goToView("order-list");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#ffffff" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .no-focus-ring:focus { outline: none !important; border-color: #cbd5e1 !important; box-shadow: none !important; }
      `}</style>

      {/* Mobile overlay */}
      {!isDesktop && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 199,
            backdropFilter: "blur(8px)",
            opacity: sidebarOpen ? 1 : 0,
            visibility: sidebarOpen ? "visible" : "hidden",
            transition: "all 0.2s cubic-bezier(0, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Sidebar wrapper */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, bottom: 0, zIndex: 200,
        width: isDesktop ? (isCollapsed ? 78 : 260) : 280,
        transform: isDesktop ? "translateX(0)" : (sidebarOpen ? "translateX(0)" : "translateX(-100%)"),
        transition: "width 0.2s cubic-bezier(0, 0, 0.2, 1), transform 0.2s cubic-bezier(0, 0, 0.2, 1)",
        boxShadow: (!isDesktop && sidebarOpen) ? "20px 0 40px rgba(0,0,0,0.3)" : "none",
      }}>
        <DispatchSidebar
          activeView={activeView}
          onNavigate={(v) => { goToView(v); if (!isDesktop) setSidebarOpen(false); }}
          currentName={currentName}
          currentRole={currentRole}
          onLogout={async () => {
            await logout();
            router.replace("/");
          }}
          userRoleColor={roleColors[currentRole] || "#6366f1"}
          onDashboardBack={() => router.push(userData?.role === "admin" ? "/dashboard/admin" : "/dashboard")}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isDesktop={isDesktop}
        />
      </div>

      {/* Main content */}
      <main style={{
        flex: 1,
        marginLeft: isDesktop ? (isCollapsed ? 78 : 260) : 0,
        padding: isMobile ? "20px 14px" : "28px 40px",
        minHeight: "100vh",
        transition: "margin-left 0.2s cubic-bezier(0, 0, 0.2, 1)",
        willChange: "margin-left"
      }}>
        <div style={{ maxWidth: 1600, margin: "0 auto" }}>
          {debugMode && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fdba74", color: "#7c2d12", fontSize: 12 }}>
              <strong>Retail Debug</strong>: view={activeView} | role={String(userData?.role || "")} | packing(view/create/edit)=
              {String(canViewPacking)}/{String(canCreatePacking)}/{String(canEditPacking)} | dispatch(view/create/edit)=
              {String(canViewDispatch)}/{String(canCreateDispatch)}/{String(canEditDispatch)} | box(view/create/edit)=
              {String(canViewBox)}/{String(canCreateBox)}/{String(canEditBox)}
            </div>
          )}
          {isMobile && (
            <MobileTopBar
              title="Retail Dispatch"
              subtitle="Track retail fulfillment"
              onMenuClick={() => setSidebarOpen(true)}
              rightSlot={<NotificationBell />}
            />
          )}
          {activeView === "overview" && (
            isMobile ? (
              <RetailDispatchOverviewMobile
                stats={stats}
                statsDate={statsDate}
                searchQuery={searchQuery}
                dispatches={overviewDispatches}
                canCreatePacking={canCreatePacking}
                canCreateDispatch={canCreateDispatch}
                canViewDispatch={canViewDispatch}
                canViewBox={canViewBox}
                onStatsDateChange={setStatsDate}
                onSearchQueryChange={setSearchQuery}
                onClearSearch={() => setSearchQuery("")}
                onNavigate={goToView}
                onOrderStatusNavigate={handleOrderStatusNavigate}
              />
            ) : (
              <RetailDispatchOverviewDesktop
                stats={stats}
                statsDate={statsDate}
                searchQuery={searchQuery}
                dispatches={overviewDispatches}
                canCreatePacking={canCreatePacking}
                canCreateDispatch={canCreateDispatch}
                canViewDispatch={canViewDispatch}
                canViewBox={canViewBox}
                onStatsDateChange={setStatsDate}
                onSearchQueryChange={setSearchQuery}
                onClearSearch={() => setSearchQuery("")}
                onNavigate={goToView}
                onOrderStatusNavigate={handleOrderStatusNavigate}
              />
            )
          )}
          {activeView === "order-list" && <OrderList orders={orders} onSelectOrder={setSelectedOrder} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterStatus={filterStatus} setFilterStatus={setFilterStatus} onRefresh={loadOrders} loading={fetching} onDeleteOrder={canDelete ? handleDeleteOrder : undefined} canDelete={canDelete} />}
          {activeView === "scanner" && <div className="animate-in fade-in duration-300"><PageHeader title="Scanner" sub="Scan barcodes..." /><Card style={{ padding: 24 }}><Scanner onScan={handleScan} /></Card></div>}
          {activeView === "create-dispatch" && <div className="max-w-3xl mx-auto pt-4 animate-in fade-in duration-300"><CreateDispatchModal dispatchType="retail" onClose={() => goToView("overview")} onDispatched={() => { loadOrders(); goToView("overview"); }} /></div>}
          {activeView === "add-order" && <div className="max-w-3xl mx-auto pt-4 animate-in fade-in duration-300"><AddOrderModal initialOrderId={scannedUnknownId} onClose={() => goToView("overview")} onOrderAdded={handleOrderAdded} /></div>}
          {activeView === "create-packing-list" && <div className="max-w-6xl mx-auto pt-4 animate-in fade-in duration-300"><CreatePackingList editingList={editingPackingList} onClose={() => { goToView("overview"); setEditingPackingList(null); }} onCreated={() => { goToView("all-packing-lists"); setEditingPackingList(null); loadOrders(); }} /></div>}
          {activeView === "create-dispatch-list" && <div className="max-w-6xl mx-auto pt-4 animate-in fade-in duration-300"><CreateDispatchList onClose={() => goToView("overview")} onCreated={() => { goToView("overview"); loadOrders(); }} /></div>}
          {activeView === "all-packing-lists" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <AllPackingLists
                onEdit={(list) => { setEditingPackingList(list); goToView("create-packing-list"); }}
                onView={(list) => setViewingPackingList(list)}
                onDelete={handleDeletePackingList}
                canDelete={canDelete}
              />
            </div>
          )}
          {activeView === "packing-transporters" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <TransportersTab onUpdated={loadOrders} />
            </div>
          )}
          {activeView === "all-dispatch-lists" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <AllDispatchLists />
            </div>
          )}
          {activeView === "box-management" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <BoxManagementTab packingLists={visiblePackingLists} products={products} />
            </div>
          )}
          {activeView === "dispatch-box" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <DispatchBoxTab products={products} />
            </div>
          )}
          {activeView === "all-box-dispatches" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <AllBoxDispatchesTab packingLists={visiblePackingLists} products={products} />
            </div>
          )}
          {activeView === "catalog" && (
            <CatalogTab
              products={products}
              categories={categories}
              collections={collections}
              brands={brands}
              loading={fetching}
              isMobile={isMobile}
              isDesktop={isDesktop}
            />
          )}
          {activeView === "messages" && (
            <MessagingTab users={users} isMobile={isMobile} />
          )}
        </div>
      </main>

      {selectedOrder && user && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onOrderUpdated={handleOrderUpdated} onDeleteOrder={canDelete ? handleDeleteOrder : undefined} user={{ uid: user.uid, name: currentName, role: currentRole }} canEdit={canEdit} canDelete={canDelete} />}

      {viewingPackingList && (
        <PackingListDetailsModal
          list={viewingPackingList}
          onClose={() => setViewingPackingList(null)}
        />
      )}
    </div>
  );
}

export default function AdvancedDispatchDashboard() {
  return (
    <Suspense fallback={null}>
      <AdvancedDispatchDashboardContent />
    </Suspense>
  );
}

