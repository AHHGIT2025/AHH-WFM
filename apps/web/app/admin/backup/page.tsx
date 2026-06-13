"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LayoutShell } from "@/components/layout-shell";

export default function AdminBackupPage() {
  const { data: session, status } = useSession();
  const [backups, setBackups] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupType, setBackupType] = useState("Full Database Backup");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch backups and audit logs
  const fetchData = async () => {
    try {
      const res = await fetch("/api/v1/admin/backups");
      if (res.ok) {
        const json = await res.json();
        setBackups(json.backups || []);
        setAuditLogs(json.auditLogs || []);
      }
    } catch (e) {
      console.error("Failed to load backup data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && (session.user as any).role === "ADMIN") {
      fetchData();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [session, status]);

  const handleCreateBackup = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupType })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setMessage({ type: "success", text: `Backup "${result.fileName}" successfully created.` });
        fetchData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to generate backup file." });
        fetchData();
      }
    } catch (e) {
      setMessage({ type: "error", text: "Network error occurred while creating backup." });
      fetchData();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (id: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete backup file: ${fileName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/backups/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Backup file "${fileName}" successfully deleted.` });
        fetchData();
      } else {
        setMessage({ type: "error", text: "Failed to delete backup file." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Network error occurred." });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  if (status === "loading" || loading) {
    return (
      <LayoutShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary">sync</span>
            <p className="mt-2 text-xs font-bold text-on-surface-variant">Loading Admin Console...</p>
          </div>
        </div>
      </LayoutShell>
    );
  }

  // Guard access
  if (!session || (session.user as any).role !== "ADMIN") {
    return (
      <LayoutShell>
        <div className="bg-status-error/10 border border-status-error/20 rounded-xl p-8 max-w-lg mx-auto text-center mt-12">
          <span className="material-symbols-outlined text-6xl text-status-error">block</span>
          <h1 className="text-2xl font-bold text-primary mt-4">Access Denied</h1>
          <p className="text-sm text-on-surface-variant mt-2">
            You do not have administrative permissions required to access the Backup & Restore Console.
          </p>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-3xl">settings_backup_restore</span>
          Admin Backup & Restore Console
        </h1>
        <p className="text-xs text-on-surface-variant mt-1">
          Perform administrative backups, track job statuses, download archives, and view history audits.
        </p>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-xl border flex items-center gap-3 ${
          message.type === "success" 
            ? "bg-status-success/10 border-status-success/20 text-status-success"
            : "bg-status-error/10 border-status-error/20 text-status-error"
        }`}>
          <span className="material-symbols-outlined">
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="text-xs font-bold">{message.text}</span>
        </div>
      )}

      {/* Overview Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Status Card */}
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Backup Status</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-outline-variant font-medium">Backup Storage</span>
              <span className="font-bold text-primary">storage/backups/ (Secure)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-outline-variant font-medium">Total Archives</span>
              <span className="font-bold text-primary">{backups.filter(b => b.status === "COMPLETED").length}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-outline-variant font-medium">Last Successful Backup</span>
              <span className="font-bold text-primary">
                {backups.find(b => b.status === "COMPLETED")?.fileName?.substring(22, 35) 
                  ? new Date(Number(backups.find(b => b.status === "COMPLETED")?.fileName?.substring(22, 35).split(".")[0])).toLocaleString()
                  : "Never"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Create System Backup</p>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">Backup Type</label>
                <select 
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value)}
                  className="w-full bg-surface-container-low border border-border-subtle rounded-lg px-3 py-2 text-xs font-bold text-primary focus:outline-none focus:border-secondary"
                >
                  <option value="Full Database Backup">Full Database Backup</option>
                  <option value="Employee & HR Data Backup">Employee & HR Data Backup</option>
                  <option value="Attendance & Leave Backup">Attendance & Leave Backup</option>
                  <option value="SAP Integration Config Backup">SAP Integration Config Backup</option>
                  <option value="System Configuration Backup">System Configuration Backup</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <button
                  onClick={handleCreateBackup}
                  disabled={creating}
                  className="bg-secondary text-white hover:bg-secondary/90 disabled:bg-secondary/50 rounded-lg px-6 py-2 h-9 text-xs font-bold transition-all shadow flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">backup</span>
                      Run Backup Job
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-border-subtle/50 pt-3 text-[10px] text-outline-variant font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-secondary">info</span>
            <span>Backups generate local JSON archives with calculated SHA-256 integrity checksums. Secrets and raw credentials are automatically stripped.</span>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Backup Archives History</p>
          <span className="text-[10px] text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full">Retention: 30 Days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                <th className="px-6 py-3">File Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Created At</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Checksum</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                    No backup archives found in history.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary">
                    <td className="px-6 py-4 font-bold max-w-xs truncate" title={b.fileName}>
                      {b.fileName}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant font-semibold">
                      {b.backupType}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant font-semibold">
                      {formatSize(b.fileSize)}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant max-w-[120px] truncate" title={b.checksum}>
                      {b.checksum || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        b.status === "COMPLETED" ? "bg-status-success/15 text-status-success" :
                        b.status === "PROCESSING" ? "bg-status-warning/15 text-status-warning" :
                        "bg-status-error/15 text-status-error"
                      }`}>
                        {b.status}
                      </span>
                      {b.errorMessage && (
                        <p className="text-[9px] text-status-error mt-1 max-w-[150px] truncate" title={b.errorMessage}>
                          {b.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {b.status === "COMPLETED" && (
                        <a
                          href={`/api/v1/admin/backups/${b.id}/download`}
                          className="inline-flex items-center justify-center p-1.5 bg-surface-container-low hover:bg-secondary/10 text-secondary rounded transition-all"
                          title="Download Backup"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteBackup(b.id, b.fileName)}
                        className="p-1.5 bg-surface-container-low hover:bg-status-error/10 text-status-error rounded transition-all"
                        title="Delete Backup"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backup Audit Log Preview */}
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-border-subtle">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Backup & Restore Activity Audit Trail</p>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-outline-variant font-bold text-center py-6">No backup activity logs registered.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="text-xs border-b border-border-subtle/30 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                      log.action === "BACKUP_CREATED" ? "bg-status-success/15 text-status-success" :
                      log.action === "BACKUP_DOWNLOADED" ? "bg-secondary/15 text-secondary" :
                      log.action === "BACKUP_DELETED" ? "bg-status-error/15 text-status-error" :
                      "bg-surface-container-low text-on-surface-variant"
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-[10px] text-outline-variant font-medium">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-primary font-medium">{log.details}</p>
                  <p className="text-[9px] text-outline-variant font-medium mt-0.5">
                    Performed By ID: {log.performedById} {log.ipAddress && `| IP: ${log.ipAddress}`}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Restore Section Coming Soon */}
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-secondary text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg">
            ROADMAP
          </div>
          <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">restore</span>
          <h3 className="text-sm font-bold text-primary">System Restore Engine</h3>
          <p className="text-[11px] text-on-surface-variant mt-2 max-w-[200px]">
            Restoring databases from JSON archive packages is locked and currently under safety review.
          </p>
          <span className="mt-4 px-3 py-1 rounded-full bg-surface-container-low text-[10px] text-secondary font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>
      </div>
    </LayoutShell>
  );
}
