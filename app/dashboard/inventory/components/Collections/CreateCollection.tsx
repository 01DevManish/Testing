"use client";

import React, { useState } from "react";
import { ref, push, set, get } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { FONT, Collection } from "../../types";
import { logActivity } from "../../../../lib/activityLogger";
import { Input, Textarea, FormField, BtnPrimary, BtnGhost, SuccessBanner, Card, PageHeader } from "../../ui";
import { allocateUniqueCollectionCode } from "../../utils/barcodeUtils";
import { touchDataSignal } from "../../../../lib/dataSignals";

export default function CreateCollection({ user, onCreated }: { user: { uid: string; name: string }, onCreated?: (c: Collection) => void }) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [desc, setDesc] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!name.trim()) { setError("Collection name is required"); return; }
        setSaving(true);
        try {
            const existingSnap = await get(ref(db, "collections"));
            const existingCollections: Collection[] = [];
            if (existingSnap.exists()) {
                existingSnap.forEach((child) => {
                    existingCollections.push({ id: child.key as string, ...child.val() } as Collection);
                });
            }
            const assignedCode = allocateUniqueCollectionCode(existingCollections, code.trim());
            const d = { 
                name: name.trim(), 
                collectionCode: assignedCode,
                description: desc.trim(), 
                createdAt: Date.now() 
            };
            const newRef = push(ref(db, "collections"));
            await set(newRef, d);
            await touchDataSignal("collections");

            await logActivity({
                type: "inventory",
                action: "create",
                title: "New Collection Created",
                description: `Collection "${name}" was created by ${user.name}.`,
                userId: user.uid,
                userName: user.name,
                userRole: "admin",
                metadata: { collectionId: newRef.key }
            });

            onCreated?.({ id: newRef.key as string, ...d } as Collection);
            setSuccess(`Collection "${name}" created with code ${assignedCode}.`);
            setName(""); setCode(""); setDesc(""); setError("");
        } catch (e) { console.error(e); alert("Failed to create collection."); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <PageHeader title="Create Collection" sub="Add a new product collection with optional 3-digit code." />
            {success && <SuccessBanner message={success} onClose={() => setSuccess("")} />}
            <Card style={{ maxWidth: 520 }}>
                <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 16 }}>
                        <FormField label="Collection Name" required>
                            <Input value={name} onChange={e => { setName(e.target.value); setError(""); }}
                                style={error ? { borderColor: "#ef4444" } : {}} />
                        </FormField>
                        <FormField label="Code">
                            <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="000" />
                        </FormField>
                    </div>
                    {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: -8, fontFamily: FONT }}>{error}</div>}
                    <FormField label="Description">
                        <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
                    </FormField>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                        <BtnGhost onClick={() => { setName(""); setCode(""); setDesc(""); setError(""); }}>Reset</BtnGhost>
                        <BtnPrimary onClick={handleSave} loading={saving}>Create Collection</BtnPrimary>
                    </div>
                </div>
            </Card>
        </div>
    );
}
