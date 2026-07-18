"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getQueue,
  retryQueueItem,
  discardQueueItem,
  clearSyncedItems,
  processQueue,
  QueueItem
} from "../../lib/secfac-offline-queue";

export default function SyncStatusPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingInProgress, setSyncingInProgress] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const refreshQueue = () => {
    setQueue(getQueue());
  };

  useEffect(() => {
    refreshQueue();
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const handleSyncNow = async () => {
    if (!isOnline) {
      alert("Device is offline. Please connect to a network to sync.");
      return;
    }
    setSyncingInProgress(true);
    setStatusMessage("Syncing local queue with server...");
    try {
      await processQueue();
      setStatusMessage("Sync completed.");
    } catch (e: any) {
      setStatusMessage(`Sync failed: ${e.message}`);
    } finally {
      refreshQueue();
      setSyncingInProgress(false);
      setTimeout(() => setStatusMessage(""), 3000);
    }
  };

  const handleRetry = (id: string) => {
    retryQueueItem(id);
    refreshQueue();
  };

  const handleDiscard = (id: string) => {
    if (confirm("Are you sure you want to discard this item? It will not be synced to the server.")) {
      discardQueueItem(id);
      refreshQueue();
    }
  };

  const handleClearSynced = () => {
    clearSyncedItems();
    refreshQueue();
  };

  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPER_ADMIN";

  // Calculate totals
  const totalPending = queue.filter(x => x.status === "PENDING").length;
  const totalSyncing = queue.filter(x => x.status === "SYNCING").length;
  const totalSynced = queue.filter(x => x.status === "SYNCED").length;
  const totalFailed = queue.filter(x => x.status === "FAILED").length;

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-on-surface">Offline Sync Status</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            {isAdmin ? "Admin Preview Mode" : "Network Queue"}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider transition-all duration-300 ${
          isOnline ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"
        }`}>
          {isOnline ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      {/* Connection Mode Warning */}
      {!isOnline && (
        <div className="bg-amber-50 border border-amber-250 text-amber-900 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-sm">
          <span className="material-symbols-outlined text-amber-700 text-[20px]">wifi_off</span>
          <div>
            <p className="font-bold">Device Offline</p>
            <p className="text-[10px] text-amber-800 font-normal">Offline queue is locked. Connect to internet to Sync Now.</p>
          </div>
        </div>
      )}

      {/* Syncing Message Banner */}
      {statusMessage && (
        <div className="bg-[#002D72]/10 border border-[#002D72]/20 text-[#002D72] px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-pulse">
          <span className="material-symbols-outlined text-lg">sync_saved_locally</span>
          <p>{statusMessage}</p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-amber-50 border border-amber-200/50 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black text-amber-800 font-mono">{totalPending}</span>
          <span className="text-[8.5px] font-bold text-amber-700 uppercase tracking-wider mt-0.5">Pending</span>
        </div>
        <div className="bg-blue-50 border border-blue-200/50 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black text-blue-800 font-mono">{totalSyncing}</span>
          <span className="text-[8.5px] font-bold text-blue-700 uppercase tracking-wider mt-0.5">Syncing</span>
        </div>
        <div className="bg-green-50 border border-green-200/50 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black text-green-800 font-mono">{totalSynced}</span>
          <span className="text-[8.5px] font-bold text-green-700 uppercase tracking-wider mt-0.5">Synced</span>
        </div>
        <div className="bg-red-50 border border-red-200/50 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black text-red-800 font-mono">{totalFailed}</span>
          <span className="text-[8.5px] font-bold text-red-700 uppercase tracking-wider mt-0.5">Failed</span>
        </div>
      </div>

      {/* Global Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSyncNow}
          disabled={syncingInProgress || !isOnline || queue.length === 0}
          className="flex-1 bg-[#002D72] text-white hover:bg-[#001D48] disabled:opacity-50 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
        >
          {syncingInProgress ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <span className="material-symbols-outlined text-sm font-bold">sync</span>
          )}
          <span>Sync Now</span>
        </button>

        <button
          onClick={handleClearSynced}
          disabled={queue.filter(x => x.status === "SYNCED" || x.status === "DISCARDED").length === 0}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <span className="material-symbols-outlined text-sm font-bold">cleaning_services</span>
          <span>Clear Synced</span>
        </button>
      </div>

      {/* Queue Listing */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5 border-b border-outline-variant/20 pb-2">
          <span className="material-symbols-outlined text-[16px] text-primary">list_alt</span>
          Queue Items ({queue.length})
        </h3>

        {queue.length === 0 ? (
          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">cloud_done</span>
            <p className="text-xs font-bold text-on-surface">Queue is empty</p>
            <p className="text-[10px] text-on-surface-variant max-w-xs mx-auto">
              There are no pending, synced, or failed offline operations in local storage.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`bg-surface border rounded-2xl p-4 shadow-sm transition-all space-y-3 ${
                  item.status === "FAILED" ? "border-red-200" :
                  item.status === "SYNCED" ? "border-green-150" :
                  item.status === "SYNCING" ? "border-blue-200 animate-pulse" :
                  "border-outline-variant/40"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                      {item.actionType.replace(/_/g, " ")}
                    </span>
                    <p className="text-[10px] font-mono text-on-surface-variant mt-1.5 truncate max-w-[200px]">
                      {item.endpoint}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold font-mono tracking-wider uppercase ${
                    item.status === "SYNCED" ? "bg-green-100 text-green-800" :
                    item.status === "FAILED" ? "bg-red-100 text-red-800" :
                    item.status === "SYNCING" ? "bg-blue-100 text-blue-800 font-semibold" :
                    item.status === "DISCARDED" ? "bg-slate-100 text-slate-500" :
                    "bg-amber-100 text-amber-800 font-semibold"
                  }`}>
                    {item.status}
                  </span>
                </div>

                <div className="text-[9px] text-on-surface-variant space-y-1 bg-[#F9F9FF] p-2.5 rounded-xl border border-outline-variant/20 font-mono">
                  <div className="flex justify-between">
                    <span>Queue ID:</span>
                    <span>{item.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Key:</span>
                    <span>{item.idempotencyKey.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Attempts:</span>
                    <span>{item.attemptCount}</span>
                  </div>
                  {item.dependsOn && item.dependsOn.length > 0 && (
                    <div className="flex flex-col pt-1 border-t border-slate-100">
                      <span className="font-bold text-amber-800 flex items-center gap-0.5 mb-0.5">
                        <span className="material-symbols-outlined text-[10px]">link</span>
                        Depends On:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.dependsOn.map(depId => (
                          <span key={depId} className="bg-slate-200 text-slate-800 text-[7px] px-1 py-0.2 rounded font-bold font-mono">
                            {depId.slice(0, 8)}...
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {item.lastError && (
                  <div className="bg-red-50 border border-red-100 text-red-800 p-2.5 rounded-xl text-[9.5px] font-medium leading-tight">
                    <strong>Sync Error:</strong> {item.lastError}
                  </div>
                )}

                {/* Queue Item Actions */}
                {item.status !== "SYNCED" && item.status !== "DISCARDED" && (
                  <div className="flex justify-end gap-2 pt-1 border-t border-outline-variant/10">
                    {item.status === "FAILED" && (
                      <button
                        onClick={() => handleRetry(item.id)}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[9px] flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[11px] font-bold">replay</span>
                        <span>Retry</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDiscard(item.id)}
                      className="px-3 py-1 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100/50 rounded-lg font-bold text-[9px] flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[11px] font-bold">delete</span>
                      <span>Discard</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info notice box */}
      <div className="bg-[#002D72]/5 border border-[#002D72]/10 rounded-2xl p-4 flex gap-3 text-xs">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
        <div>
          <p className="font-bold text-primary">Idempotency & Replay Safety</p>
          <p className="text-on-surface-variant text-[11px] mt-0.5">
            Synchronizations are protected with unique idempotency keys. Retrying will update or verify records without duplicate creation.
          </p>
        </div>
      </div>
    </div>
  );
}
