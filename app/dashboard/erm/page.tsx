"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../lib/permissions";

export default function ErmHomePage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!hasPermission(userData, "erm_dashboard_view")) {
      router.replace("/dashboard");
      return;
    }

    if (userData?.role === "admin") {
      router.replace("/dashboard/erm/admin");
      return;
    }

    const uid = userData?.uid || user?.uid;
    if (uid) router.replace(`/dashboard/erm/employee/${uid}/dashboard`);
    else router.replace("/dashboard");
  }, [loading, user, userData, router]);

  return null;
}
