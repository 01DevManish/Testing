"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Suspense } from "react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Authenticating with Zoho...");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received. Please try again.");
      return;
    }

    const handleCallback = async () => {
      try {
        setStatus("Exchanging authorization code...");

        const res = await fetch("/api/auth/zoho", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }

        setStatus("Setting up your account...");

        const zohoUser = data.user;
        const zohoUid = `zoho_${zohoUser.zohoId || zohoUser.email.replace(/[^a-zA-Z0-9]/g, "_")}`;

        // Check if user exists in Firestore
        const docRef = doc(db, "users", zohoUid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          // First time — create with employee role
          await setDoc(docRef, {
            uid: zohoUid,
            email: zohoUser.email,
            name: zohoUser.name,
            role: (zohoUser.email === "01devmanish@gmail.com") ? "admin" : "employee",
          });
        }

        // Store session
        const storedData = docSnap.exists() ? docSnap.data() : null;
        let userData = storedData as any;
        
        if (!userData) {
          userData = {
            uid: zohoUid,
            email: zohoUser.email,
            name: zohoUser.name,
            role: (zohoUser.email === "01devmanish@gmail.com") ? "admin" : "employee",
            permissions: (zohoUser.email === "01devmanish@gmail.com") ? ["all"] : [],
          };
        } else if (zohoUser.email === "01devmanish@gmail.com" && userData.role !== "admin") {
          // Force upgrade to admin and update firestore
          userData.role = "admin";
          userData.permissions = ["all"];
          await updateDoc(docRef, { role: "admin", permissions: ["all"] });
        }

        localStorage.setItem("eurus_session", JSON.stringify(userData));

        setStatus("Redirecting to dashboard...");
        let targetRoute = "/dashboard/user";
        if (userData.role === "admin") targetRoute = "/dashboard/admin";
        else if (userData.role === "employee" || userData.role === "manager") targetRoute = "/dashboard/employee";
        
        router.replace(targetRoute);
      } catch (err) {
        console.error("Callback error:", err);
        setError("Authentication failed. Please try again.");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="auth-page">
      <div className="auth-bg"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>
      <div className="auth-card animate-fade-in" style={{ textAlign: "center", padding: "60px 40px", maxWidth: 420 }}>
        <div className="brand-logo">E</div>
        {error ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Authentication Failed</h2>
            <p style={{ fontSize: 14, color: "var(--accent-red)", marginBottom: 24 }}>{error}</p>
            <button onClick={() => router.replace("/")} className="auth-btn auth-btn-primary">Back to Login</button>
          </>
        ) : (
          <>
            <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 16px", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{status}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-bg"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>
        <div className="auth-card animate-fade-in" style={{ textAlign: "center", padding: "60px 40px" }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 16px", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin-slow 0.7s linear infinite" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
