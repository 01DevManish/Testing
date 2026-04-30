"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { roleBg } from "./types";
import type { AdminStyles } from "./styles";
import { ref, onValue } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../lib/permissions";

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path?: string; // If provided, navigates to external path. Otherwise switches internal tab.
  count?: number;
  permission?: string;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface AdminSidebarProps {
  S: AdminStyles;
  tab: string;
  setTab: (tab: any) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isDesktop: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  currentName: string;
  userData?: { profilePic?: string; role?: string; permissions?: string[]; email?: string } | null;
  handleLogout: () => void;
  // Dynamic counts from DB
  usersCount?: number;
  tasksCount?: number;
}

export default function AdminSidebar({
  S, tab, setTab, sidebarOpen, setSidebarOpen, isDesktop, isCollapsed, setIsCollapsed, currentName, userData, handleLogout, usersCount, tasksCount
}: AdminSidebarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

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
    reports: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="20"></line><rect x="5" y="10" width="3" height="8"></rect><rect x="10.5" y="6" width="3" height="12"></rect><rect x="16" y="3" width="3" height="15"></rect></svg>,
    party: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    inventory: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>,
    clout: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19h11a4 4 0 0 0 .5-8 5 5 0 0 0-9.7-1.8A4 4 0 0 0 6 19Z"></path></svg>,
    retail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>,
    ecom: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path><path d="M2 7h20"></path><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 10V7"></path></svg>,
    catalog: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    erm: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M7 12h6"></path><path d="M7 16h8"></path></svg>,
    brands: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>,
    messages: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    users: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    tasks: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>,
    logs: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    profile: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  };

  const navGroups: SidebarGroup[] = [
    {
      label: "Analytics",
      items: [
        { key: "dashboard", label: "Dashboard", icon: ICONS.dashboard },
        { key: "reports", label: "Reports", icon: ICONS.reports },
      ]
    },
    {
      label: "Operations",
      items: [
        { key: "inventory", label: "Inventory Management", icon: ICONS.inventory, path: "/dashboard/inventory" },
        { key: "retail", label: "Retail Dispatch", icon: ICONS.retail, path: "/dashboard/retail-dispatch" },
        { key: "ecom", label: "Ecommerce Dispatch", icon: ICONS.ecom, path: "/dashboard/ecom-dispatch" },
        { key: "erm", label: "CRM", icon: ICONS.erm, path: "/dashboard/erm", permission: "erm_dashboard_view" },
        { key: "clout", label: "Clout", icon: ICONS.clout, path: "/dashboard/clout", permission: "clout_drive_view" },
      ]
    },
    {
      label: "Business",
      items: [
        { key: "party-rates", label: "Party Wise Rate", icon: ICONS.party },
        { key: "brands", label: "Brand Manager", icon: ICONS.brands },
        { key: "catalog", label: "Catalog Sharing", icon: ICONS.catalog },
      ]
    },
    {
      label: "Management",
      items: [
        { key: "users", label: "User Access Control", icon: ICONS.users, count: usersCount },
        { key: "tasks", label: "Administrative Tasks", icon: ICONS.tasks, count: tasksCount },
        { key: "logs", label: "Activity Logs", icon: ICONS.logs },
      ]
    },
    {
      label: "Account",
      items: [
        { key: "profile", label: "My Profile", icon: ICONS.profile },
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
        ...S.sidebar,
        width: isDesktop ? (isCollapsed ? 78 : 260) : 280,
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
                <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>Admin Console</div>
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
              color: "#818cf8",
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

        {/* Unified Navigation */}
        <div style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: "0 10px 20px",
          scrollbarWidth: "none",
        }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              {(() => {
                const visibleItems = group.items.filter((item) => !item.permission || hasPermission(userData || user, item.permission));
                if (visibleItems.length === 0) return null;
                return (
                  <>
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
                  const isActive = tab === item.key;
                  return (
                    <button 
                      key={item.key} 
                      onClick={() => { 
                        if (item.path) {
                          router.push(item.path);
                        } else {
                          setTab(item.key); 
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
                        background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                        color: isActive ? "#a5b4fc" : "#94a3b8",
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
                        <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, background: "#818cf8", borderRadius: "0 4px 4px 0" }} />
                      )}
                      
                      <span style={{ 
                        color: isActive ? "#818cf8" : "#475569", 
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
                          background: isActive ? "#818cf8" : "#334155", 
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
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, animation: "fadeInUp 0.3s ease-out" }}>
                          <path d="M5 12h14M12 5l7 7-7 7"></path>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Footer User Info - No Background Rectangles */}
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
            {userData?.profilePic ? (
              <img src={userData.profilePic} alt="DP" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 9, background: roleBg.admin, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>{currentName[0]?.toUpperCase() || "A"}</div>
            )}
            
            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0, animation: "fadeInUp 0.3s ease-out" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</div>
                <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>Admin</div>
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

