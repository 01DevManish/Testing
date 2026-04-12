import React from "react";
import { 
    modalOverlayStyles, modalCardStyles, BtnPrimary, BtnSecondary, BtnGhost 
} from "../../ui";

interface ShareCatalogModalProps {
    show: boolean;
    onClose: () => void;
    partyName: string;
    onWhatsApp: () => void;
    onDownload: () => void;
    sharing: boolean;
}

export default function ShareCatalogModal({
    show, onClose, partyName, onWhatsApp, onDownload, sharing
}: ShareCatalogModalProps) {
    if (!show && !sharing) return null;

    return (
        <div style={{ ...modalOverlayStyles, zIndex: 1100 }} onClick={onClose}>
            {sharing ? (
                <div style={{ 
                    display: "flex", flexDirection: "column", alignItems: "center", 
                    justifyContent: "center", gap: 20, color: "#fff" 
                }}>
                    <div style={{ 
                        width: 50, height: 50, border: "4px solid rgba(255,255,255,0.2)", 
                        borderTopColor: "#fff", borderRadius: "50%", 
                        animation: "spin-slow 0.8s linear infinite" 
                    }} />
                    <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "0.02em" }}>
                        Generating Premium Rate List PDF...
                    </div>
                </div>
            ) : (
                <div style={{ ...modalCardStyles, maxWidth: 400, textAlign: "center", padding: "40px 24px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ 
                        width: 72, height: 72, background: "#f0fdf4", borderRadius: "50%", 
                        display: "flex", alignItems: "center", justifyContent: "center", 
                        margin: "0 auto 24px" 
                    }}>
                        <span style={{ fontSize: 32 }}>📄</span>
                    </div>
                    
                    <h3 style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
                        Rate List Ready!
                    </h3>
                    <p style={{ fontSize: 14, color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}>
                        The customized product catalog for <b>{partyName}</b> has been generated and is ready to share.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <BtnPrimary 
                            onClick={onWhatsApp}
                            style={{ 
                                background: "#22c55e", height: 52, fontSize: 16, 
                                justifyContent: "center", gap: 10 
                            }}
                        >
                            <span>Share to WhatsApp</span>
                            <span style={{ fontSize: 18 }}>💬</span>
                        </BtnPrimary>

                        <BtnSecondary 
                            onClick={onDownload}
                            style={{ height: 52, fontSize: 16, justifyContent: "center", gap: 10 }}
                        >
                            <span>Download PDF</span>
                            <span style={{ fontSize: 18 }}>📥</span>
                        </BtnSecondary>
                    </div>

                    <button 
                        onClick={onClose}
                        style={{ 
                            marginTop: 24, background: "none", border: "none", 
                            color: "#94a3b8", cursor: "pointer", fontSize: 13, 
                            textDecoration: "underline" 
                        }}
                    >
                        Close Window
                    </button>
                </div>
            )}
            
            <style>{`
                @keyframes spin-slow { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
