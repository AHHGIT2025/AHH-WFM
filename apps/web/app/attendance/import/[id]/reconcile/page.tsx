"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Send,
  Eye,
  FileText,
  Filter,
  Check,
  RotateCcw
} from "lucide-react";

export default function AttendanceReconcilePage() {
  const params = useParams();
  const router = useRouter();
  const importBatchId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [filterResolved, setFilterResolved] = useState<string>("ALL");
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  // Decision Modal State
  const [decisionType, setDecisionType] = useState<string>("USE_IMPORTED_ATTENDANCE");
  const [reasonCode, setReasonCode] = useState<string>("CLIENT_TIMESHEET_VERIFIED");
  const [reasonNotes, setReasonNotes] = useState<string>("");
  const [resolvedStatus, setResolvedStatus] = useState<string>("PRESENT");
  const [resolvedHours, setResolvedHours] = useState<string>("8.0");
  const [resolvedOtHours, setResolvedOtHours] = useState<string>("0.0");
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to load reconciliation data.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load reconciliation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (importBatchId) {
      fetchData();
    }
  }, [importBatchId]);

  const handleStartReconciliation = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/start`, {
        method: "POST"
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to start reconciliation.");
      }
      await fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    try {
      setSubmittingDecision(true);
      const workedMins = Math.round(parseFloat(resolvedHours || "0") * 60);
      const otMins = Math.round(parseFloat(resolvedOtHours || "0") * 60);

      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedCandidate.id,
          decisionType,
          reasonCode,
          reasonNotes,
          resolvedStatus,
          resolvedWorkedMinutes: workedMins,
          resolvedOtMinutes: otMins
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to apply decision.");
      }

      setSelectedCandidate(null);
      await fetchData();
    } catch (err: any) {
      alert("Error applying decision: " + err.message);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!confirm("Submit this reconciliation batch for independent approval?")) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/submit`, {
        method: "POST"
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to submit for approval.");
      }
      alert("Reconciliation submitted successfully for approval!");
      await fetchData();
    } catch (err: any) {
      alert("Submission failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshEvidence = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/refresh`, {
        method: "POST"
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to refresh evidence.");
      }
      alert("Evidence refreshed successfully!");
      await fetchData();
    } catch (err: any) {
      alert("Refresh failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6 text-red-800 dark:text-red-200">
          <h2 className="text-lg font-bold mb-2">Reconciliation Error</h2>
          <p>{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { importBatch, reconciliationBatch, candidates = [] } = data || {};
  const isStarted = !!reconciliationBatch;
  const isPendingApproval = reconciliationBatch?.status === "PENDING_APPROVAL";
  const isApproved = reconciliationBatch?.status === "APPROVED";

  const filteredCandidates = candidates.filter((c: any) => {
    if (filterClass !== "ALL" && c.matchClassification !== filterClass) return false;
    if (filterResolved === "RESOLVED" && !c.isResolved) return false;
    if (filterResolved === "UNRESOLVED" && c.isResolved) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/attendance/import/${importBatchId}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Import Details
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Attendance Reconciliation Workspace</h1>
            <span className="text-xs px-2.5 py-1 rounded font-semibold bg-primary/10 text-primary border border-primary/20">
              {importBatch?.operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
            </span>
            {isStarted && (
              <span className="text-xs px-2.5 py-1 rounded font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {reconciliationBatch.status} (v{reconciliationBatch.reconciliationVersion})
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Batch #{importBatch?.batchNumber} • Source File: {importBatch?.originalFileName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isStarted && (
            <>
              <button
                onClick={handleRefreshEvidence}
                disabled={actionLoading || isPendingApproval || isApproved}
                className="px-3 py-2 border border-input rounded-md hover:bg-accent text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Refresh Evidence
              </button>
              <Link
                href={`/attendance/import/${importBatchId}/approval`}
                className="px-3 py-2 border border-primary/30 text-primary rounded-md hover:bg-primary/5 text-sm font-medium flex items-center gap-1.5"
              >
                <Eye className="h-4 w-4" /> Approver View
              </Link>
              <button
                onClick={handleSubmitForApproval}
                disabled={actionLoading || isPendingApproval || isApproved}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                <Send className="h-4 w-4" /> Submit for Approval
              </button>
            </>
          )}
        </div>
      </div>

      {!isStarted ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <Layers className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Start Attendance Reconciliation</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Evaluating raw staging records against authoritative mobile punches, published shift roster assignments, and approved leave records.
          </p>
          <button
            onClick={handleStartReconciliation}
            disabled={actionLoading}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-sm inline-flex items-center gap-2 shadow"
          >
            <Layers className="h-4 w-4" /> Initialize Reconciliation Engine
          </button>
        </div>
      ) : (
        <>
          {/* KPI Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
              <span className="text-xs text-muted-foreground font-medium">Total Candidates</span>
              <p className="text-xl font-bold mt-1">{reconciliationBatch.totalCandidates}</p>
            </div>
            <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 rounded-lg p-3 shadow-sm">
              <span className="text-xs text-green-700 dark:text-green-300 font-medium">Matched</span>
              <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">{reconciliationBatch.matchedCandidates}</p>
            </div>
            <div className="bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/40 rounded-lg p-3 shadow-sm">
              <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Warnings</span>
              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">{reconciliationBatch.warningCandidates}</p>
            </div>
            <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-lg p-3 shadow-sm">
              <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">Conflicts</span>
              <p className="text-xl font-bold text-orange-700 dark:text-orange-300 mt-1">{reconciliationBatch.conflictCandidates}</p>
            </div>
            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3 shadow-sm">
              <span className="text-xs text-red-700 dark:text-red-300 font-medium">Blocking</span>
              <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">{reconciliationBatch.blockingCandidates}</p>
            </div>
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-lg p-3 shadow-sm">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Resolved</span>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{reconciliationBatch.resolvedCandidates}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Classification:</span>
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="text-xs border border-input rounded px-2.5 py-1 bg-background"
                >
                  <option value="ALL">All Classifications</option>
                  <option value="MATCHED">Matched</option>
                  <option value="WARNING">Warning</option>
                  <option value="CONFLICT">Conflict</option>
                  <option value="BLOCKING">Blocking</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Status:</span>
                <select
                  value={filterResolved}
                  onChange={e => setFilterResolved(e.target.value)}
                  className="text-xs border border-input rounded px-2.5 py-1 bg-background"
                >
                  <option value="ALL">All Items</option>
                  <option value="UNRESOLVED">Unresolved Only</option>
                  <option value="RESOLVED">Resolved Only</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing {filteredCandidates.length} of {candidates.length} candidate rows
            </div>
          </div>

          {/* Candidates Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-3 font-semibold">Duty Date</th>
                    <th className="p-3 font-semibold">Employee</th>
                    <th className="p-3 font-semibold">Site / Roster</th>
                    <th className="p-3 font-semibold">Import Evidence</th>
                    <th className="p-3 font-semibold">System Evidence</th>
                    <th className="p-3 font-semibold">Classification</th>
                    <th className="p-3 font-semibold">Resolution</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No candidates match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((c: any) => {
                      const dec = c.currentDecision;
                      const workedHrs = dec ? (dec.resolvedWorkedMinutes / 60).toFixed(1) : "—";
                      const otHrs = dec ? (dec.resolvedOtMinutes / 60).toFixed(1) : "—";

                      return (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="p-3 font-medium">
                            {c.dutyDate ? new Date(c.dutyDate).toISOString().slice(0, 10) : "Unresolved"}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{c.employee?.name || (c.importedEvidence as any)?.rawEmployeeName || "Unknown"}</div>
                            <div className="text-[11px] text-muted-foreground">{c.employee?.id || (c.importedEvidence as any)?.rawEmployeeCode}</div>
                          </td>
                          <td className="p-3">
                            <div>{c.site?.name || (c.importedEvidence as any)?.rawSite || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">Shift: {c.shiftCode || "—"}</div>
                          </td>
                          <td className="p-3">
                            <div>Status: {(c.importedEvidence as any)?.status || "PRESENT"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              Worked: {(c.importedEvidence as any)?.workedHours || 0}h • OT: {(c.importedEvidence as any)?.otHours || 0}h
                            </div>
                          </td>
                          <td className="p-3">
                            <div>Origin: {c.evidenceOrigin}</div>
                            <div className="text-[11px] text-muted-foreground">Subtype: {c.evidenceSubtype || "UNCONFIRMED"}</div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                c.matchClassification === "MATCHED"
                                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                  : c.matchClassification === "WARNING"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                                  : c.matchClassification === "CONFLICT"
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              }`}
                            >
                              {c.matchClassification}
                            </span>
                          </td>
                          <td className="p-3">
                            {c.isResolved ? (
                              <div className="text-green-700 dark:text-green-400 font-medium flex items-center gap-1">
                                <Check className="h-3 w-3" /> {dec?.decisionType} ({workedHrs}h / {otHrs}h OT)
                              </div>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 font-medium">Unresolved</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedCandidate(c);
                                if (dec) {
                                  setDecisionType(dec.decisionType);
                                  setReasonCode(dec.reasonCode || "CLIENT_TIMESHEET_VERIFIED");
                                  setReasonNotes(dec.reasonNotes || "");
                                  setResolvedStatus(dec.resolvedStatus || "PRESENT");
                                  setResolvedHours(((dec.resolvedWorkedMinutes || 480) / 60).toString());
                                  setResolvedOtHours(((dec.resolvedOtMinutes || 0) / 60).toString());
                                }
                              }}
                              className="px-2.5 py-1 border border-input hover:bg-accent rounded text-[11px] font-medium"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Decision Resolution Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold">Resolve Candidate Decision</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Candidate Key: {selectedCandidate.operationalCandidateKey}
                </p>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyDecision} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Decision Type *</label>
                  <select
                    value={decisionType}
                    onChange={e => setDecisionType(e.target.value)}
                    className="w-full border border-input rounded p-2 bg-background text-xs"
                    required
                  >
                    <option value="MATCHED_NO_ACTION">MATCHED_NO_ACTION</option>
                    <option value="USE_IMPORTED_ATTENDANCE">USE_IMPORTED_ATTENDANCE</option>
                    <option value="KEEP_EXISTING_ATTENDANCE">KEEP_EXISTING_ATTENDANCE</option>
                    <option value="USE_APPROVED_LEAVE">USE_APPROVED_LEAVE</option>
                    <option value="ADJUST_PROPOSED_HOURS">ADJUST_PROPOSED_HOURS</option>
                    <option value="RESOLVE_STATUS">RESOLVE_STATUS</option>
                    <option value="EXCLUDE_ROW">EXCLUDE_ROW</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Reason Code *</label>
                  <select
                    value={reasonCode}
                    onChange={e => setReasonCode(e.target.value)}
                    className="w-full border border-input rounded p-2 bg-background text-xs"
                    required
                  >
                    <option value="CLIENT_TIMESHEET_VERIFIED">CLIENT_TIMESHEET_VERIFIED</option>
                    <option value="SUPERVISOR_CONFIRMED">SUPERVISOR_CONFIRMED</option>
                    <option value="MOBILE_DEVICE_OFFLINE">MOBILE_DEVICE_OFFLINE</option>
                    <option value="APPROVED_LEAVE_APPLIED">APPROVED_LEAVE_APPLIED</option>
                    <option value="ROSTER_CHANGE_EXECUTED">ROSTER_CHANGE_EXECUTED</option>
                    <option value="MANUAL_AUDIT_ADJUSTMENT">MANUAL_AUDIT_ADJUSTMENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-1">Resolved Status</label>
                  <select
                    value={resolvedStatus}
                    onChange={e => setResolvedStatus(e.target.value)}
                    className="w-full border border-input rounded p-2 bg-background text-xs"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="OFF">OFF</option>
                    <option value="LEAVE">LEAVE</option>
                    <option value="HOLIDAY">HOLIDAY</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Worked Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    value={resolvedHours}
                    onChange={e => setResolvedHours(e.target.value)}
                    className="w-full border border-input rounded p-2 bg-background text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">OT Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    value={resolvedOtHours}
                    onChange={e => setResolvedOtHours(e.target.value)}
                    className="w-full border border-input rounded p-2 bg-background text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Audit Notes / Rationale</label>
                <textarea
                  rows={2}
                  value={reasonNotes}
                  onChange={e => setReasonNotes(e.target.value)}
                  placeholder="Provide supervisor confirmation reference or operational explanation..."
                  className="w-full border border-input rounded p-2 bg-background text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="px-4 py-2 border border-input rounded hover:bg-accent text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-xs font-medium"
                >
                  {submittingDecision ? "Saving..." : "Apply Decision Revision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}