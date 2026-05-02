"use client";

import React, { useState } from "react";
import { PartyRate } from "./types";
import { Product } from "../inventory/types";
import { logActivity } from "../../lib/activityLogger";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../lib/permissions";
import { generatePartyRatePdf } from "../inventory/components/Catalog/PdfGenerator";
import { firestoreApi } from "../retail-dispatch/data";
import { touchDataSignal } from "../../lib/dataSignals";
import { upsertDataItems } from "../../lib/dynamoDataApi";

// Sub-components
import PartyList from "./components/Management/PartyList";
import PartyProfileModal from "./components/Management/PartyProfileModal";
import RateCatalogView from "./components/Rates/RateCatalogView";
import ShareCatalogModal from "./components/Sharing/ShareCatalogModal";

interface PartyRateModuleProps {
    partyRates: PartyRate[];
    products: Product[];
    fetching: boolean;
    isAdmin: boolean;
    loadData: () => void;
    isMobile: boolean;
    isTablet: boolean;
}

export default function PartyRateModule({
    partyRates, products, fetching, isAdmin, loadData, isMobile, isTablet
}: PartyRateModuleProps) {
    const { user, userData } = useAuth();

    // ── Granular Party Rate Permissions ─────────────────────────
    // We pass true to hasPermission to ignore the "admin" superuser role
    // and respect the actual assigned granular permissions (Limited Admin mode).
    const canView = hasPermission(userData, "party_rate_view", true);
    const canCreate = hasPermission(userData, "party_rate_create", true);
    const canEdit = hasPermission(userData, "party_rate_edit", true);
    const canDeleteParty = userData?.role === "admin"; // Delete remains admin-only
    
    // View State
    const [viewingCatalog, setViewingCatalog] = useState<PartyRate | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Form State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<any>({
        partyName: "",
        billTo: { companyName: "", traderName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" },
        sameAsBillTo: true,
        shipTo: { companyName: "", traderName: "", address: "", state: "", district: "", pincode: "", contactNo: "", adharNo: "", email: "" },
        transporter: "",
        rates: []
    });

    // Action States
    const [saving, setSaving] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [gstVerified, setGstVerified] = useState(false);
    
    // Share State
    const [sharing, setSharing] = useState(false);
    const [shareData, setShareData] = useState<{ blob: Blob, filename: string, party: PartyRate } | null>(null);

    const normalize = (value: unknown) =>
        String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    const findInventoryProduct = (rate: any, inventoryProducts: Product[]) => {
        const rateSku = normalize(rate?.sku);
        if (rateSku) {
            const bySku = inventoryProducts.find((p) => normalize(p.sku) === rateSku);
            if (bySku) return bySku;
        }
        const rateName = normalize(rate?.productName);
        if (!rateName) return undefined;
        const byName = inventoryProducts.filter((p) => normalize(p.productName) === rateName);
        return byName.length === 1 ? byName[0] : undefined;
    };

    // ── Profile Handlers ───────────────────────────────────────────
    
    const openCreateModal = () => {
        setEditingId(null);
        setForm({
            partyName: "",
            billTo: { companyName: "", traderName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" },
            sameAsBillTo: true,
            shipTo: { companyName: "", traderName: "", address: "", state: "", district: "", pincode: "", contactNo: "", adharNo: "", email: "" },
            transporter: "",
            rates: []
        });
        setGstVerified(false);
        setShowProfileModal(true);
    };

    const openEditModal = (pr: PartyRate) => {
        setEditingId(pr.id);
        const defaultSection = { companyName: "", traderName: "", address: "", state: "", district: "", pincode: "", contactNo: "", gstNo: "", panNo: "", adharNo: "", email: "" };
        setForm({
            partyName: pr.partyName || "",
            billTo: { ...defaultSection, ...(pr.billTo || {}) },
            sameAsBillTo: pr.sameAsBillTo !== undefined ? pr.sameAsBillTo : true,
            shipTo: { ...defaultSection, ...(pr.shipTo || {}) },
            transporter: pr.transporter || "",
            rates: pr.rates || []
        });
        setGstVerified(!!pr.billTo?.gstNo);
        setShowProfileModal(true);
    };

    const handleVerifyGst = async (gstin: string) => {
        const normalizedGstin = (gstin || "").trim().toUpperCase();
        if (!normalizedGstin || normalizedGstin.length !== 15) {
            alert("Please enter a valid 15-digit GST number.");
            return;
        }
        setIsVerifying(true);
        try {
            const res = await fetch(`/api/gst?gstin=${encodeURIComponent(normalizedGstin)}`);
            const result = await res.json();
            if (result.success && result.data) {
                setGstVerified(true);
                setForm((prev: any) => ({
                    ...prev,
                    billTo: {
                        ...prev.billTo,
                        companyName: result.data.companyName || prev.billTo.companyName,
                        traderName: result.data.traderName || result.data.ownerName || "",
                        address: result.data.address,
                        state: result.data.state,
                        district: result.data.district,
                        pincode: result.data.pincode,
                        gstNo: result.data.gstNo || normalizedGstin,
                        panNo: result.data.panNo || normalizedGstin.substring(2, 12)
                    }
                }));
            } else {
                alert(result.error || "GSTIN validation failed.");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to verify GST.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSaveProfile = async () => {
        const b = form.billTo;
        if (!b.companyName?.trim() || !b.address?.trim() || !b.contactNo?.trim() || !b.panNo?.trim()) {
            alert("Company Name, Address, Contact No, and PAN No are mandatory.");
            return;
        }

        const normalizedGst = String(b.gstNo || "").trim().toUpperCase();
        if (normalizedGst) {
            const duplicate = (partyRates || []).find((p) => {
                if (editingId && p.id === editingId) return false;
                const existingGst = String(p?.billTo?.gstNo || "").trim().toUpperCase();
                return existingGst && existingGst === normalizedGst;
            });
            if (duplicate) {
                alert(`Duplicate GST not allowed. GST ${normalizedGst} is already assigned to "${duplicate.partyName}".`);
                return;
            }
        }

        setSaving(true);
        try {
            const data = {
                partyName: b.companyName.trim(),
                billTo: b,
                sameAsBillTo: form.sameAsBillTo,
                shipTo: form.sameAsBillTo ? {
                    companyName: b.companyName,
                    traderName: b.traderName || "",
                    address: b.address,
                    state: b.state,
                    district: b.district,
                    pincode: b.pincode,
                    contactNo: b.contactNo,
                    adharNo: b.adharNo || "",
                    email: b.email || "",
                } : form.shipTo,
                rates: form.rates.filter((r: any) => r.productName && r.rate > 0),
                transporter: form.transporter || "",
                updatedAt: Date.now()
            };

            if (editingId) {
                await upsertDataItems("partyRates", [{ id: editingId, ...data } as PartyRate]);
            } else {
                const id = `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await upsertDataItems("partyRates", [{ id, ...data } as PartyRate]);
            }
            await touchDataSignal("partyRates");

            await logActivity({
                type: "system",
                action: editingId ? "update" : "create",
                title: editingId ? "Party Rate Updated" : "Party Rate Created",
                description: `Rate list for "${data.partyName}" was ${editingId ? "updated" : "created"}.`,
                userId: user?.uid || "",
                userName: userData?.name || "Admin",
                userRole: "admin"
            });

            setShowProfileModal(false);
            loadData();
        } catch (e) {
            console.error(e);
            alert("Failed to save profile.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProfile = async (id: string, name: string) => {
        if (!canDeleteParty || !confirm(`Permanently delete all rate data for "${name}"?`)) return;
        try {
            const res = await fetch(`/api/data/partyRates/${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || "Failed to delete party rate");
            }
            await touchDataSignal("partyRates");
            await logActivity({
                type: "system",
                action: "delete",
                title: "Party Removed",
                description: `Party "${name}" was removed by ${userData?.name || "Admin"}.`,
                userId: user?.uid || "",
                userName: userData?.name || "Admin",
                userRole: "admin"
            });
            loadData();
        } catch (e) {
            console.error(e);
            alert("Failed to delete record.");
        }
    };

    // ── Rate Handlers ──────────────────────────────────────────────

    const handleUpdateRates = async (updatedRates: any[]) => {
        if (!viewingCatalog) return;
        try {
            await upsertDataItems("partyRates", [{
                ...viewingCatalog,
                rates: updatedRates,
                updatedAt: Date.now()
            }]);
            await touchDataSignal("partyRates");
            loadData();
            setViewingCatalog({ ...viewingCatalog, rates: updatedRates });
        } catch (e) {
            console.error("Rate Update Error:", e);
            alert("Failed to update pricing.");
        }
    };

    const handleShare = async (party: PartyRate, ratesToShare: any[]) => {
        try {
            setSharing(true);
            // Use live inventory snapshot so stock status is always real-time at share time.
            let inventoryProducts: Product[] = products;
            try {
                const liveRows = await firestoreApi.getInventoryProducts({ forceFresh: true });
                if (liveRows.length > 0) {
                    inventoryProducts = liveRows as unknown as Product[];
                }
            } catch (e) {
                console.warn("Failed to fetch live inventory for PDF share. Falling back to cached products.", e);
            }

            const inStockRates = ratesToShare.filter((rate) => {
                const linked = findInventoryProduct(rate, inventoryProducts);
                if (!linked) return true; // Keep if not uniquely mappable.
                return Number(linked.stock || 0) > 0;
            });

            if (inStockRates.length === 0) {
                alert("All selected products are out of stock. PDF was not generated.");
                return;
            }

            if (inStockRates.length < ratesToShare.length) {
                alert(`${ratesToShare.length - inStockRates.length} out-of-stock product(s) were excluded from PDF.`);
            }

            const blob = await generatePartyRatePdf(party, inStockRates, inventoryProducts, false);
            if (!blob) return;

            const filename = `Rates_${party.partyName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

            if (navigator.share) {
                const file = new File([blob], filename, { type: "application/pdf" });
                try {
                    await navigator.share({
                        title: `Rate List: ${party.partyName}`,
                        files: [file]
                    });
                    setSharing(false);
                    return;
                } catch (e: any) {
                    if (e.name === 'AbortError') { setSharing(false); return; }
                }
            }

            setShareData({ blob, filename, party });
        } catch (err) {
            console.error("PDF Error:", err);
            alert("Failed to generate PDF.");
        } finally {
            setSharing(false);
        }
    };

    // ── Rendering ──────────────────────────────────────────────────

    const shareCatalogModal = (
        <ShareCatalogModal
            show={!!shareData}
            onClose={() => setShareData(null)}
            partyName={shareData?.party.partyName || ""}
            sharing={sharing}
            onWhatsApp={() => {
                const text = encodeURIComponent(`Eurus Lifestyle - Rate List for ${shareData?.party.partyName}`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
            }}
            onDownload={() => {
                if (!shareData) return;
                const url = URL.createObjectURL(shareData.blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = shareData.filename;
                a.click();
                URL.revokeObjectURL(url);
                setShareData(null);
            }}
        />
    );

    if (viewingCatalog) {
        return (
            <>
                <RateCatalogView 
                    party={viewingCatalog}
                    products={products}
                    onBack={() => setViewingCatalog(null)}
                    onUpdateRates={handleUpdateRates}
                    onShare={handleShare}
                    isAdmin={canEdit}
                    isMobile={isMobile}
                />
                {shareCatalogModal}
            </>
        );
    }

    return (
        <>
            <PartyList 
                partyRates={partyRates}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                fetching={fetching}
                isAdmin={canEdit}
                isMobile={isMobile}
                onViewProfile={openEditModal}
                onViewRates={setViewingCatalog}
                onEditProfile={canEdit ? openEditModal : undefined}
                onDelete={canDeleteParty ? handleDeleteProfile : undefined}
                onCreate={canCreate ? openCreateModal : undefined}
            />

            <PartyProfileModal 
                show={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                editingId={editingId}
                form={form}
                setForm={setForm}
                onSave={handleSaveProfile}
                saving={saving}
                isMobile={isMobile}
                gstVerified={gstVerified}
                setGstVerified={setGstVerified}
                isVerifying={isVerifying}
                onVerifyGst={handleVerifyGst}
            />

            {shareCatalogModal}
        </>
    );
}

