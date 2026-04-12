"use client";

import React, { useState } from "react";
import { ref, remove } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { Product, ItemGroup } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Card, PageHeader, EmptyState } from "../../ui";
import EditItemGroupModal from "./EditItemGroupModal";

export default function ItemGroupList({ groups, products, user, canDelete, isMobile }: {
    groups: ItemGroup[];
    products: Product[];
    user: { uid: string; name: string };
    canDelete?: boolean;
    isMobile?: boolean;
}) {
    const [editing, setEditing] = useState<ItemGroup | null>(null);

    return (
        <div>
            <PageHeader title="All Item Groups" sub="Manage your product groups and their contents." />
            {groups.length === 0 ? (
                <EmptyState title="No Groups Found" sub="You haven't created any item groups yet." />
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                    {groups.map((g) => (
                        <Card key={g.id}>
                            <div style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 500, color: "#1e293b", marginBottom: 6 }}>{g.name}</div>
                                    <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 12 }}>{g.description || "No description."}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", borderRadius: 6, color: "#475569", fontWeight: 500 }}>
                                            {g.productIds?.length || 0} Products
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                        onClick={() => setEditing(g)}
                                        style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: 8, fontSize: 12, color: "#475569", cursor: "pointer", transition: "0.2s" }}
                                    >
                                        Edit
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete group "${g.name}"?`)) {
                                                    await remove(ref(db, `itemGroups/${g.id}`));
                                                    await logActivity({
                                                        type: "inventory",
                                                        action: "delete",
                                                        title: "Item Group Deleted",
                                                        description: `Item Group "${g.name}" was deleted by ${user.name}.`,
                                                        userId: user.uid,
                                                        userName: user.name,
                                                        userRole: "admin",
                                                        metadata: { groupId: g.id, groupName: g.name }
                                                    });
                                                }
                                            }}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex", borderRadius: 6, transition: "all 0.2s" }}
                                            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                                            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {editing && (
                <EditItemGroupModal
                    group={editing}
                    user={user}
                    allProducts={products || []}
                    onClose={() => setEditing(null)}
                    isMobile={isMobile}
                />
            )}
        </div>
    );
}
