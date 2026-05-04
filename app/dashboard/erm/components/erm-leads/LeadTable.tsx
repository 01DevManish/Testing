"use client";
import React, { useMemo } from "react";
import { LeadRecord } from "./types";
import { crmCard, crmInput, crmSelect, crmTh, crmTd, crmBtnSecondary } from "./styles";
import { fmtDate, exportLeadsToExcel } from "./helpers";
import StatusBadge from "./StatusBadge";
import * as Icons from "./Icons";

interface StaffMember { uid: string; name: string; [k: string]: unknown; }

interface Props {
  leads: LeadRecord[];
  filteredLeads: LeadRecord[];
  loading: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  leadSearch: string;
  setLeadSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onOpenLead: (id: string) => void;
  staff: StaffMember[];
  onAssignChange: (leadId: string, newUid: string) => void;
}

export default function LeadTable({
  leads, filteredLeads, loading, isAdmin, canEdit,
  leadSearch, setLeadSearch, statusFilter, setStatusFilter,
  onOpenLead, staff, onAssignChange,
}: Props) {
  const title = isAdmin ? `All Leads` : `My Leads`;

  return (
    <div style={{ ...crmCard, width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icons.IconClipboard size={22} color="#4f46e5" strokeWidth={2.5} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{filteredLeads.length} of {leads.length} leads</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", width: "100%", minWidth: 0 }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
            <Icons.IconSearch size={14} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              placeholder="Search by name, phone, city..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              style={{ ...crmInput, width: "100%", minWidth: 0, paddingLeft: 34 }}
            />
          </div>
          <div style={{ position: "relative", flex: "1 1 160px", minWidth: 140 }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...crmSelect, width: "100%", minWidth: 0 }}>
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="not_interested">Not Interested</option>
              <option value="follow_up">Follow Up</option>
              <option value="scheduled">Scheduled</option>
              <option value="scheduled_meeting">Meeting Set</option>
              <option value="ordered">Ordered</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <button
            onClick={() => exportLeadsToExcel(filteredLeads as unknown as Record<string, unknown>[])}
            style={crmBtnSecondary}
          >
            <Icons.IconDownload size={14} /> Export Excel
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr>
              <th style={crmTh}>SR.</th>
              <th style={crmTh}>Date</th>
              {isAdmin && <th style={crmTh}>Source</th>}
              <th style={crmTh}>POC Name</th>
              <th style={crmTh}>Status</th>
              <th style={crmTh}>Phone No.</th>
              <th style={crmTh}>Company</th>
              <th style={crmTh}>City</th>
              <th style={crmTh}>State</th>
              {isAdmin && <th style={crmTh}>Assign To</th>}
              <th style={{ ...crmTh, textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead, idx) => (
              <tr
                key={lead.id}
                style={{
                  background: idx % 2 === 0 ? "#fff" : "#fafbfc",
                  transition: "background 0.1s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}
              >
                <td style={{ ...crmTd, fontWeight: 600, color: "#94a3b8", fontSize: 14, width: 40 }}>{idx + 1}</td>
                <td style={{ ...crmTd, fontSize: 14, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(lead.createdAt)}</td>
                {isAdmin && (
                  <td style={crmTd}>
                    <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                      {lead.source || "-"}
                    </span>
                  </td>
                )}
                <td style={{ ...crmTd, fontWeight: 600, color: "#0f172a" }}>{lead.name}</td>
                <td style={crmTd}><StatusBadge status={lead.status} /></td>
                <td style={{ ...crmTd, fontFamily: "monospace", fontSize: 14 }}>{lead.phone}</td>
                <td style={{ ...crmTd, fontSize: 14 }}>{lead.company || "-"}</td>
                <td style={{ ...crmTd, fontSize: 14 }}>{lead.city || "-"}</td>
                <td style={{ ...crmTd, fontSize: 14 }}>{lead.state || "-"}</td>
                {isAdmin && (
                  <td style={{ ...crmTd, minWidth: 140 }}>
                    {(isAdmin && canEdit) ? (
                      <select
                        value={lead.assignedToUid || ""}
                        onChange={(e) => onAssignChange(lead.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: "5px 8px",
                          fontSize: 14,
                          background: "#f8fafc",
                          color: "#1e293b",
                          cursor: "pointer",
                          width: "100%",
                          outline: "none",
                        }}
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 14, color: "#475569" }}>{lead.assignedToName || "-"}</span>
                    )}
                  </td>
                )}
                <td style={{ ...crmTd, textAlign: "center" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenLead(lead.id); }}
                    style={{
                      border: "none",
                      background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                      color: "#fff",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "7px 14px",
                      cursor: "pointer",
                      transition: "transform 0.1s",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Icons.IconZap size={12} fill="#fff" /> Action
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && filteredLeads.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 15 }}>
            <Icons.IconRefresh size={32} style={{ marginBottom: 12, opacity: 0.5, animation: "spin 2s linear infinite" }} />
            <div>Loading leads...</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!loading && filteredLeads.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 15 }}>
            <Icons.IconPackage size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>No leads found. Try adjusting your search or filters.</div>
          </div>
        )}
      </div>
    </div>
  );
}
