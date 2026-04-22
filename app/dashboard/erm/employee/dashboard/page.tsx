"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext";

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
    router.replace(`/dashboard/erm/employee/${uid}/dashboard`);
  }, [loading, user, userData, router]);

  return null;
}
