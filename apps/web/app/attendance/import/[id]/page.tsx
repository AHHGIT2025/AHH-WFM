"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

interface ValidationMsg {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  field?: string;
  message: string;
}

interface StagedRow {
  id: string;
  sourceRowNumber: number;
  rawAttendanceDate: string | null;
  rawEmployeeCode: string | null;
  rawEmployeeName: string | null;
  rawCompany: string | null;
  rawSite: string | null;
  rawContract: string | null;
  rawShift: string | null;
  rawPlannedStart: string | null;
  rawPlannedEnd: string | null;
  rawActualTimeIn: string | null;
  rawActualTimeOut: string | null;
  rawWorkedHours: string | null;
  rawOtHours: string | null;
  rawAttendanceStatus: string | null;
  rawLeaveType: string | null;
  rawRemarks: string | null;

  attendanceDate: string | null;
  actualTimeIn: string | null;
  actualTimeOut: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  workedHours: number | null;
  otHours: number | null;
  normalizedStatus: string | null;

  employeeId: string | null;
  employee?: { id: string; name: string; employeeCategory: string; employmentStatus: string } | null;
  companyId: string | null;
  siteId: string | null;
  site?: { id: string; code: string | null; name: string; operationType: string } | null;
  contractId: string | null;
  contract?: { id: string; contractNumber: string; status: string } | null;
  rosterRequirementSlotId?: string | null;
  existingAttendanceId?: string | null;

  validationStatus: "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "UNMATCHED";
  validationMessages: ValidationMsg[] | null;
  isDuplicate: boolean;
  duplicateReason: string | null;
  existingAttendanceSource: string | null;
}

