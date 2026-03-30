"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { api } from "./data";
import { Order, OrderStatus, ActiveView } from "./types";
import OrderList from "./components/OrderList";
import Scanner from "./components/Scanner";
import OrderDetailsModal from "./components/OrderDetailsModal";
import AddOrderModal from "./components/AddOrderModal";
import CreateDispatchModal from "./components/Createdispatchmodal";
import RapidEcomDispatch from "./components/RapidEcomDispatch";
import DispatchSidebar from "./DispatchSidebar";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "./components/ui";

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

  // Layout State
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Scanner & Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [scannedUnknownId, setScannedUnknownId] = useState("");

  const loadOrders = async () => {
    setFetching(true);
    try {
      const data = await api.getOrders();
      // Filter for ecom dispatches
      const filtered = data.filter(o => o.dispatchType === "ecom");
      setOrders(filtered);
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
      setActiveView("add-order");
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
          <h2 style={{ fontSize: 20, fontWeight: 400, color: "#0f172a", margin: "0 0 8px" }}>Access Denied</h2>
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
    sidebarMobileOverlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 199,
      backdropFilter: "blur(3px)",
      display: (!isDesktop && sidebarOpen) ? "block" : "none",
    } as React.CSSProperties,
    main: {
      flex: 1,
      marginLeft: isDesktop ? 260 : 0,
      padding: isMobile ? "16px 14px 32px" : "28px 32px 32px",
      minHeight: "100vh",
      maxWidth: "100%",
      overflow: "hidden",
      background: "#f0f2f5",
      transition: "margin-left 0.3s"
    } as React.CSSProperties,
    btnIcon: {
      width: 36, height: 36, borderRadius: 9, border: "1px solid #e2e8f0", 
      background: "#fff", cursor: "pointer", display: "flex", 
      alignItems: "center", justifyContent: "center", flexShrink: 0
    } as React.CSSProperties,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#f0f2f5" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>

      {/* Mobile overlay */}
      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

      {/* SIDEBAR */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        zIndex: 200,
        transform: (!isDesktop && !sidebarOpen) ? "translateX(-100%)" : "translateX(0)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
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
        />
      </div>

      {/* Main Content */}
      <main style={S.main}>
        {/* Mobile top bar */}
        {!isDesktop && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 400, color: "#0f172a" }}>Dispatch</span>
          </div>
        )}

        {activeView === "overview" && (
          <div className="animate-in fade-in duration-300">
            <PageHeader title="Ecommerce Dispatch" sub="Manage and track your Ecommerce fulfillment pipeline.">
                <BtnPrimary onClick={() => setActiveView("rapid-dispatch")}>Create Dispatch</BtnPrimary>
                <BtnGhost onClick={loadOrders} style={{ fontSize: 13 }}>Refresh</BtnGhost>
            </PageHeader>

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
                    <button onClick={() => setActiveView("rapid-dispatch")} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 400, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                      <span style={{ background: "rgba(99,102,241,0.2)", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>+</span>
                      Create Dispatch
                    </button>
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
              onDeleteOrder={handleDeleteOrder}
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

      </main>

      {/* Overlay Modals */}
      {selectedOrder && user && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={handleOrderUpdated}
          onDeleteOrder={handleDeleteOrder}
          user={{ uid: user.uid, name: currentName, role: currentRole }}
        />
      )}
    </div>
  );
}