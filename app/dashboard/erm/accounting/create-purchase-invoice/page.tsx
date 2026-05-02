"use client";

import ErmShell from "../../components/ErmShell";
import { ErmOrdersModule } from "../../components/modules";
import { useErmGuard } from "../../components/useErmGuard";

export default function ErmCreatePurchaseInvoicePage() {
  const { loading, allowed } = useErmGuard("erm_orders_create");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="purchase-create"
      title="Create Purchase Invoice"
      subtitle="Create purchase invoices under accounting."
    >
      <ErmOrdersModule />
    </ErmShell>
  );
}