interface BatchDetail {
  id: string;
  batchNumber: string;
  companyId: string | null;
  company?: { id: string; companyCode: string; companyName: string } | null;
  operationType: string | null;
  attendancePeriodFrom: string | null;
  attendancePeriodTo: string | null;
  sourceType: string;
  originalFileName: string;
  fileSize: number | null;
  recordCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  status: string;
  uploadedByName: string | null;
  uploadedAt: string;
  validationCompletedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
}

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedRow, setSelectedRow] = useState<StagedRow | null>(null);

  const fetchBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/attendance-import/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setBatch(data.batch);
      }
    } catch (e) {
      console.error("Failed to fetch batch:", e);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const fetchRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const p = new URLSearchParams();
      if (activeFilter !== "ALL") p.append("filter", activeFilter);
      if (searchQuery.trim()) p.append("q", searchQuery.trim());
      p.append("limit", "100");

      const res = await fetch(`/api/v1/attendance-import/batches/${batchId}/rows?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
      }
    } catch (e) {
      console.error("Failed to fetch rows:", e);
    } finally {
      setRowsLoading(false);
    }
  }, [batchId, activeFilter, searchQuery]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleValidate = async () => {
    setActionLoading(true);
    setActionMessage("");
    setActionError("");
    try {
      const res = await fetch(`/api/v1/attendance-import/batches/${batchId}/validate`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to validate batch.");
      } else {
        setActionMessage("Batch validation completed successfully.");
        fetchBatch();
        fetchRows();
      }
    } catch (e: any) {
      setActionError(e.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewAction = async (status: "UNDER_REVIEW" | "REJECTED") => {
    const remarks = prompt(`Enter optional remarks for setting batch to ${status}:`);
    setActionLoading(true);
    setActionMessage("");
    setActionError("");
    try {
      const res = await fetch(`/api/v1/attendance-import/batches/${batchId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to update review status.");
      } else {
        setActionMessage(`Batch status updated to ${status}.`);
        fetchBatch();
      }
    } catch (e: any) {
      setActionError(e.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBatch = async () => {
    if (!confirm("Are you sure you want to CANCEL this attendance intake batch?")) return;
    setActionLoading(true);
    setActionMessage("");
    setActionError("");
    try {
      const res = await fetch(`/api/v1/attendance-import/batches/${batchId}/cancel`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to cancel batch.");
      } else {
        setActionMessage("Batch marked as CANCELLED.");
        fetchBatch();
      }
    } catch (e: any) {
      setActionError(e.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VALIDATED":
        return <Badge variant="success">Validated</Badge>;
      case "UNDER_REVIEW":
        return <Badge variant="warning">Under Review</Badge>;
      case "VALIDATING":
        return <Badge variant="pending">Validating...</Badge>;
      case "UPLOADED":
        return <Badge variant="info">Uploaded</Badge>;
      case "REJECTED":
        return <Badge variant="error">Rejected</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getRowStatusBadge = (status: string, isDup: boolean) => {
    if (isDup || status === "DUPLICATE") {
      return <Badge variant="pending">Duplicate</Badge>;
    }
    switch (status) {
      case "VALID":
        return <Badge variant="success">Valid</Badge>;
      case "WARNING":
        return <Badge variant="warning">Warning</Badge>;
      case "ERROR":
        return <Badge variant="error">Error</Badge>;
      case "UNMATCHED":
        return <Badge variant="neutral">Unmatched</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Loading batch details...
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-8 text-center text-rose-700">
        Batch not found. <Link href="/attendance/import" className="underline font-bold">Return to Register</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Link href="/attendance/import" className="hover:underline text-primary font-medium">
            ← Back to Attendance Intake Register
          </Link>
          <span>/</span>
          <span className="font-mono font-bold text-on-surface">{batch.batchNumber}</span>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(batch.status)}
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              {batch.operationType || "OPERATIONAL SCOPE"}
            </span>
            <span className="text-xs text-on-surface-variant">
              Source: <strong className="text-on-surface">{batch.sourceType}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mt-1.5 font-mono">{batch.batchNumber}</h1>
          <p className="text-xs text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>File: <strong className="text-on-surface">{batch.originalFileName}</strong></span>
            <span>Company: <strong className="text-on-surface">{batch.company?.companyName || "Holding Level"}</strong></span>
            <span>Uploaded: <strong className="text-on-surface">{new Date(batch.uploadedAt).toLocaleString()}</strong> by {batch.uploadedByName || "System"}</span>
          </p>
        </div>

        {/* Action Controls & DRAFT Exports */}
        <div className="flex flex-wrap items-center gap-2">
          {/* DRAFT Output Exports */}
          <div className="flex items-center gap-2 border-r border-outline-variant pr-2 mr-1">
            <a
              href={`/api/v1/attendance-import/batches/${batchId}/export/detailed-timesheet`}
              download
              title="Download Detailed Monthly Attendance Timesheet with 2-Row presentation (DRAFT)"
            >
              <Button variant="secondary" size="sm" type="button">
                <span className="material-symbols-outlined text-sm mr-1">table_view</span>
                Detailed Timesheet (DRAFT)
              </Button>
            </a>

            <a
              href={`/api/v1/attendance-import/batches/${batchId}/export/client-muster`}
              download
              title="Download Client Monthly Mobilization / Muster Sheet (DRAFT)"
            >
              <Button variant="secondary" size="sm" type="button">
                <span className="material-symbols-outlined text-sm mr-1">assignment</span>
                Client Muster (DRAFT)
              </Button>
            </a>
          </div>

          {batch.status !== "CANCELLED" && (
            <>
              <Link href={`/attendance/import/${batchId}/reconcile`}>
                <Button variant="primary" size="sm" type="button" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                  <span className="material-symbols-outlined text-sm mr-1">sync_alt</span>
                  Reconciliation & Approval
                </Button>
              </Link>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleValidate}
                disabled={actionLoading || batch.status === "VALIDATING"}
              >
                <span className="material-symbols-outlined text-sm mr-1">rule</span>
                {actionLoading ? "Processing..." : "Re-Validate Batch"}
              </Button>

              {batch.status !== "UNDER_REVIEW" && (
                <Button
                  variant="workflow"
                  size="sm"
                  onClick={() => handleReviewAction("UNDER_REVIEW")}
                  disabled={actionLoading}
                >
                  <span className="material-symbols-outlined text-sm mr-1">rate_review</span>
                  Mark Under Review
                </Button>
              )}

              {batch.status !== "REJECTED" && (
                <Button
                  variant="error"
                  size="sm"
                  onClick={() => handleReviewAction("REJECTED")}
                  disabled={actionLoading}
                >
                  <span className="material-symbols-outlined text-sm mr-1">cancel</span>
                  Reject Batch
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelBatch}
                disabled={actionLoading}
              >
                Cancel Batch
              </Button>
            </>
          )}
        </div>
      </div>

      {/* DRAFT Output Watermark Alert */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-700 text-base">info</span>
          <span>
            <strong>DRAFT Pre-Reconciliation Mode:</strong> Exports generated from this console are marked <strong>DRAFT — NOT APPROVED</strong>. They reflect staged matrix intake data and cause zero mutation to authoritative payroll, billing, or attendance tables.
          </span>
        </div>
        <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] tracking-wider uppercase whitespace-nowrap">
          Draft Staging
        </span>
      </div>

      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-700 text-base">error</span>
          {actionError}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Card padded className="text-center bg-surface-container-low border-outline-variant">
          <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Total Rows</div>
          <div className="text-2xl font-bold text-on-surface mt-1">{batch.recordCount}</div>
        </Card>

        <Card padded className="text-center bg-emerald-50/60 border-emerald-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Valid Clean</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{batch.validCount}</div>
        </Card>

        <Card padded className="text-center bg-amber-50/60 border-amber-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Warnings</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{batch.warningCount}</div>
        </Card>

        <Card padded className="text-center bg-rose-50/60 border-rose-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Errors</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{batch.errorCount}</div>
        </Card>

        <Card padded className="text-center bg-purple-50/60 border-purple-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Duplicates</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{batch.duplicateCount}</div>
        </Card>

        <Card padded className="text-center bg-slate-50 border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Unmatched</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{batch.unmatchedCount}</div>
        </Card>
      </div>

      {/* Staged Data Filter Tabs & Search */}
      <Card padded className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant text-xs">
            {[
              { key: "ALL", label: "All Rows", count: batch.recordCount },
              { key: "VALID", label: "Valid", count: batch.validCount },
              { key: "WARNINGS", label: "Warnings", count: batch.warningCount },
              { key: "ERRORS", label: "Errors", count: batch.errorCount },
              { key: "DUPLICATES", label: "Duplicates", count: batch.duplicateCount },
              { key: "UNMATCHED", label: "Unmatched", count: batch.unmatchedCount }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                  activeFilter === tab.key
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-75 bg-surface-container px-1.5 py-0.2 rounded-full">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="w-full md:w-64">
            <input
              type="text"
              placeholder="Search code, name, site..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {/* Staged Rows Table */}
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold">
              <tr>
                <th className="py-3 px-3 w-12 text-center">Row</th>
                <th className="py-3 px-3">Duty Date</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Site / Location</th>
                <th className="py-3 px-3">Contract / Shift</th>
                <th className="py-3 px-3">Actual Times</th>
                <th className="py-3 px-3 text-center">Hours</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4">Validation Exceptions & Duplicate Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rowsLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                    Loading staged rows...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                    No staged rows found matching filter '{activeFilter}'.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    className="hover:bg-surface-container-lowest transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 text-center font-mono text-on-surface-variant">
                      {row.sourceRowNumber}
                    </td>

                    <td className="py-3 px-3 font-mono font-medium">
                      {row.attendanceDate
                        ? new Date(row.attendanceDate).toLocaleDateString()
                        : row.rawAttendanceDate || "—"}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-on-surface">
                        {row.employee?.name || row.rawEmployeeName || "Unknown Employee"}
                      </div>
                      <div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                        <span>{row.rawEmployeeCode}</span>
                        {row.employeeId ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-sans text-[9px] font-bold">Resolved</span>
                        ) : (
                          <span className="text-rose-700 bg-rose-50 px-1 rounded font-sans text-[9px] font-bold">Unresolved</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-on-surface">{row.site?.name || row.rawSite || "—"}</div>
                      <div className="text-[10px] text-on-surface-variant">
                        {row.site?.code ? `Code: ${row.site.code}` : row.rawCompany || ""}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono text-on-surface">{row.contract?.contractNumber || row.rawContract || "—"}</div>
                      <div className="text-[10px] text-on-surface-variant">{row.rawShift || "Default Shift"}</div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div>IN: {row.actualTimeIn ? new Date(row.actualTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : row.rawActualTimeIn || "—"}</div>
                      <div>OUT: {row.actualTimeOut ? new Date(row.actualTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : row.rawActualTimeOut || "—"}</div>
                    </td>

                    <td className="py-3 px-3 text-center font-bold">
                      <div>{row.workedHours !== null ? `${row.workedHours}h` : row.rawWorkedHours || "—"}</div>
                      {row.otHours ? <div className="text-[10px] text-amber-700 font-normal">+{row.otHours}h OT</div> : null}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {getRowStatusBadge(row.validationStatus, row.isDuplicate)}
                    </td>

                    <td className="py-3 px-4 max-w-sm">
                      <div className="flex flex-wrap gap-1">
                        {row.validationMessages && row.validationMessages.length > 0 ? (
                          row.validationMessages.map((m, idx) => {
                            const isErr = m.severity === "ERROR";
                            const isWarn = m.severity === "WARNING";
                            return (
                              <span
                                key={idx}
                                title={m.message}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold truncate max-w-[280px] inline-block ${
                                  isErr
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : isWarn
                                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                                    : "bg-blue-100 text-blue-900 border border-blue-200"
                                }`}
                              >
                                {m.code}: {m.message}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">check</span>
                            Clean Record
                          </span>
                        )}

                        {row.duplicateReason && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-purple-100 text-purple-900 border border-purple-200 block mt-1">
                            {row.duplicateReason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Row Detail Inspector Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-outline-variant max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <span className="text-xs font-bold text-primary uppercase">Row {selectedRow.sourceRowNumber} Details</span>
                <h3 className="text-lg font-bold text-on-surface">Staging Row Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-on-surface-variant hover:text-on-surface text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-surface-container-low p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-on-surface-variant uppercase text-[10px]">Raw Imported Data</span>
                <div><strong>Employee:</strong> {selectedRow.rawEmployeeCode} - {selectedRow.rawEmployeeName}</div>
                <div><strong>Duty Date:</strong> {selectedRow.rawAttendanceDate}</div>
                <div><strong>Site / Location:</strong> {selectedRow.rawSite}</div>
                <div><strong>Contract:</strong> {selectedRow.rawContract}</div>
                <div><strong>Shift:</strong> {selectedRow.rawShift} ({selectedRow.rawPlannedStart} - {selectedRow.rawPlannedEnd})</div>
                <div><strong>Time In/Out:</strong> {selectedRow.rawActualTimeIn} → {selectedRow.rawActualTimeOut}</div>
                <div><strong>Worked / OT:</strong> {selectedRow.rawWorkedHours}h / {selectedRow.rawOtHours}h</div>
                <div><strong>Remarks:</strong> {selectedRow.rawRemarks || "None"}</div>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl space-y-1.5">
                <span className="font-bold text-on-surface-variant uppercase text-[10px]">Resolved Reference Entities</span>
                <div><strong>Employee ID:</strong> {selectedRow.employeeId || "Not Resolved"}</div>
                <div><strong>Site ID:</strong> {selectedRow.siteId || "Not Resolved"}</div>
                <div><strong>Contract ID:</strong> {selectedRow.contractId || "Not Resolved"}</div>
                <div><strong>Roster Slot ID:</strong> {selectedRow.rosterRequirementSlotId || "No Slot Matched"}</div>
                <div><strong>Existing Attendance:</strong> {selectedRow.existingAttendanceId ? `ID: ${selectedRow.existingAttendanceId} (${selectedRow.existingAttendanceSource})` : "None"}</div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface-variant uppercase text-[10px]">Validation Results & Exceptions</span>
              {selectedRow.validationMessages && selectedRow.validationMessages.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedRow.validationMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        m.severity === "ERROR"
                          ? "bg-rose-50 border-rose-200 text-rose-900"
                          : m.severity === "WARNING"
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-blue-50 border-blue-200 text-blue-900"
                      }`}
                    >
                      <strong className="font-mono">{m.code}:</strong> {m.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-emerald-700 font-medium">All validation checks passed with zero errors or warnings.</div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-outline-variant">
              <Button variant="secondary" size="sm" onClick={() => setSelectedRow(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
