"use client";

import ErmShell from "../components/ErmShell";
import { ErmLeadsModule } from "../components/erm-leads";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmLeadsPage() {
  const { loading, allowed } = useErmGuard("erm_leads_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="leads"
      title="ERM Leads"
      subtitle="Manage your sales pipeline — create, assign, track, and close leads."
    >
      <ErmLeadsModule />
    </ErmShell>
  );
}
