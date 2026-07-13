"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function GuardTourPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isEntitled = data?.featureEntitlements?.canViewGuardTour === true;

  if (!isEntitled) {
    return (
      <div className="p-5 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-status-error/10 text-status-error flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[32px]">block</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-on-surface">Access Denied</h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            You do not have an active Guard Tour assignment for today or this post has no checkpoints configured.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary/95 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Guard Tour Patrol</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">Site: {data?.site?.name || "Unknown Site"}</p>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-status-success/10 text-status-success flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Guard Tour setup ready</h3>
            <p className="text-xs text-status-success font-semibold">Configured checkpoints found</p>
          </div>
        </div>

        <div className="border-t border-outline-variant/30 pt-4 grid grid-cols-2 gap-4 text-center">
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase">Checkpoints</span>
            <p className="text-xl font-black text-primary mt-1">5 Configured</p>
          </div>
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase">Status</span>
            <p className="text-xl font-black text-status-success mt-1">ACTIVE</p>
          </div>
        </div>
      </div>

      {/* Next Phase Notice Info Box */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 text-xs">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
        <div className="space-y-1">
          <p className="font-bold text-primary">Scan Engine Upcoming</p>
          <p className="text-on-surface-variant text-[11px]">
            QR/NFC scanning will be available in the next phase. Patrol routing details and checkpoint validations are being configured.
          </p>
        </div>
      </div>
    </div>
  );
}
