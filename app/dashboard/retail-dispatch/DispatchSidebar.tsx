"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FONT, ActiveView } from "./types";

interface NavItem { id: ActiveView; label: string }
interface NavGroup { key: string; label: string; icon: React.ReactNode; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
    {
        key: "overview", label: "Dashboard",
        icon: (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4.5 10V8M7.5 10V6M10.5 10V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
        items: [{ id: "overview", label: "Dashboard" }],
    },
    {
        key: "dispatch", label: "Dispatches",
        icon: (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M1 4.5h6v7H1v-7zM7 6.5h4l2.5 2v3H7v-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="3.5" cy="11.5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="10.5" cy="11.5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
        ),
        items: [
            { id: "create-dispatch", label: "Create Dispatch" },
            { id: "order-list", label: "All Dispatches" },
        ],
    },
    {
        key: "tools", label: "Tools",
        icon: (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2.5 7.5h10M2.5 4.5h10M2.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        ),
        items: [
            { id: "add-order", label: "Add Unknown Order" },
            { id: "scanner", label: "Scan Barcode" },
        ],
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

export default function DispatchSidebar({
    activeView, onNavigate, currentName, currentRole,
    onLogout, userRoleColor, onDashboardBack,
}: Props) {
    const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === activeView))?.key || "dispatch";
    const [expandedGroup, setExpandedGroup] = useState<string>(activeGroup);

    const toggleGroup = (key: string) => setExpandedGroup(prev => prev === key ? "" : key);

    return (
        <aside style={{
            width: 260, background: "#0f172a",
            display: "flex", flexDirection: "column",
            height: "100%", overflowY: "auto", overflowX: "hidden",
        }}>
            {/* Brand */}
            <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 7, background: "#fff", padding: 2, flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: FONT, letterSpacing: "-0.01em" }}>Eurus Lifestyle</div>
                        <div style={{ fontSize: 9, color: "#818cf8", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: FONT }}>Retail Dispatch Hub</div>
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
                    Dispatch Management
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

            {/* User footer */}
            <div style={{ padding: "14px 12px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: userRoleColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 13, color: "#fff", flexShrink: 0, fontFamily: FONT }}>
                        {currentName[0]?.toUpperCase() || "U"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 400, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{currentName}</div>
                        <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 400, textTransform: "capitalize", fontFamily: FONT }}>{currentRole}</div>
                    </div>
                </div>
                <button onClick={onLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "9px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)", color: "#f87171", fontSize: 12, fontWeight: 400, fontFamily: FONT, cursor: "pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M5 2H3a1 1 0 00-1 1v7a1 1 0 001 1h2M9 9.5L12 6.5M12 6.5L9 3.5M12 6.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
