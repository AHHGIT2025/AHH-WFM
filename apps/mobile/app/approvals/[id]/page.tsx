"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function MobileApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/approvals/${encodeURIComponent(id)}`);
      if (res.ok) {
        const d = await res.json();
        setData(d.data || d);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: errData.error || "Failed to load approval details." });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Network error loading details." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleExecuteAction = async () => {
    if (!selectedAction || !id) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/approvals/${encodeURIComponent(id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedAction,
          remarks: remarks.trim()
        })
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setFeedback({ type: "success", message: resData.message || `Successfully executed ${selectedAction}.` });
        setSelectedAction(null);
        setRemarks("");
        // Reload details to show updated workflow timeline & state
        await fetchDetail();
      } else {
        setFeedback({ type: "error", message: resData.error || "Action execution failed." });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to submit approval action." });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "APPROVED" || s === "COMPLETED") return "bg-status-success/10 text-status-success border-status-success/20";
    if (s === "REJECTED") return "bg-status-error/10 text-status-error border-status-error/20";
    if (s === "RETURNED") return "bg-status-warning/10 text-status-warning border-status-warning/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const summary = data?.summary;
  const instance = data?.instance;
  const lifecycle = data?.lifecycle || [];
  const canAct = data?.canAct || false;

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/approvals" className="p-2 -ml-2 rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-base font-bold text-on-surface">Approval Details</h1>
            <p className="text-[10px] text-on-surface-variant font-mono">{summary?.reference || id}</p>
          </div>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeClass(instance?.status || data?.status)}`}>
          {instance?.status || data?.status || "Pending"}
        </span>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
          feedback.type === "success"
            ? "bg-status-success/10 text-status-success border-status-success/20"
            : "bg-status-error/10 text-status-error border-status-error/20"
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {feedback.type === "success" ? "check_circle" : "error"}
          </span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Business Summary Card */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary-container/40 text-secondary">
            {summary?.moduleType || instance?.moduleType || "WORKFLOW"}
          </span>
          <span className="text-[10px] text-on-surface-variant">
            {summary?.submittedAt ? new Date(summary.submittedAt).toLocaleDateString() : ""}
          </span>
        </div>

        <div>
          <h2 className="text-sm font-bold text-on-surface">{summary?.title || "Approval Request"}</h2>
          {summary?.details && summary.details.length > 0 && (
            <div className="mt-2 space-y-1.5 pt-2 border-t border-outline-variant/20">
              {summary.details.map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <span className="text-on-surface-variant">{d.label}:</span>
                  <span className="font-semibold text-on-surface">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-outline-variant/20 flex justify-between items-center text-[10px] text-on-surface-variant">
          <span>Requester: <strong className="text-on-surface">{summary?.requesterName || "Requester"}</strong></span>
          <span>{summary?.companyName || "Al Hattab Holding"}</span>
        </div>

        {summary?.deepLink && (
          <div className="pt-2 border-t border-outline-variant/20">
            <a
              href={summary.deepLink}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
            >
              <span>View Full Source Document on Web</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
        )}
      </div>

      {/* Action Execution Panel */}
      {canAct ? (
        <div className="bg-surface border-2 border-primary/40 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-xs">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <h3>Pending Your Decision</h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSelectedAction("APPROVE")}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                selectedAction === "APPROVE"
                  ? "bg-status-success text-white shadow-sm"
                  : "bg-status-success/10 text-status-success hover:bg-status-success/20 border border-status-success/30"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Approve</span>
            </button>

            <button
              onClick={() => setSelectedAction("RETURN")}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                selectedAction === "RETURN"
                  ? "bg-status-warning text-white shadow-sm"
                  : "bg-status-warning/10 text-status-warning hover:bg-status-warning/20 border border-status-warning/30"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">replay</span>
              <span>Return</span>
            </button>

            <button
              onClick={() => setSelectedAction("REJECT")}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                selectedAction === "REJECT"
                  ? "bg-status-error text-white shadow-sm"
                  : "bg-status-error/10 text-status-error hover:bg-status-error/20 border border-status-error/30"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              <span>Reject</span>
            </button>
          </div>

          {selectedAction && (
            <div className="space-y-2 pt-2 border-t border-outline-variant/20 animate-fadeIn">
              <label className="block text-[11px] font-bold text-on-surface">
                Remarks / Decision Notes {selectedAction !== "APPROVE" && <span className="text-status-error">*</span>}
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={`Provide justification for ${selectedAction}...`}
                className="w-full p-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary h-20"
              />

              <button
                onClick={handleExecuteAction}
                disabled={actionLoading || (selectedAction !== "APPROVE" && !remarks.trim())}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Confirm {selectedAction}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-3.5 text-center text-xs text-on-surface-variant">
          <p className="font-semibold">View Only</p>
          <p className="text-[10px] mt-0.5">
            {instance?.status === "IN_PROGRESS"
              ? "This request is pending action by another assigned approver."
              : `Workflow lifecycle has completed (${instance?.status || data?.status || "Final"}).`}
          </p>
        </div>
      )}

      {/* Approval Timeline / History */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
          <span>Approval Lifecycle & History</span>
        </h3>

        <div className="space-y-3 relative pl-4 border-l-2 border-outline-variant/30 ml-2">
          {lifecycle.map((step: any, idx: number) => (
            <div key={idx} className="relative space-y-1">
              <div className={`absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface ${
                step.status === "APPROVED" || step.status === "COMPLETED"
                  ? "bg-status-success"
                  : step.status === "REJECTED"
                  ? "bg-status-error"
                  : step.status === "CURRENT"
                  ? "bg-primary animate-pulse"
                  : "bg-surface-container-high"
              }`} />

              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-on-surface">{step.title}</h4>
                  <p className="text-[10px] text-on-surface-variant">{step.actor || "Assigned Level Approvers"}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  step.status === "APPROVED" || step.status === "COMPLETED"
                    ? "bg-status-success/10 text-status-success"
                    : step.status === "CURRENT"
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}>
                  {step.status}
                </span>
              </div>

              {step.remarks && (
                <p className="text-[10px] bg-surface-container-low p-2 rounded-lg text-on-surface-variant italic">
                  "{step.remarks}"
                </p>
              )}

              {step.timestamp && (
                <p className="text-[9px] text-on-surface-variant/70">
                  {new Date(step.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
