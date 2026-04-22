"use client";

import ErmShell from "../components/ErmShell";
import { ErmCatalogModule } from "../components/modules";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmCatalogSharingPage() {
  const { loading, allowed } = useErmGuard("erm_catalog_view");
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="catalog-sharing"
      title="ERM Catalog Sharing"
      subtitle="Catalog outreach and tracking module under ERM CRM."
    >
      <ErmCatalogModule />
    </ErmShell>
  );
}
