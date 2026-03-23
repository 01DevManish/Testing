"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, Timestamp, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface DispatchOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  details: string;
  assignedTo: string;
  assignedToName: string;
  status: "pending" | "in-transit" | "delivered";
  createdAt: Timestamp;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  "in-transit": { label: "In Transit", color: "#6366f1" },
  delivered: { label: "Delivered", color: "#22c55e" },
};

export default function DispatchPage() {
  const { user, userData, logout, loading, fetchEmployees } = useAuth();
  const router = useRouter();

  const [dispatches, setDispatches] = useState<DispatchOrder[]>([]);
  const [fetching, setFetching] = useState(true);
  const [employees, setEmployees] = useState<{uid: string, name: string}[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    orderNumber: "",
    customerName: "",
    address: "",
    details: "",
    assignedTo: ""
  });
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "in-transit" | "delivered">("all");

  const isAdminOrManager = !userData || userData?.role === "admin" || userData?.role === "manager"; 

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      let q = collection(db, "dispatches") as any;
      if (userData?.role === "employee") {
        q = query(collection(db, "dispatches"), where("assignedTo", "==", userData.uid));
      }
      
      const snap = await getDocs(q);
      const list: DispatchOrder[] = [];
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) } as DispatchOrder));
      
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDispatches(list);

      if (isAdminOrManager && fetchEmployees) {
        try {
          const emps = await fetchEmployees();
          setEmployees(emps.map(e => ({ uid: e.uid, name: e.name })));
        } catch {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, [userData, isAdminOrManager, fetchEmployees]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateDispatch = async () => {
    if (!formData.orderNumber || !formData.customerName || !formData.address || !formData.assignedTo) return;
    setSaving(true);
    
    const assignedUser = employees.find(e => e.uid === formData.assignedTo);
    
    const newDispatch = {
      orderNumber: formData.orderNumber,
      customerName: formData.customerName,
      address: formData.address,
      details: formData.details,
      assignedTo: formData.assignedTo,
      assignedToName: assignedUser?.name || "Driver",
      status: "pending" as const,
      createdAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, "dispatches"), newDispatch);
      setDispatches([{ id: docRef.id, ...newDispatch }, ...dispatches]);
      setFormData({ orderNumber: "", customerName: "", address: "", details: "", assignedTo: "" });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create dispatch order.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: DispatchOrder["status"]) => {
    try {
      await updateDoc(doc(db, "dispatches", id), { status: newStatus });
      setDispatches(dispatches.map(d => d.id === id ? { ...d, status: newStatus } : d));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dispatch order?")) return;
    try {
      await deleteDoc(doc(db, "dispatches", id));
      setDispatches(dispatches.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => { await logout(); router.replace("/"); };

  const currentRole = userData?.role || "employee";
  const roleColors: Record<string, string> = { admin: "#ef4444", manager: "#f59e0b", employee: "#22c55e" };
  const currentName = userData?.name || user?.name || "User";
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good Morning" : greetHour < 17 ? "Good Afternoon" : "Good Evening";

  const filteredDispatches = filterStatus === "all" ? dispatches : dispatches.filter(d => d.status === filterStatus);

  const stats = {
    total: dispatches.length,
    pending: dispatches.filter(d => d.status === "pending").length,
    transit: dispatches.filter(d => d.status === "in-transit").length,
    delivered: dispatches.filter(d => d.status === "delivered").length
  };

  // === Inline Styles (From Admin Page) ===
  const S = {
    page: { display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc" } as React.CSSProperties,
    sidebar: { width: 260, background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", display: "flex", flexDirection: "column" as const, padding: "24px 16px", position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 100, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)" } as React.CSSProperties,
    sidebarMobileOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99, backdropFilter: "blur(4px)" } as React.CSSProperties,
    main: { flex: 1, marginLeft: 260, padding: "28px 32px 32px", minHeight: "100vh", transition: "margin-left 0.3s" } as React.CSSProperties,

    // Cards
    statCard: (gradient: string) => ({
      background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.25s ease", cursor: "default", position: "relative" as const, overflow: "hidden" as const,
    }),
    statStripe: (gradient: string) => ({
      position: "absolute" as const, top: 0, left: 0, right: 0, height: 4, background: gradient, borderRadius: "16px 16px 0 0",
    }),

    // Table
    tableContainer: { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" as const } as React.CSSProperties,
    th: { padding: "14px 20px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#94a3b8", borderBottom: "1px solid #e2e8f0", background: "#fafbfc" } as React.CSSProperties,
    td: { padding: "16px 20px", fontSize: 14, color: "#475569", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,

    // Buttons
    btnPrimary: { padding: "10px 22px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" } as React.CSSProperties,
    btnSecondary: { padding: "10px 18px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s" } as React.CSSProperties,
    btnDanger: { padding: "8px 14px", background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.2s" } as React.CSSProperties,
    btnIcon: { width: 36, height: 36, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: 16 } as React.CSSProperties,

    // Badge
    badge: (color: string, bg: string) => ({
      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${color}20`,
    }),

    // Card Form
    card: { background: "#fff", borderRadius: 20, padding: "32px 28px", width: "100%", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)", marginBottom: 24, position: "relative" as const } as React.CSSProperties,

    // Input
    input: { width: "100%", padding: "11px 14px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 14, fontFamily: "inherit", outline: "none", transition: "all 0.2s" } as React.CSSProperties,
    label: { display: "block", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 6 } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      {/* Mobile overlay */}
      {sidebarOpen && <div style={S.sidebarMobileOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* =================== SIDEBAR =================== */}
      <aside style={{ ...S.sidebar, ...(typeof window !== "undefined" && window.innerWidth < 768 && !sidebarOpen ? { transform: "translateX(-100%)" } : {}) }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px", marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Dispatch Center</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 12px", marginBottom: 8 }}>Navigation</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {userData && (
            <button onClick={() => router.push(userData.role === "admin" ? "/dashboard/admin" : "/dashboard")}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
              Dashboard
            </button>
          )}
          <button style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textAlign: "left", borderLeft: "3px solid #818cf8", paddingLeft: 11 }}>
            Dispatch Orders
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
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", width: "100%" }}>
          Sign Out
        </button>
      </aside>

      {/* =================== MAIN =================== */}
      <main style={{ ...S.main, ...(typeof window !== "undefined" && window.innerWidth < 768 ? { marginLeft: 0, padding: "80px 16px 24px" } : {}) }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Dispatch Management</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>Manage deliveries and logistics</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {isAdminOrManager && (
              <button onClick={() => setShowForm(!showForm)} style={S.btnPrimary}>
                {showForm ? "Cancel" : "New Order"}
              </button>
            )}
            <button onClick={loadData} style={S.btnSecondary}>Refresh</button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ ...S.btnIcon, display: typeof window !== "undefined" && window.innerWidth < 768 ? "flex" : "none" }}>☰</button>
          </div>
        </div>

        {/* ========== STATS ========== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Orders", value: stats.total, gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
            { label: "Pending", value: stats.pending, gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
            { label: "In Transit", value: stats.transit, gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
            { label: "Delivered", value: stats.delivered, gradient: "linear-gradient(135deg,#10b981,#34d399)" },
          ].map((s, i) => (
            <div key={i} style={S.statCard(s.gradient)}>
              <div style={S.statStripe(s.gradient)} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ========== CREATE FORM ========== */}
        {showForm && isAdminOrManager && (
          <div style={S.card}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 24px", letterSpacing: "-0.01em" }}>Create Dispatch Order</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <label style={S.label}>Order Number (#)</label>
                <input type="text" placeholder="ORD-12345" value={formData.orderNumber} onChange={e => setFormData({...formData, orderNumber: e.target.value})} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Customer Name</label>
                <input type="text" placeholder="Jane Doe" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Delivery Address</label>
                <input type="text" placeholder="123 Main St, City" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Assign Driver</label>
                <select value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})} style={{ ...S.input, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}>
                  <option value="">Select Employee...</option>
                  {employees.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
                </select>
              </div>
            </div>
            
            <div style={{ marginTop: 20 }}>
              <label style={S.label}>Extra Details / Instructions</label>
              <textarea placeholder="Gate code, phone number, etc." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} rows={2} style={{ ...S.input, resize: "vertical" }} />
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button 
                onClick={handleCreateDispatch} 
                disabled={saving || !formData.orderNumber || !formData.customerName || !formData.address || !formData.assignedTo} 
                style={{ ...S.btnPrimary, opacity: (saving || !formData.orderNumber || !formData.customerName || !formData.address || !formData.assignedTo) ? 0.6 : 1 }}
              >
                {saving ? "Creating..." : "Create Dispatch"}
              </button>
            </div>
          </div>
        )}

        {/* ========== LIST ========== */}
        <div style={S.tableContainer}>
          <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap", gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Dispatch Orders</h2>
            
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {(["all", "pending", "in-transit", "delivered"] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s",
                    border: `1.5px solid ${filterStatus === f ? "#6366f1" : "#e2e8f0"}`,
                    background: filterStatus === f ? "rgba(99,102,241,0.08)" : "#fff",
                    color: filterStatus === f ? "#6366f1" : "#94a3b8"
                  }}>
                  {f === "all" ? "All" : statusLabels[f]?.label}
                </button>
              ))}
            </div>
          </div>

          {fetching ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b", fontSize: 14, fontWeight: 500 }}>Loading orders...</div>
          ) : filteredDispatches.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>No orders found</div>
              <div style={{ fontSize: 13 }}>There are no dispatch orders in this category.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Order Details</th>
                    <th style={S.th}>Customer / Address</th>
                    {isAdminOrManager && <th style={S.th}>Assigned To</th>}
                    <th style={S.th}>Status</th>
                    <th style={{ ...S.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDispatches.map((d, i) => {
                    const statusColor = statusLabels[d.status]?.color || "#94a3b8";
                    return (
                      <tr key={d.id} style={{ transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f8fafc"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{d.orderNumber}</div>
                          <div style={{ fontSize: 12, color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{d.details || "No extra details"}</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: "#334155", fontSize: 13 }}>{d.customerName}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{d.address}</div>
                        </td>
                        {isAdminOrManager && (
                          <td style={S.td}>
                            <div style={{ display: "inline-block", padding: "4px 10px", background: "#f1f5f9", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#475569" }}>
                              {d.assignedToName}
                            </div>
                          </td>
                        )}
                        <td style={S.td}>
                          <span style={S.badge(statusColor, `${statusColor}15`)}>
                            {statusLabels[d.status]?.label}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                            {userData?.role === "employee" ? (
                              <>
                                {d.status === "pending" && (
                                  <button onClick={() => handleUpdateStatus(d.id, "in-transit")} style={{ ...S.btnPrimary, padding: "6px 12px", fontSize: 12, background: "linear-gradient(135deg, #3b82f6, #60a5fa)", boxShadow: "0 2px 8px rgba(59,130,246,0.25)" }}>Start Transit</button>
                                )}
                                {d.status === "in-transit" && (
                                  <button onClick={() => handleUpdateStatus(d.id, "delivered")} style={{ ...S.btnPrimary, padding: "6px 12px", fontSize: 12, background: "linear-gradient(135deg, #10b981, #34d399)", boxShadow: "0 2px 8px rgba(16,185,129,0.25)" }}>Mark Delivered</button>
                                )}
                              </>
                            ) : (
                              <>
                                <select value={d.status} onChange={(e) => handleUpdateStatus(d.id, e.target.value as DispatchOrder["status"])} style={{ ...S.input, padding: "6px 28px 6px 10px", fontSize: 12, width: "auto", minWidth: 100, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
                                  <option value="pending">Pending</option>
                                  <option value="in-transit">In Transit</option>
                                  <option value="delivered">Delivered</option>
                                </select>
                                <button style={S.btnDanger} onClick={() => handleDelete(d.id)}>Del</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
