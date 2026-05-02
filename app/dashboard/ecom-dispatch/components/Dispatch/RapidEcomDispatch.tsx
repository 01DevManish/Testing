"use client";

import { useState, useRef, useEffect } from "react";
import { api, firestoreApi } from "../../data";
import { useAuth } from "../../../../context/AuthContext";
// Use relative path to activityLogger if possible, or check where it is
// Based on DispatchSidebar.tsx it might be in ../../../lib/activityLogger
import { logActivity } from "../../../../lib/activityLogger";
import { PageHeader, Card, BtnPrimary, BtnGhost } from "../ui";

const PLATFORMS = ["Amazon", "Meesho", "Flipkart", "Ajio", "Other"];
const LOGISTICS = ["Delhivery", "BlueDart", "Ecom Express", "DTDC", "XpressBees", "Other"];

export default function RapidEcomDispatch({ onClose, onDispatched }: { onClose: () => void, onDispatched: () => void }) {
    const { user, userData } = useAuth();
    const [platforms] = useState(PLATFORMS);
    const [selectedPlatform, setSelectedPlatform] = useState("");
    const [awb, setAwb] = useState("");
    const [setAwbState] = useState(""); // Legacy or helper if needed, but I'll use setAwb
    const [selected3PL, setSelected3PL] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [collectionFilter, setCollectionFilter] = useState("All");
    const [selectedSize, setSelectedSize] = useState("All");
    const [sizes, setSizes] = useState<string[]>([]);
    
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);
    const [forceDispatch, setForceDispatch] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [inventory, setInventory] = useState<any[]>([]);
    const [collections, setCollections] = useState<string[]>([]);
    const [isScanning, setIsScanning] = useState(true);

    // Refs for focus management
    const platformRef = useRef<HTMLSelectElement>(null);
    const awbRef = useRef<HTMLInputElement>(null);
    const logisticsRef = useRef<HTMLSelectElement>(null);
    const productRef = useRef<HTMLInputElement>(null);
    const collectionRef = useRef<HTMLSelectElement>(null);
    const sizeRef = useRef<HTMLSelectElement>(null);
    const qtyRef = useRef<HTMLInputElement>(null);
    const submitRef = useRef<HTMLButtonElement>(null);

    const loadInventory = async () => {
        const res = await firestoreApi.getInventoryProducts();
        setInventory(res);
        
        const cols = Array.from(new Set(res.map((p: any) => p.collection || "Uncategorized").filter(Boolean)));
        setCollections(["All", ...cols as string[]]);

        const szs = Array.from(new Set(res.map((p: any) => p.size).filter(Boolean)));
        setSizes(["All", ...szs as string[]]);
    };

    useEffect(() => {
        loadInventory();
        // Initial focus on Platform
        platformRef.current?.focus();
    }, []);

    const filteredInventory = inventory.filter(p => {
        const matchesSearch = p.productName.toLowerCase().includes(productSearch.toLowerCase()) || 
                             (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()));
        
        const pCol = p.collection || "Uncategorized";
        const matchesCol = collectionFilter === "All" || pCol === collectionFilter;
        
        const matchesSize = selectedSize === "All" || p.size === selectedSize;
        
        return matchesSearch && matchesCol && matchesSize;
    });

    const handleAwbKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && awb.trim()) {
            setIsScanning(false);
            logisticsRef.current?.focus();
        }
    };

    // Scanner Listener: Catch fast keyboard input (Typical of scanners)
    useEffect(() => {
        let buffer = "";
        let lastTime = 0;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is already in an input/select
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                // Special case: If user is on Platform select and hits Enter, focus AWB
                return;
            }

            const now = Date.now();
            if (now - lastTime > 100) {
                buffer = ""; // Reset buffer if typing is slow (manual)
            }
            lastTime = now;

            if (e.key === "Enter") {
                if (buffer.length > 3) {
                    setAwb(buffer);
                    buffer = "";
                    logisticsRef.current?.focus();
                    setIsScanning(false);
                }
            } else if (e.key.length === 1) {
                buffer += e.key;
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [logisticsRef, setIsScanning]); // Added dependencies for safety

    const handleProductSelect = (p: any) => {
        setSelectedProduct(p);
        qtyRef.current?.focus();
    };

    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async () => {
        if (!selectedPlatform || !awb || !selectedProduct || !selected3PL) {
            alert("Please fill all fields!");
            return;
        }
        setShowConfirm(true);
    };

    const executeDispatch = async () => {
        setShowConfirm(false);
        setIsSaving(true);
        try {
            const dispatchId = "RE-" + Math.floor(Math.random() * 900000 + 100000);
            
            // 1. Deduct Stock
            const dispatchContextNote = `${awb} - ${selectedPlatform}`.slice(0, 60);
            await firestoreApi.deductStock(selectedProduct.id, quantity, forceDispatch, {
                reason: "Dispatch",
                note: dispatchContextNote,
                userName: userData?.name || "User",
                userUid: user?.uid || "",
                dispatchId,
                partyName: selectedPlatform || "",
            });

            // 2. Create Order
            await api.createOrder({
                id: dispatchId,
                customer: { name: selectedPlatform, phone: "", address: "Ecommerce" },
                paymentStatus: "Paid",
                status: "Dispatched",
                dispatchDate: new Date().toISOString().split('T')[0],
                products: [{ 
                    id: selectedProduct.id, 
                    name: selectedProduct.productName, 
                    quantity, 
                    price: 0, 
                    packed: true,
                    sku: selectedProduct.sku 
                }],
                logs: [
                    { status: "Dispatched", timestamp: new Date().toISOString(), user: userData?.name || "User", note: `Platform: ${selectedPlatform}, AWB: ${awb}, 3PL: ${selected3PL}` }
                ],
                dispatchRef: awb,
                transporter: selected3PL,
                dispatchType: "ecom",
                platform: selectedPlatform,
                awb: awb
            }, { uid: user?.uid || "", name: userData?.name || "User", role: userData?.role || "staff" });

            // Reset form for next entry
            setAwb("");
            setSelectedProduct(null);
            setProductSearch("");
            setQuantity(1);
            setIsScanning(true);
            setTimeout(() => platformRef.current?.focus(), 100);
            
            onDispatched();
        } catch (error) {
            console.error(error);
            alert("Failed to create dispatch.");
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        const handleConfirmKey = (e: KeyboardEvent) => {
            if (showConfirm) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    executeDispatch();
                } else if (e.key === "Escape") {
                    setShowConfirm(false);
                }
            }
        };
        window.addEventListener("keydown", handleConfirmKey);
        return () => window.removeEventListener("keydown", handleConfirmKey);
    }, [showConfirm, executeDispatch]);

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 40, position: "relative" }}>
            {showConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div className="animate-in zoom-in duration-200" style={{ background: "#fff", padding: 32, borderRadius: 20, maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>Confirm Dispatch?</div>
                        <div style={{ fontSize: 15, color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>
                            Are you sure you want to dispatch <b>{quantity}</b> units of <b>{selectedProduct?.productName}</b> to <b>{selectedPlatform}</b>?
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 500, cursor: "pointer" }}>
                                Cancel (Esc)
                            </button>
                            <button onClick={executeDispatch} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 500, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                                Confirm (Enter)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PageHeader title="Create Dispatch" sub="High-speed fulfillment for Ecommerce platforms.">
                <BtnGhost onClick={onClose}>← Back</BtnGhost>
            </PageHeader>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Left Side: Basic Info */}
                <Card style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 500, color: "#64748b", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>1. Shipment Details</h3>
                    
                    <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>Select Platform</label>
                        <select 
                            ref={platformRef}
                            value={selectedPlatform} 
                            onChange={e => setSelectedPlatform(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && awbRef.current?.focus()}
                            style={{ ...inputStyle, background: "#f8fafc" }}
                        >
                            <option value="">-- Choose Platform --</option>
                            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                             <label style={labelStyle}>AWB Number</label>
                             {isScanning && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite" }} />
                                    <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>Ready to Scan</span>
                                </div>
                             )}
                        </div>
                        <input 
                            ref={awbRef}
                            value={awb}
                            onFocus={() => setIsScanning(true)}
                            onChange={e => setAwb(e.target.value)}
                            onKeyDown={handleAwbKeyDown}
                            style={{ ...inputStyle, fontSize: 15, border: isScanning ? "2px solid #6366f1" : "1.5px solid #e2e8f0" }}
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>3PL Partner</label>
                        <select 
                            ref={logisticsRef}
                            value={selected3PL} 
                            onChange={e => setSelected3PL(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && productRef.current?.focus()}
                            style={inputStyle}
                        >
                            <option value="">-- Choose Logistics --</option>
                            {LOGISTICS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 12, padding: "16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                         <input 
                            type="checkbox" 
                            id="force" 
                            checked={forceDispatch} 
                            onChange={e => setForceDispatch(e.target.checked)}
                            style={{ width: 18, height: 18, cursor: "pointer" }}
                         />
                         <label htmlFor="force" style={{ fontSize: 13, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
                            <b>Allow Negative Inventory</b> (Force Dispatch)
                         </label>
                    </div>
                </Card>

                <Card style={{ padding: 24, display: "flex", flexDirection: "column" }}>
                    <h3 style={{ fontSize: 13, fontWeight: 500, color: "#64748b", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>2. Product & Quantity</h3>
                    
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <div style={{ flex: 2 }}>
                            <input 
                                ref={productRef}
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        if (filteredInventory.length > 0) {
                                            handleProductSelect(filteredInventory[0]);
                                        } else {
                                            collectionRef.current?.focus();
                                        }
                                    }
                                }}
                                style={inputStyle}
                            />
                        </div>
                        <select 
                            ref={collectionRef}
                            value={collectionFilter} 
                            onChange={e => setCollectionFilter(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sizeRef.current?.focus()}
                            style={{ ...inputStyle, flex: 1, minWidth: 100 }}
                        >
                            {collections.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select 
                            ref={sizeRef}
                            value={selectedSize} 
                            onChange={e => setSelectedSize(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && qtyRef.current?.focus()}
                            style={{ ...inputStyle, flex: 1, minWidth: 80 }}
                        >
                            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden", minHeight: 180, maxHeight: 300, overflowY: "auto", background: "#fff", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)" }}>
                        {filteredInventory.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => handleProductSelect(p)}
                                style={{ 
                                    padding: "12px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer",
                                    background: selectedProduct?.id === p.id ? "linear-gradient(to right, #f5f3ff, #ede9fe)" : "transparent",
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    transition: "all 0.15s ease"
                                }}
                                onMouseEnter={e => !selectedProduct || selectedProduct.id !== p.id ? e.currentTarget.style.background = "#f8fafc" : null}
                                onMouseLeave={e => !selectedProduct || selectedProduct.id !== p.id ? e.currentTarget.style.background = "transparent" : null}
                            >
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: selectedProduct?.id === p.id ? "#4f46e5" : "#0f172a" }}>{p.productName}</div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>SKU: {p.sku || 'N/A'}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: p.stock > 0 ? "#10b981" : "#ef4444" }}>
                                        {p.stock} {p.unit || 'PCS'}
                                    </div>
                                    {p.collection && <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase" }}>{p.collection}</div>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Quantity</label>
                                <input 
                                    ref={qtyRef}
                                    type="number" 
                                    min={1} 
                                    value={quantity} 
                                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                                    style={inputStyle}
                                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                                />
                            </div>
                            <div style={{ flex: 2, paddingTop: 18 }}>
                                <button 
                                    ref={submitRef}
                                    disabled={isSaving}
                                    onClick={handleSubmit} 
                                    style={{ 
                                        width: "100%", padding: "12px", borderRadius: 10, border: "none",
                                        background: "#6366f1", color: "#fff", fontWeight: 500, cursor: "pointer",
                                        boxShadow: "0 4px 10px rgba(99,102,241,0.2)",
                                        opacity: isSaving ? 0.7 : 1, transition: "transform 0.1s"
                                    }}
                                    onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                                    onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                                >
                                    {isSaving ? "Creating..." : "Confirm Dispatch"}
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
            
            {/* Keyboard Hint */}
            <div style={{ textAlign: "center", marginTop: 32, color: "#94a3b8", fontSize: 12 }}>
                Tip: Press <b>Enter</b> to move between AWB, Product Search, and Quantity fields.
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.02em" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "all 0.2s", fontFamily: "inherit" };

// Add this to the end of the file or ensure it's in a <style> block
if (typeof document !== "undefined") {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
    `;
    document.head.appendChild(style);
}

