"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LayoutShell } from "@/components/layout-shell";
import Link from "next/link";

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as any)?.role || "EMPLOYEE";

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState("");
  const [searchAction, setSearchAction] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audit/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Failed to load audit logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && userRole === "ADMIN") {
      fetchLogs();
    }
  }, [status, userRole]);

  if (status === "loading") {
    return (
      <LayoutShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary">sync</span>
            <p className="mt-2 text-xs font-bold text-on-surface-variant">Loading security audit records...</p>
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
              You do not have the required administrative clearance to view the security and user activity audits ledger.
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

  // Filter logs locally
  const filteredLogs = logs.filter(log => {
    const matchesUser = !searchUser || log.userId.toLowerCase().includes(searchUser.toLowerCase());
    const matchesAction = !searchAction || log.action.toLowerCase().includes(searchAction.toLowerCase()) || (log.entityType && log.entityType.toLowerCase().includes(searchAction.toLowerCase()));
    return matchesUser && matchesAction;
  });

  const renderDiffSideBySide = (beforeStr?: string, afterStr?: string) => {
    let beforeObj: any = null;
    let afterObj: any = null;

    try {
      if (beforeStr) beforeObj = JSON.parse(beforeStr);
    } catch (_) {}

    try {
      if (afterStr) afterObj = JSON.parse(afterStr);
    } catch (_) {}

    // Fallback if not objects
    if (!beforeObj && !afterObj) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono p-4 bg-surface-container-lowest border border-border-subtle rounded-lg">
          <div>
            <p className="text-[10px] font-bold text-outline-variant mb-1 uppercase">Before State</p>
            <pre className="p-3 bg-surface-container-low rounded border border-border-subtle text-primary overflow-x-auto whitespace-pre-wrap">{beforeStr || "NULL / NO RECORD"}</pre>
          </div>
          <div>
            <p className="text-[10px] font-bold text-outline-variant mb-1 uppercase">After State</p>
            <pre className="p-3 bg-surface-container-low rounded border border-border-subtle text-status-success overflow-x-auto whitespace-pre-wrap">{afterStr || "NULL / NO RECORD"}</pre>
          </div>
        </div>
      );
    }

    const formattedBefore = beforeObj ? JSON.stringify(beforeObj, null, 2) : "NULL";
    const formattedAfter = afterObj ? JSON.stringify(afterObj, null, 2) : "NULL";

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono p-4 bg-surface-container-lowest border border-border-subtle rounded-lg">
        <div>
          <p className="text-[10px] font-bold text-outline-variant mb-1 uppercase">Before State Changes</p>
          <pre className="p-3 bg-red-500/5 text-red-700 dark:text-red-300 rounded border border-red-500/20 overflow-x-auto whitespace-pre-wrap">{formattedBefore}</pre>
        </div>
        <div>
          <p className="text-[10px] font-bold text-outline-variant mb-1 uppercase">After State Changes</p>
          <pre className="p-3 bg-green-500/5 text-green-700 dark:text-green-300 rounded border border-green-500/20 overflow-x-auto whitespace-pre-wrap">{formattedAfter}</pre>
        </div>
      </div>
    );
  };

  return (
    <LayoutShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/reports" className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-3xl">history_toggle_off</span>
              System Audit Logs & State Diffing Console
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 ml-7">
            Chronological audit trailing of administrative updates, shifts allocations, overrides, and security events.
          </p>
        </div>
        
        <div>
          <button
            onClick={fetchLogs}
            className="bg-surface-container-high border border-border-subtle hover:bg-surface-container-highest text-primary font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">Search User ID</label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-outline-variant absolute left-3 top-2.5">person</span>
              <input
                type="text"
                placeholder="Search by Operative ID..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full bg-surface-container-low border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-xs text-primary font-semibold focus:outline-none placeholder-outline-variant"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">Search Action or Entity</label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-outline-variant absolute left-3 top-2.5">search</span>
              <input
                type="text"
                placeholder="Search by action (e.g. SHIFT_UPDATE, PAYROLL_LOCK)..."
                value={searchAction}
                onChange={(e) => setSearchAction(e.target.value)}
                className="w-full bg-surface-container-low border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-xs text-primary font-semibold focus:outline-none placeholder-outline-variant"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Audit Logs Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                  <th className="px-6 py-4 w-12"></th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Operative ID</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Entity Target</th>
                  <th className="px-6 py-4">Network Info</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                      No security audit records matched filter parameters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any) => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDiff = log.beforeJson || log.afterJson;
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => hasDiff && setExpandedLogId(isExpanded ? null : log.id)}
                          className={`border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary cursor-pointer ${isExpanded ? 'bg-surface-container-low/10' : ''}`}
                        >
                          <td className="px-6 py-4 text-center">
                            {hasDiff && (
                              <span className="material-symbols-outlined text-secondary transition-transform text-lg select-none">
                                {isExpanded ? "keyboard_arrow_down" : "keyboard_arrow_right"}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-on-surface-variant">
                            {new Date(log.createdAt || log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-bold">{log.userId}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-bold text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-on-surface-variant font-semibold">
                            {log.entityType ? `${log.entityType} (${log.entityId})` : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-[10px] text-outline-variant">
                            IP: {log.ipAddress || "Local"}
                            <span className="block max-w-[200px] truncate text-[9px]" title={log.userAgent}>
                              {log.userAgent || "Unknown Browser Agent"}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && hasDiff && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-surface-container-low/5 border-b border-border-subtle">
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-primary">State Comparison Data:</p>
                                {renderDiffSideBySide(log.beforeJson, log.afterJson)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
