"use client";

import ErmShell from "../../components/ErmShell";
import { ErmOrdersModule } from "../../components/modules";
import { useErmGuard } from "../../components/useErmGuard";

export default function ErmViewPurchaseInvoicePage() {
  const { loading, allowed } = useErmGuard("erm_orders_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="purchase-view"
      title="View Purchase Invoice"
      subtitle="View and track purchase invoices under accounting."
    >
      <ErmOrdersModule />
    </ErmShell>
  );
}
