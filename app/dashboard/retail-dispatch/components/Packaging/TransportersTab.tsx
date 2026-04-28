"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { firestoreApi } from "../../data";
import { Card, PageHeader, BtnPrimary } from "../ui";
import { FONT } from "../../types";
import { useAuth } from "../../../../context/AuthContext";
import { logActivity } from "../../../../lib/activityLogger";

type TransporterRow = {
  id: string;
  name: string;
  phone?: string;
  vehicleType?: string;
  createdAt?: string;
};

interface Props {
  onUpdated?: () => void;
}

export default function TransportersTab({ onUpdated }: Props) {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transporters, setTransporters] = useState<TransporterRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", vehicleType: "" });

  const loadTransporters = async () => {
    setLoading(true);
    try {
      const rows = await firestoreApi.getTransporters();
      setTransporters(
        [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      );
    } catch (e) {
      console.error(e);
      alert("Failed to load transporters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransporters();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transporters;
    return transporters.filter((t) => {
      const name = String(t.name || "").toLowerCase();
      const phone = String(t.phone || "").toLowerCase();
      const vehicle = String(t.vehicleType || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || vehicle.includes(q);
    });
  }, [search, transporters]);

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      alert("Transporter name is required.");
      return;
    }

    const duplicate = transporters.some(
      (t) => String(t.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      alert("This transporter already exists.");
      return;
    }

    setSaving(true);
    try {
      await firestoreApi.createTransporter({
        name,
        phone: form.phone.trim(),
        vehicleType: form.vehicleType.trim(),
      });
      await loadTransporters();
      onUpdated?.();
      setForm({ name: "", phone: "", vehicleType: "" });

      await logActivity({
        type: "dispatch",
        action: "create",
        title: "Transporter Created",
        description: `Transporter "${name}" created by ${userData?.name || "User"}.`,
        userId: user?.uid || "unknown",
        userName: userData?.name || "User",
        userRole: userData?.role || "staff",
      });
    } catch (e) {
      console.error(e);
      alert("Failed to create transporter.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: TransporterRow) => {
    if (!row.id) return;
    if (!confirm(`Delete transporter "${row.name}"?`)) return;

    setDeletingId(row.id);
    try {
      await firestoreApi.deleteTransporter(row.id);
      setTransporters((prev) => prev.filter((t) => t.id !== row.id));
      onUpdated?.();

      await logActivity({
        type: "dispatch",
        action: "delete",
        title: "Transporter Deleted",
        description: `Transporter "${row.name}" deleted by ${userData?.name || "User"}.`,
        userId: user?.uid || "unknown",
        userName: userData?.name || "User",
        userRole: userData?.role || "staff",
      });
    } catch (e) {
      console.error(e);
      alert("Failed to delete transporter.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Transporters" sub="Create and manage transporter list used in packing lists." />

      <Card style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10 }}>
          <input
            placeholder="Transporter Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Vehicle Type (optional)"
            value={form.vehicleType}
            onChange={(e) => setForm((p) => ({ ...p, vehicleType: e.target.value }))}
            style={inputStyle}
          />
          <BtnPrimary onClick={handleCreate} disabled={saving}>
            {saving ? "Saving..." : "Create"}
          </BtnPrimary>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>
          <input
            placeholder="Search transporter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Vehicle</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={tdStyle}>{row.phone || "-"}</td>
                  <td style={tdStyle}>{row.vehicleType || "-"}</td>
                  <td style={{ ...tdStyle, width: 120 }}>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={deletingId === row.id}
                      style={{ border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontFamily: FONT }}
                    >
                      {deletingId === row.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: "24px 12px" }}>
                    No transporter found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: "24px 12px" }}>
                    Loading transporters...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  outline: "none",
  fontSize: 13,
  fontFamily: FONT,
  color: "#0f172a",
  background: "#fff",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#1e293b",
  fontFamily: FONT,
};
