"use client";

import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Party { id: string; name: string; city: string; gst?: string }
interface Product { id: string; name: string; sku: string; stock: number; unit: string }

interface DispatchForm {
    party: Party | null;
    newParty: { name: string; city: string; gst: string };
    isNewParty: boolean;

    product: Product | null;
    newProduct: { name: string; sku: string; unit: string };
    isNewProduct: boolean;

    packagingType: string;
    remarks: string;
    quantity: number;
    transporter: string;
    bails: number;
}

const PACKAGING_OPTIONS = ["Carton Box", "Gunny Bag", "Poly Bag", "Wooden Crate", "Stretch Wrap", "Bubble Wrap"];
const TRANSPORTERS = ["DTDC", "Delhivery", "BlueDart", "FedEx", "Ecom Express", "Own Vehicle", "Other"];

// ─── Mock Data (replace with real api calls) ──────────────────────────────────
const MOCK_PARTIES: Party[] = [
    { id: "P001", name: "Sharma Traders", city: "Delhi", gst: "07AAACS1234A1Z5" },
    { id: "P002", name: "Gupta Wholesale", city: "Lucknow", gst: "09AABCG5678B2Z6" },
    { id: "P003", name: "Rajesh Enterprises", city: "Kanpur" },
    { id: "P004", name: "M/S Shiv Shakti", city: "Agra", gst: "09AABCS9012C3Z7" },
];
const MOCK_PRODUCTS: Product[] = [
    { id: "PR001", name: "Premium Cotton Shirt", sku: "CTN-001", stock: 240, unit: "PCS" },
    { id: "PR002", name: "Denim Jeans – 32W", sku: "DNM-032", stock: 80, unit: "PCS" },
    { id: "PR003", name: "Ethnic Kurta Set", sku: "ETH-K01", stock: 150, unit: "SET" },
    { id: "PR004", name: "Woollen Blazer", sku: "WOL-B02", stock: 60, unit: "PCS" },
];
const CONFIRM_PIN = "1234"; // replace with env or api-verified PIN

