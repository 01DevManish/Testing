"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";
import * as Icons from "./erm-leads/Icons";

interface ErmShellProps {
  active: "dashboard" | "inventory" | "leads" | "orders" | "catalog-sharing";
  title: string;
  subtitle: string;
  children: React.ReactNode;
  employeeDashboardUid?: string;
}

interface NavItem {
  key: ErmShellProps["active"];
  label: string;
  path: string;
  permission: string;
  icon: React.ReactNode;
}

export default function ErmShell({ active, title, subtitle, children, employeeDashboardUid }: ErmShellProps) {
  const router = useRouter();
  const { userData, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const dashboardPath = useMemo(() => {
    const uid = employeeDashboardUid || userData?.uid || "";
    if (userData?.role === "admin") return "/dashboard/erm/admin";
    return uid ? `/dashboard/erm/employee/${uid}/dashboard` : "/dashboard/erm";
  }, [employeeDashboardUid, userData]);

  const navItems: NavItem[] = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", path: dashboardPath, permission: "erm_dashboard_view", icon: <Icons.IconPieChart size={20} /> },
      { key: "inventory", label: "Inventory", path: "/dashboard/erm/inventory", permission: "erm_inventory_view", icon: <Icons.IconPackage size={20} /> },
      { key: "leads", label: "Leads", path: "/dashboard/erm/leads", permission: "erm_leads_view", icon: <Icons.IconUsers size={20} /> },
      { key: "orders", label: "Orders", path: "/dashboard/erm/orders", permission: "erm_orders_view", icon: <Icons.IconBriefcase size={20} /> },
      { key: "catalog-sharing", label: "Catalog Sharing", path: "/dashboard/erm/catalog-sharing", permission: "erm_catalog_view", icon: <Icons.IconShare size={20} /> },
    ],
    [dashboardPath],
  );

  const allowedItems = useMemo(
    () => navItems.filter((item) => hasPermission(userData, item.permission)),
    [navItems, userData],
  );
  const roleLabel = String(userData?.role || "employee")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const userInitial = String(userData?.name || "U").trim().charAt(0).toUpperCase() || "U";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "radial-gradient(circle at top left, #eff6ff 0%, #f8fafc 45%, #f1f5f9 100%)", fontFamily: "inherit" }}>
      {mobileOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.45)", zIndex: 90 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`erm-sidebar ${desktopCollapsed ? "collapsed" : ""}`}
        style={{
          width: desktopCollapsed ? 80 : 240,
          background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
          color: "#e2e8f0",
          padding: desktopCollapsed ? "18px 8px" : "18px 12px",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflowX: "visible",
        }}
      >
        <button
          className="desktop-toggle"
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          style={{
            position: "absolute",
            top: 24,
            right: -12,
            width: 24,
            height: 24,
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            zIndex: 110,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "all 0.2s"
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: desktopCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: desktopCollapsed ? "center" : "flex-start", marginBottom: 30, padding: desktopCollapsed ? "0" : "0 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", padding: 3, flexShrink: 0 }} />
            {!desktopCollapsed && (
              <div style={{ whiteSpace: "nowrap", opacity: desktopCollapsed ? 0 : 1, transition: "opacity 0.2s" }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.5px" }}>EURUS ERM</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>CRM Workspace</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          {allowedItems.map((item) => {
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                onClick={() => {
                  router.push(item.path);
                  setMobileOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: desktopCollapsed ? "center" : "flex-start",
                  gap: desktopCollapsed ? 0 : 12,
                  textAlign: "left",
                  border: "1px solid transparent",
                  borderRadius: 10,
                  padding: desktopCollapsed ? "12px" : "10px 12px",
                  fontSize: 14,
                  cursor: "pointer",
                  color: isActive ? "#c7d2fe" : "#cbd5e1",
                  background: isActive ? "rgba(99,102,241,0.2)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
                title={desktopCollapsed ? item.label : ""}
              >
                <div style={{ flexShrink: 0, display: "flex" }}>
                  {React.cloneElement(item.icon as any, { size: 22 })}
                </div>
                {!desktopCollapsed && <span style={{ opacity: desktopCollapsed ? 0 : 1, transition: "opacity 0.2s" }}>{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ position: "absolute", left: desktopCollapsed ? 8 : 12, right: desktopCollapsed ? 8 : 12, bottom: 12, display: "grid", gap: 8 }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ display: "flex", justifyContent: "center", border: "1px solid #334155", background: "transparent", color: "#cbd5e1", borderRadius: 12, padding: desktopCollapsed ? "10px 0" : "10px 12px", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
            title={desktopCollapsed ? "Back To Dashboard" : ""}
          >
            {desktopCollapsed ? <Icons.IconBriefcase size={20} /> : "Back To Dashboard"}
          </button>
          <button
            onClick={async () => {
              await logout();
              router.replace("/");
            }}
            style={{ display: "flex", justifyContent: "center", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderRadius: 12, padding: desktopCollapsed ? "10px 0" : "10px 12px", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
            title={desktopCollapsed ? "Logout" : ""}
          >
            {desktopCollapsed ? <Icons.IconX size={20} /> : "Logout"}
          </button>
        </div>
      </aside>

      <main className={`erm-main ${desktopCollapsed ? "collapsed" : ""}`} style={{ flex: 1, padding: "20px", transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button
            className="erm-menu-toggle"
            onClick={() => setMobileOpen(true)}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              color: "#0f172a",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Menu
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "8px 10px",
              boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              minWidth: 180,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userData?.name || "User"}
              </div>
              <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>{roleLabel}</div>
            </div>
          </div>
        </div>

        <div style={{ background: "linear-gradient(135deg,#ffffff,#f8fafc)", border: "1px solid #dbeafe", borderRadius: 16, padding: "14px 20px", boxShadow: "0 10px 30px rgba(30,64,175,0.08)" }}>
          <h1 style={{ margin: 0, fontSize: 20, color: "#0f172a", fontWeight: 700 }}>{title}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>
        </div>

        <div style={{ marginTop: 14 }}>{children}</div>
      </main>

      <style jsx>{`
        @media (max-width: 1023px) {
          .desktop-toggle { display: none !important; }
        }
        @media (min-width: 1024px) {
          .erm-sidebar { transform: translateX(0) !important; }
          .erm-main { margin-left: 240px !important; padding: 20px 24px !important; }
          .erm-main.collapsed { margin-left: 80px !important; }
          :global(.erm-menu-toggle) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
