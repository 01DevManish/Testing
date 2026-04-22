"use client";

import React, { useState } from "react";
import { ref, update, get } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { Collection } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, Card } from "../../ui";
import { allocateUniqueCollectionCode } from "../../utils/barcodeUtils";
import { touchDataSignal } from "../../../../lib/dataSignals";

export default function EditCollectionModal({ collection, user, onClose }: {
    collection: Collection;
    user: { uid: string; name: string };
    onClose: () => void;
}) {
    const [name, setName] = useState(collection.name);
    const [code, setCode] = useState(collection.collectionCode || "");
    const [desc, setDesc] = useState(collection.description || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const snap = await get(ref(db, "collections"));
            const allCollections: Collection[] = [];
            if (snap.exists()) {
                snap.forEach((child) => {
                    allCollections.push({ id: child.key as string, ...child.val() } as Collection);
                });
            }
            const others = allCollections.filter(c => c.id !== collection.id);
            const assignedCode = allocateUniqueCollectionCode(others, code.trim() || collection.collectionCode || "");
            await update(ref(db, `collections/${collection.id}`), { 
                name: name.trim(), 
                collectionCode: assignedCode,
                description: desc.trim() 
            });
            await touchDataSignal("collections");
            await logActivity({
                type: "inventory",
                action: "update",
                title: "Collection Updated",
                description: `Collection "${collection.name}" was updated by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { collectionId: collection.id }
            });
            onClose();
        } catch (e) { console.error(e); alert("Failed to update."); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Card style={{ maxWidth: 460, width: "100%" }}>
                <div style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", marginBottom: 20 }}>Edit Collection</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 16 }}>
                            <FormField label="Collection Name" required><Input value={name} onChange={e => setName(e.target.value)} /></FormField>
                            <FormField label="Code"><Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="000" /></FormField>
                        </div>
                        <FormField label="Description"><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} /></FormField>
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Save Changes</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}
