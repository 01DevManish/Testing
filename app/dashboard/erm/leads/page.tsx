"use client";

import ErmShell from "../components/ErmShell";
import { ErmLeadsModule } from "../components/modules";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmLeadsPage() {
  const { loading, allowed } = useErmGuard("erm_leads_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="leads"
      title="ERM Leads"
      subtitle="Leads lifecycle module under ERM CRM."
    >
      <ErmLeadsModule />
    </ErmShell>
  );
}
