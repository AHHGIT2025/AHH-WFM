"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OperationType } from "@ahh-wfm/types";

export default function SecFacNotificationSettingsPage() {
  const [operationType, setOperationType] = useState<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT">("SECURITY_GUARDING");
  const [activeTab, setActiveTab] = useState<"channels" | "preferences" | "workerHealth" | "deadLetter">("channels");

  // Data states
  const [channels, setChannels] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [workerHealth, setWorkerHealth] = useState<any>(null);
  const [deadLetters, setDeadLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state for Channel Config
  const [configModal, setConfigModal] = useState<any>(null);
  const [configForm, setConfigForm] = useState({
    channel: "EMAIL",
    provider: "M365_SMTP",
    isEnabled: false,
    senderName: "WFM Alerts",
    senderAddress: "alerts@alhattab.com.qa",
    maximumAttempts: "3",
    baseRetryDelaySeconds: "60"
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = `operationType=${operationType}`;
      const [resChan, resPref, resWorker, resDL] = await Promise.all([
        fetch(`/api/v1/secfac/channel-configurations?${q}`),
        fetch(`/api/v1/secfac/notification-preferences?${q}`),
        fetch(`/api/v1/secfac/workers/health?${q}`),
        fetch(`/api/v1/secfac/notifications/dead-letter?${q}`)
      ]);

      if (resChan.ok) {
        const data = await resChan.json();
        setChannels(data.configurations || []);
      }
      if (resPref.ok) {
        const data = await resPref.json();
        setPreferences(data.preferences || []);
      }
      if (resWorker.ok) {
        const data = await resWorker.json();
        setWorkerHealth(data);
      }
      if (resDL.ok) {
        const data = await resDL.json();
        setDeadLetters(data.deadLetters || []);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  }, [operationType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/secfac/channel-configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType,
          channel: configForm.channel,
          provider: configForm.provider,
          isEnabled: configForm.isEnabled,
          senderName: configForm.senderName,
          senderAddress: configForm.senderAddress,
          maximumAttempts: parseInt(configForm.maximumAttempts, 10),
          baseRetryDelaySeconds: parseInt(configForm.baseRetryDelaySeconds, 10)
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }

      setConfigModal(null);
      fetchData();
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`);
    }
  };

  const handleManualRetry = async (notificationId: string) => {
    const reason = prompt("Enter reason for manual retry:");
    if (!reason) return;

    try {
      const res = await fetch(`/api/v1/secfac/notifications/${notificationId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Retry failed");
      }

      alert("Notification reset to PENDING for outbox worker retry.");
      fetchData();
    } catch (e: any) {
      alert(`Retry failed: ${e?.message || e}`);
    }
  };

  const channelList: Array<"IN_APP" | "EMAIL" | "PUSH" | "SMS" | "WHATSAPP"> = ["IN_APP", "EMAIL", "PUSH", "SMS", "WHATSAPP"];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">mark_email_unread</span>
            SECFAC Notification & Worker Settings
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure outbox channel providers, recipient preferences, quiet hours, background worker health, and dead-letter queues
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/settings/secfac-alert-rules"
            className="px-3 py-2 text-xs font-bold border border-outline-variant hover:bg-surface-container-low rounded-lg transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Alert Rules
          </Link>
          <button
            onClick={() => fetchData()}
            className="px-3 py-2 text-xs font-bold border border-outline-variant hover:bg-surface-container-low rounded-lg transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Scope Selector Tabs */}
      <div className="flex border-b border-outline-variant gap-6 text-sm font-bold">
        <button
          onClick={() => setOperationType("SECURITY_GUARDING")}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${
            operationType === "SECURITY_GUARDING"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          Security Guarding Scope
        </button>
        <button
          onClick={() => setOperationType("FACILITY_MANAGEMENT")}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${
            operationType === "FACILITY_MANAGEMENT"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">business</span>
          Facility Management Scope
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex bg-surface-container-low border border-outline-variant rounded-xl p-1 max-w-xl text-xs font-bold">
        <button
          onClick={() => setActiveTab("channels")}
          className={`flex-1 py-2 rounded-lg transition-colors text-center ${
            activeTab === "channels" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Channel Config
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex-1 py-2 rounded-lg transition-colors text-center ${
            activeTab === "preferences" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Preferences & Quiet Hours
        </button>
        <button
          onClick={() => setActiveTab("workerHealth")}
          className={`flex-1 py-2 rounded-lg transition-colors text-center ${
            activeTab === "workerHealth" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Worker Health
        </button>
        <button
          onClick={() => setActiveTab("deadLetter")}
          className={`flex-1 py-2 rounded-lg transition-colors text-center flex items-center justify-center gap-1 ${
            activeTab === "deadLetter" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Dead-Letter Queue
          {deadLetters.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-600 text-white">
              {deadLetters.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {/* Tab 1: Channel Configuration */}
      {activeTab === "channels" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            <p className="font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Controlled Channel Governance
            </p>
            <p className="mt-1 leading-relaxed">
              All external channels (Email, Push, WhatsApp, SMS) default to disabled. Enabling a channel here allows outbox workers to process queued notifications for {operationType}. Server feature flags override database settings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {channelList.map((ch) => {
              const cfg = channels.find(c => c.channel === ch);
              const isEnabled = cfg?.isEnabled || false;

              return (
                <div key={ch} className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-primary">{ch}</span>
                      {isEnabled ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-800 border border-green-300">ACTIVE</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600 border border-gray-300">DISABLED</span>
                      )}
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-2">
                      Provider: <span className="font-bold">{cfg?.provider || "Not Configured"}</span>
                    </p>
                    {cfg?.senderAddress && (
                      <p className="text-[10px] text-on-surface-variant font-mono mt-1 truncate">
                        Sender: {cfg.senderAddress}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setConfigForm({
                        channel: ch,
                        provider: cfg?.provider || (ch === "EMAIL" ? "M365_SMTP" : ch === "PUSH" ? "FCM_CAPACITOR" : ch === "WHATSAPP" ? "META_CLOUD_API" : "ENTERPRISE_SMS_GATEWAY"),
                        isEnabled,
                        senderName: cfg?.senderName || "WFM Alerts",
                        senderAddress: cfg?.senderAddress || "alerts@alhattab.com.qa",
                        maximumAttempts: String(cfg?.maximumAttempts || 3),
                        baseRetryDelaySeconds: String(cfg?.baseRetryDelaySeconds || 60)
                      });
                      setConfigModal(ch);
                    }}
                    className="w-full py-1.5 text-xs font-bold border border-outline-variant hover:bg-surface-container-low rounded-lg transition-colors"
                  >
                    Configure
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Preferences & Quiet Hours */}
      {activeTab === "preferences" && (
        <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-primary">Notification Preferences & Quiet Hours Rules</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Hierarchy: User + AlertCode &gt; User Default &gt; Role + AlertCode &gt; Role Default &gt; Operation Default</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <th className="py-3 px-4">Target User / Role</th>
                <th className="py-3 px-4">Alert Code</th>
                <th className="py-3 px-4">Enabled Channels</th>
                <th className="py-3 px-4">Quiet Hours (Qatar)</th>
                <th className="py-3 px-4">Min Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {preferences.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-on-surface-variant">
                    No custom preferences configured. Default operational rules apply (IN_APP enabled, Quiet Hours disabled).
                  </td>
                </tr>
              ) : (
                preferences.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-lowest">
                    <td className="py-3 px-4 font-bold text-primary">
                      {p.userId ? `User: ${p.userId.slice(0, 8)}...` : p.roleCode ? `Role: ${p.roleCode}` : "Operation Global Default"}
                    </td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">
                      {p.alertCode || "All Codes"}
                    </td>
                    <td className="py-3 px-4 space-x-1">
                      {p.inAppEnabled && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">IN_APP</span>}
                      {p.emailEnabled && <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-bold text-[10px]">EMAIL</span>}
                      {p.pushEnabled && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[10px]">PUSH</span>}
                      {p.smsEnabled && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">SMS</span>}
                      {p.whatsappEnabled && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">WA</span>}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant">
                      {p.quietHoursEnabled ? `${p.quietHoursStart || "22:00"} - ${p.quietHoursEnd || "06:00"}` : "Disabled"}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {p.minimumSeverity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Worker Health Dashboard */}
      {activeTab === "workerHealth" && workerHealth && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-outline-variant pb-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">memory</span>
                  Outbox Notification Worker
                </h3>
                {workerHealth.workers?.notificationWorker?.healthy ? (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-300">ONLINE</span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 border border-gray-300">OFFLINE / DISABLED</span>
                )}
              </div>
              <div className="text-xs space-y-1.5 text-on-surface-variant">
                <p>Environment Flag: <span className="font-bold font-mono">{String(workerHealth.workers?.notificationWorker?.enabled)}</span></p>
                <p>Last Heartbeat: <span className="font-bold">{workerHealth.workers?.notificationWorker?.lastJob?.heartbeatAt ? new Date(workerHealth.workers.notificationWorker.lastJob.heartbeatAt).toLocaleString() : "N/A"}</span></p>
                <p>Batch Processed Last Cycle: <span className="font-bold">{workerHealth.workers?.notificationWorker?.lastJob?.processedCount || 0}</span></p>
              </div>
            </div>

            <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-outline-variant pb-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">update</span>
                  Evaluation Scheduler Worker
                </h3>
                {workerHealth.workers?.evaluationWorker?.healthy ? (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-300">ONLINE</span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 border border-gray-300">OFFLINE / DISABLED</span>
                )}
              </div>
              <div className="text-xs space-y-1.5 text-on-surface-variant">
                <p>Environment Flag: <span className="font-bold font-mono">{String(workerHealth.workers?.evaluationWorker?.enabled)}</span></p>
                <p>Last Heartbeat: <span className="font-bold">{workerHealth.workers?.evaluationWorker?.lastJob?.heartbeatAt ? new Date(workerHealth.workers.evaluationWorker.lastJob.heartbeatAt).toLocaleString() : "N/A"}</span></p>
                <p>Alerts Evaluated Last Cycle: <span className="font-bold">{workerHealth.workers?.evaluationWorker?.lastJob?.processedCount || 0}</span></p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs">
            <h3 className="font-bold text-sm text-primary mb-3">Distributed Database Worker Locks</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                    <th className="py-2 px-3">Lock Key</th>
                    <th className="py-2 px-3">Owner Process</th>
                    <th className="py-2 px-3">Acquired At</th>
                    <th className="py-2 px-3">Expires At</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {workerHealth.locks?.activeLocks?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-on-surface-variant">No active worker locks in database.</td>
                    </tr>
                  ) : (
                    workerHealth.locks?.activeLocks?.map((l: any) => (
                      <tr key={l.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">{l.lockKey}</td>
                        <td className="py-2.5 px-3 font-mono">{l.ownerId}</td>
                        <td className="py-2.5 px-3 text-on-surface-variant">{new Date(l.acquiredAt).toLocaleTimeString()}</td>
                        <td className="py-2.5 px-3 text-on-surface-variant">{new Date(l.expiresAt).toLocaleTimeString()}</td>
                        <td className="py-2.5 px-3">
                          {new Date(l.expiresAt).getTime() <= Date.now() ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">EXPIRED (STALE)</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 font-bold rounded text-[10px]">HELD</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Dead-Letter Queue */}
      {activeTab === "deadLetter" && (
        <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-primary">Dead-Letter Notification Queue</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Notifications that failed after reaching maximum retry attempts</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Alert Title</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Failure Reason</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {deadLetters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-on-surface-variant">
                    No dead-letter notifications found. Queue is clean.
                  </td>
                </tr>
              ) : (
                deadLetters.map((dl) => (
                  <tr key={dl.id} className="hover:bg-surface-container-lowest">
                    <td className="py-3 px-4 font-bold text-primary">{dl.channel}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold">{dl.alert?.title || "Alert"}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{dl.alertId}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-red-600">{dl.attemptCount}</td>
                    <td className="py-3 px-4 text-on-surface-variant max-w-xs truncate">{dl.failureReason || "Max attempts exceeded"}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleManualRetry(dl.id)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-primary text-white hover:opacity-90 rounded transition-opacity"
                      >
                        Manual Retry
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Config Modal */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveChannel} className="bg-surface border border-outline-variant rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-primary">Configure {configModal} Channel ({operationType})</h3>

            <div>
              <label className="font-bold text-on-surface-variant">Provider Name</label>
              <input
                type="text"
                required
                value={configForm.provider}
                onChange={(e) => setConfigForm({ ...configForm, provider: e.target.value })}
                className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant">Sender Name</label>
                <input
                  type="text"
                  value={configForm.senderName}
                  onChange={(e) => setConfigForm({ ...configForm, senderName: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-bold text-on-surface-variant">Sender Address</label>
                <input
                  type="text"
                  value={configForm.senderAddress}
                  onChange={(e) => setConfigForm({ ...configForm, senderAddress: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant">Max Attempts</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={configForm.maximumAttempts}
                  onChange={(e) => setConfigForm({ ...configForm, maximumAttempts: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-bold text-on-surface-variant">Base Delay (s)</label>
                <input
                  type="number"
                  min="10"
                  value={configForm.baseRetryDelaySeconds}
                  onChange={(e) => setConfigForm({ ...configForm, baseRetryDelaySeconds: e.target.value })}
                  className="w-full mt-1 p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={configForm.isEnabled}
                onChange={(e) => setConfigForm({ ...configForm, isEnabled: e.target.checked })}
                className="rounded text-primary"
              />
              Enable Channel for {operationType}
            </label>

            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setConfigModal(null)}
                className="px-4 py-2 font-bold border border-outline-variant rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-bold bg-primary text-white rounded-lg hover:opacity-90"
              >
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
