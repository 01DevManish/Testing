"use client";

import ErmShell from "../components/ErmShell";
import { useErmGuard } from "../components/useErmGuard";

export default function ErmNoWorkspacePage() {
  const { loading, allowed } = useErmGuard("erm_dashboard_view", { requireWorkspace: false });
  if (loading || !allowed) return null;

  return (
    <ErmShell
      active="dashboard"
      title="CRM Workspace"
      subtitle="Workspace pending admin setup."
      workspaceReady={false}
    >
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: 14,
          padding: "18px 20px",
          color: "#9a3412",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Contact to admin. Your CRM workspace is not created yet.
      </div>
    </ErmShell>
  );
}

