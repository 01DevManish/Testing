"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SmartImage from "../../../components/SmartImage";
import { useAuth } from "../../../context/AuthContext";
import { useData } from "../../../context/DataContext";

const PER_PAGE = 10;

export default function CriticalStockPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { products } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading && (!user || userData?.role !== "admin")) {
      router.replace("/dashboard");
    }
  }, [loading, user, userData, router]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const criticalItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (products || [])
      .filter((p: any) => {
        const stock = Number(p.stock || 0);
        const minStock = Number(p.minStock || 0);
        return stock > 0 && stock <= minStock;
      })
      .filter((p: any) => !q || p.productName?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .sort((a: any, b: any) => Number(a.stock || 0) - Number(b.stock || 0));
  }, [products, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(criticalItems.length / PER_PAGE));
  const paginatedItems = criticalItems.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading || !user || userData?.role !== "admin") return null;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a", fontWeight: 500 }}>Critical Stock</h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>
            {criticalItems.length} item{criticalItems.length !== 1 ? "s" : ""} in critical range
          </div>
        </div>
        <button
          onClick={() => router.push("/dashboard/admin")}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#334155", cursor: "pointer", fontSize: 12 }}
        >
          Back to Admin
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search Product / SKU"
          style={{ width: "100%", maxWidth: 320, padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", background: "#f8fafc" }}
        />
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
        {paginatedItems.length > 0 ? (
          paginatedItems.map((p: any) => {
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 }}>
                  <SmartImage src={p.imageUrl || "/placeholder-prod.png"} alt={p.productName || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.productName}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>SKU: {p.sku}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#a16207" }}>
                    {p.stock} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{p.unit || "PCS"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#a16207", marginTop: 2 }}>Low Stock</div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: "30px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}>No critical stock items found.</div>
        )}
      </div>

      {criticalItems.length > PER_PAGE && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Showing {(page - 1) * PER_PAGE + 1} - {Math.min(page * PER_PAGE, criticalItems.length)} of {criticalItems.length}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: page === 1 ? "#f8fafc" : "#fff", color: page === 1 ? "#cbd5e1" : "#334155", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 12 }}
            >
              Prev
            </button>
            <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", padding: "0 4px" }}>
              Page {page} of {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: page === totalPages ? "#f8fafc" : "#fff", color: page === totalPages ? "#cbd5e1" : "#334155", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 12 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
