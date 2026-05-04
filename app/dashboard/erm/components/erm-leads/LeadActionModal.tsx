"use client";
import React, { useState } from "react";
import { LeadRecord, LeadCallRecord, LeadStatus } from "./types";
import { crmInput, crmSelect, crmBtnPrimary, crmBtnSecondary, crmLabel, crmOverlay, crmModalBox } from "./styles";
import { fmtDateTime } from "./helpers";
import StatusBadge from "./StatusBadge";
import * as Icons from "./Icons";

interface StaffMember { uid: string; name: string; [k: string]: unknown; }

interface Props {
  lead: LeadRecord;
  callLogs: LeadCallRecord[];
  isAdmin: boolean;
  canEdit: boolean;
  canSaveCall: boolean;
  staff: StaffMember[];
  savingMeta: boolean;
  savingCall: boolean;
  onClose: () => void;
  onSaveMeta: (form: MetaForm) => void;
  onSaveCall: (form: CallForm) => void;
}

interface MetaForm {
  name: string; phone: string; address: string; email: string;
  company: string; city: string; state: string; pincode: string;
  status: LeadStatus; assignedToUid: string; notes: string; nextFollowUpAt: string;
}

interface CallForm {
  outcome: LeadCallRecord["outcome"];
  callType: LeadCallRecord["callType"];
  followUpMode: LeadCallRecord["followUpMode"];
  durationMinutes: string;
  scheduledAt: string;
  nextAction: string;
  notes: string;
}

