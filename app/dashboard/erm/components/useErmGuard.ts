"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";

export function useErmGuard(requiredPermission: string) {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!hasPermission(userData, requiredPermission)) {
      router.replace("/dashboard");
    }
  }, [loading, user, userData, requiredPermission, router]);

  const allowed = !loading && !!user && hasPermission(userData, requiredPermission);
  return { loading, allowed };
}
