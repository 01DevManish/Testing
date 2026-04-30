"use client";

import ErmShell from "../components/ErmShell";
import { ErmDashboardModule } from "../components/modules";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmAdminPage() {
  const { loading, allowed } = useErmGuard("erm_dashboard_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="dashboard"
      title="CRM Workspace Admin Dashboard"
      subtitle="Admin can see all CRM workspace users, orders/sales, and employee workspace links."
    >
      <ErmDashboardModule />
    </ErmShell>
  );
}
