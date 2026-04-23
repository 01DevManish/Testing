"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "@/app/lib/permissions";

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path?: string; // If provided, navigates using router
  count?: number;
  permission?: string;
}

interface EmployeeSidebarProps {
  currentView: string;
  setView: (view: any) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isDesktop: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  userData: any;
  handleLogout: () => void;
  taskStats?: { pending: number };
}

const roleColors: Record<string, string> = {
  manager: "#f59e0b",
  employee: "#10b981",
};

const roleGradients: Record<string, string> = {
  manager: "linear-gradient(135deg,#f59e0b,#fbbf24)",
  employee: "linear-gradient(135deg,#10b981,#34d399)",
};

export default function EmployeeSidebar({
  currentView, setView, sidebarOpen, setSidebarOpen, isDesktop, isCollapsed, setIsCollapsed, userData, handleLogout, taskStats
}: EmployeeSidebarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const role = userData?.role || "employee";
  const themeColor = roleColors[role] || "#10b981";
  const portalName = role === "manager" ? "Manager Portal" : "Employee Portal";

  // Listen for total unread messages
  useEffect(() => {
    if (!user) return;
    const chatsRef = ref(db, `user_chats/${user.uid}`);
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      let total = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => { total += (child.val().unreadCount || 0); });
      }
      setUnreadCount(total);
    });
    return () => unsubscribe();
  }, [user]);

  const ICONS = {
    dashboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    tasks: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>,
    party: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    messages: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    catalog: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    retail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>,
    ecom: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path><path d="M2 7h20"></path><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 10V7"></path></svg>,
    inventory: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>,
    erm: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M7 12h6"></path><path d="M7 16h8"></path></svg>,
    exit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  };

  const menuItems: { label: string; items: SidebarItem[] }[] = [
    {
      label: "Operations",
      items: [
        { key: "dashboard", label: "Dashboard", icon: ICONS.dashboard, path: "/dashboard" },
        { key: "retail", label: "Retail Dispatch", icon: ICONS.retail, path: "/dashboard/retail-dispatch", permission: "retail_view" },
        { key: "ecom", label: "Ecommerce Dispatch", icon: ICONS.ecom, path: "/dashboard/ecom-dispatch", permission: "ecom_view" },
        { key: "inventory", label: "Inventory Feed", icon: ICONS.inventory, path: "/dashboard/inventory", permission: "inventory_view" },
        { key: "erm", label: "ERM CRM", icon: ICONS.erm, path: "/dashboard/erm", permission: "erm_dashboard_view" },
      ]
    },
    {
      label: "Team & Tasks",
      items: [
        { key: "tasks", label: "My Tasks", icon: ICONS.tasks, count: taskStats?.pending },
      ]
    },
    {
      label: "Business",
      items: [
        { key: "party-rates", label: "Party Wise Rates", icon: ICONS.party, permission: "party_rate_view" },
        { key: "catalog", label: "Catalog Sharing", icon: ICONS.catalog },
      ]
    },
    {
      label: "Communication",
      items: [
        { key: "messages", label: "Team Messaging", icon: ICONS.messages, count: unreadCount },
      ]
    }
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {!isDesktop && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            zIndex: 199,
            opacity: sidebarOpen ? 1 : 0,
            visibility: sidebarOpen ? "visible" : "hidden",
            transition: "all 0.2s cubic-bezier(0, 0, 0.2, 1)",
          }} 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      <aside style={{
        width: isDesktop ? (isCollapsed ? 78 : 260) : 280,
        background: "#0f172a",
        display: "flex", 
        flexDirection: "column",
        overflow: "visible",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 200,
        transform: isDesktop ? "translateX(0)" : (sidebarOpen ? "translateX(0)" : "translateX(-100%)"),
        transition: "width 0.2s cubic-bezier(0, 0, 0.2, 1), transform 0.2s cubic-bezier(0, 0, 0.2, 1)",
        boxShadow: (!isDesktop && sidebarOpen) ? "20px 0 40px rgba(0,0,0,0.3)" : "none",
      }}>
        {/* Brand Header */}
        <div style={{ 
          padding: isDesktop && isCollapsed ? "20px 0" : "20px 18px 24px", 
          flexShrink: 0, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: isDesktop && isCollapsed ? "center" : "flex-start",
          transition: "all 0.3s ease" 
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12, 
            overflow: "hidden",
            justifyContent: isDesktop && isCollapsed ? "center" : "flex-start",
            width: "100%"
          }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ 
                width: 42, 
                height: 42, 
                objectFit: "contain", 
                borderRadius: 10, 
                background: "#fff", 
                padding: 4, 
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                transition: "all 0.3s ease"
              }} 
            />
            {(!isCollapsed || !isDesktop) && (
              <div style={{ animation: "fadeInUp 0.3s ease-out" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>EURUS LIFESTYLE</div>
                <div style={{ fontSize: 9, color: themeColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>{portalName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Toggle Button */}
        {isDesktop && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              position: "absolute",
              right: -12,
              top: 32,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#1e293b",
              border: "1px solid #334155",
              color: themeColor,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              zIndex: 300,
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.background = "#334155";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "#1e293b";
            }}
          >
            {isCollapsed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
            )}
          </button>
        )}

        {/* Navigation Wrapper */}
        <div style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: "0 10px 20px",
          scrollbarWidth: "none",
        }}>
          {menuItems.map((group) => {
            // Filter items based on permissions
            const visibleItems = group.items.filter(item => !item.permission || hasPermission(userData, item.permission));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} style={{ marginBottom: 20 }}>
                {!isCollapsed && (
                  <div style={{ 
                    fontSize: 9, 
                    fontWeight: 600, 
                    color: "#475569", 
                    textTransform: "uppercase", 
                    letterSpacing: "0.12em", 
                    padding: "0 12px", 
                    marginBottom: 8,
                    animation: "fadeInUp 0.3s ease-out"
                  }}>{group.label}</div>
                )}
                
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {visibleItems.map((item) => {
                    const isActive = currentView === item.key;
                    return (
                      <button 
                        key={item.key} 
                        onClick={() => { 
                          if (item.path) {
                            router.push(item.path);
                          } else {
                            setView(item.key); 
                          }
                          if (!isDesktop) setSidebarOpen(false); 
                        }}
                        style={{
                          display: "flex", 
                          alignItems: "center", 
                          gap: 12, 
                          width: "100%",
                          padding: isCollapsed ? "10px 0" : "10px 12px", 
                          justifyContent: isCollapsed ? "center" : "flex-start",
                          borderRadius: 10, 
                          border: "none",
                          background: isActive ? `${themeColor}1a` : "transparent",
                          color: isActive ? themeColor : "#94a3b8",
                          fontSize: 13, 
                          fontWeight: isActive ? 600 : 500, 
                          fontFamily: "inherit", 
                          cursor: "pointer", 
                          transition: "all 0.15s", 
                          textAlign: isCollapsed ? "center" : "left",
                          position: "relative",
                          overflow: "hidden"
                        }}>
                        {/* Active indicator bar */}
                        {isActive && (
                          <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, background: themeColor, borderRadius: "0 4px 4px 0" }} />
                        )}
                        
                        <span style={{ 
                          color: isActive ? themeColor : "#475569", 
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center"
                        }}>
                          {item.icon}
                        </span>
                        
                        {!isCollapsed && (
                          <span style={{ 
                            flex: 1, 
                            whiteSpace: "nowrap", 
                            overflow: "hidden", 
                            textOverflow: "ellipsis",
                            animation: "fadeInUp 0.2s ease-out"
                          }}>{item.label}</span>
                        )}
                        
                        {item.count !== undefined && item.count > 0 && !isCollapsed && (
                          <span style={{ 
                            background: isActive ? themeColor : "#334155", 
                            color: "#fff", 
                            fontSize: 10, 
                            fontWeight: 700, 
                            minWidth: 18, 
                            height: 18, 
                            borderRadius: 9, 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            animation: "fadeInUp 0.3s ease-out"
                          }}>{item.count}</span>
                        )}

                        {item.path && !isCollapsed && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3, animation: "fadeInUp 0.3s ease-out" }}>
                            <path d="M5 12h14M12 5l7 7-7 7"></path>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* User Footer */}
        <div style={{ 
          padding: "16px 20px", 
          borderTop: "1px solid rgba(255,255,255,0.06)", 
          flexShrink: 0
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12
          }}>
            <div style={{ 
              width: 34, 
              height: 34, 
              borderRadius: 9, 
              background: roleGradients[role] || roleGradients.employee, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              fontWeight: 700, 
              fontSize: 13, 
              color: "#fff", 
              flexShrink: 0 
            }}>
              {(userData?.name?.[0] || "U").toUpperCase()}
            </div>
            
            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0, animation: "fadeInUp 0.3s ease-out" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userData?.name || "User"}</div>
                <div style={{ fontSize: 9, color: themeColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>{role}</div>
              </div>
            )}

            {!isCollapsed && (
              <button onClick={handleLogout} title="Sign Out" style={{ 
                width: 34, 
                height: 34, 
                borderRadius: 9, 
                border: "none",
                background: "rgba(239,68,68,0.1)", 
                color: "#f87171", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                cursor: "pointer", 
                transition: "all 0.2s",
                flexShrink: 0,
                animation: "fadeInUp 0.3s ease-out"
              }}>
                {ICONS.exit}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

