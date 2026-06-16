"use client";

import React, { useState } from "react";
import { Card, Input, Button } from "@ahh-wfm/ui/src";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        // Force session update so mustChangePassword becomes false
        await update({ mustChangePassword: false });
        router.push("/dashboard");
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
    <div className="flex h-screen w-screen items-center justify-center bg-surface-container-lowest">
      <Card className="w-full max-w-md p-8 shadow-xl border border-border-subtle">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px] text-primary">lock_reset</span>
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Change Password Required</h1>
          <p className="text-sm text-on-surface-variant">
            Your account requires a password update before you can continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Current Password</label>
            <Input
              type="password"
              placeholder="Enter current password..."
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">New Password</label>
            <Input
              type="password"
              placeholder="Enter new password..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Confirm New Password</label>
            <Input
              type="password"
              placeholder="Confirm new password..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error font-bold flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <p>{error}</p>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full mt-4" disabled={loading}>
            {loading ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
