"use client";
import React, { useState } from "react";
import { LeadRecord, LeadFormState, LeadStatus } from "./types";
import { crmCard, crmInput, crmSelect, crmBtnPrimary, crmBtnSecondary, crmLabel } from "./styles";
import { downloadLeadsTemplate, normalizeHeader, parseCsvRows, pickFromRow, generateEntityId, sortByUpdatedAtDesc, saveCachedArray, ERM_LEADS_CACHE_KEY } from "./helpers";
import * as Icons from "./Icons";

interface StaffMember {
  uid: string;
  name: string;
  [key: string]: unknown;
}

interface Props {
  canAdminUpload: boolean;
  staff: StaffMember[];
  leads: LeadRecord[];
  setLeads: (leads: LeadRecord[]) => void;
  upsertEntityItems: (entity: "ermLeads", items: LeadRecord[]) => Promise<void>;
  userData: { uid?: string; name?: string } | null;
}

const EMPTY_FORM: LeadFormState = {
  name: "", phone: "", address: "", email: "", company: "",
  city: "", state: "", pincode: "", source: "",
  status: "new", nextFollowUpAt: "", assignedToUid: "",
};

export default function LeadCreateForm({ canAdminUpload, staff, leads, setLeads, upsertEntityItems, userData }: Props) {
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key: keyof LeadFormState, val: string) => setForm((p) => ({ ...p, [key]: val }));
  const canSubmit = Boolean(form.name.trim() && form.phone.trim() && canAdminUpload);

  const createLead = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const assignee = staff.find((s) => s.uid === form.assignedToUid);
      const now = Date.now();
      const newLead: LeadRecord = {
        id: generateEntityId("lead"),
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        source: form.source.trim() || "manual",
        status: form.status || "new",
        nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).getTime() : undefined,
        assignedToUid: assignee?.uid || userData?.uid || "",
        assignedToName: assignee?.name || userData?.name || "",
        createdAt: now,
        updatedAt: now,
      };
      const next = sortByUpdatedAtDesc([newLead, ...leads]);
      setLeads(next);
      saveCachedArray(ERM_LEADS_CACHE_KEY, next);
      await upsertEntityItems("ermLeads", [newLead]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  const parseFile = async (file: File) => {
    let rows: Record<string, string>[] = [];
    const fn = (file.name || "").toLowerCase();
    if (fn.endsWith(".xlsx") || fn.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const s = wb.SheetNames[0];
      if (s) {
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[s], { defval: "" });
        rows = jsonRows.map((r) => {
          const m: Record<string, string> = {};
          Object.entries(r).forEach(([k, v]) => { m[normalizeHeader(k)] = String(v ?? "").trim(); });
          return m;
        });
      }
    } else {
      const csvRows = parseCsvRows(await file.text());
      rows = csvRows.map((r) => {
        const m: Record<string, string> = {};
        Object.entries(r).forEach(([k, v]) => { m[normalizeHeader(k)] = String(v ?? "").trim(); });
        return m;
      });
    }
    return rows;
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    try {
      const rows = await parseFile(file);
      setPreviewRows(rows.slice(0, 5));
      setShowPreview(true);
    } catch { setShowPreview(false); }
  };

  const confirmUpload = async () => {
    if (!selectedFile || !canAdminUpload) return;
    setUploading(true);
    try {
      const rows = await parseFile(selectedFile);
      if (!rows.length) return;
      const now = Date.now();
      const fn = (selectedFile.name || "").toLowerCase();
      const toInsert: LeadRecord[] = [];
      for (const row of rows) {
        const name = pickFromRow(row, ["pocname", "name", "full_name", "customer_name", "lead_name"]);
        const phone = pickFromRow(row, ["phoneno", "phone", "mobile", "contact", "phone_number"]);
        if (!name || !phone) continue;
        const assignToVal = pickFromRow(row, ["assignto", "assigned_uid", "assigned_to_uid", "assignedtouid", "owner_uid"]);
        const assigned = staff.find((s) => s.uid === assignToVal || String(s.name || "").toLowerCase() === String(assignToVal || "").toLowerCase());
        const aUid = assigned?.uid || userData?.uid || "";
        toInsert.push({
          id: generateEntityId("lead"),
          name, phone,
          address: pickFromRow(row, ["address", "full_address", "location"]),
          email: pickFromRow(row, ["emailid", "email"]),
          company: pickFromRow(row, ["companyname", "company", "organization"]),
          city: pickFromRow(row, ["city"]),
          state: pickFromRow(row, ["state", "region"]),
          pincode: pickFromRow(row, ["pincode", "pin", "postal", "zip"]),
          source: pickFromRow(row, ["source"]) || (fn.endsWith(".csv") ? "csv_upload" : "xlsx_upload"),
          status: "new",
          assignedToUid: aUid,
          assignedToName: assigned?.name || pickFromRow(row, ["assigned_to_name", "owner_name"]) || userData?.name || "",
          createdAt: now, updatedAt: now,
        });
      }
      if (!toInsert.length) return;
      const next = sortByUpdatedAtDesc([...toInsert, ...leads]);
      setLeads(next);
      saveCachedArray(ERM_LEADS_CACHE_KEY, next);
      await upsertEntityItems("ermLeads", toInsert);
    } finally {
      setUploading(false);
      setShowPreview(false);
      setSelectedFile(null);
      setPreviewRows([]);
    }
  };

  if (!canAdminUpload) {
    return (
      <div style={{ ...crmCard, background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", display: "flex", alignItems: "center", gap: 10 }}>
        <Icons.IconClipboard size={20} color="#64748b" />
        <span style={{ fontSize: 15, color: "#475569" }}>Leads are uploaded and assigned by Admin. You can manage calls and follow-up for your assigned leads.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Action bar */}
      <div style={{ ...crmCard, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Lead Management</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>Create, upload, or download lead templates</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowForm(!showForm)} style={{ ...crmBtnPrimary, gap: 6 }}>
            {showForm ? <><Icons.IconX size={14} /> Close</> : <><Icons.IconPlus size={14} /> Add Lead</>}
          </button>
          <button onClick={() => downloadLeadsTemplate(staff)} style={{ ...crmBtnSecondary, gap: 6 }}>
            <Icons.IconDownload size={14} /> Download Template
          </button>
          <label style={{ ...crmBtnSecondary, cursor: "pointer", gap: 6 }}>
            <Icons.IconUpload size={14} /> Upload Excel/CSV
            <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...crmCard, borderLeft: "4px solid #6366f1" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 14 }}>Create New Lead</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {([
              ["source", "Source", "e.g. Website, Referral, IndiaMART"],
              ["name", "POC Name", "Contact person name"],
              ["phone", "Phone No.", "10-digit mobile number"],
              ["address", "Address", "Full address"],
              ["email", "Email ID", "email@example.com"],
              ["company", "Company Name", "Organization / firm name"],
              ["city", "City", "e.g. Mumbai, Delhi"],
              ["state", "State", "e.g. Maharashtra, Gujarat"],
              ["pincode", "Pincode", "e.g. 400001"],
            ] as [keyof LeadFormState, string, string][]).map(([key, label, ph]) => (
              <div key={key}>
                <label style={crmLabel}>{label}</label>
                <input placeholder={ph} value={form[key]} onChange={(e) => set(key, e.target.value)} style={crmInput} />
              </div>
            ))}
            <div>
              <label style={crmLabel}>Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} style={crmSelect}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="not_interested">Not Interested</option>
                <option value="follow_up">Follow Up</option>
                <option value="scheduled_meeting">Meeting Scheduled</option>
                <option value="ordered">Ordered</option>
              </select>
            </div>
            <div>
              <label style={crmLabel}>Assign To</label>
              <select value={form.assignedToUid} onChange={(e) => set("assignedToUid", e.target.value)} style={crmSelect}>
                <option value="">Select team member...</option>
                {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              </select>
            </div>
            {(form.status === "follow_up" || form.status === "scheduled_meeting") && (
              <div>
                <label style={crmLabel}>Follow-up Date</label>
                <input type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} style={crmInput} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={createLead} disabled={!canSubmit || creating} style={{ ...crmBtnPrimary, opacity: canSubmit && !creating ? 1 : 0.5, gap: 6 }}>
              {creating ? "Saving..." : <><Icons.IconDownload size={14} /> Save Lead</>}
            </button>
            <button onClick={() => { setForm(EMPTY_FORM); setShowForm(false); }} style={crmBtnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Upload preview */}
      {showPreview && (
        <div style={{ ...crmCard, borderLeft: "4px solid #d97706", background: "#fffbeb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
              <Icons.IconFileText size={18} /> Upload Preview — {previewRows.length} rows shown
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmUpload} disabled={uploading} style={{ ...crmBtnPrimary, background: "linear-gradient(135deg, #d97706, #b45309)", gap: 6 }}>
                {uploading ? "Uploading..." : <><Icons.IconCheck size={14} /> Confirm Upload</>}
              </button>
              <button onClick={() => { setShowPreview(false); setSelectedFile(null); }} style={crmBtnSecondary}>Cancel</button>
            </div>
          </div>
          <div style={{ overflowX: "auto", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {previewRows[0] && Object.keys(previewRows[0]).slice(0, 10).map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#92400e", borderBottom: "1px solid #fde68a", fontWeight: 600, fontSize: 13, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).slice(0, 10).map((v, j) => (
                      <td key={j} style={{ padding: "6px 8px", borderBottom: "1px solid #fef3c7", color: "#78350f" }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
