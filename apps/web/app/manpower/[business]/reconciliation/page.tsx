"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@ahh-wfm/ui";
import { hasPermission } from "@/lib/permissions";

interface ReconciliationRecord {
  id: string;
  operationType: string;
  contractCode: string;
  contractTitle: string;
  siteName?: string;
  expectedEmployeeId: string;
  expectedEmployeeCode: string;
  expectedEmployeeName: string;
  expectedShiftCode?: string;
  expectedPosition?: string;
  expectedSourceType: string;
  suppressionSourceType?: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  actualCheckInUtc?: string;
  actualCheckOutUtc?: string;
  lateMinutes: number;
  detectionOutcome: string;
  workflowStatus: string;
  resolution: string;
  suppressionReason?: string;
  reviewNotes?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  rowVersion: number;
  attendanceRecord?: {
    device?: string;
    lat?: number;
    lng?: number;
    status?: string;
  };
}

interface SummaryData {
  totalCount: number;
  onTimeCount: number;
  lateCount: number;
  noCheckInCount: number;
  locationMismatchCount: number;
  suppressedCount: number;
  pendingReviewCount: number;
  resolvedCount: number;
}

export default function ReconciliationConsolePage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();

  const business = (params?.business as string) || "security-guarding";
  const operationType = business === "facility-management" ? "FACILITY_MANAGEMENT" : "SECURITY_GUARDING";
  const businessTitle = business === "facility-management" ? "Facility Management" : "Security Guarding";

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [records, setRecords] = useState<ReconciliationRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [scopeOutcome, setScopeOutcome] = useState("PROCESSED");
  const [publicationVersion, setPublicationVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedRecord, setSelectedRecord] = useState<ReconciliationRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const canView = hasPermission(session?.user as any, "manpower.reconciliation.view") || hasPermission(session?.user as any, "manpower.admin.full_access");
  const canRun = hasPermission(session?.user as any, "manpower.reconciliation.run") || hasPermission(session?.user as any, "manpower.admin.full_access");
  const canExcuse = hasPermission(session?.user as any, "manpower.reconciliation.excuse") || hasPermission(session?.user as any, "manpower.admin.full_access");
  const canClassifyUnexcused = hasPermission(session?.user as any, "manpower.reconciliation.classifyUnexcused") || hasPermission(session?.user as any, "manpower.admin.full_access");
  const canMarkSyncDelay = hasPermission(session?.user as any, "manpower.reconciliation.markSyncDelay") || hasPermission(session?.user as any, "manpower.admin.full_access");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/v1/manpower/scheduling/reconciliation?business=${business}&date=${date}`;
      if (outcomeFilter !== "ALL") url += `&detectionOutcome=${outcomeFilter}`;
      if (statusFilter !== "ALL") url += `&workflowStatus=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecords(data.reconciliations);
          setSummary(data.summary);
          setScopeOutcome(data.scopeOutcome);
          setPublicationVersion(data.publicationVersion);
        } else {
          setError(data.error || "Failed to load reconciliation data.");
        }
      } else {
        if (res.status === 403) {
          setError(`Access Forbidden: You do not have permission to view ${businessTitle} reconciliation.`);
        } else {
          setError("Failed to fetch reconciliation records from server.");
        }
      }
    } catch (e: any) {
      setError(e.message || "An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [date, outcomeFilter, statusFilter, business]);

  const handleManualRun = async () => {
    setRefreshing(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/v1/manpower/scheduling/reconciliation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business, date })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Manual reconciliation cycle completed successfully.");
        loadData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "Manual reconciliation run failed.");
      }
    } catch (e: any) {
      setError(e.message || "An error occurred during manual refresh.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleReviewDecision = async (resolution: string) => {
    if (!selectedRecord) return;
    setSubmittingReview(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/v1/manpower/scheduling/reconciliation/${selectedRecord.id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          reviewNotes,
          rowVersion: selectedRecord.rowVersion
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSuccess(`Record resolution updated to ${resolution}.`);
          setSelectedRecord(null);
          setReviewNotes("");
          loadData();
        } else {
          setError(data.error || "Failed to update review status.");
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "Review submission failed.");
      }
    } catch (e: any) {
      setError(e.message || "An error occurred during review submission.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-6 text-red-600 font-medium">
        Access Forbidden: You do not have permission to view attendance reconciliation records.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {businessTitle} — Attendance Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Compare active published roster requirements against real-time attendance punches.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="border rounded px-3 py-1.5 text-sm bg-white text-slate-900 shadow-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {canRun && (
            <Button
              variant="secondary"
              onClick={handleManualRun}
              disabled={refreshing}
              className="text-sm font-medium"
            >
              {refreshing ? "Refreshing..." : "Manual Refresh"}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded text-sm">
          {success}
        </div>
      )}

      {/* Scope Outcome Alert Banner */}
      {scopeOutcome === "NO_PUBLISHED_ROSTER" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">No Published Roster for Date</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              Reconciliation requires an ACTIVE published roster. No per-employee absence alerts have been generated for draft schedules.
            </p>
          </div>
          <span className="text-xs font-mono bg-amber-100 px-2.5 py-1 rounded text-amber-900">
            NO_PUBLISHED_ROSTER
          </span>
        </div>
      )}

      {/* Summary Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border rounded-lg p-3 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">Total Expected</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{summary.totalCount}</div>
          </div>
          <div className="bg-white border rounded-lg p-3 shadow-sm border-l-4 border-l-emerald-500">
            <span className="text-xs text-slate-500 font-medium">On-Time</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">{summary.onTimeCount}</div>
          </div>
          <div className="bg-white border rounded-lg p-3 shadow-sm border-l-4 border-l-amber-500">
            <span className="text-xs text-slate-500 font-medium">Late Arrivals</span>
            <div className="text-xl font-bold text-amber-600 mt-1">{summary.lateCount}</div>
          </div>
          <div className="bg-white border rounded-lg p-3 shadow-sm border-l-4 border-l-red-500">
            <span className="text-xs text-slate-500 font-medium">No-Check-In</span>
            <div className="text-xl font-bold text-red-600 mt-1">{summary.noCheckInCount}</div>
          </div>
          <div className="bg-white border rounded-lg p-3 shadow-sm border-l-4 border-l-purple-500">
            <span className="text-xs text-slate-500 font-medium">Location Mismatch</span>
            <div className="text-xl font-bold text-purple-600 mt-1">{summary.locationMismatchCount}</div>
          </div>
          <div className="bg-white border rounded-lg p-3 shadow-sm border-l-4 border-l-slate-400">
            <span className="text-xs text-slate-500 font-medium">Suppressed</span>
            <div className="text-xl font-bold text-slate-600 mt-1">{summary.suppressedCount}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-2.5 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mr-2">Filter Outcome:</span>
          {["ALL", "LATE", "NO_CHECK_IN", "LOCATION_MISMATCH", "SUPPRESSED", "ON_TIME"].map((outcome) => (
            <button
              key={outcome}
              onClick={() => setOutcomeFilter(outcome)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                outcomeFilter === outcome
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-200 border"
              }`}
            >
              {outcome.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mr-2">Status:</span>
          {["ALL", "PENDING_REVIEW", "RESOLVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                statusFilter === st
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-200 border"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading reconciliation queue...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No reconciliation records found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-600 uppercase text-[10px] tracking-wider">
                  <th className="p-3 font-semibold">Employee</th>
                  <th className="p-3 font-semibold">Contract / Site</th>
                  <th className="p-3 font-semibold">Shift & Scheduled UTC</th>
                  <th className="p-3 font-semibold">Actual Punch</th>
                  <th className="p-3 font-semibold">Outcome</th>
                  <th className="p-3 font-semibold">Workflow / Resolution</th>
                  <th className="p-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{r.expectedEmployeeName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{r.expectedEmployeeCode}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{r.contractCode}</div>
                      <div className="text-[10px] text-slate-500">{r.siteName || "Default Site"}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{r.expectedShiftCode || r.expectedPosition}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(r.scheduledStartUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(r.scheduledEndUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="p-3">
                      {r.actualCheckInUtc ? (
                        <div>
                          <div className="font-semibold text-slate-900">
                            {new Date(r.actualCheckInUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {r.lateMinutes > 0 && (
                            <span className="text-[10px] text-amber-600 font-semibold">{r.lateMinutes} mins late</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No punch</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.detectionOutcome === "ON_TIME"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.detectionOutcome === "LATE"
                            ? "bg-amber-100 text-amber-800"
                            : r.detectionOutcome === "NO_CHECK_IN"
                            ? "bg-red-100 text-red-800"
                            : r.detectionOutcome === "LOCATION_MISMATCH"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.detectionOutcome}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{r.workflowStatus}</div>
                      <div className="text-[10px] text-slate-500">{r.resolution}</div>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedRecord(r)}
                        className="text-xs h-7 px-2.5"
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supervisor Review Drawer Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-5 border">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Supervisor Review</h3>
                <p className="text-xs text-slate-500">{selectedRecord.expectedEmployeeName} ({selectedRecord.expectedEmployeeCode})</p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3.5 rounded border">
              <div><strong className="text-slate-900">Contract:</strong> {selectedRecord.contractTitle} ({selectedRecord.contractCode})</div>
              <div><strong className="text-slate-900">Site:</strong> {selectedRecord.siteName || "N/A"}</div>
              <div><strong className="text-slate-900">Scheduled UTC:</strong> {new Date(selectedRecord.scheduledStartUtc).toUTCString()}</div>
              <div><strong className="text-slate-900">Detection Outcome:</strong> <span className="font-bold text-slate-900">{selectedRecord.detectionOutcome}</span></div>
              {selectedRecord.lateMinutes > 0 && <div><strong className="text-slate-900">Delay:</strong> {selectedRecord.lateMinutes} minutes</div>}
              {selectedRecord.attendanceRecord?.device && <div><strong className="text-slate-900">Device Source:</strong> {selectedRecord.attendanceRecord.device}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Review Notes:</label>
              <textarea
                className="w-full border rounded p-2 text-xs bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900"
                rows={3}
                placeholder="Provide justification or review notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <div className="pt-2 border-t flex flex-wrap items-center justify-end gap-2">
              {canExcuse && (
                <Button
                  variant="secondary"
                  disabled={submittingReview}
                  onClick={() => handleReviewDecision("EXCUSED")}
                  className="text-xs"
                >
                  Excuse Exception
                </Button>
              )}
              {canMarkSyncDelay && (
                <Button
                  variant="ghost"
                  disabled={submittingReview}
                  onClick={() => handleReviewDecision("ATTENDANCE_SYNC_DELAY")}
                  className="text-xs text-slate-700"
                >
                  Flag Sync Delay
                </Button>
              )}
              {canClassifyUnexcused && (
                <Button
                  variant="error"
                  disabled={submittingReview}
                  onClick={() => handleReviewDecision("UNEXCUSED_ABSENCE")}
                  className="text-xs"
                >
                  Mark Unexcused Absence
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
