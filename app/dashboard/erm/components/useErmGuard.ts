"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../lib/permissions";
import { hasCrmWorkspace } from "../../../lib/crmWorkspace";

export function useErmGuard(requiredPermission: string, options?: { requireWorkspace?: boolean }) {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const requireWorkspace = options?.requireWorkspace ?? true;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!hasPermission(userData, requiredPermission)) {
      router.replace("/dashboard");
      return;
    }
    if (requireWorkspace && !hasCrmWorkspace(userData)) {
      router.replace("/dashboard/erm/no-workspace");
    }
  }, [loading, user, userData, requiredPermission, requireWorkspace, router]);

  const allowed = !loading
    && !!user
    && hasPermission(userData, requiredPermission)
    && (!requireWorkspace || hasCrmWorkspace(userData));
  return { loading, allowed };
}
