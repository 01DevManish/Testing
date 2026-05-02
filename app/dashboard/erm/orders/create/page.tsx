"use client";

import ErmShell from "../../components/ErmShell";
import { ErmOrdersModule } from "../../components/modules";
import { useErmGuard } from "../../components/useErmGuard";

export default function ErmCreateOrderPage() {
  const { loading, allowed } = useErmGuard("erm_orders_create");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="orders-create"
      title="Create Order"
      subtitle="Create and process ERM orders."
    >
      <ErmOrdersModule />
    </ErmShell>
  );
}
