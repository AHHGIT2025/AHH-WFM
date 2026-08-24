"use client";

import React, { useState, Suspense, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { BRANDING } from "@/lib/branding";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    try {
      // Pre-check credentials for explicit error messaging
      const checkRes = await fetch("/api/v1/auth/pre-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const checkData = await checkRes.json();
      if (!checkData.success) {
        setLoginError(checkData.error || "Invalid username or password.");
        setLoading(false);
        return;
      }

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setLoginError("Invalid username or password.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setLoginError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    signIn("azure-ad", { callbackUrl: "/" });
  };

  return (
    <div className="w-full max-w-[450px] bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10 text-white">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-white mb-2">
          <span className="material-symbols-outlined text-[#5FAFD8] text-[32px]">domain</span>
          {BRANDING.PRODUCT_NAME}
        </div>
        <p className="text-xs text-slate-300 font-medium uppercase tracking-widest">{BRANDING.PORTAL_NAME}</p>
        <p className="text-xs text-slate-300 mt-1">
          by <span className="font-semibold text-white">{BRANDING.BRAND_NAME}</span>
        </p>
        <p className="text-[11px] text-slate-300 italic mt-0.5">{BRANDING.TAGLINE}</p>
      </div>

      {/* Error Banners */}
      {error && error !== "CredentialsSignin" && (
        <div className="mb-6 p-4.5 bg-red-950/45 border border-red-800/60 rounded-xl flex gap-3 text-xs font-semibold text-red-400">
          <span className="material-symbols-outlined shrink-0 text-[18px]">error</span>
          <span>{error === "UnauthorizedAccess" ? "Access denied. Only Supervisors and Administrators are permitted to enter this console." : decodeURIComponent(error)}</span>
        </div>
      )}

      {loginError && (
        <div className="mb-6 p-4.5 bg-red-950/45 border border-red-800/60 rounded-xl flex gap-3 text-xs font-semibold text-red-400">
          <span className="material-symbols-outlined shrink-0 text-[18px]">error</span>
          <span>{loginError}</span>
        </div>
      )}

      {/* Microsoft Entra ID OAuth Sign In */}
      <button
        onClick={handleMicrosoftLogin}
        className="w-full flex items-center justify-center gap-3 bg-white text-[#031751] font-bold py-3 px-4 rounded-xl shadow-lg hover:bg-slate-100 transition-colors active:scale-[0.98] transition-transform text-xs"
      >
        {/* Mock Microsoft Icon */}
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
          <path fill="#F35325" d="M0 0h11v11H0z" />
          <path fill="#803D90" d="M12 0h11v11H12z" />
          <path fill="#00A4EF" d="M0 12h11v11H0z" />
          <path fill="#FEBA08" d="M12 12h11v11H12z" />
        </svg>
        <span>Sign in with Microsoft Office 365</span>
      </button>

      {/* Divider */}
      <div className="flex items-center my-6">
        <div className="flex-grow h-px bg-slate-700/80"></div>
        <span className="text-[10px] text-slate-400 font-bold uppercase px-3">or credentials bypass</span>
        <div className="flex-grow h-px bg-slate-700/80"></div>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1.5 tracking-wider">Email Address</label>
          <input
            type="email"
            required
            disabled={loading}
            placeholder="e.g. admin@alhattab.qa"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#031751]/90 border border-slate-700 rounded-xl focus:outline-none focus:border-[#116BEE] text-xs font-medium placeholder-slate-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1.5 tracking-wider">Password</label>
          <input
            type="password"
            required
            disabled={loading}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#031751]/90 border border-slate-700 rounded-xl focus:outline-none focus:border-[#116BEE] text-xs font-medium placeholder-slate-400 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#093FA6] text-white font-bold py-3 rounded-xl hover:bg-[#116BEE] transition-colors active:scale-[0.98] transition-transform text-xs flex items-center justify-center shadow-md"
        >
          {loading ? "Authenticating..." : "Sign In"}
        </button>
      </form>

      <div className="mt-8 text-center border-t border-slate-700/80 pt-4 space-y-1">
        <p className="text-[10px] text-slate-300 font-semibold">{BRANDING.PRODUCT_NAME} Secure Portal · {BRANDING.VERSION_TEXT}</p>
        <p className="text-[10px] text-slate-400">{BRANDING.COPYRIGHT_TEXT}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#031751] flex items-center justify-center px-4 font-sans text-white relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#093FA6] opacity-30 blur-[150px]"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#116BEE] opacity-20 blur-[150px]"></div>

      <Suspense fallback={
        <div className="w-full max-w-[450px] bg-[#031751]/80 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-8 text-center text-xs">
          Loading authentication gateway...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
