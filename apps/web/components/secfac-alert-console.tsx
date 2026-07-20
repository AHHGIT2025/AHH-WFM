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
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [escalatedOnly, setEscalatedOnly] = useState<boolean>(false);
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [adminQueueOnly, setAdminQueueOnly] = useState<boolean>(false);
  const [slaBreachedOnly, setSlaBreachedOnly] = useState<boolean>(false);
  const [ackOverdueOnly, setAckOverdueOnly] = useState<boolean>(false);
  const [resOverdueOnly, setResOverdueOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"all" | "daily-review">("all");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail drawer & action modal states
  const [selectedAlert, setSelectedAlert] = useState<SecFacOperationalAlert | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: "RESOLVE" | "DISMISS" | "CANCEL" | "ACKNOWLEDGE" | "START_ACTION" | "ESCALATE" | "REASSIGN" | null;
    alert: SecFacOperationalAlert | null;
  }>({ type: null, alert: null });
  const [actionInput, setActionInput] = useState<string>("");
  const [targetUserIdInput, setTargetUserIdInput] = useState<string>("");
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

      if (viewMode === "daily-review") {
        query.append("status", "OPEN");
        query.append("status", "ACKNOWLEDGED");
        query.append("status", "IN_PROGRESS");
      } else {
        if (statusFilter) query.append("status", statusFilter);
      }

      if (severityFilter) query.append("severity", severityFilter);
      if (searchQuery) query.append("search", searchQuery);
      if (escalatedOnly) query.append("escalatedOnly", "true");
      if (unassignedOnly) query.append("unassignedOnly", "true");
      if (adminQueueOnly) query.append("assignmentSource", "ADMIN_QUEUE");
      if (slaBreachedOnly) query.append("slaBreachedOnly", "true");
      if (ackOverdueOnly) query.append("acknowledgementOverdue", "true");
      if (resOverdueOnly) query.append("resolutionOverdue", "true");

      const [resAlerts, resHealth] = await Promise.all([
        fetch(`/api/v1/secfac/alerts?${query.toString()}`),
        fetch(`/api/v1/secfac/alerts/health?operationType=${operationType}`)
      ]);

      if (!resAlerts.ok) {
        const errData = await resAlerts.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load alerts");
      }

      const dataAlerts = await resAlerts.json();
      setAlerts(dataAlerts.alerts || []);
      setTotalPages(dataAlerts.pagination?.totalPages || 1);

      if (resHealth.ok) {
        const dataHealth = await resHealth.json();
        setHealth(dataHealth);
      }
    } catch (e: any) {
      console.error("Alert console fetch error:", e);
      setError(e?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [
    operationType, page, statusFilter, severityFilter, searchQuery,
    escalatedOnly, unassignedOnly, adminQueueOnly, slaBreachedOnly,
    ackOverdueOnly, resOverdueOnly, viewMode
  ]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleExportCsv = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromStr = thirtyDaysAgo.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];
    window.open(`/api/v1/secfac/alerts/export?operationType=${operationType}&fromDate=${fromStr}&toDate=${toStr}`, "_blank");
  };

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
      } else if (actionModal.type === "REASSIGN") {
        endpoint += "reassign";
        body = { targetUserId: targetUserIdInput, note: actionInput };
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
      setTargetUserIdInput("");
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
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 animate-pulse">CRITICAL</span>;
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-surface-container-low border border-outline-variant rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                viewMode === "all" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-primary"
              }`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setViewMode("daily-review")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "daily-review" ? "bg-surface text-primary shadow-xs" : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">supervisor_account</span>
              Daily Review
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 text-xs font-bold border border-outline-variant hover:bg-surface-container-low rounded-lg transition-colors flex items-center gap-1"
            title="Export 30-Day CSV Report"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            CSV Export
          </button>

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
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Open</p>
          <p className="text-xl font-extrabold text-status-error mt-1">{health?.open ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Unassigned</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1">{health?.unassigned ?? 0}</p>
        </div>
        <div
          onClick={() => { setAdminQueueOnly(!adminQueueOnly); setPage(1); }}
          className={`bg-surface border rounded-xl p-3 shadow-xs cursor-pointer transition-colors ${
            adminQueueOnly ? "border-purple-600 ring-2 ring-purple-400" : "border-outline-variant hover:border-purple-300"
          }`}
        >
          <p className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">admin_panel_settings</span>
            Admin Queue
          </p>
          <p className="text-xl font-extrabold text-purple-800 dark:text-purple-300 mt-1">{health?.adminQueue ?? 0}</p>
        </div>
        <div
          onClick={() => { setAckOverdueOnly(!ackOverdueOnly); setPage(1); }}
          className={`bg-surface border rounded-xl p-3 shadow-xs cursor-pointer transition-colors ${
            ackOverdueOnly ? "border-red-600 ring-2 ring-red-400" : "border-outline-variant hover:border-red-300"
          }`}
        >
          <p className="text-[10px] uppercase font-bold text-red-700 tracking-wider">Ack Overdue</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{health?.acknowledgementOverdue ?? 0}</p>
        </div>
        <div
          onClick={() => { setResOverdueOnly(!resOverdueOnly); setPage(1); }}
          className={`bg-surface border rounded-xl p-3 shadow-xs cursor-pointer transition-colors ${
            resOverdueOnly ? "border-red-600 ring-2 ring-red-400" : "border-outline-variant hover:border-red-300"
          }`}
        >
          <p className="text-[10px] uppercase font-bold text-red-700 tracking-wider">Res Overdue</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{health?.resolutionOverdue ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Escalated</p>
          <p className="text-xl font-extrabold text-purple-600 mt-1">{health?.escalated ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Critical</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{health?.criticalOpen ?? 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Active Rules</p>
          <p className="text-xl font-extrabold text-green-600 mt-1">{health?.rulesActive ?? 0}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Search title, code, reference..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs border border-outline-variant rounded-lg bg-surface-container-lowest focus:outline-none focus:border-primary"
          />
          {viewMode !== "daily-review" && (
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
          )}
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
              checked={adminQueueOnly}
              onChange={(e) => { setAdminQueueOnly(e.target.checked); setPage(1); }}
              className="rounded text-purple-600"
            />
            Admin Queue
          </label>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={slaBreachedOnly}
              onChange={(e) => { setSlaBreachedOnly(e.target.checked); setPage(1); }}
              className="rounded text-red-600"
            />
            SLA Breached
          </label>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={escalatedOnly}
              onChange={(e) => { setEscalatedOnly(e.target.checked); setPage(1); }}
              className="rounded text-primary"
            />
            Escalated Only
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
                <th className="py-3 px-4">SLA Status</th>
                <th className="py-3 px-4">Status</th>
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
                alerts.map((a: any) => (
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
                      {a.assignmentSource === "ADMIN_QUEUE" ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1 w-fit">
                          <span className="material-symbols-outlined text-[12px]">admin_panel_settings</span>
                          Admin Queue
                        </span>
                      ) : (
                        <span className="font-medium text-on-surface">
                          {a.assignedUserId ? `User: ${a.assignedUserId.slice(0, 8)}...` : a.assignedRole ? `${a.assignedRole} Queue` : "Unassigned"}
                        </span>
                      )}
                      {a.assignmentSource && (
                        <div className="text-[10px] text-on-surface-variant opacity-75">{a.assignmentSource}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {a.slaStatus ? (
                        <div className="space-y-0.5 text-[10px]">
                          {a.slaStatus.acknowledgementOverdue && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 font-bold rounded block w-fit">Ack Overdue</span>
                          )}
                          {a.slaStatus.resolutionOverdue && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 font-bold rounded block w-fit">Res Overdue</span>
                          )}
                          {!a.slaStatus.acknowledgementOverdue && !a.slaStatus.resolutionOverdue && (
                            <span className="text-green-700 font-medium">On Track</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-on-surface-variant text-[10px]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(a.status)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                      <button
                        onClick={() => setSelectedAlert(a)}
                        className="px-2.5 py-1 text-[11px] font-bold border border-outline-variant hover:bg-surface-container-low rounded transition-colors"
                      >
                        Details
                      </button>

                      {a.assignmentSource === "ADMIN_QUEUE" && (
                        <button
                          onClick={() => setActionModal({ type: "REASSIGN", alert: a })}
                          className="px-2 py-1 text-[11px] font-bold bg-purple-700 text-white rounded hover:opacity-90"
                        >
                          Assign User
                        </button>
                      )}

                      {a.status === "OPEN" && (
                        <button
                          onClick={() => setActionModal({ type: "ACKNOWLEDGE", alert: a })}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white hover:opacity-90 rounded transition-opacity"
                        >
                          Ack
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
                  <p className="text-[10px] text-on-surface-variant font-bold">Assignment Source</p>
                  <p className="font-medium text-purple-700 font-bold">{selectedAlert.assignmentSource || "Default"}</p>
                </div>
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
              {actionModal.type === "REASSIGN" && "Reassign Admin Queue Alert"}
            </h3>
            <p className="text-xs text-on-surface-variant">
              Alert: <span className="font-bold">{actionModal.alert.title}</span>
            </p>

            {actionModal.type === "REASSIGN" && (
              <div>
                <label className="text-xs font-bold text-on-surface-variant">Target User ID</label>
                <input
                  type="text"
                  placeholder="Enter User ID..."
                  value={targetUserIdInput}
                  onChange={(e) => setTargetUserIdInput(e.target.value)}
                  className="w-full mt-1 text-xs p-2 border border-outline-variant rounded bg-surface-container-lowest"
                />
              </div>
            )}

            <textarea
              rows={3}
              placeholder="Enter action note / reason..."
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              className="w-full text-xs p-3 border border-outline-variant rounded-lg focus:outline-none focus:border-primary"
            />

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
