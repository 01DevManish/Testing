"use client";

import React, { useState } from "react";
import { ref, remove } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { Collection } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Card, PageHeader, EmptyState } from "../../ui";
import EditCollectionModal from "./EditCollectionModal";

export default function CollectionList({ collections, user, canDelete }: {
    collections: Collection[];
    user: { uid: string; name: string };
    canDelete?: boolean;
}) {
    const [editing, setEditing] = useState<Collection | null>(null);

    return (
        <div>
            <PageHeader title="All Collections" sub="Manage your product collections and identification codes." />
            {collections.length === 0 ? (
                <EmptyState title="No Collections Found" sub="You haven't created any collections yet." />
            ) : (
                <Card>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 1 }}>
                        {collections.map((c) => (
                            <div key={c.id} style={{ padding: 20, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#fff", transition: "all 0.2s" }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>{c.name}</div>
                                        {c.collectionCode && (
                                            <span style={{ fontSize: 10, padding: "2px 6px", background: "#f1f5f9", borderRadius: 4, color: "#64748b", fontWeight: 500 }}>Code: {c.collectionCode}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, maxWidth: "90%" }}>{c.description || "No description provided."}</div>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                        onClick={() => setEditing(c)}
                                        style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: 8, fontSize: 12, color: "#475569", cursor: "pointer", transition: "0.2s" }}
                                    >
                                        Edit
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete collection "${c.name}"?`)) {
                                                    await remove(ref(db, `collections/${c.id}`));
                                                    await logActivity({
                                                        type: "inventory",
                                                        action: "delete",
                                                        title: "Collection Deleted",
                                                        description: `Collection "${c.name}" was deleted by ${user.name}.`,
                                                        userId: user.uid,
                                                        userName: user.name,
                                                        userRole: "admin",
                                                        metadata: { collectionId: c.id }
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
                        ))}
                    </div>
                </Card>
            )}

            {editing && (
                <EditCollectionModal
                    collection={editing}
                    user={user}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}
