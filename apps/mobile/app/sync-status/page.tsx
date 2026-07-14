"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function SyncStatusPage() {
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

  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPER_ADMIN";
  const hasActiveAssignment = data?.dutySource !== "NONE" && data?.dutySource !== "EMPLOYEE_DEFAULT_LOCATION";

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Offline Sync Status</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            {isAdmin ? "Admin Preview Mode" : "Network Queue"}
          </p>
        </div>
      </div>

      {/* Access Control */}
      {!hasActiveAssignment && !isAdmin ? (
        <div className="bg-surface border border-outline-variant/30 p-6 rounded-2xl text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">block</span>
          <p className="text-sm font-bold text-on-surface">Access restricted</p>
          <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
            You do not have a scheduled operation task requiring sync queues today.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase">Database Queue</span>
              <p className="text-sm font-extrabold text-on-surface mt-0.5">All local logs in sync</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-status-success/10 text-status-success">
              ONLINE
            </span>
          </div>

          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 space-y-3 text-center py-6">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-1">cloud_done</span>
            <p className="text-xs font-bold text-on-surface">No Pending Transactions</p>
            <p className="text-[10px] text-on-surface-variant max-w-xs mx-auto">
              All checkpoint scans and checkin attendances have been uploaded successfully.
            </p>
          </div>
        </div>
      )}

      {/* Next Phase Notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 text-xs">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
        <div>
          <p className="font-bold text-primary">Coming in next phase</p>
          <p className="text-on-surface-variant text-[11px] mt-0.5">
            IndexedDB local offline storage queue, automated background sync retries, and network status updates activate in Phase 1B.
          </p>
        </div>
      </div>
    </div>
  );
}
