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

export default function AdvancedDispatchDashboard() {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();

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

  useEffect(() => {
    loadOrders();
    // Allow public access for testing (remove this rule in production)
  }, []);

  const handleScan = async (code: string) => {
    const order = orders.find(o => o.id.toUpperCase() === code.toUpperCase());
    
    if (order) {
      setSelectedOrder(order);
    } else {
      // If code not found, prompt to create/import it
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
    setSelectedOrder(newOrder); // Automatically open the newly created order
  };

  if (loading) return null;

  const todayDate = new Date().toISOString().split('T')[0];
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "Pending").length,
    packed: orders.filter(o => o.status === "Packed").length,
    dispatchedToday: orders.filter(o => o.status === "Dispatched" && o.logs.some(l => l.status === "Dispatched" && l.timestamp.startsWith(todayDate))).length,
    failed: 0 // Mock failed count
  };

  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };
  const currentName = userData?.name || "User";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const S = {
    sidebar: { width: 260, background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", display: "flex", flexDirection: "column" as const, padding: "24px 16px", position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 100, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)" } as React.CSSProperties,
    sidebarMobileOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99, backdropFilter: "blur(4px)" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,
  };

  return (
    <div className="bg-gray-50 flex flex-col md:flex-row font-sans" style={{ minHeight: "100vh", fontFamily: "inherit" }}>
      {sidebarOpen && <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* =================== SIDEBAR =================== */}
      <aside style={{ ...S.sidebar, ...(typeof window !== "undefined" && window.innerWidth < 768 && !sidebarOpen ? { transform: "translateX(-100%)" } : {}) }}>
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
          <button onClick={() => router.push(userData?.role === "admin" ? "/dashboard/admin" : "/dashboard")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
            Dashboard
          </button>
          
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #818cf8", paddingLeft: 11 }}>
            Advanced Dispatch
          </button>
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: roleColors[currentRole] || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>{currentName[0]?.toUpperCase() || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
              <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, textTransform: "capitalize" }}>{currentRole}</div>
            </div>
          </div>
        </div>
        <button onClick={() => { logout(); router.replace("/"); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 min-h-screen" style={{ marginLeft: typeof window !== "undefined" && window.innerWidth >= 768 ? 260 : 0 }}>
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ ...S.btnIcon, display: typeof window !== "undefined" && window.innerWidth < 768 ? "flex" : "none", width: 40, height: 40, marginTop: 4 }}>☰</button>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Dispatch Overview</h1>
                <p className="text-gray-500 mt-1 font-medium">Manage and track your entire fulfillment pipeline.</p>
              </div>
            </div>
            <div className="flex gap-3">
               <button onClick={() => { setScannedUnknownId(""); setShowAddModal(true); }} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2">
                 <span>+</span> Add Order
               </button>
               <button onClick={loadOrders} className="px-5 py-2.5 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2">
                 Refresh
               </button>
            </div>
          </div>

          {/* Stats Widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl"></div>
              <div>
                <p className="text-sm font-bold text-gray-400">Total Orders</p>
                <h3 className="text-2xl font-black text-gray-800">{stats.total}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-500 flex items-center justify-center text-2xl"></div>
              <div>
                <p className="text-sm font-bold text-gray-400">Pending</p>
                <h3 className="text-2xl font-black text-gray-800">{stats.pending}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl"></div>
              <div>
                <p className="text-sm font-bold text-gray-400">Dispatched Today</p>
                <h3 className="text-2xl font-black text-gray-800">{stats.dispatchedToday}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-2xl"></div>
              <div>
                <p className="text-sm font-bold text-gray-400">Failed Prints</p>
                <h3 className="text-2xl font-black text-gray-800">{stats.failed}</h3>
              </div>
            </div>
          </div>

          {/* Scanner & Table Section */}
          <div className="grid grid-cols-1 gap-6">
            <Scanner onScan={handleScan} />

            {fetching ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium">Loading orders...</p>
              </div>
            ) : (
              <div className="h-[600px]">
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

      {/* Modals */}
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
    </div>
  );
}
