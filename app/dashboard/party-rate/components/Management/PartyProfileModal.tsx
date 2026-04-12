import React, { useState } from "react";
import { PartyRate } from "../../types";
import { 
    Input, FormField, SectionDivider, BtnPrimary, BtnSecondary, BtnGhost, 
    modalOverlayStyles, modalCardStyles 
} from "../../ui";

interface PartyProfileModalProps {
    show: boolean;
    onClose: () => void;
    editingId: string | null;
    form: any;
    setForm: (form: any) => void;
    onSave: () => void;
    saving: boolean;
    isMobile: boolean;
    gstVerified: boolean;
    setGstVerified: (val: boolean) => void;
    isVerifying: boolean;
    onVerifyGst: (gstin: string) => void;
}

export default function PartyProfileModal({
    show, onClose, editingId, form, setForm, onSave, saving, 
    isMobile, gstVerified, setGstVerified, isVerifying, onVerifyGst
}: PartyProfileModalProps) {
    if (!show) return null;

    return (
        <div style={modalOverlayStyles} onClick={onClose}>
            <div style={{ ...modalCardStyles, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ 
                    padding: "24px 32px", borderBottom: "1px solid #f1f5f9", 
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#fff", zIndex: 10
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#0f172a" }}>
                            {editingId ? "Edit Party Profile" : "Register New Party"}
                        </h3>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                            Configure billing, shipping, and logistics details
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: "#f1f5f9", border: "none", borderRadius: 10, 
                            width: 32, height: 32, cursor: "pointer", color: "#64748b",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
                    <SectionDivider title="Bill To Details" />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                        <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                            <FormField label="Company Name" required>
                                <Input 
                                    value={form?.billTo?.companyName || ""} 
                                    onChange={e => setForm({ ...form, billTo: { ...form.billTo, companyName: e.target.value } })} 
                                    placeholder="Legal Business Name"
                                />
                            </FormField>
                        </div>
                        
                        <FormField label="Trader / Owner Name">
                            <Input 
                                value={form?.billTo?.traderName || ""} 
                                onChange={e => setForm({ ...form, billTo: { ...form.billTo, traderName: e.target.value } })} 
                                placeholder="Contact Person"
                            />
                        </FormField>

                        <FormField label="GST Number">
                            <div style={{ display: "flex", gap: 8 }}>
                                <div style={{ flex: 1, position: "relative" }}>
                                    <Input 
                                        value={form?.billTo?.gstNo || ""} 
                                        onChange={e => {
                                            setForm({ ...form, billTo: { ...form.billTo, gstNo: e.target.value.toUpperCase() } });
                                            setGstVerified(false);
                                        }} 
                                        placeholder="15-digit GSTIN"
                                        style={{ paddingRight: gstVerified ? 30 : 12 }}
                                    />
                                    {gstVerified && (
                                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#22c55e", fontSize: 14 }}>✅</span>
                                    )}
                                </div>
                                <BtnSecondary 
                                    onClick={() => onVerifyGst(form?.billTo?.gstNo || "")} 
                                    loading={isVerifying}
                                    style={{ 
                                        minWidth: 80, height: 41, 
                                        background: gstVerified ? "#f0fdf4" : "#6366f1",
                                        color: gstVerified ? "#15803d" : "#fff",
                                        borderColor: gstVerified ? "#bbf7d0" : "transparent"
                                    }}
                                >
                                    {gstVerified ? "Verified" : "Verify"}
                                </BtnSecondary>
                            </div>
                        </FormField>

                        <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                            <FormField label="Full Address" required>
                                <Input 
                                    value={form?.billTo?.address || ""} 
                                    onChange={e => setForm({ ...form, billTo: { ...form.billTo, address: e.target.value } })} 
                                    placeholder="Street, Area, etc."
                                />
                            </FormField>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, gridColumn: isMobile ? "span 1" : "span 2" }}>
                            <FormField label="City / Dist" required>
                                <Input value={form?.billTo?.district || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, district: e.target.value } })} />
                            </FormField>
                            <FormField label="State" required>
                                <Input value={form?.billTo?.state || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, state: e.target.value } })} />
                            </FormField>
                            <FormField label="Pincode" required>
                                <Input value={form?.billTo?.pincode || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, pincode: e.target.value } })} />
                            </FormField>
                        </div>

                        <FormField label="Contact Number" required>
                            <Input value={form?.billTo?.contactNo || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, contactNo: e.target.value } })} placeholder="+91" />
                        </FormField>
                        <FormField label="Email Address">
                            <Input value={form?.billTo?.email || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, email: e.target.value } })} placeholder="client@example.com" />
                        </FormField>
                        
                        <FormField label="PAN Number" required>
                            <Input value={form?.billTo?.panNo || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, panNo: e.target.value.toUpperCase() } })} />
                        </FormField>
                        <FormField label="Aadhar (Optional)">
                            <Input value={form?.billTo?.adharNo || ""} onChange={e => setForm({ ...form, billTo: { ...form.billTo, adharNo: e.target.value } })} />
                        </FormField>
                    </div>

                    <SectionDivider title="Logistics & Shipping" />
                    <div style={{ marginBottom: 20 }}>
                        <FormField label="Default Transporter">
                            <Input 
                                value={form.transporter || ""} 
                                onChange={e => setForm({ ...form, transporter: e.target.value })} 
                                placeholder="Primary Freight/Courier Partner"
                            />
                        </FormField>
                    </div>

                    <div style={{ 
                        background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>Shipping Address</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>Use billing address for shipping?</div>
                        </div>
                        <label style={{ position: "relative", display: "inline-block", width: 44, height: 22, cursor: "pointer" }}>
                            <input 
                                type="checkbox" 
                                checked={form.sameAsBillTo} 
                                onChange={e => setForm({ ...form, sameAsBillTo: e.target.checked })}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ 
                                position: "absolute", inset: 0, borderRadius: 34, 
                                background: form.sameAsBillTo ? "#6366f1" : "#cbd5e1",
                                transition: "0.4s"
                            }}>
                                <span style={{ 
                                    position: "absolute", left: 4, bottom: 4, width: 14, height: 14, 
                                    background: "#fff", borderRadius: "50%", transition: "0.4s",
                                    transform: form.sameAsBillTo ? "translateX(22px)" : "translateX(0)"
                                }} />
                            </span>
                        </label>
                    </div>

                    {!form.sameAsBillTo && (
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginTop: 24, animation: "fadeIn 0.2s ease-out" }}>
                            <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                                <FormField label="Shipping Company Name">
                                    <Input value={form?.shipTo?.companyName || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, companyName: e.target.value } })} />
                                </FormField>
                            </div>
                            <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                                <FormField label="Shipping Address">
                                    <Input value={form?.shipTo?.address || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, address: e.target.value } })} />
                                </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, gridColumn: isMobile ? "span 1" : "span 2" }}>
                                <FormField label="City">
                                    <Input value={form?.shipTo?.district || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, district: e.target.value } })} />
                                </FormField>
                                <FormField label="State">
                                    <Input value={form?.shipTo?.state || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, state: e.target.value } })} />
                                </FormField>
                                <FormField label="Pincode">
                                    <Input value={form?.shipTo?.pincode || ""} onChange={e => setForm({ ...form, shipTo: { ...form.shipTo, pincode: e.target.value } })} />
                                </FormField>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ 
                    padding: "20px 32px", borderTop: "1px solid #f1f5f9", 
                    display: "flex", gap: 12, justifyContent: "flex-end",
                    background: "#fff"
                }}>
                    <BtnGhost onClick={onClose}>Cancel</BtnGhost>
                    <BtnPrimary 
                        onClick={onSave} 
                        loading={saving}
                        disabled={!form?.billTo?.companyName || !form?.billTo?.address || !form?.billTo?.contactNo}
                        style={{ minWidth: 140 }}
                    >
                        {editingId ? "Update Profile" : "Create Party"}
                    </BtnPrimary>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}