// ─── Step meta ────────────────────────────────────────────────────────────────
const STEPS = [
    { no: 1, label: "Party", icon: "🏢" },
    { no: 2, label: "Product", icon: "📦" },
    { no: 3, label: "Packaging", icon: "🗃️" },
    { no: 4, label: "Remarks", icon: "📝" },
    { no: 5, label: "Quantity", icon: "🔢" },
    { no: 6, label: "Transporter", icon: "🚛" },
    { no: 7, label: "Bails", icon: "📐" },
    { no: 8, label: "Confirm", icon: "✅" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dispatchId() {
    return "DSP-" + Date.now().toString(36).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CreateDispatchModal({ onClose, onDispatched }: {
    onClose: () => void;
    onDispatched?: (data: any) => void;
}) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<DispatchForm>({
        party: null, newParty: { name: "", city: "", gst: "" }, isNewParty: false,
        product: null, newProduct: { name: "", sku: "", unit: "PCS" }, isNewProduct: false,
        packagingType: "", remarks: "", quantity: 1, transporter: "", bails: 1,
    });

    // PIN confirmation
    const [pinStep, setPinStep] = useState(false);
    const [pin, setPin] = useState(["", "", "", ""]);
    const [pinError, setPinError] = useState("");
    const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

    // Print
    const [dispatched, setDispatched] = useState(false);
    const [dispatchRef] = useState(dispatchId());
    const printRef = useRef<HTMLDivElement>(null);

    // Party search
    const [partySearch, setPartySearch] = useState("");
    const [productSearch, setProductSearch] = useState("");

    const filteredParties = MOCK_PARTIES.filter(p =>
        p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
        p.city.toLowerCase().includes(partySearch.toLowerCase())
    );
    const filteredProducts = MOCK_PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
    );

    // ── Step validation ─────────────────────────────────────────────────────────
    function canProceed() {
        if (step === 1) return form.isNewParty ? form.newParty.name.trim() !== "" : form.party !== null;
        if (step === 2) return form.isNewProduct ? form.newProduct.name.trim() !== "" : form.product !== null;
        if (step === 3) return form.packagingType !== "";
        if (step === 5) return form.quantity >= 1;
        if (step === 6) return form.transporter !== "";
        if (step === 7) return form.bails >= 1;
        return true;
    }

    // ── PIN logic ───────────────────────────────────────────────────────────────
    function handlePinInput(idx: number, val: string) {
        if (!/^\d?$/.test(val)) return;
        const np = [...pin]; np[idx] = val; setPin(np);
        setPinError("");
        if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    }
    function handlePinKeyDown(idx: number, e: React.KeyboardEvent) {
        if (e.key === "Backspace" && !pin[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
    }
    function handleConfirmPin() {
        if (pin.join("") === CONFIRM_PIN) {
            setDispatched(true);
            onDispatched?.({ ...form, ref: dispatchRef });
        } else {
            setPinError("Incorrect PIN. Please try again.");
            setPin(["", "", "", ""]);
            pinRefs[0].current?.focus();
        }
    }

    // ── Print ───────────────────────────────────────────────────────────────────
    function handlePrint() {
        const win = window.open("", "_blank");
        if (!win || !printRef.current) return;
        win.document.write(`<html><head><title>Dispatch Slip</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:32px;color:#111;max-width:720px;margin:auto}
        h1{font-size:22px;font-weight:900;margin-bottom:4px}
        .sub{color:#6b7280;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        td,th{padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;text-align:left}
        th{background:#f9fafb;font-weight:700;color:#374151}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8}
        .ref{font-size:12px;color:#9ca3af;margin-bottom:20px}
        .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
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
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                            {dispatched ? "✅ Dispatch Confirmed" : pinStep ? "🔐 Confirm with PIN" : "Create Dispatch"}
                        </div>
                        {!dispatched && !pinStep && (
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                Step {step} of 8 — {STEPS[step - 1].label}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={closeBtn}>✕</button>
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
                                <div key={s.no} style={{ fontSize: 9, color: step >= s.no ? "#6366f1" : "#cbd5e1", fontWeight: 700, textAlign: "center", flex: 1 }}>
                                    {s.icon}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Body ───────────────────────────────────────────────────────── */}
                <div style={modalBody}>

                    {/* ================================================================
              DISPATCHED — PRINT VIEW
          ================================================================ */}
                    {dispatched && (
                        <div>
                            <div style={{ textAlign: "center", marginBottom: 24 }}>
                                <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Dispatch is ready!</div>
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Ref: <b>{dispatchRef}</b></div>
                            </div>

                            {/* Printable slip */}
                            <div ref={printRef} style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 20 }}>
                                <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Eurus Lifestyle — Dispatch Slip</h1>
                                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Ref: {dispatchRef} &nbsp;|&nbsp; {new Date().toLocaleString()}</div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                    <tbody>
                                        {[
                                            ["Party", partyName || "—"],
                                            ["City", form.isNewParty ? form.newParty.city : form.party?.city || "—"],
                                            ["GST", form.isNewParty ? (form.newParty.gst || "N/A") : (form.party?.gst || "N/A")],
                                            ["Product", productName || "—"],
                                            ["SKU", form.isNewProduct ? form.newProduct.sku : (form.product?.sku || "—")],
                                            ["Packaging", form.packagingType],
                                            ["Quantity", `${form.quantity} ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || ""}`],
                                            ["No. of Bails", form.bails],
                                            ["Transporter", form.transporter],
                                            ["Remarks", form.remarks || "—"],
                                        ].map(([k, v]) => (
                                            <tr key={k as string}>
                                                <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", fontWeight: 700, background: "#f1f5f9", color: "#374151", width: "35%" }}>{k}</td>
                                                <td style={{ padding: "7px 10px", border: "1px solid #e2e8f0", color: "#0f172a" }}>{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                                    <span>Authorised by PIN ✓</span>
                                    <span>Eurus Lifestyle Logistics Hub</span>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={handlePrint} style={btnPrimary}>🖨️ Print Dispatch Slip</button>
                                <button onClick={onClose} style={btnGhost}>Close</button>
                            </div>
                        </div>
                    )}

                    {/* ================================================================
              PIN CONFIRMATION STEP
          ================================================================ */}
                    {!dispatched && pinStep && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Enter Dispatch PIN</div>
                            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
                                Enter your 4-digit PIN to confirm and lock this dispatch.
                            </div>

                            {/* Dispatch summary mini */}
                            <div style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
                                    <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Party:</span> <b>{partyName}</b></div>
                                    <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Product:</span> <b>{productName}</b></div>
                                    <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Qty:</span> <b>{form.quantity}</b></div>
                                    <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Bails:</span> <b>{form.bails}</b></div>
                                    <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Transporter:</span> <b>{form.transporter}</b></div>
                                    <div><span style={{ color: "#94a3b8", fontWeight: 600 }}>Packaging:</span> <b>{form.packagingType}</b></div>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
                                {pin.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={pinRefs[i]}
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={d}
                                        onChange={e => handlePinInput(i, e.target.value)}
                                        onKeyDown={e => handlePinKeyDown(i, e)}
                                        style={{
                                            width: 52, height: 60, borderRadius: 12,
                                            border: pinError ? "2px solid #ef4444" : "2px solid #e2e8f0",
                                            fontSize: 28, fontWeight: 900, textAlign: "center",
                                            outline: "none", background: "#fff", color: "#0f172a",
                                            transition: "border 0.2s"
                                        }}
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>

                            {pinError && (
                                <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                                    {pinError}
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                <button
                                    onClick={handleConfirmPin}
                                    disabled={pin.some(p => p === "")}
                                    style={{ ...btnPrimary, opacity: pin.some(p => p === "") ? 0.5 : 1 }}
                                >
                                    ✅ Confirm Dispatch
                                </button>
                                <button onClick={() => { setPinStep(false); setPin(["", "", "", ""]); setPinError(""); }} style={btnGhost}>
                                    ← Back
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ================================================================
              STEP FORMS
          ================================================================ */}
                    {!dispatched && !pinStep && (
                        <>
                            {/* ── STEP 1: Party ────────────────────────────────────────── */}
                            {step === 1 && (
                                <div>
                                    <StepTitle icon="🏢" title="Select Party" sub="Choose an existing party or create a new one." />
                                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                        <button style={form.isNewParty ? tabInactive : tabActive} onClick={() => setForm(f => ({ ...f, isNewParty: false }))}>Select Existing</button>
                                        <button style={form.isNewParty ? tabActive : tabInactive} onClick={() => setForm(f => ({ ...f, isNewParty: true }))}>+ Create New</button>
                                    </div>
                                    {!form.isNewParty ? (
                                        <>
                                            <input placeholder="Search party name or city…" value={partySearch} onChange={e => setPartySearch(e.target.value)} style={inputStyle} />
                                            <div style={listBox}>
                                                {filteredParties.map(p => (
                                                    <div key={p.id} onClick={() => setForm(f => ({ ...f, party: p }))}
                                                        style={{ ...listItem, background: form.party?.id === p.id ? "#ede9fe" : "#fff", borderColor: form.party?.id === p.id ? "#818cf8" : "#e2e8f0" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                                                                <div style={{ fontSize: 12, color: "#64748b" }}>{p.city} {p.gst ? `· GST: ${p.gst}` : ""}</div>
                                                            </div>
                                                            {form.party?.id === p.id && <span style={{ color: "#6366f1", fontWeight: 800, fontSize: 18 }}>✓</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredParties.length === 0 && <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No parties found</div>}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <input placeholder="Party Name *" value={form.newParty.name} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, name: e.target.value } }))} style={inputStyle} />
                                            <input placeholder="City *" value={form.newParty.city} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, city: e.target.value } }))} style={inputStyle} />
                                            <input placeholder="GST Number (optional)" value={form.newParty.gst} onChange={e => setForm(f => ({ ...f, newParty: { ...f.newParty, gst: e.target.value } }))} style={inputStyle} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 2: Product ──────────────────────────────────────── */}
                            {step === 2 && (
                                <div>
                                    <StepTitle icon="📦" title="Select Product" sub="Pick from inventory or add a new product." />
                                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                        <button style={form.isNewProduct ? tabInactive : tabActive} onClick={() => setForm(f => ({ ...f, isNewProduct: false }))}>From Inventory</button>
                                        <button style={form.isNewProduct ? tabActive : tabInactive} onClick={() => setForm(f => ({ ...f, isNewProduct: true }))}>+ Create New</button>
                                    </div>
                                    {!form.isNewProduct ? (
                                        <>
                                            <input placeholder="Search product name or SKU…" value={productSearch} onChange={e => setProductSearch(e.target.value)} style={inputStyle} />
                                            <div style={listBox}>
                                                {filteredProducts.map(p => (
                                                    <div key={p.id} onClick={() => setForm(f => ({ ...f, product: p }))}
                                                        style={{ ...listItem, background: form.product?.id === p.id ? "#ede9fe" : "#fff", borderColor: form.product?.id === p.id ? "#818cf8" : "#e2e8f0" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                                                                <div style={{ fontSize: 12, color: "#64748b" }}>SKU: {p.sku} &nbsp;·&nbsp; Stock: {p.stock} {p.unit}</div>
                                                            </div>
                                                            {form.product?.id === p.id && <span style={{ color: "#6366f1", fontWeight: 800, fontSize: 18 }}>✓</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredProducts.length === 0 && <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No products found</div>}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <input placeholder="Product Name *" value={form.newProduct.name} onChange={e => setForm(f => ({ ...f, newProduct: { ...f.newProduct, name: e.target.value } }))} style={inputStyle} />
                                            <input placeholder="SKU / Item Code" value={form.newProduct.sku} onChange={e => setForm(f => ({ ...f, newProduct: { ...f.newProduct, sku: e.target.value } }))} style={inputStyle} />
                                            <select value={form.newProduct.unit} onChange={e => setForm(f => ({ ...f, newProduct: { ...f.newProduct, unit: e.target.value } }))} style={inputStyle}>
                                                {["PCS", "SET", "KG", "MTR", "BOX", "DOZEN"].map(u => <option key={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 3: Packaging Type ───────────────────────────────── */}
                            {step === 3 && (
                                <div>
                                    <StepTitle icon="🗃️" title="Packaging Type" sub="How will the goods be packaged for dispatch?" />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        {PACKAGING_OPTIONS.map(opt => (
                                            <div key={opt} onClick={() => setForm(f => ({ ...f, packagingType: opt }))}
                                                style={{ ...cardOption, background: form.packagingType === opt ? "#ede9fe" : "#fff", borderColor: form.packagingType === opt ? "#818cf8" : "#e2e8f0", color: form.packagingType === opt ? "#4f46e5" : "#374151" }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{opt}</div>
                                                {form.packagingType === opt && <div style={{ fontSize: 18 }}>✓</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 4: Remarks ─────────────────────────────────────── */}
                            {step === 4 && (
                                <div>
                                    <StepTitle icon="📝" title="Add Remarks" sub="Any special instructions, notes, or handling requirements?" />
                                    <textarea
                                        placeholder="e.g. Handle with care, fragile items inside, deliver before 5 PM…"
                                        value={form.remarks}
                                        onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                                        rows={6}
                                        style={{ ...inputStyle, resize: "vertical", minHeight: 140, fontFamily: "inherit" }}
                                    />
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Optional — leave blank if none.</div>
                                </div>
                            )}

                            {/* ── STEP 5: Quantity ─────────────────────────────────────── */}
                            {step === 5 && (
                                <div>
                                    <StepTitle icon="🔢" title="Select Quantity"
                                        sub={`How many ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || "units"} of "${productName}" to dispatch?`} />
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "32px 0" }}>
                                        <button onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} style={counterBtn}>−</button>
                                        <div style={{ textAlign: "center" }}>
                                            <input
                                                type="number" min={1}
                                                value={form.quantity}
                                                onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                style={{ fontSize: 40, fontWeight: 900, width: 120, textAlign: "center", border: "2px solid #e2e8f0", borderRadius: 12, padding: "8px 0", outline: "none", color: "#0f172a" }}
                                            />
                                            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, fontWeight: 600 }}>
                                                {form.isNewProduct ? form.newProduct.unit : form.product?.unit || "UNITS"}
                                            </div>
                                        </div>
                                        <button onClick={() => setForm(f => ({ ...f, quantity: f.quantity + 1 }))} style={counterBtn}>+</button>
                                    </div>
                                    {!form.isNewProduct && form.product && (
                                        <div style={{ textAlign: "center", fontSize: 13, color: form.quantity > form.product.stock ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                                            {form.quantity > form.product.stock
                                                ? `⚠️ Exceeds stock (${form.product.stock} available)`
                                                : `✓ ${form.product.stock - form.quantity} will remain in stock`}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 6: Transporter ──────────────────────────────────── */}
                            {step === 6 && (
                                <div>
                                    <StepTitle icon="🚛" title="Select Transporter" sub="Which logistics partner will handle this shipment?" />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                                        {TRANSPORTERS.map(t => (
                                            <div key={t} onClick={() => setForm(f => ({ ...f, transporter: t }))}
                                                style={{ ...cardOption, background: form.transporter === t ? "#ede9fe" : "#fff", borderColor: form.transporter === t ? "#818cf8" : "#e2e8f0", color: form.transporter === t ? "#4f46e5" : "#374151" }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>🚛 {t}</div>
                                                {form.transporter === t && <div style={{ fontSize: 18 }}>✓</div>}
                                            </div>
                                        ))}
                                    </div>
                                    {form.transporter === "Other" && (
                                        <input placeholder="Enter transporter name…" style={inputStyle}
                                            onChange={e => setForm(f => ({ ...f, transporter: e.target.value || "Other" }))} />
                                    )}
                                </div>
                            )}

                            {/* ── STEP 7: No. of Bails ─────────────────────────────────── */}
                            {step === 7 && (
                                <div>
                                    <StepTitle icon="📐" title="Number of Bails" sub="How many bails / bundles make up this dispatch?" />
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "32px 0" }}>
                                        <button onClick={() => setForm(f => ({ ...f, bails: Math.max(1, f.bails - 1) }))} style={counterBtn}>−</button>
                                        <div style={{ textAlign: "center" }}>
                                            <input
                                                type="number" min={1}
                                                value={form.bails}
                                                onChange={e => setForm(f => ({ ...f, bails: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                style={{ fontSize: 40, fontWeight: 900, width: 120, textAlign: "center", border: "2px solid #e2e8f0", borderRadius: 12, padding: "8px 0", outline: "none", color: "#0f172a" }}
                                            />
                                            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, fontWeight: 600 }}>BAILS</div>
                                        </div>
                                        <button onClick={() => setForm(f => ({ ...f, bails: f.bails + 1 }))} style={counterBtn}>+</button>
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 8: Confirm Summary ──────────────────────────────── */}
                            {step === 8 && (
                                <div>
                                    <StepTitle icon="✅" title="Confirm Dispatch" sub="Review all details before proceeding to PIN confirmation." />
                                    <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                                        {[
                                            ["🏢 Party", partyName || "—", form.isNewParty ? "New" : ""],
                                            ["📦 Product", productName || "—", form.isNewProduct ? "New" : ""],
                                            ["🗃️ Packaging", form.packagingType, ""],
                                            ["🔢 Quantity", `${form.quantity} ${form.isNewProduct ? form.newProduct.unit : form.product?.unit || ""}`, ""],
                                            ["🚛 Transporter", form.transporter, ""],
                                            ["📐 No. of Bails", form.bails.toString(), ""],
                                            ["📝 Remarks", form.remarks || "—", ""],
                                        ].map(([k, v, badge], i) => (
                                            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: i < 6 ? "1px solid #e2e8f0" : "none", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{k}</div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    {badge && <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 20 }}>{badge}</span>}
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", maxWidth: 200, textAlign: "right" }}>{v}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 16, padding: "12px 16px", background: "#fef9c3", borderRadius: 10, border: "1px solid #fde047", fontSize: 13, color: "#854d0e", fontWeight: 600 }}>
                                        ⚠️ Once confirmed with PIN, this dispatch cannot be undone. Please review carefully.
                                    </div>
                                </div>
                            )}

                            {/* ── Navigation ───────────────────────────────────────────── */}
                            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                                {step > 1 && (
                                    <button onClick={() => setStep(s => s - 1)} style={btnGhost}>← Back</button>
                                )}
                                <div style={{ flex: 1 }} />
                                {step < 8 ? (
                                    <button onClick={() => canProceed() && setStep(s => s + 1)} style={{ ...btnPrimary, opacity: canProceed() ? 1 : 0.4 }}>
                                        Next →
                                    </button>
                                ) : (
                                    <button onClick={() => setPinStep(true)} style={btnPrimary}>
                                        🔐 Enter PIN to Confirm
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StepTitle({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{sub}</div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
    backdropFilter: "blur(6px)", zIndex: 1000, display: "flex",
    alignItems: "center", justifyContent: "center", padding: 16,
};
const modal: React.CSSProperties = {
    background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
    maxHeight: "92vh", display: "flex", flexDirection: "column",
    boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden",
};
const modalHeader: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "22px 28px 16px", borderBottom: "1px solid #f1f5f9",
};
const modalBody: React.CSSProperties = {
    padding: "24px 28px 28px", overflowY: "auto", flex: 1,
};
const closeBtn: React.CSSProperties = {
    width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#f8fafc", cursor: "pointer", fontSize: 13,
    color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center",
};
const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
    borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit",
    color: "#0f172a", background: "#fff", boxSizing: "border-box",
};
const listBox: React.CSSProperties = {
    border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden",
    maxHeight: 240, overflowY: "auto",
};
const listItem: React.CSSProperties = {
    padding: "13px 16px", borderBottom: "1px solid #f1f5f9",
    cursor: "pointer", transition: "background 0.15s", border: "none",
};
const cardOption: React.CSSProperties = {
    padding: "14px 16px", borderRadius: 12, border: "2px solid #e2e8f0",
    cursor: "pointer", display: "flex", justifyContent: "space-between",
    alignItems: "center", transition: "all 0.15s",
};
const counterBtn: React.CSSProperties = {
    width: 52, height: 52, borderRadius: 12, border: "2px solid #e2e8f0",
    background: "#f8fafc", fontSize: 24, fontWeight: 700, cursor: "pointer",
    color: "#374151", display: "flex", alignItems: "center", justifyContent: "center",
};
const tabActive: React.CSSProperties = {
    padding: "8px 18px", borderRadius: 8, border: "none",
    background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit",
};
const tabInactive: React.CSSProperties = {
    padding: "8px 18px", borderRadius: 8, border: "1.5px solid #e2e8f0",
    background: "#f8fafc", color: "#64748b", fontWeight: 600, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
    padding: "11px 22px", borderRadius: 10, border: "none",
    background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 14,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
};
const btnGhost: React.CSSProperties = {
    padding: "11px 22px", borderRadius: 10, border: "1.5px solid #e2e8f0",
    background: "#f8fafc", color: "#374151", fontWeight: 700, fontSize: 14,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
};