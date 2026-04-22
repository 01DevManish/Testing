"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ErmShell from "../../../components/ErmShell";
import { ErmDashboardModule } from "../../../components/modules";
import { useErmGuard } from "../../../components/useErmGuard";
import { useAuth } from "../../../../../context/AuthContext";

export default function ErmEmployeeDashboardByIdPage() {
  const router = useRouter();
  const params = useParams<{ employeeId: string }>();
  const { loading, allowed } = useErmGuard("erm_dashboard_view");
  const { userData } = useAuth();

  const requestedId = String(params?.employeeId || "");
  const isAdmin = userData?.role === "admin";
  const canView = isAdmin || userData?.uid === requestedId;

  useEffect(() => {
    if (loading) return;
    if (!allowed) return;
    if (!requestedId) {
      router.replace("/dashboard/erm");
      return;
    }
    if (!canView) {
      router.replace("/dashboard/erm");
    }
  }, [loading, allowed, requestedId, canView, router]);

  if (loading || !allowed || !requestedId || !canView) return null;

  return (
    <ErmShell
      active="dashboard"
      title={isAdmin ? "Employee Dashboard (Admin View)" : "My ERM Dashboard"}
      subtitle={isAdmin ? "Admin view of individual employee performance." : "Your own orders and sales only."}
      employeeDashboardUid={requestedId}
    >
      <ErmDashboardModule forcedEmployeeUid={requestedId} />
    </ErmShell>
  );
}