export default function LeadActionModal({ lead, callLogs, isAdmin, canEdit, canSaveCall, staff, savingMeta, savingCall, onClose, onSaveMeta, onSaveCall }: Props) {
  const [tab, setTab] = useState<"details" | "call" | "history">("details");
  const [lookingUpPincode, setLookingUpPincode] = useState(false);

  const [meta, setMeta] = useState<MetaForm>({
    name: lead.name || "", phone: lead.phone || "", address: lead.address || "",
    email: lead.email || "", company: lead.company || "", city: lead.city || "",
    state: lead.state || "", pincode: lead.pincode || "",
    status: lead.status || "new",
    assignedToUid: lead.assignedToUid || "",
    notes: lead.notes || "",
    nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : "",
  });

  const [call, setCall] = useState<CallForm>({
    outcome: "follow_up", callType: "voice", followUpMode: "call",
    durationMinutes: "", scheduledAt: "", nextAction: "", notes: "",
  });

  const mSet = (k: keyof MetaForm, v: string) => setMeta((p) => ({ ...p, [k]: v }));
  const cSet = (k: keyof CallForm, v: string) => setCall((p) => ({ ...p, [k]: v }));

  const autoFillCityStateFromPincode = async (rawPincode: string) => {
    const pincode = String(rawPincode || "").trim();
    if (!/^\d{6}$/.test(pincode)) return;
    try {
      setLookingUpPincode(true);
      const r = await fetch(`/api/pincode/${pincode}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (!j?.found) return;
      setMeta((prev) => ({
        ...prev,
        city: String(j.city || prev.city || "").trim(),
        state: String(j.state || prev.state || "").trim(),
      }));
    } catch {
      // no-op
    } finally {
      setLookingUpPincode(false);
    }
  };

  const tabBtn = (key: typeof tab, label: string, Icon: React.ComponentType<any>) => (
    <button
      onClick={() => setTab(key)}
      style={{
        border: "none",
        borderBottom: tab === key ? "2px solid #4f46e5" : "2px solid transparent",
        background: "transparent",
        color: tab === key ? "#4f46e5" : "#64748b",
        fontSize: 13, fontWeight: 600, padding: "10px 16px", cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 6
      }}
    >
      <Icon size={16} /> {label}
    </button>
  );

  const fieldRow = (label: string, key: keyof MetaForm, ph: string, type = "text") => (
    <div>
      <label style={crmLabel}>{label}</label>
      {type === "select-status" ? (
        <select value={meta[key]} onChange={(e) => mSet(key, e.target.value)} style={crmSelect}>
          {["new","contacted","interested","not_interested","follow_up","scheduled_meeting","ordered","onboarding_scheduled","won","lost"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      ) : type === "select-assign" ? (
        <select value={meta[key]} onChange={(e) => mSet(key, e.target.value)} style={crmSelect}>
          <option value="">Select team member...</option>
          {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
        </select>
      ) : (
        <input
          type={type}
          placeholder={ph}
          value={meta[key]}
          onChange={(e) => {
            const nextVal = e.target.value;
            mSet(key, nextVal);
            if (key === "pincode") {
              const digits = String(nextVal || "").replace(/\D/g, "");
              if (digits.length === 6) void autoFillCityStateFromPincode(digits);
            }
          }}
          onBlur={key === "pincode" ? () => autoFillCityStateFromPincode(meta.pincode) : undefined}
          style={crmInput}
        />
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={crmOverlay}>
      <div onClick={(e) => e.stopPropagation()} style={crmModalBox}>
        {/* Modal header */}
        <div style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, #4f46e5, #6366f1)",
          color: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{lead.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {lead.phone} • {lead.source || "Direct"} • Created {fmtDateTime(lead.createdAt)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge status={lead.status} />
            <button onClick={onClose} style={{
              border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)",
              color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer",
            }}>✕ Close</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          {tabBtn("details", "Lead Details", Icons.IconFileText)}
          {tabBtn("call", "Log Call", Icons.IconPhone)}
          {tabBtn("history", `History (${callLogs.length})`, Icons.IconHistory)}
        </div>

        {/* Tab content */}
        <div style={{ padding: 20, maxHeight: "60vh", overflowY: "auto" }}>
          {tab === "details" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {fieldRow("POC Name", "name", "Contact person name")}
                {fieldRow("Phone No.", "phone", "10-digit mobile")}
                {fieldRow("Email ID", "email", "email@example.com")}
                {fieldRow("Company Name", "company", "Organization name")}
                {fieldRow("Address", "address", "Full address")}
                {fieldRow("City", "city", "e.g. Mumbai")}
                {fieldRow("State", "state", "e.g. Maharashtra")}
                {fieldRow("Pincode", "pincode", "e.g. 400001")}
                {fieldRow("Status", "status", "", "select-status")}
                {isAdmin && fieldRow("Assign To", "assignedToUid", "", "select-assign")}
                {(meta.status === "follow_up" || meta.status === "scheduled_meeting" || meta.status === "onboarding_scheduled") &&
                  fieldRow("Follow-up Date", "nextFollowUpAt", "", "datetime-local")}
              </div>
              {lookingUpPincode && (
                <div style={{ fontSize: 12, color: "#6366f1" }}>
                  Looking up city/state from pincode...
                </div>
              )}
              <div>
                <label style={crmLabel}>Notes</label>
                <textarea placeholder="Internal notes about this lead..." value={meta.notes}
                  onChange={(e) => mSet("notes", e.target.value)}
                  style={{ ...crmInput, minHeight: 70, resize: "vertical" }} />
              </div>
              <button onClick={() => onSaveMeta(meta)} disabled={!canEdit || savingMeta}
                style={{ ...crmBtnPrimary, justifySelf: "start", opacity: canEdit && !savingMeta ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {savingMeta ? "Saving..." : <><Icons.IconDownload size={14} /> Save Changes</>}
              </button>
            </div>
          )}

          {tab === "call" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <label style={crmLabel}>Call Outcome</label>
                  <select value={call.outcome} onChange={(e) => cSet("outcome", e.target.value)} style={crmSelect}>
                    <option value="follow_up">Follow Up</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="no_response">No Response</option>
                  </select>
                </div>
                <div>
                  <label style={crmLabel}>Call Type</label>
                  <select value={call.callType} onChange={(e) => cSet("callType", e.target.value)} style={crmSelect}>
                    <option value="voice">Voice Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="meeting">In-Person</option>
                    <option value="video">Video Call</option>
                  </select>
                </div>
                <div>
                  <label style={crmLabel}>Follow-up Mode</label>
                  <select value={call.followUpMode} onChange={(e) => cSet("followUpMode", e.target.value)} style={crmSelect}>
                    <option value="call">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="meeting">Meeting</option>
                    <option value="none">— None</option>
                  </select>
                </div>
                <div>
                  <label style={crmLabel}>Duration (min)</label>
                  <input type="number" min={0} placeholder="e.g. 15" value={call.durationMinutes}
                    onChange={(e) => cSet("durationMinutes", e.target.value)} style={crmInput} />
                </div>
                <div>
                  <label style={crmLabel}>Next Follow-up</label>
                  <input type="datetime-local" value={call.scheduledAt}
                    onChange={(e) => cSet("scheduledAt", e.target.value)} style={crmInput} />
                </div>
              </div>
              <div>
                <label style={crmLabel}>Next Action</label>
                <input placeholder="e.g. Send quotation, Schedule demo" value={call.nextAction}
                  onChange={(e) => cSet("nextAction", e.target.value)} style={crmInput} />
              </div>
              <div>
                <label style={crmLabel}>Call Notes</label>
                <textarea placeholder="What was discussed? Key points..." value={call.notes}
                  onChange={(e) => cSet("notes", e.target.value)}
                  style={{ ...crmInput, minHeight: 80, resize: "vertical" }} />
              </div>
              <button onClick={() => onSaveCall(call)} disabled={!canSaveCall || savingCall}
                style={{ ...crmBtnPrimary, justifySelf: "start", opacity: canSaveCall && !savingCall ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {savingCall ? "Saving..." : <><Icons.IconPhone size={14} /> Save Call Record</>}
              </button>
            </div>
          )}

          {tab === "history" && (
            <div style={{ display: "grid", gap: 10 }}>
              {callLogs.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                  <Icons.IconPackage size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div>No call records yet. Log your first call above.</div>
                </div>
              )}
              {callLogs.map((log) => (
                <div key={log.id} style={{
                  border: "1px solid #e2e8f0", borderRadius: 10, padding: 14,
                  background: "#fafbfc", transition: "background 0.1s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StatusBadge status={log.outcome} />
                      <span style={{ fontSize: 12, color: "#64748b" }}>{log.callType || "voice"}</span>
                      {log.durationMinutes ? <span style={{ fontSize: 11, color: "#94a3b8" }}>• {log.durationMinutes}m</span> : null}
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDateTime(log.calledAt)}</span>
                  </div>
                  {log.calledByName && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>By: {log.calledByName}</div>}
                  {log.nextAction && (
                    <div style={{ fontSize: 12, color: "#1e293b", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icons.IconZap size={12} color="#4f46e5" /> Next: {log.nextAction}
                    </div>
                  )}
                  {log.notes && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{log.notes}</div>}
                  {log.scheduledAt && (
                    <div style={{ fontSize: 11, color: "#6366f1", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icons.IconCalendar size={12} /> Follow-up: {fmtDateTime(log.scheduledAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
