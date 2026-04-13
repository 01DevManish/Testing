"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FONT, ActiveView } from "../../types";
import { ref, onValue } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../context/AuthContext";

import { hasPermission } from "@/app/lib/permissions";

interface NavItem { id: ActiveView; label: string; permKey?: string }
interface NavGroup { key: string; label: string; icon: React.ReactNode; items: NavItem[]; permKey?: string }

function getNavGroups(userData: any): NavGroup[] {
    const groups: NavGroup[] = [
        {
            key: "overview", label: "Dashboard",
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
            items: [{ id: "overview", label: "Dashboard" }],
        },
        {
            key: "packing", label: "Packing",
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>,
            items: [
                { id: "create-packing-list", label: "Create Packing", permKey: "retail_packing_create" },
                { id: "all-packing-lists", label: "All Packing Lists", permKey: "retail_packing_view" },
            ],
            permKey: "retail_packing_view"
        },
        {
            key: "dispatch_retail", label: "Dispatch",
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><path d="M16 8h4l3 3v5h-7V8z"></path><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>,
            items: [
                { id: "create-dispatch-list", label: "Create Dispatch List", permKey: "retail_dispatch_create" },
                { id: "all-dispatch-lists", label: "All Dispatch List", permKey: "retail_dispatch_view" },
            ],
            permKey: "retail_dispatch_view"
        },
        {
            key: "box_mgnt", label: "Box Management",
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>,
            items: [
                { id: "box-management", label: "Manage Boxes", permKey: "retail_box_view" },
                { id: "dispatch-box", label: "Dispatch Box (New)", permKey: "retail_box_view" },
                { id: "all-box-dispatches", label: "Box History", permKey: "retail_box_view" },
            ],
            permKey: "retail_box_view"
        },
    ];

    return groups.map(g => ({
        ...g,
        items: g.items.filter(item => !item.permKey || hasPermission(userData, item.permKey))
    })).filter(g => g.items.length > 0 && (!g.permKey || hasPermission(userData, g.permKey)));
}


interface Props {
    activeView: ActiveView;
    onNavigate: (view: ActiveView) => void;
    currentName: string;
    currentRole: string;
    onLogout: () => void;
    userRoleColor: string;
    onDashboardBack: () => void;
    isCollapsed: boolean;
    setIsCollapsed: (c: boolean) => void;
    isDesktop: boolean;
}

