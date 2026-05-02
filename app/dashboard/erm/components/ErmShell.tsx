"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";
import * as Icons from "./erm-leads/Icons";

type ErmActive =
  | "dashboard"
  | "inventory"
  | "leads"
  | "orders"
  | "catalog-sharing"
  | "orders-create"
  | "orders-all"
  | "purchase-create"
  | "purchase-view";

interface ErmShellProps {
  active: ErmActive;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  employeeDashboardUid?: string;
  workspaceReady?: boolean;
  viewedEmployeeName?: string;
}

interface NavItem {
  key: ErmActive;
  label: string;
  path: string;
  permission: string;
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  items: NavItem[];
}

export default function ErmShell({
  active,
  title,
  subtitle,
  children,
  employeeDashboardUid,
  workspaceReady = true,
  viewedEmployeeName,
}: ErmShellProps) {
  const router = useRouter();
  const { userData, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string>("orders");

  const dashboardPath = useMemo(() => {
    const uid = employeeDashboardUid || userData?.uid || "";
    if (userData?.role === "admin") return "/dashboard/erm/admin";
    return uid ? `/dashboard/erm/employee/${uid}/dashboard` : "/dashboard/erm";
  }, [employeeDashboardUid, userData]);

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: <Icons.IconPieChart size={16} />,
        items: [{ key: "dashboard", label: "Dashboard", path: dashboardPath, permission: "erm_dashboard_view" }],
      },
      {
        key: "inventory",
        label: "Inventory",
        icon: <Icons.IconPackage size={16} />,
        items: [{ key: "inventory", label: "Inventory", path: "/dashboard/erm/inventory", permission: "erm_inventory_view" }],
      },
      {
        key: "leads",
        label: "Leads",
        icon: <Icons.IconUsers size={16} />,
        items: [{ key: "leads", label: "Leads", path: "/dashboard/erm/leads", permission: "erm_leads_view" }],
      },
      {
        key: "orders",
        label: "Orders",
        icon: <Icons.IconBriefcase size={16} />,
        permission: "erm_orders_view",
        items: [
          { key: "orders-create", label: "Create Order", path: "/dashboard/erm/orders/create", permission: "erm_orders_create" },
          { key: "orders-all", label: "All Order", path: "/dashboard/erm/orders", permission: "erm_orders_view" },
        ],
      },
      {
        key: "accounting",
        label: "Accounting",
        icon: <Icons.IconClipboard size={16} />,
        permission: "erm_orders_view",
        items: [
          { key: "purchase-create", label: "Create Purchase Invoice", path: "/dashboard/erm/accounting/create-purchase-invoice", permission: "erm_orders_create" },
          { key: "purchase-view", label: "View Purchase Invoice", path: "/dashboard/erm/accounting/view-purchase-invoice", permission: "erm_orders_view" },
        ],
      },
      {
        key: "catalog-sharing",
        label: "Catalog Sharing",
        icon: <Icons.IconShare size={16} />,
        items: [{ key: "catalog-sharing", label: "Catalog Sharing", path: "/dashboard/erm/catalog-sharing", permission: "erm_catalog_view" }],
      },
    ],
    [dashboardPath],
  );

  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const items = group.items.filter((item) => {
          if (!workspaceReady && item.key !== "dashboard") return false;
          return hasPermission(userData, item.permission);
        });
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0 && (!group.permission || hasPermission(userData, group.permission)));
  }, [navGroups, userData, workspaceReady]);

  const roleLabel = String(userData?.role || "employee")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const userInitial = String(userData?.name || "U").trim().charAt(0).toUpperCase() || "U";
  const showViewedEmployee = Boolean(userData?.role === "admin" && viewedEmployeeName?.trim());
  const activeGroup = filteredGroups.find((g) => g.items.some((i) => i.key === active))?.key || "dashboard";

  const onNavClick = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "radial-gradient(circle at top left, #eff6ff 0%, #f8fafc 45%, #f1f5f9 100%)", fontFamily: "inherit" }}>
      {mobileOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.45)", zIndex: 90 }} onClick={() => setMobileOpen(false)} />}

      <aside
        className={`erm-sidebar ${desktopCollapsed ? "collapsed" : ""}`}
        style={{
          width: desktopCollapsed ? 78 : 260,
          background: "#0f172a",
          color: "#e2e8f0",
          padding: desktopCollapsed ? "18px 8px" : "18px 12px",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <button
          className="desktop-toggle"
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          style={{ position: "absolute", top: 24, right: -12, width: 24, height: 24, background: "#1e293b", border: "1px solid #334155", color: "#818cf8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", zIndex: 110 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            {desktopCollapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>

        <div style={{ padding: desktopCollapsed ? "0" : "0 8px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: desktopCollapsed ? 0 : 10, justifyContent: desktopCollapsed ? "center" : "flex-start" }}>
            <img src="/logo.png" alt="Logo" style={{ width: 42, height: 42, borderRadius: 10, background: "#fff", padding: 4, flexShrink: 0 }} />
            {!desktopCollapsed && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>EURUS LIFESTYLE</div>
                <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>CRM Workspace</div>
              </div>
            )}
          </div>
          {!desktopCollapsed && (
            <button onClick={() => router.push("/dashboard")} style={{ marginTop: 12, width: "100%", border: "none", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff", padding: "8px 10px", fontSize: 12, textAlign: "left", cursor: "pointer" }}>
              Back to Dashboard
            </button>
          )}
        </div>

        {!desktopCollapsed && (
          <div style={{ padding: "6px 8px", fontSize: 9, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            CRM Management
          </div>
        )}

        <nav style={{ flex: 1, overflowY: "auto", padding: "0 6px 12px" }}>
          {filteredGroups.map((group) => {
            const isSingle = group.items.length === 1;
            const isOpen = expandedGroup === group.key || activeGroup === group.key;
            const hasActive = group.items.some((i) => i.key === active);

            return (
              <div key={group.key} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => {
                    if (isSingle) onNavClick(group.items[0].path);
                    else setExpandedGroup((prev) => (prev === group.key ? "" : group.key));
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    padding: desktopCollapsed ? "10px 0" : "9px 10px",
                    borderRadius: 9,
                    border: "none",
                    justifyContent: desktopCollapsed ? "center" : "flex-start",
                    background: hasActive && (!isOpen || isSingle) ? "rgba(99,102,241,0.12)" : "transparent",
                    color: hasActive ? "#a5b4fc" : "#64748b",
                    cursor: "pointer",
                    textAlign: desktopCollapsed ? "center" : "left",
                  }}
                  title={desktopCollapsed ? group.label : ""}
                >
                  <span style={{ color: hasActive ? "#818cf8" : "#475569", display: "flex", alignItems: "center", marginRight: desktopCollapsed ? 0 : 9 }}>{group.icon}</span>
                  {!desktopCollapsed && <span style={{ flex: 1, fontSize: 13, fontWeight: hasActive ? 600 : 500 }}>{group.label}</span>}
                  {!isSingle && !desktopCollapsed && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#475569" }}>
                      <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {!isSingle && isOpen && !desktopCollapsed && (
                  <div style={{ paddingLeft: 10, paddingTop: 2, paddingBottom: 4 }}>
                    <div style={{ borderLeft: "1.5px solid rgba(99,102,241,0.2)", marginLeft: 7 }}>
                      {group.items.map((item) => {
                        const isActive = item.key === active;
                        return (
                          <button
                            key={item.key}
                            onClick={() => onNavClick(item.path)}
                            style={{
                              width: "100%",
                              padding: "7px 10px 7px 16px",
                              borderRadius: 7,
                              border: "none",
                              background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                              color: isActive ? "#a5b4fc" : "#64748b",
                              fontSize: 12,
                              fontWeight: isActive ? 600 : 400,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: desktopCollapsed ? "8px 4px" : "8px 10px", justifyContent: desktopCollapsed ? "center" : "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {userInitial}
            </div>
            {!desktopCollapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userData?.name || "User"}</div>
                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 600, textTransform: "uppercase" }}>{roleLabel}</div>
              </div>
            )}
            {!desktopCollapsed && (
              <button
                onClick={async () => {
                  await logout();
                  router.replace("/");
                }}
                title="Sign Out"
                style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <Icons.IconX size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className={`erm-main ${desktopCollapsed ? "collapsed" : ""}`} style={{ flex: 1, padding: "20px", transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <button className="erm-menu-toggle" onClick={() => setMobileOpen(true)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 12, color: "#0f172a", cursor: "pointer", fontWeight: 600 }}>
            Menu
          </button>
        </div>

        <div style={{ background: "linear-gradient(135deg,#ffffff,#f8fafc)", border: "1px solid #dbeafe", borderRadius: 16, padding: "14px 20px", boxShadow: "0 10px 30px rgba(30,64,175,0.08)" }}>
          <h1 style={{ margin: 0, fontSize: 20, color: "#0f172a", fontWeight: 700 }}>{title}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>
          {showViewedEmployee && (
            <div style={{ marginTop: 10, display: "inline-flex", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 600 }}>
              Employee: {viewedEmployeeName}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>{children}</div>
      </main>

      <style jsx>{`
        @media (max-width: 1023px) {
          .desktop-toggle { display: none !important; }
        }
        @media (min-width: 1024px) {
          .erm-sidebar { transform: translateX(0) !important; }
          .erm-main { margin-left: 260px !important; padding: 20px 24px !important; }
          .erm-main.collapsed { margin-left: 78px !important; }
          :global(.erm-menu-toggle) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
