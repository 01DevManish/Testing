"use client";

import ErmShell from "../components/ErmShell";
import { ErmOrdersModule } from "../components/modules";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmOrdersPage() {
  const { loading, allowed } = useErmGuard("erm_orders_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="orders"
      title="ERM Orders"
      subtitle="Order processing module under ERM CRM."
    >
      <ErmOrdersModule />
    </ErmShell>
  );
}
