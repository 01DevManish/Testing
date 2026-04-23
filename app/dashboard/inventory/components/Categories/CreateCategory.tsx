"use client";

import React, { useState } from "react";
import { ref, push, set } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../../../lib/firebase";
import { FONT, Category } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, SuccessBanner, Card, PageHeader } from "../../ui";
import { touchDataSignal } from "../../../../lib/dataSignals";

export default function CreateCategory({ user, onCreated }: { user: { uid: string; name: string }, onCreated?: (c: Category) => void }) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!name.trim()) { setError("Category name is required"); return; }
        setSaving(true);
        try {
            const d = { name: name.trim(), description: desc.trim(), createdAt: Date.now() };
            const newRef = push(ref(db, "categories"));
            await set(newRef, d);
            await touchDataSignal("categories");

            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Category Created",
                description: `Category "${name}" was created by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { categoryId: newRef.key }
            });

            onCreated?.({ id: newRef.key as string, ...d } as Category);
            setSuccess(`Category "${name}" created.`);
            setName(""); setDesc(""); setError("");
        } catch (e) { console.error(e); alert("Failed to create category."); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <PageHeader title="Create Category" sub="Add a new product category." />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <Card style={{ maxWidth: 520 }}>
                <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <FormField label="Category Name" required>
                        <Input value={name} onChange={e => { setName(e.target.value); setError(""); }}
                            style={error ? { borderColor: "#ef4444" } : {}} />
                        {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: FONT }}>{error}</div>}
                    </FormField>
                    <FormField label="Description">
                        <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                    </FormField>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                        <BtnGhost onClick={() => { setName(""); setDesc(""); setError(""); }}>Reset</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Create Category</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}

