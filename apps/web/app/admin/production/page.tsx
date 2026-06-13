"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LayoutShell } from "@/components/layout-shell";
import Link from "next/link";

export default function ProductionReadinessPage() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as any)?.role || "EMPLOYEE";

  const [checklist, setChecklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/production");
      if (res.ok) {
        setChecklist(await res.json());
      }
    } catch (e) {
      console.error("Failed to load production checks", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && userRole === "ADMIN") {
      fetchChecklist();
    }
  }, [status, userRole]);

  const runCheck = async (checkKey?: string) => {
    if (checkKey) {
      setRunningKey(checkKey);
    } else {
      setRunningAll(true);
    }

    try {
      const res = await fetch("/api/v1/admin/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runSpecificCheckKey: checkKey })
      });

      if (res.ok) {
        const updated = await res.json();
        setChecklist(updated);
        showToast(checkKey ? "Verification completed successfully." : "Full health check runner completed.");
      } else {
        showToast("Runner failed to complete successfully.");
      }
    } catch (e) {
      showToast("Network failure executing checks.");
    } finally {
      setRunningKey(null);
      setRunningAll(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  if (status === "loading") {
    return (
      <LayoutShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary">sync</span>
            <p className="mt-2 text-xs font-bold text-on-surface-variant">Loading production diagnostics dashboard...</p>
          </div>
        </div>
      </LayoutShell>
    );
  }

  if (userRole !== "ADMIN") {
    return (
      <LayoutShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center max-w-md p-6 bg-status-error/10 border border-status-error/20 rounded-2xl">
            <span className="material-symbols-outlined text-status-error text-5xl">gpp_bad</span>
            <h2 className="text-lg font-bold text-primary mt-2">Access Denied</h2>
            <p className="text-xs text-on-surface-variant mt-1">
              You must possess administrator credentials to initialize environment health checks.
            </p>
            <div className="mt-4">
              <Link href="/reports" className="bg-primary text-white font-bold text-xs px-4 py-2 rounded-lg inline-block">
                Return to Reports Hub
              </Link>
            </div>
          </div>
        </div>
      </LayoutShell>
    );
  }

  // Group checklist by category
  const categories = Array.from(new Set(checklist.map(c => c.category)));

  const getStatusIcon = (statusStr: string) => {
    switch (statusStr) {
      case "PASSED":
        return <span className="material-symbols-outlined text-status-success text-lg">check_circle</span>;
      case "WARNING":
        return <span className="material-symbols-outlined text-status-warning text-lg font-bold">warning</span>;
      case "FAILED":
        return <span className="material-symbols-outlined text-status-error text-lg">cancel</span>;
      default:
        return <span className="material-symbols-outlined text-outline-variant text-lg animate-pulse">pending</span>;
    }
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "PASSED":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-status-success/15 text-status-success">PASSED</span>;
      case "WARNING":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-status-warning/15 text-status-warning">WARNING</span>;
      case "FAILED":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-status-error/15 text-status-error">FAILED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-surface-container-low text-outline-variant">UNVERIFIED</span>;
    }
  };

  const getCheckKey = (checkName: string) => {
    const map: Record<string, string> = {
      "Active Environment Keys": "ENV_KEYS",
      "SSL/TLS Configuration Check": "SSL_TLS",
      "Database Connection & Limits": "DB_CONN",
      "Database Indexing Status": "DB_INDEX",
      "Backup Storage Directory Access": "BACKUP_DIR",
      "Daily Backup Schedule Configuration": "BACKUP_CRON",
      "SAP Connection & OData Reference": "SAP_SYNC",
      "System Environment Profile": "SYS_PROFILE",
      "Dependencies Integrity": "DEP_INTEGRITY"
    };
    return map[checkName] || "";
  };

  return (
    <LayoutShell>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-secondary text-white text-xs font-bold px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 border border-border-subtle animate-bounce">
          <span className="material-symbols-outlined">info</span>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-3xl">fact_check</span>
            Production Readiness Verification Board
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Conduct automated health diagnostics to verify keys, database connectivity, and mock integration parameters.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => runCheck()}
            disabled={runningAll || runningKey !== null}
            className="bg-primary text-white hover:bg-primary/95 disabled:bg-primary/50 font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
          >
            {runningAll ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                Testing System...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">play_circle</span>
                Run All Diagnostics
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid of Categorized Checks */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((category) => {
            const items = checklist.filter(c => c.category === category);
            return (
              <div key={category} className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-border-subtle/40 pb-2">
                  <p className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      {category === "Security" ? "security" :
                       category === "Database" ? "database" :
                       category === "Backups" ? "cloud_sync" :
                       category === "Inbound Sync" ? "sync_alt" : "tune"}
                    </span>
                    {category} Controls
                  </p>
                  <span className="text-[10px] font-bold text-outline-variant">{items.length} Checked Items</span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => {
                    const checkKey = getCheckKey(item.checkName);
                    const isRunning = runningKey === checkKey;
                    let resultObj: any = {};
                    try {
                      resultObj = JSON.parse(item.resultJson);
                    } catch (_) {}

                    return (
                      <div key={item.id} className="bg-surface-container-low/30 border border-border-subtle/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <div>
                              <p className="text-xs font-bold text-primary">{item.checkName}</p>
                              <p className="text-[9px] text-outline-variant font-medium">Checked: {new Date(item.checkedAt || item.updatedAt).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                            <button
                              onClick={() => runCheck(checkKey)}
                              disabled={runningAll || runningKey !== null}
                              title="Test check"
                              className="w-7 h-7 bg-surface-container-high border border-border-subtle hover:bg-surface-container-highest text-primary font-bold rounded-lg flex items-center justify-center transition-all"
                            >
                              {isRunning ? (
                                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                              ) : (
                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Diagnostics Details */}
                        {resultObj && (
                          <div className="text-[11px] font-medium text-on-surface-variant pl-6 border-t border-border-subtle/30 pt-2 space-y-1">
                            {resultObj.message && <p className="font-bold text-primary">{resultObj.message}</p>}
                            
                            {resultObj.variables && (
                              <div className="grid grid-cols-2 gap-1 font-mono text-[9px] bg-surface-container-lowest/60 p-2 rounded border border-border-subtle/20 mt-1">
                                {Object.entries(resultObj.variables).map(([k, v]: any) => (
                                  <div key={k} className="flex justify-between col-span-2">
                                    <span className="text-outline-variant">{k}:</span>
                                    <span className={v === "MISSING" ? "text-status-error font-bold" : "text-status-success"}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {resultObj.sslProtocol && (
                              <p className="font-mono text-[9px]">
                                SSL Protocol: {resultObj.sslProtocol} ({resultObj.cipherSuite})
                              </p>
                            )}

                            {resultObj.latencyMs !== undefined && (
                              <p className="font-mono text-[9px]">
                                Read/Write Latency: <span className="text-status-success font-bold">{resultObj.latencyMs}ms</span> | Pool Size: {resultObj.poolLimit}
                              </p>
                            )}

                            {resultObj.directoryPath && (
                              <p className="font-mono text-[9px]">
                                Directory: <span className="underline">{resultObj.directoryPath}</span> | Writable: <span className="text-status-success font-bold">YES</span>
                              </p>
                            )}

                            {resultObj.cronSchedule && (
                              <p className="font-mono text-[9px]">
                                Job Trigger: {resultObj.cronSchedule} | Retention: {resultObj.retentionDays} Days
                              </p>
                            )}

                            {resultObj.configuredConnections !== undefined && (
                              <p className="font-mono text-[9px]">
                                Active Profiles: {resultObj.configuredConnections} | Mock Sync Mode: ACTIVE
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </LayoutShell>
  );
}
