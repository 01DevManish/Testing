import React from "react";
import { PartyRate } from "../../types";
import { Card, Spinner } from "../../ui";

interface PartyListProps {
    partyRates: PartyRate[];
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    fetching: boolean;
    isAdmin: boolean;
    onViewProfile: (pr: PartyRate) => void;
    onViewRates: (pr: PartyRate) => void;
    onEditProfile?: (pr: PartyRate) => void;
    onDelete?: (id: string, name: string) => void;
    onCreate?: () => void;
}

export default function PartyList({
    partyRates, searchTerm, setSearchTerm, fetching, isAdmin,
    onViewProfile, onViewRates, onEditProfile, onDelete, onCreate
}: PartyListProps) {
    const filteredRates = partyRates.filter(r =>
        (r?.partyName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 500, color: "#0f172a", margin: 0 }}>Party Wise Rate</h2>
                    <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Manage customer-specific product pricing and profiles</p>
                </div>
                {onCreate && (
                    <button 
                        onClick={onCreate}
                        style={{ 
                            padding: "10px 20px", background: "#6366f1", color: "#fff", 
                            border: "none", borderRadius: 10, fontWeight: 500, cursor: "pointer",
                            boxShadow: "0 4px 6px -1px rgba(99, 102, 241, 0.2)",
                            display: "flex", alignItems: "center", gap: 8
                        }}
                    >
                        <span style={{ fontSize: 18 }}>+</span> Create Party
                    </button>
                )}
            </div>

            <div style={{ 
                marginBottom: 24, display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", background: "#fff", border: "1.5px solid #e2e8f0",
                borderRadius: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
            }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                    className="focus:outline-none focus:ring-0"
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search Party"
                    style={{ border: "none", outline: "none", boxShadow: "none", background: "transparent", width: "100%", fontSize: 14, color: "#1e293b" }}
                />
            </div>

            {fetching ? (
                <Spinner />
            ) : (
                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
                    gap: 20 
                }}>
                    {filteredRates.map(pr => (
                        <Card 
                            key={pr.id} 
                            style={{ 
                                padding: 20, cursor: "pointer", border: "1px solid #e2e8f0",
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                background: "#fff"
                            }}
                        >
                            <div onClick={() => {
                                if (onEditProfile) onViewProfile(pr);
                                else onViewRates(pr); // Default to catalog view if they can't see the profile
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                    <div>
                                        <h3 style={{ fontSize: 17, fontWeight: 600, color: "#0f172a", margin: "0 0 4px 0" }}>{pr.partyName}</h3>
                                        {isAdmin && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>
                                                    {pr.billTo?.district || "N/A"}
                                                </span>
                                                <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>
                                                    {pr.billTo?.state || "N/A"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {(onEditProfile || onDelete) && (
                                        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                                            {onEditProfile && (
                                                <button 
                                                    onClick={() => onEditProfile(pr)} 
                                                    style={{ border: "none", background: "#f8fafc", color: "#6366f1", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                    title="Edit Profile"
                                                >
                                                    ✎
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button 
                                                    onClick={() => onDelete(pr.id, pr.partyName)} 
                                                    style={{ border: "none", background: "#fff1f2", color: "#ef4444", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                                    title="Delete Profile"
                                                >
                                                    🗑
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                    {(pr.rates || []).slice(0, 3).map((r, i) => (
                                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
                                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>{r.productName}</span>
                                            {isAdmin && <span style={{ fontWeight: 500, color: "#0f172a" }}>₹{r.rate}</span>}
                                        </div>
                                    ))}
                                    {(pr.rates?.length || 0) > 3 && (
                                        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4, background: "#f8fafc", padding: "4px 0", borderRadius: 6 }}>
                                            + {pr.rates!.length - 3} more products {isAdmin && "in custom pricing"}
                                        </div>
                                    )}
                                    {(!pr.rates || pr.rates.length === 0) && (
                                        <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
                                            No products assigned yet.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ 
                                marginTop: "auto", paddingTop: 16, borderTop: "1px solid #f1f5f9", 
                                display: "flex", justifyContent: "space-between", alignItems: "center" 
                            }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                    Updated: {pr.updatedAt ? new Date(pr.updatedAt).toLocaleDateString() : "Never"}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onViewRates(pr); }}
                                    style={{ 
                                        background: "#eff6ff", border: "none", color: "#2563eb", 
                                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                                        padding: "6px 12px", borderRadius: 6, transition: "0.2s"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#dbeafe"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#eff6ff"}
                                >
                                    {isAdmin ? "Manage Rates →" : "View Products →"}
                                </button>
                            </div>
                        </Card>
                    ))}

                    {filteredRates.length === 0 && (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 40px", background: "#fff", borderRadius: 20, border: "2px dashed #e2e8f0" }}>
                            <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
                            <h3 style={{ fontSize: 18, color: "#1e293b", margin: "0 0 8px 0" }}>No party records found</h3>
                            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>Try clearing your search or creating a new party profile.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