export default function DispatchSidebar({
    activeView, onNavigate, currentName, currentRole,
    onLogout, userRoleColor, onDashboardBack, isCollapsed, setIsCollapsed, isDesktop
}: Props) {
    const { user, userData } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const navGroups = getNavGroups(userData);
    const activeGroup = navGroups.find(g => g.items.some(i => i.id === activeView))?.key || "packing";
    const [expandedGroup, setExpandedGroup] = useState<string>(activeGroup);

    // Listen for total unread messages
    useEffect(() => {
        if (!user) return;
        const chatsRef = ref(db, `user_chats/${user.uid}`);
        const unsubscribe = onValue(chatsRef, (snapshot) => {
            let total = 0;
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    total += (child.val().unreadCount || 0);
                });
            }
            setUnreadCount(total);
        });
        return () => unsubscribe();
    }, [user]);

    const toggleGroup = (key: string) => setExpandedGroup(prev => prev === key ? "" : key);

    return (
        <aside style={{
            width: isDesktop ? (isCollapsed ? 78 : 260) : 280, 
            background: "#0f172a",
            display: "flex", flexDirection: "column",
            height: "100%", overflow: "visible",
            transition: "width 0.2s cubic-bezier(0, 0, 0.2, 1)",
            willChange: "width",
            position: "relative"
        }}>
            {/* Brand */}
            <div style={{ 
                padding: (isDesktop && isCollapsed) ? "20px 0 14px" : "20px 18px 14px", 
                borderBottom: "1px solid rgba(255,255,255,0.06)", 
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: (isDesktop && isCollapsed) ? "center" : "flex-start",
                transition: "all 0.15s ease-out" 
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: (isDesktop && isCollapsed) ? 0 : 14, justifyContent: (isDesktop && isCollapsed) ? "center" : "flex-start", width: "100%" }}>
                    <img src="/logo.png" alt="Logo" style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 10, background: "#fff", padding: 4, flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} />
                    {(!isCollapsed || !isDesktop) && (
                        <div style={{ animation: "fadeInUp 0.15s ease-out" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: FONT, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>EURUS LIFESTYLE</div>
                            <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: FONT }}>Retail Dispatch Hub</div>
                        </div>
                    )}
                </div>
                {(!isCollapsed || !isDesktop) && (
                    <button onClick={onDashboardBack} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 10px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, fontFamily: FONT, fontWeight: 400, cursor: "pointer", animation: "fadeInUp 0.15s ease-out" }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M8 2L4 6.5L8 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to Dashboard
                    </button>
                )}
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

            {/* Section label */}
            {(!isCollapsed || !isDesktop) && (
                <div style={{ padding: "14px 18px 6px", flexShrink: 0, animation: "fadeInUp 0.15s ease-out" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: FONT }}>
                        Dispatch Management
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
                {navGroups.map((group) => {
                    const isOpen = expandedGroup === group.key;
                    const hasActive = group.items.some(i => i.id === activeView);
                    const isSingle = group.items.length === 1;

                    return (
                        <div key={group.key} style={{ marginBottom: 2 }}>
                            {/* Group header */}
                            <button
                                onClick={() => isSingle ? onNavigate(group.items[0].id) : toggleGroup(group.key)}
                                style={{
                                    display: "flex", alignItems: "center", width: "100%",
                                    padding: isCollapsed ? "10px 0" : "9px 10px", borderRadius: 9, border: "none",
                                    justifyContent: isCollapsed ? "center" : "flex-start",
                                    background: hasActive && (!isOpen || isSingle) ? "rgba(99,102,241,0.08)" : "transparent",
                                    color: hasActive ? "#a5b4fc" : "#64748b",
                                    cursor: "pointer", fontFamily: FONT, textAlign: isCollapsed ? "center" : "left",
                                    transition: "background 0.15s",
                                }}
                            >
                                <span style={{ color: hasActive ? "#818cf8" : "#475569", flexShrink: 0, display: "flex", alignItems: "center", marginRight: isCollapsed ? 0 : 9 }}>
                                    {group.icon}
                                </span>
                                {!isCollapsed && (
                                    <span style={{ flex: 1, fontSize: 13, fontWeight: hasActive ? 600 : 500, letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "space-between", animation: "fadeInUp 0.1s ease-out" }}>
                                        {group.label}
                                        {group.key === "communication" && unreadCount > 0 && (
                                            <span style={{ background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #0f172a", marginLeft: 8 }}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {hasActive && (!isOpen || isSingle) && !isCollapsed && (
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", marginRight: 6, flexShrink: 0 }} />
                                )}
                                {!isSingle && !isCollapsed && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                                        style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", color: "#475569" }}>
                                        <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>

                            {/* Sub items */}
                            {!isSingle && isOpen && !isCollapsed && (
                                <div style={{ paddingLeft: 10, paddingTop: 2, paddingBottom: 4 }}>
                                    <div style={{ borderLeft: "1.5px solid rgba(99,102,241,0.2)", marginLeft: 7 }}>
                                        {group.items.map((item) => {
                                            const isActive = activeView === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => onNavigate(item.id)}
                                                    style={{
                                                        display: "flex", alignItems: "center",
                                                        width: "100%", padding: "7px 10px 7px 16px",
                                                        borderRadius: 7, border: "none",
                                                        background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                                                        color: isActive ? "#a5b4fc" : "#64748b",
                                                        fontSize: 12, fontFamily: FONT,
                                                        fontWeight: isActive ? 600 : 400,
                                                        cursor: "pointer", textAlign: "left",
                                                        transition: "background 0.12s", position: "relative",
                                                    }}
                                                >
                                                    <span style={{
                                                        position: "absolute", left: -5,
                                                        width: isActive ? 9 : 5, height: isActive ? 9 : 5,
                                                        borderRadius: "50%",
                                                        background: isActive ? "#6366f1" : "rgba(99,102,241,0.2)",
                                                        border: isActive ? "2px solid #0f172a" : "none",
                                                        flexShrink: 0,
                                                    }} />
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

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 14px", flexShrink: 0 }} />

            {/* User footer - Condensed Row */}
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
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: userRoleColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0, fontFamily: FONT }}>
                        {currentName[0]?.toUpperCase() || "U"}
                    </div>
                    
                    {!isCollapsed && (
                        <div style={{ flex: 1, minWidth: 0, animation: "fadeInUp 0.15s ease-out" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{currentName}</div>
                            <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", fontFamily: FONT }}>{currentRole}</div>
                        </div>
                    )}

                    {!isCollapsed && (
                        <button onClick={onLogout} title="Sign Out" style={{ 
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
                            animation: "fadeInUp 0.15s ease-out"
                        }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
