"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// This old callback path is no longer used.
// Zoho now redirects to /api/auth/zoho/callback
// This page redirects any stale requests to the correct path.

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      router.replace(`/api/auth/zoho/callback?code=${code}`);
    } else {
      router.replace("/");
    }
  }, [searchParams, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "inherit", color: "#64748b" }}>
      Redirecting...
    </div>
  );
}

export default function OldCallbackPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>Loading...</div>}>
      <RedirectContent />
    </Suspense>
  );
}
