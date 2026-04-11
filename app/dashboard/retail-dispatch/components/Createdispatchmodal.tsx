"use client";

import { useState, useRef, useEffect } from "react";
import { api, firestoreApi } from "../data";
import { useAuth } from "../../../context/AuthContext";
import { ref, update } from "firebase/database";
import { db } from "../../../lib/firebase";
import { logActivity } from "../../../lib/activityLogger";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Party { id: string; name: string; city?: string; gst?: string; gstin?: string; address?: string }
interface Product { id: string; name: string; sku: string; stock: number; unit: string; productName?: string }

interface DispatchForm {
    party: Party | null;
    newParty: { 
        name: string; 
        phone: string; 
        email: string; 
        address: string; 
        city: string; 
        state: string; 
        pincode: string; 
        gst: string;
    };
    isNewParty: boolean;

    product: Product | null;
    newProduct: { name: string; sku: string; unit: string };
    isNewProduct: boolean;

    packagingType: string;
    remarks: string;
    quantity: number;
    transporter: string;
    invoiceNo: string;
    lrNo: string;
}

const PACKAGING_OPTIONS = ["PVC", "PVC Zip", "Bookfold", "Envolope Fold", "HOMCOT Bag", "Comfy Bag", "Comfy set Bag", "Embeoize Bag", "UC Comfy Bag", "Other"];
const TRANSPORTERS = ["DTDC", "Delhivery", "BlueDart", "FedEx", "Ecom Express", "Own Vehicle", "Other"];

const STEPS = [
    { no: 1, label: "Party", icon: "🏢" },
    { no: 2, label: "Product", icon: "📦" },
    { no: 3, label: "Packaging", icon: "🗃️" },
    { no: 4, label: "Remarks", icon: "📝" },
    { no: 5, label: "Quantity", icon: "🔢" },
    { no: 6, label: "Transporter", icon: "🚛" },
    { no: 7, label: "Shipping", icon: "📄" },
    { no: 8, label: "Confirm", icon: "✅" },
];

