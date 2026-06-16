"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function MobileChangePasswordPage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      if (res.ok) {
        setSuccess(true);
        // Force session update so mustChangePassword becomes false
        await update({ mustChangePassword: false });
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to change password.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[380px] mx-auto bg-surface border border-outline-variant/35 rounded-2xl p-6 shadow-md mt-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2 text-primary">
          <span className="material-symbols-outlined text-[26px]">lock_reset</span>
        </div>
        <h2 className="text-base font-bold text-primary">Change Your Password</h2>
        <p className="text-[10px] text-on-surface-variant leading-tight mt-0.5">
          Your account requires a password update before you can continue.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded-xl flex gap-2 text-[10px] font-semibold text-status-error">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-status-success/10 border border-status-success/30 rounded-xl flex gap-2 text-[10px] font-semibold text-status-success">
          <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
          <span>Password changed successfully! Redirecting...</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
            Current Password
          </label>
          <input
            type="password"
            required
            disabled={loading || success}
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-[11px] font-medium bg-surface placeholder-on-surface-variant/40"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
            New Password
          </label>
          <input
            type="password"
            required
            disabled={loading || success}
            placeholder="Min. 8 chars, mixed case, symbols"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-[11px] font-medium bg-surface placeholder-on-surface-variant/40"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
            Confirm New Password
          </label>
          <input
            type="password"
            required
            disabled={loading || success}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-[11px] font-medium bg-surface placeholder-on-surface-variant/40"
          />
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-[#b89d7e] hover:bg-[#a5896a] text-white font-bold py-2.5 rounded-xl transition-colors active:scale-[0.98] transition-transform text-[11px] flex items-center justify-center"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
