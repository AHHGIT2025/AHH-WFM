"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";

interface StepConfirmationProps {
  previewData: any;
  previewToken: string;
  allowPartial: boolean;
  setAllowPartial: (allow: boolean) => void;
  submitting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export const StepConfirmation: React.FC<StepConfirmationProps> = ({
  previewData,
  previewToken,
  allowPartial,
  setAllowPartial,
  submitting,
  onConfirm,
  onBack
}) => {
  const eligibleCount = previewData?.eligibleCount || 0;
  const skippedCount = previewData?.skippedCount || 0;
  const requestedCount = previewData?.requestedCount || 0;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-base font-bold text-foreground">Step 6 — Confirm Bulk Deployment</h4>
        <p className="text-xs text-secondary mt-1">
          Review deployment policy and confirm execution. This operation will commit valid assignments in a single transaction.
        </p>
      </div>

      {/* Deployment Policy Choice */}
      <div className="p-4 rounded-xl border border-outline-variant bg-surface-variant/10 space-y-4">
        <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">Deployment Policy</h5>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="policy"
              checked={allowPartial}
              onChange={() => setAllowPartial(true)}
              className="mt-1 text-primary focus:ring-primary"
            />
            <div>
              <span className="font-bold text-sm text-foreground block">Partial Deployment (Recommended)</span>
              <span className="text-xs text-secondary block mt-0.5">
                Deploy only the {eligibleCount} eligible candidate combinations. The {skippedCount} skipped combinations will remain vacant.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="policy"
              checked={!allowPartial}
              onChange={() => setAllowPartial(false)}
              className="mt-1 text-primary focus:ring-primary"
            />
            <div>
              <span className="font-bold text-sm text-foreground block">Strict Deployment (All-or-Nothing)</span>
              <span className="text-xs text-secondary block mt-0.5">
                Require 100% of candidate combinations ({requestedCount}) to be eligible. If any combination is skipped, 0 assignments will be created.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Confirmation Warning Box */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>Final Confirmation Notice</span>
        </div>
        <p>
          {allowPartial
            ? `${eligibleCount} of ${requestedCount} candidate assignments are eligible. ${skippedCount} combinations will be skipped.`
            : `All ${requestedCount} candidate assignments must be eligible. If any combination is skipped, the entire deployment will fail.`}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={submitting}
          onClick={onBack}
          className="border border-outline text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-surface-variant flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          disabled={submitting || (eligibleCount === 0 && allowPartial)}
          onClick={onConfirm}
          className="bg-primary text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Committing Deployment...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {allowPartial ? `Deploy ${eligibleCount} Eligible Assignments` : "Deploy All Assignments"}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
