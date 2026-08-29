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
  Download,
  RotateCcw,
  Check,
  X
} from "lucide-react";

export default function AttendanceApprovalConsolePage() {
  const params = useParams();
  const router = useRouter();
  const importBatchId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Return / Reject / Reopen Modal State
  const [modalType, setModalType] = useState<"RETURN" | "REJECT" | "REOPEN" | null>(null);
  const [reasonText, setReasonText] = useState("");

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

  const handleApprove = async () => {
    if (!confirm("Approve this reconciliation batch and generate immutable approved snapshot?")) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/approve`, {
        method: "POST"
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Approval failed.");
      }
      alert("Reconciliation approved successfully!");
      await fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonText.trim()) return;

    try {
      setActionLoading(true);
      let endpoint = "";
      let payload: any = {};

      if (modalType === "RETURN") {
        endpoint = "return";
        payload = { returnReason: reasonText };
      } else if (modalType === "REJECT") {
        endpoint = "reject";
        payload = { rejectionReason: reasonText };
      } else if (modalType === "REOPEN") {
        endpoint = "reopen";
        payload = { reopenReason: reasonText };
      }

      const res = await fetch(`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Action failed.");
      }

      setModalType(null);
      setReasonText("");
      await fetchData();
    } catch (err: any) {
      alert("Action error: " + err.message);
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
        </div>
      </div>
    );
  }

  const { importBatch, reconciliationBatch, candidates = [], snapshots = [], events = [] } = data || {};
  const isPendingApproval = reconciliationBatch?.status === "PENDING_APPROVAL";
  const isApproved = reconciliationBatch?.status === "APPROVED";
  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/attendance/import/${importBatchId}/reconcile`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Reconcile Workspace
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Reconciliation Approver Console</h1>
            <span className="text-xs px-2.5 py-1 rounded font-semibold bg-primary/10 text-primary border border-primary/20">
              {importBatch?.operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
            </span>
            {reconciliationBatch && (
              <span className="text-xs px-2.5 py-1 rounded font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                {reconciliationBatch.status} (v{reconciliationBatch.reconciliationVersion})
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Batch #{importBatch?.batchNumber} • Approver Segregation of Duties Enforced
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPendingApproval && (
            <>
              <button
                onClick={() => setModalType("RETURN")}
                disabled={actionLoading}
                className="px-3 py-2 border border-orange-300 text-orange-700 dark:text-orange-300 rounded-md hover:bg-orange-50 text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Return with Comments
              </button>
              <button
                onClick={() => setModalType("REJECT")}
                disabled={actionLoading}
                className="px-3 py-2 border border-red-300 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 text-sm font-medium flex items-center gap-1.5"
              >
                <X className="h-4 w-4" /> Reject Batch
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium flex items-center gap-1.5 shadow"
              >
                <Check className="h-4 w-4" /> Approve Reconciliation
              </button>
            </>
          )}

          {isApproved && (
            <>
              <a
                href={`/api/v1/attendance-import/batches/${importBatchId}/reconciliation/export?snapshotId=${latestSnapshot?.id}`}
                className="px-3 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium flex items-center gap-1.5 shadow-sm"
              >
                <Download className="h-4 w-4" /> Export Approved XLSX
              </a>
              <button
                onClick={() => setModalType("REOPEN")}
                disabled={actionLoading}
                className="px-3 py-2 border border-primary/30 text-primary rounded-md hover:bg-primary/5 text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reopen Reconciliation (v{reconciliationBatch.reconciliationVersion + 1})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Snapshot / Approval Card */}
      {isApproved && latestSnapshot && (
        <div className="bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-300 font-bold text-base">
              <CheckCircle className="h-5 w-5" /> Immutable Approved Snapshot Generated
            </div>
            <span className="text-xs bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-200 px-2 py-0.5 rounded font-mono">
              Version {latestSnapshot.approvalVersion}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block">Approved Rows</span>
              <span className="font-semibold">{latestSnapshot.totalRows}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Regular Hours Total</span>
              <span className="font-semibold">{(latestSnapshot.approvedRegularMinutesTotal / 60).toFixed(2)}h</span>
            </div>
            <div>
              <span className="text-muted-foreground block">OT Hours Total</span>
              <span className="font-semibold">{(latestSnapshot.approvedOtMinutesTotal / 60).toFixed(2)}h</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Snapshot SHA-256</span>
              <span className="font-mono text-[10px] break-all">{latestSnapshot.snapshotHash}</span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail List */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-base font-bold">Workflow Audit Log</h3>
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events recorded yet.</p>
          ) : (
            events.map((ev: any) => (
              <div key={ev.id} className="flex items-start justify-between border-b border-border/50 pb-2 text-xs">
                <div>
                  <span className="font-semibold text-primary">{ev.eventType}</span>
                  <span className="text-muted-foreground ml-2">by {ev.actorName} ({ev.actorRole})</span>
                </div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  {new Date(ev.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal for Return / Reject / Reopen */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold">
              {modalType === "RETURN" && "Return Reconciliation Batch"}
              {modalType === "REJECT" && "Reject Reconciliation Batch"}
              {modalType === "REOPEN" && "Reopen Approved Reconciliation"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {modalType === "RETURN" && "Provide feedback for the reviewer to address conflicts and resubmit."}
              {modalType === "REJECT" && "Rejecting this batch is a terminal action for this import."}
              {modalType === "REOPEN" && "Reopening creates version N+1 while preserving all historical snapshots."}
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Mandatory Reason / Notes *</label>
                <textarea
                  rows={3}
                  value={reasonText}
                  onChange={e => setReasonText(e.target.value)}
                  required
                  placeholder="Enter audit explanation..."
                  className="w-full border border-input rounded p-2 bg-background text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 border border-input rounded hover:bg-accent text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-xs font-medium"
                >
                  Confirm Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}