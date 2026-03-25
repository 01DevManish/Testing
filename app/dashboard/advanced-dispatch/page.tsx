"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { api } from "./data";
import { Order, OrderStatus } from "./types";
import OrderList from "./components/OrderList";
import Scanner from "./components/Scanner";
import OrderDetailsModal from "./components/OrderDetailsModal";
import AddOrderModal from "./components/AddOrderModal";
import CreateDispatchModal from "./components/Createdispatchmodal"; // ← NEW

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

  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "All">("All");

  // Scanner & Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Add Order Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [scannedUnknownId, setScannedUnknownId] = useState("");

  // Create Dispatch Wizard
  const [showCreateDispatch, setShowCreateDispatch] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadOrders = async () => {
    setFetching(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const handleScan = async (code: string) => {
    const order = orders.find(o => o.id.toUpperCase() === code.toUpperCase());
    if (order) {
      setSelectedOrder(order);
    } else {
      setScannedUnknownId(code);
      setShowAddModal(true);
    }
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
  };

  const handleOrderAdded = (newOrder: Order) => {
    setOrders([newOrder, ...orders]);
    setShowAddModal(false);
    setScannedUnknownId("");
    setSelectedOrder(newOrder);
  };

  // Permission check: only admin or users with "dispatch" permission can access
  const hasAccess = userData?.role === "admin" || userData?.permissions?.includes("dispatch");
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
        <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>Access Denied</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>You do not have permission to access the Dispatch page.</p>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>Redirecting to dashboard...</p>
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
    sidebar: {
      width: SIDEBAR_WIDTH,
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      display: "flex",
      flexDirection: "column" as const,
      padding: "24px 16px",
      position: "fixed" as const,
      top: 0, left: 0, bottom: 0,
      zIndex: 100,
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      transform: (!isDesktop && !sidebarOpen) ? "translateX(-100%)" : "translateX(0)",
    } as React.CSSProperties,
    sidebarMobileOverlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 99,
      backdropFilter: "blur(4px)",
      display: (!isDesktop && sidebarOpen) ? "block" : "none",
    } as React.CSSProperties,
    main: {
      flex: 1,
      marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
      padding: isMobile ? "70px 16px 32px" : "28px 32px 32px",
      minHeight: "100vh",
      transition: "margin-left 0.3s"
    } as React.CSSProperties,
    btnIcon: {
      width: 36, height: 36, borderRadius: 10, background: "#f8fafc",
      border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.2s", fontSize: 16
    } as React.CSSProperties,
  };

  return (
    <div className="bg-gray-50 flex flex-col font-sans" style={{ minHeight: "100vh", fontFamily: "inherit" }}>
      {/* Sidebar Overlay */}
      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

      {/* =================== SIDEBAR =================== */}
      <aside style={S.sidebar}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Logistics Hub</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => router.push(userData?.role === "admin" ? "/dashboard/admin" : "/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Dashboard
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #818cf8", paddingLeft: 11 }}>
            Advanced Dispatch
          </button>
          {(userData?.role === "admin" || userData?.permissions?.includes("inventory")) && (
            <button onClick={() => router.push("/dashboard/inventory")}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Inventory
            </button>
          )}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleColors[currentRole] || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>
              {currentName[0]?.toUpperCase() || "U"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, textTransform: "capitalize" }}>{currentRole}</div>
            </div>
          </div>
        </div>
        <button onClick={() => { logout(); router.replace("/"); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main style={S.main}>
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Page Header ────────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {!isDesktop && (
                <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>☰</button>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Dispatch Overview</h1>
                <p className="text-gray-500 mt-1 font-medium">Manage and track your entire fulfillment pipeline.</p>
              </div>
            </div>

            {/* ── Action Buttons ──────────────────────────────────────────── */}
            <div className="flex gap-3 flex-wrap">
              {/* ★ CREATE DISPATCH — Primary CTA */}
              <button
                onClick={() => setShowCreateDispatch(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "#fff", fontWeight: 800, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 4px 15px rgba(99,102,241,0.35)",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 18 }}>🚀</span>
                Create Dispatch
              </button>

              <button
                onClick={() => { setScannedUnknownId(""); setShowAddModal(true); }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2"
              >
                <span>+</span> Add Order
              </button>

              <button
                onClick={loadOrders}
                className="px-5 py-2.5 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* ── Stats Widgets ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Today's Dispatched", value: stats.dispatchedToday, color: "emerald", icon: "🚚" },
              { label: "Previous Day Dispatched", value: stats.pending, color: "yellow", icon: "⏳" },
              { label: "Total Dispatched", value: stats.total, color: "indigo", icon: "📦" },
            ].map(s => (
              <div key={s.label} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-${s.color}-50 text-${s.color}-500 flex items-center justify-center text-2xl`}>{s.icon}</div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                  <h3 className="text-2xl font-black text-gray-800">{s.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* ── Scanner & Table Section ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6">
            <Scanner onScan={handleScan} />

            {fetching ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium">Loading orders...</p>
              </div>
            ) : (
              <div style={{ height: isMobile ? "auto" : "600px" }}>
                <OrderList
                  orders={orders}
                  onSelectOrder={setSelectedOrder}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* ★ Create Dispatch — 8-step wizard */}
      {showCreateDispatch && (
        <CreateDispatchModal
          onClose={() => setShowCreateDispatch(false)}
          onDispatched={(data) => {
            console.log("Dispatch created:", data);
            loadOrders(); // refresh order list after dispatch
          }}
        />
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={handleOrderUpdated}
        />
      )}

      {showAddModal && (
        <AddOrderModal
          initialOrderId={scannedUnknownId}
          onClose={() => setShowAddModal(false)}
          onOrderAdded={handleOrderAdded}
        />
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}