"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext";
import { hasCrmWorkspace } from "../../../../lib/crmWorkspace";

export default function ErmEmployeeDefaultDashboardRedirect() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const uid = userData?.uid || user?.uid;
    if (!uid) {
      router.replace("/dashboard");
      return;
    }
    if (userData?.role !== "admin" && !hasCrmWorkspace(userData)) {
      router.replace("/dashboard/erm/no-workspace");
      return;
    }
    router.replace(`/dashboard/erm/employee/${uid}/dashboard`);
  }, [loading, user, userData, router]);

  return null;
}
