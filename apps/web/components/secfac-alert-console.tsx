"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertCountSummary, OperationType, SecFacOperationalAlert } from "@ahh-wfm/types";

interface SecFacAlertConsoleProps {
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";
  title: string;
  subtitle: string;
  icon: string;
}

export const SecFacAlertConsole: React.FC<SecFacAlertConsoleProps> = ({
  operationType,
  title,
  subtitle,
  icon
}) => {
  const [alerts, setAlerts] = useState<SecFacOperationalAlert[]>([]);
  const [summary, setSummary] = useState<AlertCountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [escalatedOnly, setEscalatedOnly] = useState<boolean>(false);
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail drawer & action modal states
  const [selectedAlert, setSelectedAlert] = useState<SecFacOperationalAlert | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: "RESOLVE" | "DISMISS" | "CANCEL" | "ACKNOWLEDGE" | "START_ACTION" | "ESCALATE" | null;
    alert: SecFacOperationalAlert | null;
  }>({ type: null, alert: null });
  const [actionInput, setActionInput] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        operationType,
        page: page.toString(),
        pageSize: "15"
      });

      if (statusFilter) query.append("status", statusFilter);
      if (severityFilter) query.append("severity", severityFilter);
      if (searchQuery) query.append("search", searchQuery);
      if (escalatedOnly) query.append("escalatedOnly", "true");
      if (unassignedOnly) query.append("unassignedOnly", "true");

      const [resAlerts, resCount] = await Promise.all([
        fetch(`/api/v1/secfac/alerts?${query.toString()}`),
        fetch(`/api/v1/secfac/alerts/count?operationType=${operationType}`)
      ]);

      if (!resAlerts.ok) {
        const errData = await resAlerts.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load alerts");
      }

      const dataAlerts = await resAlerts.json();
      setAlerts(dataAlerts.alerts || []);
      setTotalPages(dataAlerts.pagination?.totalPages || 1);

      if (resCount.ok) {
        const dataCount = await resCount.json();
        setSummary(dataCount);
      }
    } catch (e: any) {
      console.error("Alert console fetch error:", e);
      setError(e?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [operationType, page, statusFilter, severityFilter, searchQuery, escalatedOnly, unassignedOnly]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleActionSubmit = async () => {
    if (!actionModal.type || !actionModal.alert) return;
    setActionSubmitting(true);
    try {
      const alertId = actionModal.alert.id;
      let endpoint = `/api/v1/secfac/alerts/${alertId}/`;
      let body: any = {};

      if (actionModal.type === "ACKNOWLEDGE") {
        endpoint += "acknowledge";
        body = { note: actionInput };
      } else if (actionModal.type === "START_ACTION") {
        endpoint += "start-action";
        body = { note: actionInput };
      } else if (actionModal.type === "RESOLVE") {
        endpoint += "resolve";
        body = { resolutionNote: actionInput };
      } else if (actionModal.type === "DISMISS") {
        endpoint += "dismiss";
        body = { dismissalReason: actionInput };
      } else if (actionModal.type === "CANCEL") {
        endpoint += "cancel";
        body = { cancellationReason: actionInput };
      } else if (actionModal.type === "ESCALATE") {
        endpoint += "escalate";
        body = { force: true, reason: actionInput };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Action failed");
      }

      setActionModal({ type: null, alert: null });
      setActionInput("");
      if (selectedAlert && selectedAlert.id === alertId) {
        const detailRes = await fetch(`/api/v1/secfac/alerts/${alertId}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setSelectedAlert(detailData.alert);
        }
      }
      fetchAlerts();
    } catch (e: any) {
      alert(`Action failed: ${e?.message || e}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300">CRITICAL</span>;
      case "HIGH":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">HIGH</span>;
      case "MEDIUM":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">MEDIUM</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-status-error/10 text-status-error border border-status-error/30">OPEN</span>;
      case "ACKNOWLEDGED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">ACKNOWLEDGED</span>;
      case "IN_PROGRESS":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-primary/10 text-primary border border-primary/30">IN PROGRESS</span>;
      case "RESOLVED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30">RESOLVED</span>;
      case "DISMISSED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/30">DISMISSED</span>;
      case "CANCELLED":
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
            {title}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAlerts()}
            className="px-3 py-2 text-xs font-bold border border-outline-variant hover:bg-surface-container-low rounded-lg transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
          <Link
            href="/settings/secfac-alert-rules"
            className="px-3 py-2 text-xs font-bold bg-primary text-white hover:opacity-90 rounded-lg shadow-sm transition-opacity flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Configure Rules
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Open</p>
          <p className="text-xl font-extrabold text-status-error mt-1">{summary?.open ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Acknowledged</p>
          <p className="text-xl font-extrabold text-amber-600 mt-1">{summary?.acknowledged ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">In Progress</p>
          <p className="text-xl font-extrabold text-primary mt-1">{summary?.inProgress ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Escalated</p>
          <p className="text-xl font-extrabold text-purple-600 mt-1">{summary?.escalated ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Critical</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{summary?.critical ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Resolved</p>
          <p className="text-xl font-extrabold text-green-600 mt-1">{summary?.resolved ?? 0}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search alerts or reference..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs border border-outline-variant rounded-lg bg-surface-container-lowest focus:outline-none focus:border-primary"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs border border-outline-variant rounded-lg bg-surface-container-lowest focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs border border-outline-variant rounded-lg bg-surface-container-lowest focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={escalatedOnly}
              onChange={(e) => { setEscalatedOnly(e.target.checked); setPage(1); }}
              className="rounded text-primary"
            />
            Escalated Only
          </label>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => { setUnassignedOnly(e.target.checked); setPage(1); }}
              className="rounded text-primary"
            />
            Unassigned Only
          </label>
        </div>
      </div>

      {/* Main Alerts Table */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-xs">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-xs font-medium border-b border-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Alert Code / Title</th>
                <th className="py-3 px-4">Detected</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Escalation</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined animate-spin text-2xl text-primary mb-1">sync</span>
                    <p>Loading operational alerts...</p>
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant font-medium">
                    No active alerts found matching criteria.
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getSeverityBadge(a.severity)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-primary">{a.title}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{a.alertCode} | Ref: {a.sourceId || "N/A"}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-on-surface-variant">
                      {new Date(a.firstDetectedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-on-surface">
                        {a.assignedUserId ? `User: ${a.assignedUserId.slice(0, 8)}...` : a.assignedRole ? `${a.assignedRole} Queue` : "Unassigned"}
                      </span>
                      {a.assignmentSource && (
                        <div className="text-[10px] text-on-surface-variant opacity-75">{a.assignmentSource}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(a.status)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold">
                      {a.escalationLevel > 0 ? (
                        <span className="text-purple-700 dark:text-purple-400 font-bold">L{a.escalationLevel}</span>
                      ) : (
                        <span className="text-on-surface-variant text-[11px]">L0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                      <button
                        onClick={() => setSelectedAlert(a)}
                        className="px-2.5 py-1 text-[11px] font-bold border border-outline-variant hover:bg-surface-container-low rounded transition-colors"
                      >
                        Details
                      </button>

                      {a.status === "OPEN" && (
                        <button
                          onClick={() => setActionModal({ type: "ACKNOWLEDGE", alert: a })}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white hover:opacity-90 rounded transition-opacity"
                        >
                          Ack
                        </button>
                      )}

                      {["OPEN", "ACKNOWLEDGED"].includes(a.status) && (
                        <button
                          onClick={() => setActionModal({ type: "START_ACTION", alert: a })}
                          className="px-2.5 py-1 text-[11px] font-bold bg-primary text-white hover:opacity-90 rounded transition-opacity"
                        >
                          Start
                        </button>
                      )}

                      {["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(a.status) && (
                        <button
                          onClick={() => setActionModal({ type: "RESOLVE", alert: a })}
                          className="px-2.5 py-1 text-[11px] font-bold bg-green-600 text-white hover:opacity-90 rounded transition-opacity"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 bg-surface-container-low border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 border border-outline-variant rounded bg-surface disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border border-outline-variant rounded bg-surface disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Alert Detail Drawer */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-surface h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex justify-between items-start border-b border-outline-variant pb-4">
              <div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(selectedAlert.severity)}
                  {getStatusBadge(selectedAlert.status)}
                </div>
                <h2 className="text-lg font-bold text-primary mt-2">{selectedAlert.title}</h2>
                <p className="text-xs text-on-surface-variant font-mono">{selectedAlert.alertCode} | Deduplication Key: {selectedAlert.deduplicationKey}</p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 rounded-full hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Alert Message</p>
                <p className="mt-1 text-on-surface bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">{selectedAlert.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-3 rounded-lg">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold">First Detected</p>
                  <p className="font-medium">{new Date(selectedAlert.firstDetectedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold">Last Detected</p>
                  <p className="font-medium">{new Date(selectedAlert.lastDetectedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold">Assigned User / Role</p>
                  <p className="font-medium">{selectedAlert.assignedUserId || selectedAlert.assignedRole || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold">Escalation Level</p>
                  <p className="font-medium">Level {selectedAlert.escalationLevel}</p>
                </div>
              </div>

              {selectedAlert.resolutionNote && (
                <div className="bg-green-50 text-green-800 p-3 rounded-lg border border-green-200">
                  <p className="font-bold text-[10px] uppercase">Resolution Note</p>
                  <p className="mt-0.5">{selectedAlert.resolutionNote}</p>
                </div>
              )}

              {selectedAlert.dismissalReason && (
                <div className="bg-gray-50 text-gray-800 p-3 rounded-lg border border-gray-200">
                  <p className="font-bold text-[10px] uppercase">Dismissal Reason</p>
                  <p className="mt-0.5">{selectedAlert.dismissalReason}</p>
                </div>
              )}

              {selectedAlert.cancellationReason && (
                <div className="bg-purple-50 text-purple-800 p-3 rounded-lg border border-purple-200">
                  <p className="font-bold text-[10px] uppercase">Cancellation Reason</p>
                  <p className="mt-0.5">{selectedAlert.cancellationReason}</p>
                </div>
              )}

              {/* Action Buttons inside Drawer */}
              <div className="border-t border-outline-variant pt-4 flex flex-wrap gap-2">
                {selectedAlert.status === "OPEN" && (
                  <button
                    onClick={() => setActionModal({ type: "ACKNOWLEDGE", alert: selectedAlert })}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded"
                  >
                    Acknowledge
                  </button>
                )}
                {["OPEN", "ACKNOWLEDGED"].includes(selectedAlert.status) && (
                  <button
                    onClick={() => setActionModal({ type: "START_ACTION", alert: selectedAlert })}
                    className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded"
                  >
                    Start Action
                  </button>
                )}
                {["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"].includes(selectedAlert.status) && (
                  <>
                    <button
                      onClick={() => setActionModal({ type: "RESOLVE", alert: selectedAlert })}
                      className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => setActionModal({ type: "DISMISS", alert: selectedAlert })}
                      className="px-3 py-1.5 text-xs font-bold bg-gray-600 text-white rounded"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => setActionModal({ type: "ESCALATE", alert: selectedAlert })}
                      className="px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded"
                    >
                      Escalate Now
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal.type && actionModal.alert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-outline-variant rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-primary">
              {actionModal.type === "RESOLVE" && "Resolve Alert"}
              {actionModal.type === "DISMISS" && "Dismiss Alert"}
              {actionModal.type === "CANCEL" && "Cancel Alert"}
              {actionModal.type === "ACKNOWLEDGE" && "Acknowledge Alert"}
              {actionModal.type === "START_ACTION" && "Start Action on Alert"}
              {actionModal.type === "ESCALATE" && "Escalate Alert"}
            </h3>
            <p className="text-xs text-on-surface-variant">
              Alert: <span className="font-bold">{actionModal.alert.title}</span>
            </p>

            {(actionModal.type === "RESOLVE" || actionModal.type === "DISMISS" || actionModal.type === "CANCEL" || actionModal.type === "ESCALATE") && (
              <textarea
                rows={3}
                placeholder={
                  actionModal.type === "RESOLVE" ? "Enter mandatory resolution note..." :
                  actionModal.type === "DISMISS" ? "Enter mandatory dismissal reason..." :
                  actionModal.type === "CANCEL" ? "Enter cancellation reason..." : "Enter escalation reason..."
                }
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                className="w-full text-xs p-3 border border-outline-variant rounded-lg focus:outline-none focus:border-primary"
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionSubmitting}
                onClick={() => setActionModal({ type: null, alert: null })}
                className="px-4 py-2 text-xs font-bold border border-outline-variant rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleActionSubmit}
                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {actionSubmitting ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
