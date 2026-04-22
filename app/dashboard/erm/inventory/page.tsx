"use client";

import ErmShell from "../components/ErmShell";
import { ErmInventoryModule } from "../components/modules";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmInventoryPage() {
  const { loading, allowed } = useErmGuard("erm_inventory_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="inventory"
      title="ERM Inventory"
      subtitle="Inventory workflow module under ERM CRM."
    >
      <ErmInventoryModule />
    </ErmShell>
  );
}
