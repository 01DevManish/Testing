"use client";

import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const { loginWithZoho, loginWithGoogle, error, clearError, user, loading } = useAuth();
  const router = useRouter();

  // If already logged in, redirect
  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") router.push("/dashboard/admin");
      else router.push("/dashboard");
    }
  }, [loading, user, router]);

  if (!loading && user) return null;

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Side - Branding / Graphic (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#0B0F19] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-600 blur-[120px]"></div>
          <div className="absolute top-[40%] text-right -right-[10%] w-[60%] h-[60%] rounded-full bg-purple-600 blur-[150px]"></div>
        </div>

        <div className="relative z-10 flex flex-col items-start">
          <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mb-4 rounded-xl" style={{ background: "#fff", padding: 3 }} />
          <span className="text-xl font-semibold tracking-tight">EURUS LIFESTYLE</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Join the Next Generation of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Logistics.</span>
          </h1>
          <p className="text-lg text-gray-400 font-normal">
            Create an account in seconds to access advanced fulfillment tools, seamless dispatch tracking, and team management integrations.
          </p>
        </div>

        <div className="relative z-10 flex gap-4 text-sm text-gray-500 font-medium">
          <span>&copy; {new Date().getFullYear()} Eurus Lifestyle.</span>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white relative">
        <div className="w-full max-w-md animate-fade-in-up">

          <div className="lg:hidden flex flex-col items-center mb-10 text-center">
            <img src="/logo.png" alt="EURUS LIFESTYLE" className="w-24 h-24 object-contain mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">EURUS LIFESTYLE</h1>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create an Account</h2>
            <p className="text-gray-500 font-normal">Contact your administrator to set up your ERP account.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3">
              <span className="text-lg leading-none">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
              <button onClick={clearError} className="text-red-400 hover:text-red-700 font-bold px-1">✕</button>
            </div>
          )}

          <div className="mt-10 text-center text-sm text-gray-500 font-medium">
            Already have an account?{' '}
            <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-bold border-b border-transparent hover:border-indigo-800 transition-colors pb-0.5">
              Log in here
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
