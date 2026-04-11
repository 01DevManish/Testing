"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FONT, ActiveView } from "./types";

interface NavItem { id: ActiveView; label: string }
interface NavGroup { key: string; label: string; icon: React.ReactNode; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
    {
        key: "overview", label: "Dashboard",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
        items: [{ id: "overview", label: "Dashboard" }],
    },
    {
        key: "inventory", label: "Inventory Adjustment",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 6 4 14H4L8 6"></path><path d="M12 2v4"></path><path d="M8 2v4"></path><path d="M16 2v4"></path><rect x="3" y="6" width="18" height="4" rx="1"></rect></svg>,
        items: [
            { id: "inventory-adjustment", label: "Inventory Adjustment" },
        ],
    },
    {
        key: "product", label: "Items",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>,
        items: [
            { id: "product-create", label: "Create Item" },
            { id: "inventory-bulk", label: "Bulk Upload" },
            { id: "product-list", label: "All Items" },
        ],
    },
    {
        key: "category", label: "Category",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>,
        items: [
            { id: "category-create", label: "Create Category" },
            { id: "category-list", label: "All Categories" },
        ],
    },
    {
        key: "collections", label: "Collections",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
        items: [
            { id: "collections-create", label: "Create Collection" },
            { id: "collections-list", label: "All Collections" },
        ],
    },
    {
        key: "grouping", label: "Item Grouping",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>,
        items: [
            { id: "grouping-create", label: "Create Group" },
            { id: "grouping-list", label: "All Groups" },
        ],
    },
    {
        key: "catalog", label: "Catalog Sharing",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
        items: [{ id: "catalog", label: "Catalog Sharing" }],
    },
    {
        key: "barcode", label: "Barcode Manager",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5v14"></path><path d="M21 5v14"></path><path d="M7 5v14"></path><path d="M11 5v14"></path><path d="M17 5v14"></path><path d="M13 5v14"></path></svg>,
        items: [{ id: "inventory-barcode-create", label: "Barcode Generator" }],
    },
];

interface Props {
    activeView: ActiveView;
    onNavigate: (view: ActiveView) => void;
    currentName: string;
    currentRole: string;
    onLogout: () => void;
    userRoleColor: string;
    onDashboardBack: () => void;
}

export default function InventorySidebar({
    activeView, onNavigate, currentName, currentRole,
    onLogout, userRoleColor, onDashboardBack,
}: Props) {
    const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === activeView))?.key || "product";
    const [expandedGroup, setExpandedGroup] = useState<string>(activeGroup);

    const toggleGroup = (key: string) => setExpandedGroup(prev => prev === key ? "" : key);

    const handleItem = (groupKey: string, itemId: ActiveView) => {
        setExpandedGroup(groupKey);
        onNavigate(itemId);
    };

    return (
        <aside style={{
            width: 260, background: "#0f172a",
            display: "flex", flexDirection: "column",
            height: "100%", overflowY: "auto", overflowX: "hidden",
        }}>
            {/* Brand */}
            <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                    <img src="/logo.png" alt="Logo" style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 7, background: "#fff", padding: 2, flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: FONT, letterSpacing: "-0.01em" }}>EURUS LIFESTYLE</div>
                        <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: FONT }}>Inventory Hub</div>
                    </div>
                </div>
                <button onClick={onDashboardBack} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 10px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, fontFamily: FONT, fontWeight: 400, cursor: "pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M8 2L4 6.5L8 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back to Dashboard
                </button>
            </div>

            {/* Section label */}
            <div style={{ padding: "14px 18px 6px", flexShrink: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 400, color: "#334155", textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: FONT }}>
                    Inventory Management
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
                {NAV_GROUPS.map((group) => {
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
                                    padding: "9px 10px", borderRadius: 9, border: "none",
                                    background: hasActive && (!isOpen || isSingle) ? "rgba(99,102,241,0.08)" : "transparent",
                                    color: hasActive ? "#a5b4fc" : "#64748b",
                                    cursor: "pointer", fontFamily: FONT, textAlign: "left",
                                    transition: "background 0.15s",
                                }}
                            >
                                <span style={{ color: hasActive ? "#818cf8" : "#475569", flexShrink: 0, display: "flex", alignItems: "center", marginRight: 9 }}>
                                    {group.icon}
                                </span>
                                <span style={{ flex: 1, fontSize: 13, fontWeight: hasActive ? 600 : 500, letterSpacing: "-0.01em" }}>
                                    {group.label}
                                </span>
                                {hasActive && (!isOpen || isSingle) && (
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", marginRight: 6, flexShrink: 0 }} />
                                )}
                                {!isSingle && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                                        style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", color: "#475569" }}>
                                        <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>

                            {/* Sub items */}
                            {!isSingle && isOpen && (
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
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{currentName}</div>
                        <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", fontFamily: FONT }}>{currentRole}</div>
                    </div>

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
                        flexShrink: 0
                    }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </div>
        </aside>
    );
}