"use client";

import React, { useState } from "react";
import { X, AlertTriangle, CheckCircle2, UserMinus, ArrowLeft, Loader2, Info } from "lucide-react";
import { Button } from "@ahh-wfm/ui/src";

interface BulkUnassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string | null;
  mode: "SINGLE_DAY" | "ENTIRE_ASSIGNMENT_PERIOD";
  onSuccess: (summary: string) => void;
}

const REASON_OPTIONS = [
  { code: "EMPLOYEE_TRANSFERRED", label: "Employee Transferred" },
  { code: "EMPLOYEE_UNAVAILABLE", label: "Employee Unavailable" },
  { code: "SCHEDULE_CORRECTION", label: "Schedule Correction" },
  { code: "CREATED_IN_ERROR", label: "Assignment Created in Error" },
  { code: "REQUIREMENT_CHANGED", label: "Contract / Site Requirement Changed" },
  { code: "OPERATIONAL_REPLACEMENT", label: "Operational Replacement" },
  { code: "OTHER", label: "Other (Requires Notes)" }
];

export const BulkUnassignmentModal: React.FC<BulkUnassignmentModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  mode,
  onSuccess
}) => {
  const [step, setStep] = useState<number>(1);
  const [reasonCode, setReasonCode] = useState<string>("SCHEDULE_CORRECTION");
  const [reasonNotes, setReasonNotes] = useState<string>("");
  const [allowPartial, setAllowPartial] = useState<boolean>(mode === "SINGLE_DAY"); // Default STRICT for ENTIRE_PERIOD

  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [submittingConfirm, setSubmittingConfirm] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [previewData, setPreviewData] = useState<any>(null);
  const [previewToken, setPreviewToken] = useState<string>("");

  if (!isOpen || !assignmentId) return null;

  // Step 1 -> 2: Generate Preview
  const handleGeneratePreview = async () => {
    if (reasonCode === "OTHER" && !reasonNotes.trim()) {
      setErrorMessage("Please enter notes explaining the reason when 'Other' is selected.");
      return;
    }

    setLoadingPreview(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/v1/manpower/scheduling/bulk-unassignment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          mode,
          reasonCode,
          reasonNotes,
          policy: allowPartial ? "PARTIAL" : "STRICT"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate unassignment preview");
      }

      setPreviewData(data);
      setPreviewToken(data.previewToken);
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Step 2 -> Execute Confirmation
  const handleConfirmUnassignment = async () => {
    setSubmittingConfirm(true);
    setErrorMessage("");

    try {
      const idempotencyKey = `unasg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch("/api/v1/manpower/scheduling/bulk-unassignment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewToken,
          idempotencyKey,
          allowPartial
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm unassignment");
      }

      const summaryText = `${data.unassignedCount} assignment(s) unassigned. ${data.blockedCount} blocked.`;
      onSuccess(summaryText);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to confirm unassignment");
    } finally {
      setSubmittingConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="border-b border-outline-variant p-4 flex items-center justify-between bg-surface">
          <div>
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-destructive" />
              {mode === "SINGLE_DAY" ? "Unassign Single Day" : "Unassign Entire Assignment Period"}
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              {mode === "SINGLE_DAY" ? "Deactivate assignment for the selected date only" : "Deactivate linked assignments across the full deployment range"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
            {errorMessage}
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Reason for Unassignment <span className="text-destructive">*</span>
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full bg-surface-variant/20 border border-outline-variant rounded-xl p-3 text-xs text-foreground font-medium focus:ring-primary focus:border-primary"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Additional Notes {reasonCode === "OTHER" ? <span className="text-destructive">*</span> : "(Optional)"}
                </label>
                <textarea
                  rows={3}
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  placeholder="Provide context or explanation for audit record..."
                  className="w-full bg-surface-variant/20 border border-outline-variant rounded-xl p-3 text-xs text-foreground font-medium focus:ring-primary focus:border-primary"
                />
              </div>

              {mode === "ENTIRE_ASSIGNMENT_PERIOD" && (
                <div className="p-4 rounded-xl border border-outline-variant bg-surface-variant/10 space-y-3">
                  <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">Unassignment Policy</h5>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="policy"
                        checked={!allowPartial}
                        onChange={() => setAllowPartial(false)}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-bold text-xs text-foreground block">Strict Policy (Recommended for Period)</span>
                        <span className="text-[11px] text-secondary block">
                          Requires ALL period assignments to be eligible. If any single date is locked, published, or attendance-linked, 0 dates will be unassigned.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="policy"
                        checked={allowPartial}
                        onChange={() => setAllowPartial(true)}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-bold text-xs text-foreground block">Partial Policy</span>
                        <span className="text-[11px] text-secondary block">
                          Unassign eligible dates only. Blocked dates (locked/published) will remain active.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" disabled={loadingPreview} onClick={handleGeneratePreview} className="gap-2">
                  {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview Unassignment"}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && previewData && (
            <div className="space-y-6">
              {/* Target Summary */}
              <div className="p-4 rounded-xl border border-outline-variant bg-surface-variant/10 space-y-3">
                <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">Unassignment Summary</h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-secondary block">Employee</span>
                    <span className="font-bold text-foreground block mt-0.5">{previewData.employee.name}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Requirement Series</span>
                    <span className="font-bold text-foreground block mt-0.5">
                      {previewData.requirementSeries.siteName} • {previewData.requirementSeries.postName} ({previewData.requirementSeries.position})
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary block">Period Range</span>
                    <span className="font-bold text-foreground block mt-0.5">{previewData.fromDate} to {previewData.toDate}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Assignments Found</span>
                    <span className="font-bold text-foreground block mt-0.5">
                      {previewData.activeAssignmentsFound} Total ({previewData.eligibleCount} Eligible, {previewData.blockedCount} Blocked)
                    </span>
                  </div>
                </div>
              </div>

              {/* Blocked Notice */}
              {previewData.blockedCount > 0 && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>{previewData.blockedCount} assignment date(s) are blocked</span>
                  </div>
                  <p>
                    {!allowPartial
                      ? "Strict policy is active. Because some dates are blocked, 0 assignments will be unassigned unless policy is switched to Partial or blocked dates are cleared."
                      : `Partial policy will unassign the ${previewData.eligibleCount} eligible date(s). The ${previewData.blockedCount} blocked date(s) will remain active.`}
                  </p>
                </div>
              )}

              {/* Date Results Breakdown */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">Per-Date Eligibility List</h5>
                <div className="border border-outline-variant rounded-xl divide-y divide-outline-variant max-h-48 overflow-y-auto text-xs">
                  {previewData.results.map((r: any) => (
                    <div key={r.assignmentId} className="p-3 flex items-center justify-between">
                      <span className="font-medium text-foreground">{r.businessDate}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-secondary">{r.message}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === "ELIGIBLE" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {r.status === "ELIGIBLE" ? "ELIGIBLE" : r.reasonCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  variant="primary"
                  disabled={submittingConfirm || (previewData.eligibleCount === 0 && allowPartial) || (!allowPartial && previewData.blockedCount > 0)}
                  onClick={handleConfirmUnassignment}
                  className="bg-destructive text-white hover:bg-destructive/90 gap-2"
                >
                  {submittingConfirm ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Unassigning...
                    </>
                  ) : (
                    <>
                      <UserMinus className="h-4 w-4" />
                      {allowPartial
                        ? `Unassign ${previewData.eligibleCount} Eligible Dates`
                        : `Unassign All ${previewData.eligibleCount} Dates`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
