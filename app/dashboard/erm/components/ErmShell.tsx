"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";

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
}

export default function ErmShell({ active, title, subtitle, children, employeeDashboardUid }: ErmShellProps) {
  const router = useRouter();
  const { userData, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardPath = useMemo(() => {
    const uid = employeeDashboardUid || userData?.uid || "";
    if (userData?.role === "admin") return "/dashboard/erm/admin";
    return uid ? `/dashboard/erm/employee/${uid}/dashboard` : "/dashboard/erm";
  }, [employeeDashboardUid, userData]);

  const navItems: NavItem[] = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", path: dashboardPath, permission: "erm_dashboard_view" },
      { key: "inventory", label: "Inventory", path: "/dashboard/erm/inventory", permission: "erm_inventory_view" },
      { key: "leads", label: "Leads", path: "/dashboard/erm/leads", permission: "erm_leads_view" },
      { key: "orders", label: "Orders", path: "/dashboard/erm/orders", permission: "erm_orders_view" },
      { key: "catalog-sharing", label: "Catalog Sharing", path: "/dashboard/erm/catalog-sharing", permission: "erm_catalog_view" },
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
        style={{
          width: 260,
          background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
          color: "#e2e8f0",
          padding: "18px 12px",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 16px" }}>
          <img src="/logo.png" alt="Logo" style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", padding: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>EURUS ERM</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>CRM Workspace</div>
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
                  textAlign: "left",
                  border: "1px solid transparent",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  color: isActive ? "#c7d2fe" : "#cbd5e1",
                  background: isActive ? "rgba(99,102,241,0.2)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "grid", gap: 8 }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ border: "1px solid #334155", background: "transparent", color: "#cbd5e1", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}
          >
            Back To Dashboard
          </button>
          <button
            onClick={async () => {
              await logout();
              router.replace("/");
            }}
            style={{ border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 0, padding: "16px" }}>
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
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userData?.name || "User"}
              </div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{roleLabel}</div>
            </div>
          </div>
        </div>

        <div style={{ background: "linear-gradient(135deg,#ffffff,#f8fafc)", border: "1px solid #dbeafe", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(30,64,175,0.08)" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>{title}</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>
        </div>

        <div style={{ marginTop: 14 }}>{children}</div>
      </main>

      <style jsx>{`
        @media (min-width: 1024px) {
          aside { transform: translateX(0) !important; }
          main { margin-left: 260px !important; padding: 24px !important; }
          :global(.erm-menu-toggle) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
