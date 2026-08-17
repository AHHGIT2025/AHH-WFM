"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const approvalId = params.id as string;

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action State
  const [remarks, setRemarks] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [modalAction, setModalAction] = useState<"APPROVE" | "RETURN" | "REJECT" | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/approvals/${approvalId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load approval details");
      }
      const json = await res.json();
      if (json.success && json.data) {
        setDetail(json.data);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load approval record");
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const executeAction = async (action: "APPROVE" | "RETURN" | "REJECT") => {
    if ((action === "RETURN" || action === "REJECT") && !remarks.trim()) {
      setActionMessage({ type: "error", text: `Remarks are mandatory when choosing ${action}.` });
      return;
    }

    setActionPending(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/approvals/${approvalId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, remarks })
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.error || "Failed to record approval action");
      }

      setActionMessage({ type: "success", text: `Workflow step successfully ${action === "APPROVE" ? "approved" : action === "RETURN" ? "returned for correction" : "rejected"}.` });
      setModalAction(null);
      setRemarks("");
      // Reload updated detail
      await loadDetail();
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "An unexpected error occurred." });
    } finally {
      setActionPending(false);
    }
  };

  const getBadgeVariant = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "APPROVED" || s === "COMPLETED") return "success";
    if (s === "REJECTED") return "error";
    if (s === "RETURNED" || s === "RETURNED_FOR_CORRECTION" || s === "IN_PROGRESS" || s === "CURRENT") return "warning";
    return "neutral";
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center space-y-3">
        <div className="animate-spin inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
        <p className="text-xs text-on-surface-variant">Loading approval case...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <Card className="p-6 border-status-error bg-status-error/5 text-center space-y-3">
          <span className="material-symbols-outlined text-status-error text-3xl">error</span>
          <h2 className="text-sm font-bold text-status-error">Unable to Load Approval</h2>
          <p className="text-xs text-on-surface-variant">{error || "Approval request not found or access denied."}</p>
          <Link href="/approvals">
            <Button size="sm" variant="secondary">Back to Approval Center</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { instance, requestSummary, businessSummary, myAction, currentApproval, nextApproval, lifecycle, canAct, sourceDeepLink } = detail;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/approvals" className="hover:text-primary transition-colors flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Approval Center</span>
            </Link>
            <span>/</span>
            <span className="font-mono">{requestSummary.reference}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-primary tracking-tight">{requestSummary.title}</h1>
            <Badge variant="neutral" className="text-xs uppercase font-bold py-0.5 px-2">
              {instance.moduleType}
            </Badge>
            <Badge variant={getBadgeVariant(instance.status)} className="text-xs font-bold py-0.5 px-2">
              {instance.status}
            </Badge>
          </div>
        </div>

        {/* Source Link */}
        {sourceDeepLink && (
          <Link href={sourceDeepLink} target="_blank">
            <Button size="sm" variant="secondary" className="text-xs font-semibold flex items-center gap-1">
              <span>Open Source Console</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${actionMessage.type === "success" ? "bg-status-success/10 text-status-success border border-status-success/30" : "bg-status-error/10 text-status-error border border-status-error/30"}`}>
          <span className="material-symbols-outlined text-base">{actionMessage.type === "success" ? "check_circle" : "error"}</span>
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* 2-Column Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Request Info & Business Data (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Header Card */}
          <Card className="p-5 border border-border-subtle bg-surface-container-lowest space-y-4">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border-subtle pb-2">
              Request Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Reference ID</span>
                <span className="font-mono font-bold text-on-surface">{requestSummary.reference}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Requester</span>
                <span className="font-medium text-on-surface">{requestSummary.requesterName}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Submitted Date</span>
                <span className="text-on-surface">{new Date(requestSummary.submittedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Operating Company</span>
                <span className="text-on-surface font-medium">{requestSummary.companyName}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Workflow Template</span>
                <span className="text-on-surface">{instance.workflowName || "Standard Workflow"}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Current Stage</span>
                <span className="font-bold text-primary">{currentApproval.levelName || `Level ${currentApproval.levelNumber}`}</span>
              </div>
            </div>
          </Card>

          {/* Business Details Card */}
          <Card className="p-5 border border-border-subtle bg-surface-container-lowest space-y-4">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border-subtle pb-2">
              Business Key Attributes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {businessSummary.map((field: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-surface-container-low border border-border-subtle flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant font-medium">{field.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">{field.value}</span>
                    {field.badge && (
                      <Badge variant={getBadgeVariant(field.badge)} className="text-[10px] py-0 px-1.5 font-bold">
                        {field.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* My Action Card (If Previously Actioned) */}
          {myAction && (
            <Card className="p-5 border border-status-success/30 bg-status-success/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-status-success text-xl">check_circle</span>
                  <h3 className="text-xs font-bold text-status-success uppercase tracking-wider">Your Recorded Action</h3>
                </div>
                <Badge variant={getBadgeVariant(myAction.action)} className="text-xs font-bold">
                  {myAction.action}
                </Badge>
              </div>
              <p className="text-xs text-on-surface-variant">
                You executed <strong className="text-on-surface">{myAction.action}</strong> on {new Date(myAction.actionAt).toLocaleString()}.
              </p>
              {myAction.remarks && (
                <div className="p-2 rounded bg-surface-container-lowest border border-border-subtle text-xs text-on-surface italic">
                  "{myAction.remarks}"
                </div>
              )}
            </Card>
          )}

          {/* Action Control Panel (If User canAct) */}
          {canAct && (
            <Card className="p-5 border-2 border-primary/40 bg-surface-container-lowest space-y-4 shadow-md">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                <span className="material-symbols-outlined text-primary text-xl">gavel</span>
                <div>
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Decision Action Panel</h3>
                  <p className="text-[11px] text-on-surface-variant">You are the designated authorized approver for this active stage.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface block">
                  Remarks / Audit Justification:
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter approval comments, return instructions, or rejection reasons..."
                  className="w-full text-xs p-3 bg-surface-container-low border border-border-subtle rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionPending}
                  onClick={() => setModalAction("RETURN")}
                  className="text-xs font-bold text-status-warning border-status-warning/40 hover:bg-status-warning/10"
                >
                  <span className="material-symbols-outlined text-sm mr-1">undo</span>
                  <span>Return for Correction</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionPending}
                  onClick={() => setModalAction("REJECT")}
                  className="text-xs font-bold text-status-error border-status-error/40 hover:bg-status-error/10"
                >
                  <span className="material-symbols-outlined text-sm mr-1">cancel</span>
                  <span>Reject Request</span>
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  disabled={actionPending}
                  onClick={() => setModalAction("APPROVE")}
                  className="text-xs font-bold bg-status-success hover:bg-status-success/90 text-white"
                >
                  <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
                  <span>Approve Stage</span>
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Audit Trail & Lifecycle Timeline (1 col) */}
        <div className="space-y-6">
          {/* Active Level Card */}
          <Card className="p-4 border border-border-subtle bg-surface-container-lowest space-y-3">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border-subtle pb-2">
              Workflow Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-medium">Stage:</span>
                <span className="font-bold text-on-surface">{currentApproval.levelName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-medium">Rule:</span>
                <Badge variant="neutral" className="text-[10px] font-bold">{currentApproval.approvalRule}</Badge>
              </div>
              <div className="pt-2 border-t border-border-subtle">
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block mb-1">
                  Designated Approvers:
                </span>
                <div className="space-y-1">
                  {currentApproval.currentPendingApprovers?.map((ap: any, i: number) => (
                    <div key={i} className="text-xs font-semibold text-on-surface flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-primary">person</span>
                      <span>{ap.name}</span>
                      {ap.role && <span className="text-[10px] text-on-surface-variant font-normal">({ap.role})</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Vertical Lifecycle Timeline */}
          <Card className="p-4 border border-border-subtle bg-surface-container-lowest space-y-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border-subtle pb-2 flex items-center justify-between">
              <span>Complete Lifecycle</span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">timeline</span>
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
              {lifecycle.map((step: any, idx: number) => {
                const isDone = step.status === "COMPLETED" || step.status === "APPROVED";
                const isCurrent = step.status === "CURRENT";
                const isRejected = step.status === "REJECTED";
                const isReturned = step.status === "RETURNED";

                return (
                  <div key={idx} className="relative text-xs">
                    {/* Node Icon */}
                    <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center border text-[10px] ${
                      isDone
                        ? "bg-status-success text-white border-status-success"
                        : isRejected
                        ? "bg-status-error text-white border-status-error"
                        : isReturned
                        ? "bg-status-warning text-white border-status-warning"
                        : isCurrent
                        ? "bg-primary text-white border-primary animate-pulse"
                        : "bg-surface-container text-on-surface-variant border-border-subtle"
                    }`}>
                      {isDone ? "✓" : isRejected ? "✕" : isReturned ? "↺" : step.stepNumber}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isCurrent ? "text-primary" : "text-on-surface"}`}>
                          {step.title}
                        </span>
                        {step.status && (
                          <Badge variant={getBadgeVariant(step.status)} className="text-[9px] py-0 px-1 font-bold">
                            {step.status}
                          </Badge>
                        )}
                      </div>

                      <p className="text-[11px] text-on-surface-variant">
                        Actor: <strong className="text-on-surface">{step.actor}</strong>
                      </p>

                      {step.timestamp && (
                        <p className="text-[10px] text-on-surface-variant">
                          {new Date(step.timestamp).toLocaleString()}
                        </p>
                      )}

                      {step.remarks && (
                        <p className="text-[11px] text-on-surface bg-surface-container-low p-1.5 rounded border border-border-subtle italic mt-1">
                          "{step.remarks}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <Card className="max-w-md w-full p-6 space-y-4 border border-border-subtle bg-surface-container-lowest shadow-2xl">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-2xl ${modalAction === "APPROVE" ? "text-status-success" : modalAction === "RETURN" ? "text-status-warning" : "text-status-error"}`}>
                {modalAction === "APPROVE" ? "check_circle" : modalAction === "RETURN" ? "undo" : "cancel"}
              </span>
              <h3 className="text-sm font-bold text-on-surface">
                Confirm {modalAction === "APPROVE" ? "Approval" : modalAction === "RETURN" ? "Return for Correction" : "Rejection"}
              </h3>
            </div>

            <p className="text-xs text-on-surface-variant">
              Are you sure you want to <strong>{modalAction}</strong> request <strong>{requestSummary.reference}</strong>? This decision will be permanently recorded in the immutable audit trail.
            </p>

            {remarks && (
              <div className="p-2 rounded bg-surface-container-low text-xs text-on-surface italic border border-border-subtle">
                "{remarks}"
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button
                size="sm"
                variant="secondary"
                disabled={actionPending}
                onClick={() => setModalAction(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={actionPending}
                onClick={() => executeAction(modalAction)}
                className={`font-bold ${modalAction === "APPROVE" ? "bg-status-success text-white" : modalAction === "RETURN" ? "bg-status-warning text-white" : "bg-status-error text-white"}`}
              >
                {actionPending ? "Executing..." : `Confirm ${modalAction}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