function dispatchId() {
    return "DSP-" + Math.floor(Math.random() * 900000 + 100000).toString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CreateDispatchModal({ onClose, onDispatched, dispatchType }: {
    onClose: () => void;
    onDispatched?: (data: any) => void;
    dispatchType?: "retail" | "ecom";
}) {
    const { user, userData } = useAuth();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<DispatchForm>({
        party: null, 
        newParty: { 
            name: "", 
            phone: "", 
            email: "", 
            address: "", 
            city: "", 
            state: "", 
            pincode: "", 
            gst: "" 
        }, 
        isNewParty: false,
        product: null, newProduct: { name: "", sku: "", unit: "PCS" }, isNewProduct: false,
        packagingType: "", remarks: "", quantity: 1, transporter: "", invoiceNo: "", lrNo: "",
    });

    const [dbParties, setDbParties] = useState<Party[]>([]);
    const [dbProducts, setDbProducts] = useState<Product[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isVerifyingGst, setIsVerifyingGst] = useState(false);

    const handleVerifyGst = async (gstin: string) => {
        if (!gstin || gstin.length !== 15) {
            alert("Please enter a valid 15-digit GST number.");
            return;
        }
        setIsVerifyingGst(true);
        try {
            const res = await fetch(`/api/gst?gstin=${gstin}`);
            const result = await res.json();
            if (result.success && result.data) {
                setForm(f => ({
                    ...f,
                    newParty: {
                        ...f.newParty,
                        name: result.data.companyName || result.data.legalName,
                        address: result.data.address || "",
                        city: result.data.city || "",
                        state: result.data.state || "",
                        pincode: result.data.pincode || "",
                        gst: gstin
                    }
                }));
            } else {
                alert(result.error || "GSTIN validation failed.");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to verify GST. Please check your connection.");
        } finally {
            setIsVerifyingGst(false);
        }
    };

    useEffect(() => {
        firestoreApi.getParties().then(res => setDbParties(res));
        firestoreApi.getInventoryProducts().then(res => {
            const mapped = res.map(p => ({
                id: p.id,
                name: p.productName || "Unknown",
                sku: p.sku || "N/A",
                stock: p.stock || 0,
                unit: p.unit || "PCS"
            }));
            setDbProducts(mapped);
        });
    }, []);

    // PIN confirmation
    const [pinStep, setPinStep] = useState(false);
    const [pin, setPin] = useState(["", "", "", ""]);
    const [pinError, setPinError] = useState("");
    const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

    const hasPin = !!userData?.dispatchPin;

    // Print
    const [dispatched, setDispatched] = useState(false);
    const [dispatchRef] = useState(dispatchId());
    const printRef = useRef<HTMLDivElement>(null);

    // Delete Party Confirmation
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Filter search
    const [partySearch, setPartySearch] = useState("");
    const [productSearch, setProductSearch] = useState("");

    const filteredParties = dbParties.filter(p =>
        p.name?.toLowerCase().includes(partySearch.toLowerCase()) ||
        (p.city && p.city.toLowerCase().includes(partySearch.toLowerCase()))
    );
    const filteredProducts = dbProducts.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    );

    function canProceed() {
        if (step === 1) return form.isNewParty ? form.newParty.name.trim() !== "" : form.party !== null;
        if (step === 2) return form.isNewProduct ? form.newProduct.name.trim() !== "" : form.product !== null;
        if (step === 3) return form.packagingType !== "";
        if (step === 5) {
            if (!form.isNewProduct && form.product && form.quantity > form.product.stock) return false;
            return form.quantity >= 1;
        }
        if (step === 6) return form.transporter !== "";
        if (step === 7) return form.invoiceNo.trim() !== "" && form.lrNo.trim() !== "";
        return true;
    }

    function handlePinInput(idx: number, val: string) {
        if (!/^\d?$/.test(val)) return;
        const np = [...pin]; np[idx] = val; setPin(np);
        setPinError("");
        if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    }
    
    function handlePinKeyDown(idx: number, e: React.KeyboardEvent) {
        if (e.key === "Backspace" && !pin[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
    }

    async function handleConfirmPin() {
        const enteredPin = pin.join("");
        
        // Mode 1: First time setup
        if (!hasPin) {
            if (enteredPin.length < 4) return;
            setIsSaving(true);
            try {
                await update(ref(db, `users/${user?.uid}`), { dispatchPin: enteredPin });
                alert("Dispatch PIN created successfully! Please proceed to confirm dispatch.");
                setPin(["", "", "", ""]);
                // Refresh window to get new userData if not using a listener, 
                // but since we are in a wizard, let's just use local state for this session.
                // Or better, the AuthContext should handle it if it listens.
                window.location.reload(); // Simplest way to ensure context updates for now
                return;
            } catch (e) {
                setPinError("Failed to set PIN.");
                setIsSaving(false);
                return;
            }
        }

        // Mode 2: Verification
        if (enteredPin !== userData?.dispatchPin) {
            setPinError("Incorrect PIN. Please try again.");
            setPin(["", "", "", ""]);
            pinRefs[0].current?.focus();
            return;
        }

        setIsSaving(true);
        try {
            // Deduct Stock
            if (!form.isNewProduct && form.product) {
                await firestoreApi.deductStock(form.product.id, form.quantity);
            }

            // Deduct or Create Party
            let partyId = form.party?.id;
            const finalPartyName = form.isNewParty ? form.newParty.name : form.party?.name;
            if (form.isNewParty) {
               const p = await firestoreApi.createParty({
                   name: form.newParty.name,
                   phone: form.newParty.phone,
                   email: form.newParty.email,
                   address: form.newParty.address,
                   city: form.newParty.city,
                   state: form.newParty.state,
                   pincode: form.newParty.pincode,
                   gstin: form.newParty.gst,
                   createdAt: new Date().toISOString()
               });
               partyId = p.id;
            }

            // Create Order/Dispatch
            const finalProductName = form.isNewProduct ? form.newProduct.name : form.product?.name;
            const finalProdId = form.isNewProduct ? `NEW-${Date.now()}` : form.product?.id || `PROD-${Date.now()}`;

            await api.createOrder({
                id: dispatchRef,
                customer: { name: finalPartyName || "Transporter", phone: "", address: form.isNewParty ? form.newParty.city : (form.party?.city || "") },
                paymentStatus: "Paid",
                status: "Dispatched",
                dispatchDate: new Date().toISOString().split('T')[0],
                products: [{ id: finalProdId, name: finalProductName || "Item", quantity: form.quantity, price: 0, packed: true }],
                logs: [
                    { status: "Pending", timestamp: new Date(Date.now() - 1000).toISOString(), user: "System" },
                    { status: "Packed", timestamp: new Date(Date.now() - 500).toISOString(), user: "System" },
                    { status: "Dispatched", timestamp: new Date().toISOString(), user: userData?.name || "User", note: form.remarks }
                ],
                partyId,
                dispatchRef,
                transporter: form.transporter,
                invoiceNo: form.invoiceNo,
                lrNo: form.lrNo,
                confirmedByPin: true,
                dispatchType: dispatchType
            });

            // Log activity
            await logActivity({
                type: "dispatch",
                action: "create",
                title: "New Dispatch Created",
                description: `Dispatch ${dispatchRef} created for ${finalPartyName} (${form.quantity} ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || "units"}) by ${userData?.name || "User"}.`,
                userId: user?.uid || "unknown",
                userName: userData?.name || "User",
                userRole: userData?.role || "staff",
                metadata: { dispatchId: dispatchRef, partyId, prodId: finalProdId }
            });

            setDispatched(true);
            onDispatched?.({ ...form, ref: dispatchRef });
        } catch (e) {
            console.error(e);
            setPinError("Failed to save dispatch to database.");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteParty(id: string) {
        setIsSaving(true);
        try {
            await firestoreApi.deleteParty(id);
            const partyToDelete = dbParties.find(p => p.id === id);
            
            // Log activity
            await logActivity({
                type: "user",
                action: "delete",
                title: "Party Deleted",
                description: `Party "${partyToDelete?.name || "Unknown"}" was deleted by ${userData?.name || "User"}.`,
                userId: user?.uid || "unknown",
                userName: userData?.name || "User",
                userRole: userData?.role || "staff",
                metadata: { partyId: id }
            });

            setDbParties(prev => prev.filter(p => p.id !== id));
            if (form.party?.id === id) setForm(f => ({ ...f, party: null }));
            setDeleteConfirmId(null);
        } catch (e) {
            alert("Failed to delete party.");
        } finally {
            setIsSaving(false);
        }
    }

    function handlePrint() {
        const win = window.open("", "_blank");
        if (!win || !printRef.current) return;
        win.document.write(`<html><head><title>Dispatch Slip</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:32px;color:#111;max-width:720px;margin:auto}
        h1{font-size:22px;font-weight:400;margin-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        td,th{padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;text-align:left}
        th{background:#f9fafb;font-weight:400;color:#374151}
        @media print{body{padding:16px}}
      </style>
    </head><body>${printRef.current.innerHTML}</body></html>`);
        win.document.close();
        win.print();
    }

    const partyName = form.isNewParty ? form.newParty.name : form.party?.name;
    const productName = form.isNewProduct ? form.newProduct.name : form.product?.name;

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div style={overlay}>
            <div style={modal}>

                {/* ── Header ─────────────────────────────────────────────────────── */}
                <div style={modalHeader}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 400, color: "#0f172a", letterSpacing: "-0.02em" }}>
                            {dispatched ? "✅ Dispatch Confirmed" : pinStep ? "🔐 Confirm with PIN" : "Create Dispatch"}
                        </div>
                        {!dispatched && !pinStep && (
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                Step {step} of 8 — {STEPS[step - 1].label}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={{ fontSize: 13, fontWeight: 400, color: "#64748b", background: "none", border: "none", cursor: "pointer", transition: "color 0.2s" }}>
                        ← Back to Overview
                    </button>
                </div>

                {/* ── Progress Bar ────────────────────────────────────────────────── */}
                {!dispatched && !pinStep && (
                    <div style={{ padding: "0 28px", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                            {STEPS.map(s => (
                                <div key={s.no} style={{
                                    flex: 1, height: 4, borderRadius: 99,
                                    background: step >= s.no ? "#6366f1" : "#e2e8f0",
                                    transition: "background 0.3s"
                                }} />
                            ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            {STEPS.map(s => (
                                <div key={s.no} style={{ fontSize: 9, color: step >= s.no ? "#6366f1" : "#cbd5e1", fontWeight: 400, textAlign: "center", flex: 1 }}>
                                    {s.icon}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Body ───────────────────────────────────────────────────────── */}
                <div style={modalBody}>

                    {dispatched && (
                        <div>
                            <div style={{ textAlign: "center", marginBottom: 24 }}>
                                <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
                                <div style={{ fontSize: 16, fontWeight: 400, color: "#0f172a" }}>Dispatch is ready!</div>
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Ref: <b>{dispatchRef}</b></div>
                            </div>

                            <div ref={printRef} style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 20 }}>
                                <h1 style={{ fontSize: 20, fontWeight: 400, margin: 0 }}>Eurus Lifestyle — Dispatch Slip</h1>
                                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Ref: {dispatchRef} &nbsp;|&nbsp; {new Date().toLocaleString()}</div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                    <tbody>
                                        {[
                                            ["Party", partyName || "—"],
                                            ["City", form.isNewParty ? form.newParty.city : (form.party?.city || "—")],
                                            ["GST", form.isNewParty ? (form.newParty.gst || "N/A") : (form.party?.gst || form.party?.gstin || "N/A")],
                                            ["Product", productName || "—"],
                                            ["SKU", form.isNewProduct ? form.newProduct.sku : (form.product?.sku || "—")],
                                            ["Packaging", form.packagingType],
                                            ["Quantity", `${form.quantity} ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || ""}`],
                                            ["Invoice No.", form.invoiceNo],
                                            ["LR No.", form.lrNo],
                                            ["Transporter", form.transporter],
                                            ["Remarks", form.remarks || "—"],
                                        ].map(([k, v]) => (
                                            <tr key={k as string}>
                                                <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", fontWeight: 400, background: "#f1f5f9", color: "#374151", width: "35%" }}>{k}</td>
                                                <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", color: "#0f172a" }}>{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8", display: "flex", justifySelf: "space-between" }}>
                                    <span>Authorised by PIN ✓</span>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={handlePrint} style={btnPrimary}>🖨️ Print Dispatch Slip</button>
                                <button onClick={onClose} style={btnGhost}>Return to Overview</button>
                            </div>
                        </div>
                    )}

                    {!dispatched && pinStep && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>{hasPin ? "🔐" : "🆕"}</div>
                            <div style={{ fontSize: 16, fontWeight: 400, color: "#0f172a", marginBottom: 4 }}>
                                {hasPin ? "Enter Dispatch PIN" : "Setup Dispatch PIN"}
                            </div>
                            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                                {hasPin 
                                    ? "Enter your 4-digit PIN to confirm and deduct stock from inventory."
                                    : "This is your first time. Please choose a 4-digit PIN for future dispatch confirmations."
                                }
                            </div>

                            {hasPin && (
                                <div style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
                                        <div><span style={{ color: "#94a3b8", fontWeight: 400 }}>Party:</span> <b>{partyName}</b></div>
                                        <div><span style={{ color: "#94a3b8", fontWeight: 400 }}>Product:</span> <b>{productName}</b></div>
                                        <div><span style={{ color: "#94a3b8", fontWeight: 400 }}>Qty deducting:</span> <b>{form.quantity}</b></div>
                                        <div><span style={{ color: "#94a3b8", fontWeight: 400 }}>Inv No:</span> <b>{form.invoiceNo}</b></div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
                                {pin.map((d, i) => (
                                    <input
                                        key={i} ref={pinRefs[i]} type="password" inputMode="numeric" maxLength={1} value={d}
                                        onChange={e => handlePinInput(i, e.target.value)} onKeyDown={e => handlePinKeyDown(i, e)}
                                        style={{ width: 52, height: 60, borderRadius: 0, border: pinError ? "2px solid #ef4444" : "2px solid #e2e8f0", fontSize: 28, fontWeight: 400, textAlign: "center", outline: "none", background: "#fff", color: "#0f172a" }}
                                        autoFocus={i === 0} disabled={isSaving}
                                    />
                                ))}
                            </div>

                            {pinError && <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 400, marginBottom: 16 }}>{pinError}</div>}

                            {hasPin && (
                                <div style={{ marginBottom: 20 }}>
                                    <p style={{ fontSize: 12, color: "#94a3b8" }}>
                                        Forgotten your PIN? <span style={{ color: "#6366f1", fontWeight: 400, cursor: "pointer" }} onClick={() => alert("Please contact your Administrator to reset your Dispatch PIN.")}>Contact Admin</span>
                                    </p>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                <button onClick={handleConfirmPin} disabled={pin.some(p => p === "") || isSaving} style={{ ...btnPrimary, opacity: pin.some(p => p === "") || isSaving ? 0.5 : 1 }}>
                                    {isSaving ? "Saving..." : hasPin ? "✅ Confirm Dispatch" : "💾 Save PIN & Proceed"}
                                </button>
                                <button onClick={() => { setPinStep(false); setPin(["", "", "", ""]); setPinError(""); }} disabled={isSaving} style={btnGhost}>← Back</button>
                            </div>
                        </div>
                    )}

                    {!dispatched && !pinStep && (
                        <>
                            {step === 1 && (
                                <div>
                                    <StepTitle icon="🏢" title="Select Party" sub="Choose an existing party or create a new one." />
                                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                        <button style={form.isNewParty ? tabInactive : tabActive} onClick={() => setForm(f => ({ ...f, isNewParty: false }))}>Select Existing</button>
                                        <button style={form.isNewParty ? tabActive : tabInactive} onClick={() => setForm(f => ({ ...f, isNewParty: true }))}>+ Create New</button>
                                    </div>
                                    {!form.isNewParty ? (
                                        <>
                                            <input value={partySearch} placeholder="Search Party" onChange={e => setPartySearch(e.target.value)} style={inputStyle} />
                                            <div style={{ ...listBox, marginTop: 8 }}>
                                                {filteredParties.map(p => (
                                                    <div key={p.id} 
                                                        style={{ ...listItem, background: form.party?.id === p.id ? "#ede9fe" : "#fff", borderColor: form.party?.id === p.id ? "#818cf8" : "#e2e8f0", position: "relative" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <div onClick={() => setForm(f => ({ ...f, party: p }))} style={{ flex: 1, cursor: "pointer" }}>
                                                                <div style={{ fontWeight: 400, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                                                                <div style={{ fontSize: 12, color: "#64748b" }}>{p.city || p.address || "No city"} {p.gst || p.gstin ? `· GST: ${p.gst || p.gstin}` : ""}</div>
                                                            </div>
                                                            
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                {deleteConfirmId === p.id ? (
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fee2e2", padding: "4px 8px", borderRadius: 8, border: "1px solid #fecaca" }}>
                                                                        <span style={{ fontSize: 10, fontWeight: 400, color: "#991b1b" }}>Delete?</span>
                                                                        <button onClick={() => handleDeleteParty(p.id)} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", fontWeight: 400 }}>Yes</button>
                                                                        <button onClick={() => setDeleteConfirmId(null)} style={{ background: "#94a3b8", color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", fontWeight: 400 }}>No</button>
                                                                    </div>
                                                                ) : (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                                                                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 6, transition: "color 0.2s" }}
                                                                        onMouseOver={e => e.currentTarget.style.color = "#ef4444"}
                                                                        onMouseOut={e => e.currentTarget.style.color = "#94a3b8"}
                                                                    >
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                                {form.party?.id === p.id && <span style={{ color: "#6366f1", fontWeight: 400, fontSize: 18 }}>✓</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredParties.length === 0 && <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No parties found</div>}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <input 
                                                    placeholder="GST Number (Optional)" 
                                                    value={form.newParty.gst} 
                                                    onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, gst: e.target.value.toUpperCase() } }))} 
                                                    style={{ ...inputStyle, flex: 1 }} 
                                                />
                                                <button 
                                                    onClick={() => handleVerifyGst(form.newParty.gst)}
                                                    disabled={isVerifyingGst || !form.newParty.gst}
                                                    style={{ 
                                                        ...btnPrimary, 
                                                        padding: "0 16px", 
                                                        background: isVerifyingGst ? "#e2e8f0" : "#6366f1",
                                                        color: isVerifyingGst ? "#94a3b8" : "#fff",
                                                        fontSize: 12
                                                    }}
                                                    >
                                                        {isVerifyingGst ? "Verifying" : "Verify GST"}
                                                    </button>
                                            </div>
                                            <input placeholder="Party / Company Name" value={form.newParty.name} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, name: e.target.value } }))} style={inputStyle} />
                                            
                                            <div style={{ display: "flex", gap: 12 }}>
                                                <input placeholder="Phone Number" value={form.newParty.phone} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, phone: e.target.value } }))} style={{ ...inputStyle, flex: 1 }} />
                                                <input placeholder="Email Address" value={form.newParty.email} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, email: e.target.value } }))} style={{ ...inputStyle, flex: 1 }} />
                                            </div>

                                            <input placeholder="Full Address" value={form.newParty.address} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, address: e.target.value } }))} style={inputStyle} />
                                            
                                            <div style={{ display: "flex", gap: 12 }}>
                                                <input placeholder="City" value={form.newParty.city} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, city: e.target.value } }))} style={{ ...inputStyle, flex: 1 }} />
                                                <input placeholder="State" value={form.newParty.state} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, state: e.target.value } }))} style={{ ...inputStyle, flex: 1 }} />
                                                <input placeholder="Pincode" value={form.newParty.pincode} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, pincode: e.target.value } }))} style={{ ...inputStyle, flex: 1 }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 2 && (
                                <div>
                                    <StepTitle icon="📦" title="Select Product" sub="Pick from inventory or add a new dispatch un-tracked product." />
                                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                        <button style={form.isNewProduct ? tabInactive : tabActive} onClick={() => setForm(f => ({ ...f, isNewProduct: false }))}>From Inventory</button>
                                        <button style={form.isNewProduct ? tabActive : tabInactive} onClick={() => setForm(f => ({ ...f, isNewProduct: true }))}>+ Untracked Item</button>
                                    </div>
                                    {!form.isNewProduct ? (
                                        <>
                                            <input value={productSearch} placeholder="Search Product" onChange={e => setProductSearch(e.target.value)} style={inputStyle} />
                                            <div style={{ ...listBox, marginTop: 8 }}>
                                                {filteredProducts.map(p => (
                                                    <div key={p.id} onClick={() => setForm(f => ({ ...f, product: p }))}
                                                        style={{ ...listItem, background: form.product?.id === p.id ? "#f0fdf4" : "#fff", borderColor: form.product?.id === p.id ? "#22c55e" : "#e2e8f0" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <div>
                                                                <div style={{ fontWeight: 400, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                                                                <div style={{ fontSize: 12, color: "#64748b" }}>SKU: {p.sku} &nbsp;·&nbsp; <b className="text-emerald-600">Stock: {p.stock} {p.unit}</b></div>
                                                            </div>
                                                            {form.product?.id === p.id && <span style={{ color: "#22c55e", fontWeight: 400, fontSize: 18 }}>✓</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredProducts.length === 0 && <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No inventory products found</div>}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <input value={form.newProduct.name} onChange={e => setForm(f => ({ ...f, newProduct: { ...f.newProduct, name: e.target.value } }))} style={inputStyle} />
                                            <input value={form.newProduct.sku} onChange={e => setForm(f => ({ ...f, newProduct: { ...f.newProduct, sku: e.target.value } }))} style={inputStyle} />
                                            <select value={form.newProduct.unit} onChange={e => setForm(f => ({ ...f, newProduct: { ...f.newProduct, unit: e.target.value } }))} style={inputStyle}>
                                                {["PCS", "SET", "KG", "MTR", "BOX", "DOZEN"].map(u => <option key={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 3 && (
                                <div>
                                    <StepTitle icon="🗃️" title="Packaging Type" sub="How will the goods be packaged for dispatch?" />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        {PACKAGING_OPTIONS.map(opt => (
                                            <div key={opt} onClick={() => setForm(f => ({ ...f, packagingType: opt }))}
                                                style={{ ...cardOption, background: form.packagingType === opt ? "#ede9fe" : "#fff", borderColor: form.packagingType === opt ? "#818cf8" : "#e2e8f0", color: form.packagingType === opt ? "#4f46e5" : "#374151" }}>
                                                <div style={{ fontWeight: 400, fontSize: 14 }}>{opt}</div>
                                                {form.packagingType === opt && <div style={{ fontSize: 18 }}>✓</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div>
                                    <StepTitle icon="📝" title="Add Remarks" sub="Any special instructions, notes, or handling requirements?" />
                                    <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={6} style={{ ...inputStyle, resize: "vertical", minHeight: 140, fontFamily: "inherit" }} />
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Optional — leave blank if none.</div>
                                </div>
                            )}

                            {step === 5 && (
                                <div>
                                    <StepTitle icon="🔢" title="Select Quantity" sub={`How many ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || "units"} of "${productName}" to dispatch?`} />
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "32px 0" }}>
                                        <button onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} style={counterBtn}>−</button>
                                        <div style={{ textAlign: "center" }}>
                                            <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} style={{ fontSize: 40, fontWeight: 400, width: 120, textAlign: "center", border: "2px solid #e2e8f0", borderRadius: 0, padding: "8px 0", outline: "none", color: "#0f172a" }} />
                                            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, fontWeight: 400 }}>{form.isNewProduct ? form.newProduct.unit : form.product?.unit || "UNITS"}</div>
                                        </div>
                                        <button onClick={() => setForm(f => ({ ...f, quantity: f.quantity + 1 }))} style={counterBtn}>+</button>
                                    </div>
                                    {!form.isNewProduct && form.product && (
                                        <div style={{ textAlign: "center", fontSize: 14, color: form.quantity > form.product.stock ? "#ef4444" : "#22c55e", fontWeight: 400 }}>
                                            {form.quantity > form.product.stock
                                                ? `❌ Exceeds inventory stock (${form.product.stock} available)`
                                                : `✓ ${form.product.stock - form.quantity} will remain in inventory`}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 6 && (
                                <div>
                                    <StepTitle icon="🚛" title="Select Transporter" sub="Which logistics partner will handle this shipment?" />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                                        {TRANSPORTERS.map(t => (
                                            <div key={t} onClick={() => setForm(f => ({ ...f, transporter: t }))} style={{ ...cardOption, background: form.transporter === t ? "#ede9fe" : "#fff", borderColor: form.transporter === t ? "#818cf8" : "#e2e8f0", color: form.transporter === t ? "#4f46e5" : "#374151" }}>
                                                <div style={{ fontWeight: 400, fontSize: 14 }}>🚛 {t}</div>
                                                {form.transporter === t && <div style={{ fontSize: 18 }}>✓</div>}
                                            </div>
                                        ))}
                                    </div>
                                    {form.transporter === "Other" && <input style={inputStyle} onChange={e => setForm(f => ({ ...f, transporter: e.target.value || "Other" }))} />}
                                </div>
                            )}

                            {step === 7 && (
                                <div>
                                    <StepTitle icon="📄" title="Shipping Details" sub="Enter mandatory invoice and LR numbers for tracking." />
                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginBottom: 6, display: "block" }}>Invoice Number</label>
                                            <input 
                                                placeholder="Enter Invoice No" 
                                                value={form.invoiceNo} 
                                                onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))} 
                                                style={inputStyle} 
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginBottom: 6, display: "block" }}>LR Number</label>
                                            <input 
                                                placeholder="Enter LR No" 
                                                value={form.lrNo} 
                                                onChange={e => setForm(f => ({ ...f, lrNo: e.target.value }))} 
                                                style={inputStyle} 
                                            />
                                        </div>
                                    </div>
                                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, fontStyle: "italic" }}>Both fields are required to proceed.</p>
                                </div>
                            )}

                            {step === 8 && (
                                <div>
                                    <StepTitle icon="✅" title="Confirm Dispatch" sub="Review all details before proceeding to inventory deduction and confirmation." />
                                    <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                                        {[
                                            ["🏢 Party", partyName || "—", form.isNewParty ? "New" : ""],
                                            ["📦 Product", productName || "—", form.isNewProduct ? "New" : ""],
                                            ["🗃️ Packaging", form.packagingType, ""],
                                            ["🔢 Quantity", `${form.quantity} ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || ""}`, ""],
                                            ["🚛 Transporter", form.transporter, ""],
                                            ["📄 Invoice No.", form.invoiceNo, ""],
                                            ["📄 LR No.", form.lrNo, ""],
                                            ["📝 Remarks", form.remarks || "—", ""],
                                        ].map(([k, v, badge], i) => (
                                            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: i < 6 ? "1px solid #e2e8f0" : "none", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                                <div style={{ fontSize: 13, fontWeight: 400, color: "#64748b" }}>{k}</div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    {badge && <span style={{ fontSize: 10, fontWeight: 400, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 20 }}>{badge}</span>}
                                                    <div style={{ fontSize: 14, fontWeight: 400, color: "#0f172a", maxWidth: 200, textAlign: "right" }}>{v}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 16, padding: "12px 16px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", fontSize: 13, color: "#991b1b", fontWeight: 400 }}>
                                        ⚠️ Completing this dispatch will permanently deduct stock from "{productName}" in the Inventory database.
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                                {step > 1 && <button onClick={() => setStep(s => s - 1)} style={btnGhost}>← Back</button>}
                                <div style={{ flex: 1 }} />
                                {step < 8 ? (
                                    <button onClick={() => canProceed() && setStep(s => s + 1)} style={{ ...btnPrimary, opacity: canProceed() ? 1 : 0.4 }}>Next →</button>
                                ) : (
                                    <button onClick={() => setPinStep(true)} style={btnPrimary}>🔐 Enter PIN to Confirm</button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function StepTitle({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 400, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{sub}</div>
        </div>
    );
}

const overlay: React.CSSProperties = {
    position: "relative", zIndex: 1, display: "flex", width: "100%",
    alignItems: "flex-start", justifyContent: "center", padding: "0 0 40px 0",
};
const modal: React.CSSProperties = {
    background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640,
    display: "flex", flexDirection: "column",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", overflow: "hidden",
};
const modalHeader: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "22px 28px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc"
};
const modalBody: React.CSSProperties = { padding: "24px 28px 28px", overflowY: "visible", flex: 1 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 0, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "#fff", boxSizing: "border-box" };
const listBox: React.CSSProperties = { border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden", maxHeight: 240, overflowY: "auto" };
const listItem: React.CSSProperties = { padding: "13px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.15s", border: "none" };
const cardOption: React.CSSProperties = { padding: "14px 16px", borderRadius: 12, border: "2px solid #e2e8f0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.15s" };
const counterBtn: React.CSSProperties = { width: 52, height: 52, borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", fontSize: 24, fontWeight: 400, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" };
const tabActive: React.CSSProperties = { padding: "8px 18px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontWeight: 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const tabInactive: React.CSSProperties = { padding: "8px 18px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { padding: "11px 22px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 400, fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" };
const btnGhost: React.CSSProperties = { padding: "11px 22px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#374151", fontWeight: 400, fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" };