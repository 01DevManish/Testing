"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { api } from "./data";
import MobileTopBar from "../../components/MobileTopBar";
import { Order, OrderStatus, ActiveView } from "./types";
import OrderList from "./components/Items/OrderList";
import Scanner from "./components/Box/Scanner";
import OrderDetailsModal from "./components/Items/OrderDetailsModal";
import AddOrderModal from "./components/Items/AddOrderModal";
import CreateDispatchModal from "./components/Dispatch/Createdispatchmodal";
import RapidEcomDispatch from "./components/Dispatch/RapidEcomDispatch";
import DispatchSidebar from "./components/Layout/DispatchSidebar";
import CatalogTab from "../inventory/components/Catalog/CatalogTab";
import MessagingTab from "../../components/MessagingTab";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "./components/ui";
import { hasPermission } from "../../lib/permissions";

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

export default function AdvancedDispatchDashboard() {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const { 
    orders: allOrders, setOrders, 
    products,
    loading: fetchingGlobal, refreshData: loadOrders,
    categories, collections, brands, users
  } = useData();

  // Filter for ecom dispatches
  const orders = useMemo(() => allOrders.filter(o => o.dispatchType === "ecom"), [allOrders]);
  const fetching = fetchingGlobal;

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "All">("All");

  // Layout State
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ecomDispatchSidebarCollapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("ecomDispatchSidebarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  // Scanner & Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [scannedUnknownId, setScannedUnknownId] = useState("");

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const handleScan = async (code: string) => {
    const order = orders.find(o => o.id.toUpperCase() === code.toUpperCase());
    if (order) {
      setSelectedOrder(order);
    } else {
      if (canCreate) {
        setScannedUnknownId(code);
        setActiveView("add-order");
      } else {
        alert("Found no order with this ID. You do not have permission to create a new one.");
      }
    }
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
  };

  const handleOrderAdded = (newOrder: Order) => {
    setOrders([newOrder, ...orders]);
    setActiveView("overview");
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

  // ── Granular Sub-Module Permissions ──────────────────────────
  const canViewPacking = hasPermission(userData, "ecom_packing_view");
  const canCreatePacking = hasPermission(userData, "ecom_packing_create");
  const canEditPacking = hasPermission(userData, "ecom_packing_edit");

  const canViewDispatch = hasPermission(userData, "ecom_dispatch_view");
  const canCreateDispatch = hasPermission(userData, "ecom_dispatch_create");
  const canEditDispatch = hasPermission(userData, "ecom_dispatch_edit");

  const canViewBox = hasPermission(userData, "ecom_box_view");
  const canCreateBox = hasPermission(userData, "ecom_box_create");
  const canEditBox = hasPermission(userData, "ecom_box_edit");

  // Legacy aliases for existing components
  const canView = canViewPacking || canViewDispatch || canViewBox || hasPermission(userData, "ecom_view");
  const canCreate = canCreatePacking || canCreateDispatch || hasPermission(userData, "ecom_create");
  const canEdit = canEditPacking || canEditDispatch || hasPermission(userData, "ecom_edit");
  const canDelete = userData?.role === "admin"; // Delete is admin-only

  const hasAccess = canView;

  useEffect(() => {
    if (!loading && user && !hasAccess) {
      const timer = setTimeout(() => router.replace("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, user, hasAccess, router]);

  if (loading) return null;
  if (!loading && user && !hasAccess) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "inherit" }}>
        <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", maxWidth: 420 }}>
          <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "#1e293b", margin: "0 0 10px" }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 20px" }}>You do not have the required permissions to access the Ecommerce Dispatch dashboard. Please contact your administrator.</p>
          <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Returning to dashboard...
          </div>
        </div>
      </div>
    );
  }

  const todayDate = new Date().toISOString().split('T')[0];
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "Pending").length,
    packed: orders.filter(o => o.status === "Packed").length,
    dispatchedToday: orders.filter(o => o.status === "Dispatched" && o.logs.some(l => l.status === "Dispatched" && l.timestamp.startsWith(todayDate))).length,
    failed: 0
  };

  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };
  const currentName = userData?.name || user?.name || "User";

  const SIDEBAR_WIDTH = 260;

  const S = {
    btnIcon: {
      width: 36, height: 36, borderRadius: 9, border: "1px solid #e2e8f0", 
      background: "#fff", cursor: "pointer", display: "flex", 
      alignItems: "center", justifyContent: "center", flexShrink: 0
    } as React.CSSProperties,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#f8fafc" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
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
          onNavigate={(view) => {
            setActiveView(view);
            if (!isDesktop) setSidebarOpen(false);
          }}
          currentName={currentName}
          currentRole={currentRole}
          onLogout={() => { logout(); router.replace("/"); }}
          userRoleColor={roleColors[currentRole] || "#6366f1"}
          onDashboardBack={() => router.push(userData?.role === "admin" ? "/dashboard/admin" : "/dashboard")}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isDesktop={isDesktop}
        />
      </div>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        marginLeft: isDesktop ? (isCollapsed ? 78 : 260) : 0,
        minHeight: "100vh", 
        transition: "margin-left 0.2s cubic-bezier(0, 0, 0.2, 1)",
        willChange: "margin-left"
      }}>
        <div style={{ padding: isMobile ? "20px 14px" : "28px 40px", maxWidth: 1600, margin: "0 auto" }}>
        {/* Mobile top bar */}
        {!isDesktop && (
          <MobileTopBar
            title="Ecom Dispatch"
            subtitle="Track ecommerce fulfillment"
            onMenuClick={() => setSidebarOpen(true)}
          />
        )}

        {activeView === "overview" && (
          <div className="animate-in fade-in duration-300">
            <PageHeader title="Ecommerce Dispatch" sub="Manage and track your Ecommerce fulfillment pipeline." />

            {/* NEW: Global Search on Overview */}
            <Card style={{ padding: "18px 20px", marginBottom: 24, background: "linear-gradient(to bottom right, #fff, #f8fafc)" }}>
               <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 280, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10 }}>
                     <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "#94a3b8" }}>
                        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M10 10L13.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                     </svg>
                     <input 
                        type="text" 
                        onChange={(e) => {
                           setSearchQuery(e.target.value);
                           if (e.target.value) setActiveView("order-list");
                        }}
                        style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14, fontFamily: "'Segoe UI', system-ui", color: "#1e293b" }}
                     />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                     {["Pending", "Packed", "Dispatched"].map(s => (
                        <button 
                           key={s} 
                           onClick={() => {
                              setFilterStatus(s as any);
                              setActiveView("order-list");
                           }}
                           style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 400, cursor: "pointer", transition: "all 0.15s" }}
                           onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                           onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                        >
                           {s}
                        </button>
                     ))}
                  </div>
               </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Today's Dispatched", value: stats.dispatchedToday, color: "emerald", icon: "🚚" },
                { label: "Pending Orders", value: stats.pending, color: "amber", icon: "🕒" },
                { label: "Ready to Ship", value: stats.packed, color: "indigo", icon: "📦" },
              ].map(s => (
                <Card key={s.label} style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f8fafc", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 400, color: "#1e293b", fontFamily: "'Segoe UI', system-ui" }}>{s.value}</div>
                  </div>
                </Card>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "2fr 1fr" : "1fr", gap: 24 }}>
              <div>
                <Card style={{ padding: 0, overflow: "hidden", minHeight: 300 }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 400, color: "#1e293b", margin: 0 }}>Recent Dispatches</h3>
                    <button onClick={() => setActiveView("order-list")} style={{ fontSize: 12, fontWeight: 400, color: "#6366f1", background: "none", border: "none", cursor: "pointer" }}>View All →</button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Order ID</th>
                          <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Party Name</th>
                          <th style={{ padding: "12px 20px", textAlign: "center", fontSize: 11, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Total Box</th>
                          <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Status</th>
                          <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 11, fontWeight: 400, color: "#64748b", textTransform: "uppercase" }}>Transporter</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => o.status === "Dispatched").slice(0, 6).length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>🚚</div>
                                    No recent dispatches found.
                                </td>
                            </tr>
                        ) : (
                            orders.filter(o => o.status === "Dispatched").slice(0, 6).map(o => (
                                <tr key={o.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                                  <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 400, color: "#475569" }}>#{o.id}</td>
                                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#64748b" }}>{o.partyName || o.customer?.name || "Unknown"}</td>
                                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#1e293b", fontWeight: 400, textAlign: "center" }}>{o.bails || 0}</td>
                                  <td style={{ padding: "12px 20px", fontSize: 11 }}>
                                      <span style={{ padding: "4px 10px", borderRadius: 20, background: "#eef2ff", color: "#6366f1", fontWeight: 400 }}>{o.status}</span>
                                  </td>
                                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#64748b", textAlign: "right", fontWeight: 400 }}>{o.courierPartner || o.transporterName || "—"}</td>
                                </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <div>
                <Card style={{ padding: "24px", height: "100%", background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "#fff", border: "none" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 400, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    Quick Actions
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button onClick={() => setActiveView("order-list")} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 400, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                      <span style={{ background: "rgba(139,92,246,0.2)", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📋</span>
                      Manage All Orders
                    </button>
                    <button onClick={() => setActiveView("scanner")} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 400, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                      <span style={{ background: "rgba(20,184,166,0.2)", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔍</span>
                      Barcode Scanner
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeView === "order-list" && (
          <div className="animate-in fade-in duration-300">
            <OrderList
              orders={orders}
              onSelectOrder={setSelectedOrder}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              onRefresh={loadOrders}
              loading={fetching}
              onDeleteOrder={canDelete ? handleDeleteOrder : undefined}
              canDelete={canDelete}
            />
          </div>
        )}

        {activeView === "scanner" && (
          <div className="animate-in fade-in duration-300">
             <PageHeader title="Scanner" sub="Scan barcodes to quickly find and process orders." />
             <Card style={{ padding: 24 }}>
               <Scanner onScan={handleScan} />
             </Card>
          </div>
        )}

        {activeView === "rapid-dispatch" && (
          <div className="animate-in fade-in duration-300">
            <RapidEcomDispatch
              onClose={() => setActiveView("overview")}
              onDispatched={() => {
                loadOrders();
              }}
            />
          </div>
        )}

        {activeView === "create-dispatch" && (
          <div className="max-w-3xl mx-auto pt-4 animate-in fade-in duration-300">
            <CreateDispatchModal
              dispatchType="ecom"
              onClose={() => setActiveView("overview")}
              onDispatched={(data) => {
                loadOrders();
                setActiveView("overview");
              }}
            />
          </div>
        )}

        {activeView === "add-order" && (
          <div className="max-w-3xl mx-auto pt-4 animate-in fade-in duration-300">
            <AddOrderModal
              initialOrderId={scannedUnknownId}
              onClose={() => setActiveView("overview")}
              onOrderAdded={handleOrderAdded}
            />
          </div>
        )}

        {activeView === "catalog" && (
          <div className="animate-in fade-in duration-300">
            <CatalogTab 
              products={products} 
              categories={categories}
              collections={collections}
              brands={brands}
              loading={fetching}
              isMobile={isMobile}
              isDesktop={isDesktop}
            />
          </div>
        )}

          {activeView === "messages" && (
            <MessagingTab users={users} isMobile={isMobile} />
          )}
        </div>
      </main>

      {/* Overlay Modals */}
      {selectedOrder && user && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={handleOrderUpdated}
          onDeleteOrder={canDelete ? handleDeleteOrder : undefined}
          user={{ uid: user.uid, name: currentName, role: currentRole }}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
