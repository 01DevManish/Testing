"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { api } from "./data";
import { Order, OrderStatus, ActiveView } from "./types";
import OrderList from "./components/OrderList";
import Scanner from "./components/Scanner";
import OrderDetailsModal from "./components/OrderDetailsModal";
import AddOrderModal from "./components/AddOrderModal";
import CreateDispatchModal from "./components/Createdispatchmodal";
import CreatePackingList from "./components/CreatePackingList";
import AllPackingLists from "./components/AllPackingLists";
import CreateDispatchList from "./components/CreateDispatchList";
import AllDispatchLists from "./components/AllDispatchLists";
import BoxManagementTab from "./components/BoxManagementTab";
import PackingListDetailsModal from "./components/PackingListDetailsModal";
import NotificationBell from "../../components/NotificationBell";
import DispatchSidebar from "./DispatchSidebar";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "./components/ui";
import { hasPermission } from "../../lib/permissions";
import MessagingTab from "../../components/MessagingTab";
import CatalogTab from "../inventory/CatalogTab";

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
  const isDesktop = width >= 1024;

  const { 
    orders: allOrders, setOrders,
    products,
    users, 
    categories, collections, brands,
    loading: fetchingGlobal, refreshData: loadOrders 
  } = useData();

  const orders = useMemo(() => allOrders.filter(o => o.dispatchType === "retail" || !o.dispatchType), [allOrders]);
  const fetching = fetchingGlobal;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "All">("All");
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [scannedUnknownId, setScannedUnknownId] = useState("");
  const [editingPackingList, setEditingPackingList] = useState<any>(null);
  const [viewingPackingList, setViewingPackingList] = useState<any>(null);
  const [packingLists, setPackingLists] = useState<any[]>([]);
  const [statsDate, setStatsDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const listsRef = ref(db, "packingLists");
    const unsubscribe = onValue(listsRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
      setPackingLists(data);
    });
    return () => unsubscribe();
  }, []);

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

  const canView = hasPermission(userData, "retail_view");
  const canCreate = hasPermission(userData, "retail_create");
  const canEdit = hasPermission(userData, "retail_edit");
  const canDelete = hasPermission(userData, "retail_delete");
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
  const stats = {
    todayPacking: packingLists.filter(l => new Date(l.createdAt).toISOString().split('T')[0] === todayDate).length,
    todayDispatch: packingLists.filter(l => (l.status === "Packed" || l.status === "Completed") && l.dispatchedAt && new Date(l.dispatchedAt).toISOString().split('T')[0] === todayDate).length,
    filteredDispatch: packingLists.filter(l => (l.status === "Packed" || l.status === "Completed") && l.dispatchedAt && new Date(l.dispatchedAt).toISOString().split('T')[0] === statsDate).length,
    pending: orders.filter(o => o.status === "Pending").length,
  };

  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };
  const currentName = userData?.name || user?.name || "User";

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
      overflowX: "hidden",
      overflowY: "auto",
      background: "#f0f2f5",
      transition: "margin-left 0.3s",
      scrollbarWidth: "none",
    } as React.CSSProperties,
    btnIcon: {
      width: 36, height: 36, borderRadius: 9, border: "1px solid #e2e8f0", 
      background: "#fff", cursor: "pointer", display: "flex", 
      alignItems: "center", justifyContent: "center", flexShrink: 0
    } as React.CSSProperties,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: "#f0f2f5", overflow: "hidden" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Hide scrollbars for the main layout to keep it clean */
        ::-webkit-scrollbar { width: 0px; height: 0px; background: transparent; }
        .no-focus-ring:focus { outline: none !important; border-color: #cbd5e1 !important; box-shadow: none !important; }
        /* Show custom thin scrollbars only on tables if needed */
        .scrollable-body::-webkit-scrollbar { width: 4px; height: 4px; }
        .scrollable-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>

      <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />

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

      <main style={{ 
        ...S.main, 
        padding: activeView === "messages" ? 0 : S.main.padding,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}>
        {activeView !== "messages" && !isDesktop && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <button onClick={() => setSidebarOpen(true)} style={S.btnIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 400, color: "#0f172a" }}>Dispatch</span>
          </div>
        )}

        <div style={{ flex: 1, display: activeView === "messages" ? "flex" : "block", flexDirection: "column" }}>
          {activeView === "overview" && (
            <div className="animate-in fade-in duration-300">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <PageHeader title="Retail Dispatch" sub="Manage and track your retail fulfillment pipeline." />
                <NotificationBell />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Today's Packing", value: stats.todayPacking, color: "#6366f1", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg> },
                  { label: "Today's Dispatch", value: stats.todayDispatch, color: "#10b981", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg> },
                  { 
                    label: "Total Dispatch", value: stats.filteredDispatch, color: "#3b82f6", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
                  },
                  { label: "Pending Orders", value: stats.pending, color: "#f59e0b", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
                ].map(s => (
                  <Card key={s.label} style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}10`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 600, color: "#1e293b" }}>{s.value}</div>
                    </div>
                  </Card>
                ))}
              </div>

              <Card style={{ padding: "16px 20px", marginBottom: 24 }}>
                 <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 280, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                       <input 
                          className="no-focus-ring"
                          type="text" 
                          value={searchQuery}
                          placeholder="Search Party / Dispatch ID"
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14, fontWeight: 500, color: "#1e293b" }}
                       />
                       {searchQuery && (
                         <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Clear</button>
                       )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                       {["Pending", "Packed", "Dispatched"].map(s => (
                          <button key={s} onClick={() => { setFilterStatus(s as any); setActiveView("order-list"); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{s}</button>
                       ))}
                    </div>
                 </div>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                <Card style={{ padding: 0, overflow: "hidden", minHeight: 450 }}>
                  <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                      Recent Dispatches
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", padding: "4px 8px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>DATE:</span>
                        <input 
                          type="date" 
                          value={statsDate} 
                          onChange={(e) => setStatsDate(e.target.value)}
                          style={{ fontSize: 12, border: "none", background: "transparent", outline: "none", color: "#1e293b", fontWeight: 700 }}
                        />
                      </div>
                      <button onClick={() => setActiveView("all-dispatch-lists")} style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", background: "#f5f3ff", padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer" }}>View All History →</button>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Dispatch ID", "Party Name", "Units", "Items", "Pkg", "Status", "LR No."].map(h => (
                            <th key={h} style={{ padding: "14px 24px", textAlign: h === "LR No." ? "right" : (h === "Items" || h === "Pkg" || h === "Status" || h === "Units") ? "center" : "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filtered = packingLists
                            .filter(l => {
                              const matchesStatus = (l.status === "Packed" || l.status === "Completed");
                              const matchesDate = l.dispatchedAt && new Date(l.dispatchedAt).toISOString().split('T')[0] === statsDate;
                              const matchesSearch = !searchQuery || 
                                l.partyName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                l.dispatchId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                l.id?.toLowerCase().includes(searchQuery.toLowerCase());
                              return matchesStatus && matchesDate && matchesSearch;
                            })
                            .sort((a, b) => (Number(b.dispatchedAt) || 0) - (Number(a.dispatchedAt) || 0));
                          
                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ padding: "80px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                                  No retail dispatches found for {statsDate}.
                                </td>
                              </tr>
                            );
                          }
                          
                          return filtered.map((l: any) => {
                            const sColor = l.status === "Completed" ? "#10b981" : "#f59e0b";
                            const totalUnits = l.items?.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0) || 0;
                            return (
                              <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700 }}>#{l.dispatchId || l.id.slice(-6).toUpperCase()}</td>
                                <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 600 }}>{l.partyName}</td>
                                <td style={{ padding: "16px 24px", fontSize: 13, textAlign: "center", fontWeight: 700 }}>{totalUnits}</td>
                                <td style={{ padding: "16px 24px", fontSize: 13, textAlign: "center" }}>{l.items?.length || 0}</td>
                                <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 700, textAlign: "center" }}>{l.bails || 0}</td>
                                <td style={{ padding: "16px 24px", textAlign: "center" }}><span style={{ padding: "5px 12px", borderRadius: 20, background: `${sColor}15`, color: sColor, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{l.status === "Completed" ? "Shipped" : "Ready"}</span></td>
                                <td style={{ padding: "16px 24px", fontSize: 13, textAlign: "right", fontWeight: 800, fontFamily: "monospace", color: l.lrNo ? "#1e293b" : "#cbd5e1" }}>{l.lrNo || "PENDING"}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeView === "order-list" && <OrderList orders={orders} onSelectOrder={setSelectedOrder} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterStatus={filterStatus} setFilterStatus={setFilterStatus} onRefresh={loadOrders} loading={fetching} onDeleteOrder={canDelete ? handleDeleteOrder : undefined} canDelete={canDelete} />}
          {activeView === "scanner" && <div className="animate-in fade-in duration-300"><PageHeader title="Scanner" sub="Scan barcodes..." /><Card style={{ padding: 24 }}><Scanner onScan={handleScan} /></Card></div>}
          {activeView === "create-dispatch" && <div className="max-w-3xl mx-auto pt-4 animate-in fade-in duration-300"><CreateDispatchModal dispatchType="retail" onClose={() => setActiveView("overview")} onDispatched={() => { loadOrders(); setActiveView("overview"); }} /></div>}
          {activeView === "add-order" && <div className="max-w-3xl mx-auto pt-4 animate-in fade-in duration-300"><AddOrderModal initialOrderId={scannedUnknownId} onClose={() => setActiveView("overview")} onOrderAdded={handleOrderAdded} /></div>}
          {activeView === "create-packing-list" && <div className="max-w-6xl mx-auto pt-4 animate-in fade-in duration-300"><CreatePackingList editingList={editingPackingList} onClose={() => { setActiveView("overview"); setEditingPackingList(null); }} onCreated={() => { setActiveView("all-packing-lists"); setEditingPackingList(null); loadOrders(); }} /></div>}
          {activeView === "create-dispatch-list" && <div className="max-w-6xl mx-auto pt-4 animate-in fade-in duration-300"><CreateDispatchList onClose={() => setActiveView("overview")} onCreated={() => { setActiveView("overview"); loadOrders(); }} /></div>}
          {activeView === "all-packing-lists" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <AllPackingLists 
                onEdit={(list) => { setEditingPackingList(list); setActiveView("create-packing-list"); }} 
                onView={(list) => setViewingPackingList(list)}
              />
            </div>
          )}
          {activeView === "all-dispatch-lists" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <AllDispatchLists 
                onView={(list) => setViewingPackingList(list)}
                onEdit={(list) => { setEditingPackingList(list); setActiveView("create-packing-list"); }}
              />
            </div>
          )}
          {activeView === "box-management" && (
            <div className="max-w-7xl mx-auto pt-4 animate-in fade-in duration-300">
              <BoxManagementTab packingLists={packingLists} />
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