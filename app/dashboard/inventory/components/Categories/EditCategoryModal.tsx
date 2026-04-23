"use client";

import React, { useState } from "react";
import { ref, update } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../../../lib/firebase";
import { Category } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, Card } from "../../ui";
import { touchDataSignal } from "../../../../lib/dataSignals";

export default function EditCategoryModal({ category, user, onClose }: {
    category: Category;
    user: { uid: string; name: string };
    onClose: () => void;
}) {
    const [name, setName] = useState(category.name);
    const [desc, setDesc] = useState(category.description || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await update(ref(db, `categories/${category.id}`), { name: name.trim(), description: desc.trim() });
            await touchDataSignal("categories");
            await logActivity({
                type: "inventory",
                action: "update",
                title: "Category Updated",
                description: `Category "${category.name}" was updated by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { categoryId: category.id }
            });
            onClose();
        } catch (e) { console.error(e); alert("Failed to update."); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Card style={{ maxWidth: 460, width: "100%" }}>
                <div style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", marginBottom: 20 }}>Edit Category</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <FormField label="Category Name" required><Input value={name} onChange={e => setName(e.target.value)} /></FormField>
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

