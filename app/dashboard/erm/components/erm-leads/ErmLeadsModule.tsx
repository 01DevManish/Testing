"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { useData } from "../../../../context/DataContext";
import { hasPermission } from "../../../../lib/permissions";
import { LeadRecord, LeadCallRecord, ErmEntity, LeadStatus } from "./types";
import {
  sortByUpdatedAtDesc, sortByCalledAtDesc,
  parseCachedArray, saveCachedArray,
  generateEntityId,
  ERM_LEADS_CACHE_KEY, ERM_LEAD_CALLS_CACHE_KEY,
} from "./helpers";

import LeadStatCards from "./LeadStatCards";
import LeadCreateForm from "./LeadCreateForm";
import LeadTable from "./LeadTable";
import LeadActionModal from "./LeadActionModal";

export default function ErmLeadsModule() {
  const { userData } = useAuth();
  const { users = [] } = useData();
  const canCreate = hasPermission(userData, "erm_leads_create");
  const canEdit = hasPermission(userData, "erm_leads_edit");
  const isAdmin = userData?.role === "admin";
  const canAdminUpload = isAdmin && canCreate;

  /* ── State ── */
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [allLeadCalls, setAllLeadCalls] = useState<LeadCallRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /* ── API helpers ── */
  const fetchEntity = useCallback(async <T,>(entity: ErmEntity): Promise<T[]> => {
    const r = await fetch(`/api/data/${entity}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to load ${entity}`);
    const j = await r.json();
    return Array.isArray(j?.items) ? (j.items as T[]) : [];
  }, []);

  const upsertEntity = useCallback(async <T extends { id: string }>(entity: ErmEntity, items: T[]) => {
    const valid = items.filter((i) => String(i.id || "").trim());
    if (!valid.length) return;
    const r = await fetch(`/api/data/${entity}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "upsert", items: valid }),
    });
    if (!r.ok) throw new Error(`Failed to save ${entity}`);
  }, []);

  const syncLeads = useCallback(async () => {
    const rows = await fetchEntity<LeadRecord>("ermLeads");
    const sorted = sortByUpdatedAtDesc(rows);
    setLeads(sorted);
    saveCachedArray(ERM_LEADS_CACHE_KEY, sorted);
  }, [fetchEntity]);

  const syncCalls = useCallback(async () => {
    const rows = await fetchEntity<LeadCallRecord>("ermLeadCalls");
    const sorted = sortByCalledAtDesc(rows);
    setAllLeadCalls(sorted);
    saveCachedArray(ERM_LEAD_CALLS_CACHE_KEY, sorted);
  }, [fetchEntity]);

  /* ── Init + polling ── */
  useEffect(() => {
    const cached = sortByUpdatedAtDesc(parseCachedArray<LeadRecord>(ERM_LEADS_CACHE_KEY));
    if (cached.length) setLeads(cached);
    const cachedCalls = sortByCalledAtDesc(parseCachedArray<LeadCallRecord>(ERM_LEAD_CALLS_CACHE_KEY));
    if (cachedCalls.length) setAllLeadCalls(cachedCalls);

    let alive = true;
    Promise.all([syncLeads(), syncCalls()])
      .catch((e) => console.error("ERM sync failed:", e))
      .finally(() => { if (alive) setLoadingLeads(false); });

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      syncLeads().catch(() => {});
      syncCalls().catch(() => {});
    }, 15000);

    return () => { alive = false; window.clearInterval(timer); };
  }, [syncLeads, syncCalls]);

  /* ── Staff (ERM-permissioned users) ── */
  const staff = useMemo(
    () => users.filter((u) => 
      u.email !== "01devmanish@gmail.com" && 
      (hasPermission(u, "erm_leads_view") || u.role === "admin" || u.role === "manager")
    ),
    [users],
  );

  /* ── Filtered leads ── */
  const visibleLeads = useMemo(() => {
    if (isAdmin) return leads;
    return leads.filter((l) => l.assignedToUid === userData?.uid);
  }, [isAdmin, leads, userData]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return visibleLeads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(l.name || "").toLowerCase().includes(q) ||
        String(l.phone || "").toLowerCase().includes(q) ||
        String(l.city || "").toLowerCase().includes(q) ||
        String(l.company || "").toLowerCase().includes(q) ||
        String(l.assignedToName || "").toLowerCase().includes(q)
      );
    });
  }, [visibleLeads, leadSearch, statusFilter]);

  const selectedLead = visibleLeads.find((l) => l.id === selectedLeadId) || null;
  const callLogs = useMemo(
    () => sortByCalledAtDesc(allLeadCalls.filter((c) => (c as unknown as Record<string, unknown>).leadId === selectedLeadId)),
    [allLeadCalls, selectedLeadId],
  );

  /* ── Inline assign ── */
  const handleAssignChange = useCallback(async (leadId: string, newUid: string) => {
    const assignee = staff.find((s) => s.uid === newUid);
    const now = Date.now();
    const nextLeads = leads.map((l) =>
      l.id === leadId
        ? { ...l, assignedToUid: newUid, assignedToName: assignee?.name || "", updatedAt: now }
        : l,
    );
    setLeads(nextLeads);
    saveCachedArray(ERM_LEADS_CACHE_KEY, nextLeads);
    const updated = nextLeads.find((l) => l.id === leadId);
    if (updated) await upsertEntity("ermLeads", [updated]);
  }, [leads, staff, upsertEntity]);

  /* ── Save meta ── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveMeta = useCallback(async (form: any) => {
    if (!canEdit || !selectedLead) return;
    setSavingMeta(true);
    try {
      const assignee = staff.find((s) => s.uid === form.assignedToUid);
      const updated: LeadRecord = {
        ...selectedLead,
        name: form.name?.trim() || selectedLead.name,
        phone: form.phone?.trim() || selectedLead.phone,
        address: form.address?.trim() || "",
        email: form.email?.trim() || "",
        company: form.company?.trim() || "",
        city: form.city?.trim() || "",
        state: form.state?.trim() || "",
        pincode: form.pincode?.trim() || "",
        status: (form.status as LeadStatus) || selectedLead.status,
        assignedToUid: form.assignedToUid || selectedLead.assignedToUid || "",
        assignedToName: assignee?.name || selectedLead.assignedToName || "",
        notes: form.notes?.trim() || "",
        nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).getTime() : undefined,
        updatedAt: Date.now(),
      };
      const next = sortByUpdatedAtDesc(leads.map((l) => (l.id === selectedLead.id ? updated : l)));
      setLeads(next);
      saveCachedArray(ERM_LEADS_CACHE_KEY, next);
      await upsertEntity("ermLeads", [updated]);
      setIsModalOpen(false);
      setSelectedLeadId("");
    } finally {
      setSavingMeta(false);
    }
  }, [canEdit, selectedLead, staff, leads, upsertEntity]);

  /* ── Save call ── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveCall = useCallback(async (form: any) => {
    if (!canEdit || !selectedLead) return;
    setSavingCall(true);
    try {
      const now = Date.now();
      const scheduledTs = form.scheduledAt ? new Date(form.scheduledAt).getTime() : undefined;
      const duration = Number(form.durationMinutes || 0);
      const newCall: LeadCallRecord = {
        id: generateEntityId("call"),
        leadId: selectedLead.id,
        outcome: form.outcome as LeadCallRecord["outcome"],
        notes: form.notes?.trim() || "",
        scheduledAt: scheduledTs,
        callType: form.callType as LeadCallRecord["callType"],
        durationMinutes: duration > 0 ? duration : undefined,
        followUpMode: form.followUpMode as LeadCallRecord["followUpMode"],
        priority: selectedLead.priority || "cold",
        nextAction: form.nextAction?.trim() || "",
        calledAt: now,
        calledByUid: userData?.uid || "",
        calledByName: userData?.name || "",
      };

      const patchedLead: LeadRecord = {
        ...selectedLead,
        status: form.outcome === "interested" ? "interested" : form.outcome === "not_interested" ? "not_interested" : (scheduledTs ? "scheduled" : "contacted"),
        nextFollowUpAt: scheduledTs,
        lastOutcome: form.outcome,
        notes: form.notes?.trim() || selectedLead.notes || "",
        callAttemptCount: (selectedLead.callAttemptCount || 0) + 1,
        updatedAt: now,
      };

      const nextCalls = sortByCalledAtDesc([newCall, ...allLeadCalls]);
      const nextLeads = sortByUpdatedAtDesc(leads.map((l) => (l.id === selectedLead.id ? patchedLead : l)));
      setAllLeadCalls(nextCalls);
      setLeads(nextLeads);
      saveCachedArray(ERM_LEAD_CALLS_CACHE_KEY, nextCalls);
      saveCachedArray(ERM_LEADS_CACHE_KEY, nextLeads);
      await Promise.all([
        upsertEntity("ermLeadCalls", [newCall]),
        upsertEntity("ermLeads", [patchedLead]),
      ]);
      setIsModalOpen(false);
      setSelectedLeadId("");
    } finally {
      setSavingCall(false);
    }
  }, [canEdit, selectedLead, userData, allLeadCalls, leads, upsertEntity]);

  return (
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
      <LeadStatCards leads={visibleLeads} loading={loadingLeads} />

      <LeadCreateForm
        canAdminUpload={canAdminUpload}
        staff={staff as any[]}
        leads={leads}
        setLeads={setLeads}
        upsertEntityItems={(e, items) => upsertEntity(e, items)}
        userData={userData}
      />

      <LeadTable
        leads={visibleLeads}
        filteredLeads={filteredLeads}
        loading={loadingLeads}
        isAdmin={isAdmin}
        canEdit={canEdit}
        leadSearch={leadSearch}
        setLeadSearch={setLeadSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onOpenLead={(id) => { setSelectedLeadId(id); setIsModalOpen(true); }}
        staff={staff as any[]}
        onAssignChange={handleAssignChange}
      />

      {selectedLead && isModalOpen && (
        <LeadActionModal
          lead={selectedLead}
          callLogs={callLogs}
          canEdit={canEdit}
          staff={staff as any[]}
          savingMeta={savingMeta}
          savingCall={savingCall}
          onClose={() => { setIsModalOpen(false); setSelectedLeadId(""); }}
          onSaveMeta={handleSaveMeta}
          onSaveCall={handleSaveCall}
        />
      )}
    </div>
  );
}
