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
          <span className="text-xl font-bold tracking-tight">Eurus Lifestyle</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-extrabold leading-tight mb-6">
            Join the Next Generation of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Logistics.</span>
          </h1>
          <p className="text-lg text-gray-400 font-medium">
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
            <img src="/logo.png" alt="Eurus Lifestyle" className="w-24 h-24 object-contain mb-4" />
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Eurus Lifestyle</h1>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Create an Account</h2>
            <p className="text-gray-500 font-medium">Sign up to get started immediately.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3">
              <span className="text-lg leading-none">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
              <button onClick={clearError} className="text-red-400 hover:text-red-700 font-bold px-1">✕</button>
            </div>
          )}

          <div className="space-y-4">
            {/* Google Auth Button */}
            <button 
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow transition-all group"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.86 16.81 15.65 17.61V20.4H19.22C21.3 18.48 22.56 15.63 22.56 12.25Z" fill="#4285F4"/>
                <path d="M12 23C14.97 23 17.46 22.02 19.22 20.4L15.65 17.61C14.7 18.25 13.45 18.63 12 18.63C9.19 18.63 6.81 16.73 5.96 14.24H2.28V17.06C4.07 20.62 7.74 23 12 23Z" fill="#34A853"/>
                <path d="M5.96 14.24C5.74 13.59 5.61 12.89 5.61 12.2C5.61 11.5 5.74 10.81 5.96 10.15V7.33H2.28C1.54 8.79 1.12 10.42 1.12 12.2C1.12 13.98 1.54 15.61 2.28 17.06L5.96 14.24Z" fill="#FBBC05"/>
                <path d="M12 5.38C13.62 5.38 15.06 5.93 16.2 7.02L19.3 3.92C17.46 2.2 14.97 1.2 12 1.2C7.74 1.2 4.07 3.58 2.28 7.33L5.96 10.15C6.81 7.66 9.19 5.38 12 5.38Z" fill="#EA4335"/>
              </svg>
              <span className="font-bold text-gray-700">Sign up with Google</span>
            </button>

            {/* Zoho Auth Button */}
            <button 
              onClick={loginWithZoho}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow transition-all group"
            >
              <div className="flex gap-1 items-center justify-center w-6 h-6">
                <svg viewBox="0 0 120 40" width="24" height="24" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="scale-125">
                  <rect x="10" y="8" width="24" height="24" rx="4" stroke="#d52027" transform="rotate(-8 22 20)" />
                  <rect x="36" y="8" width="24" height="24" rx="4" stroke="#009639" transform="rotate(8 48 20)" />
                  <rect x="62" y="8" width="24" height="24" rx="4" stroke="#0060a9" transform="rotate(-4 74 20)" />
                  <rect x="88" y="8" width="24" height="24" rx="4" stroke="#f39200" transform="rotate(2 100 20)" />
                </svg>
              </div>
              <span className="font-bold text-gray-700">Sign up with Zoho</span>
            </button>
          </div>

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
