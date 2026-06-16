"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

function MobileLoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        if (res.error === "CredentialsSignin") {
          setLoginError("Invalid email/username or password. Please try again.");
        } else {
          setLoginError(res.error);
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setLoginError("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    signIn("azure-ad", { callbackUrl: "/" });
  };

  return (
    <div className="w-full max-w-[380px] mx-auto bg-surface border border-outline-variant/35 rounded-2xl p-6 shadow-md">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2 text-primary">
          <span className="material-symbols-outlined text-[26px]">fingerprint</span>
        </div>
        <h2 className="text-base font-bold text-primary">Al Hattab Employee Portal</h2>
        <p className="text-[10px] text-on-surface-variant leading-tight mt-0.5">Secure Geo-Attendance Client</p>
      </div>

      {/* Error Notification */}
      {error && error !== "CredentialsSignin" && (
        <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded-xl flex gap-2 text-[10px] font-semibold text-status-error">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{decodeURIComponent(error)}</span>
        </div>
      )}

      {loginError && (
        <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded-xl flex gap-2 text-[10px] font-semibold text-status-error">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{loginError}</span>
        </div>
      )}

      {/* Microsoft login button */}
      <button
        onClick={handleMicrosoftLogin}
        className="w-full flex items-center justify-center gap-2.5 bg-primary text-white font-bold py-2.5 px-3 rounded-xl shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98] transition-transform text-[11px]"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23">
          <path fill="#F35325" d="M0 0h11v11H0z" />
          <path fill="#803D90" d="M12 0h11v11H12z" />
          <path fill="#00A4EF" d="M0 12h11v11H0z" />
          <path fill="#FEBA08" d="M12 12h11v11H12z" />
        </svg>
        <span>Office 365 Account Login</span>
      </button>

      {/* Divider */}
      <div className="flex items-center my-4">
        <div className="flex-grow h-px bg-outline-variant/40"></div>
        <span className="text-[9px] text-on-surface-variant/50 font-bold uppercase px-2">or bypass</span>
        <div className="flex-grow h-px bg-outline-variant/40"></div>
      </div>

      {/* Credentials Bypass */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-3">
        <div>
          <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Email Address</label>
          <input
            type="email"
            required
            disabled={loading}
            placeholder="e.g. ahmed.ali@alhattab.qa"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-[11px] font-medium bg-surface placeholder-on-surface-variant/40"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Password</label>
          <input
            type="password"
            required
            disabled={loading}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-[11px] font-medium bg-surface placeholder-on-surface-variant/40"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#b89d7e] hover:bg-[#a5896a] text-white font-bold py-2.5 rounded-xl transition-colors active:scale-[0.98] transition-transform text-[11px] flex items-center justify-center"
        >
          {loading ? "Signing in..." : "Log In"}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-outline-variant/30 pt-3">
        <p className="text-[9px] text-on-surface-variant/40 font-semibold">Security Level: High (SSL & JWT)</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-col flex-grow min-h-[580px] bg-background justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-[380px] mx-auto bg-surface border border-outline-variant/35 rounded-2xl p-6 text-center text-[11px]">
          Loading employee portal...
        </div>
      }>
        <MobileLoginForm />
      </Suspense>
    </div>
  );
}
