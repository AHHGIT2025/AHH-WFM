"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Calendar, ArrowRight, ArrowLeft } from "lucide-react";

interface StepPreviewSummaryProps {
  previewData: any;
  onNext: () => void;
  onBack: () => void;
}

export const StepPreviewSummary: React.FC<StepPreviewSummaryProps> = ({
  previewData,
  onNext,
  onBack
}) => {
  if (!previewData) {
    return (
      <div className="p-8 text-center text-secondary">
        Generating preview data...
      </div>
    );
  }

  const {
    mode,
    fromDate,
    toDate,
    requestedCount,
    matchingVacantSlots,
    eligibleCount,
    skippedCount,
    unfilledSeriesCount,
    unusedEmployeeCount,
    results = []
  } = previewData;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-base font-bold text-foreground">Step 5 — Preview Deployment Summary</h4>
        <p className="text-xs text-secondary mt-1">
          Review candidate deployment combinations and per-date eligibility check outcomes before confirming.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-outline-variant bg-surface-variant/10">
          <span className="text-secondary font-medium block">Selected Period</span>
          <span className="font-bold text-foreground mt-1 block truncate">
            {fromDate} to {toDate}
          </span>
        </div>

        <div className="p-3 rounded-xl border border-outline-variant bg-surface-variant/10">
          <span className="text-secondary font-medium block">Candidates / Vacant Slots</span>
          <span className="font-bold text-foreground mt-1 block">
            {requestedCount} candidates / {matchingVacantSlots} slots
          </span>
        </div>

        <div className="p-3 rounded-xl border border-success/20 bg-success/10">
          <span className="text-success font-semibold block">Eligible Assignments</span>
          <span className="font-extrabold text-success text-base mt-0.5 block">
            {eligibleCount}
          </span>
        </div>

        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10">
          <span className="text-amber-700 font-semibold block">Skipped Combinations</span>
          <span className="font-extrabold text-amber-700 text-base mt-0.5 block">
            {skippedCount}
          </span>
        </div>
      </div>

      {/* Per-Date Results Table */}
      <div className="border border-outline-variant rounded-xl overflow-hidden bg-background">
        <div className="p-3 border-b border-outline-variant bg-surface-variant/20 font-bold text-xs text-foreground flex justify-between">
          <span>Per-Date Candidate Combination Details ({results.length})</span>
          <span>{eligibleCount} Eligible / {skippedCount} Skipped</span>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-outline-variant text-xs">
          {results.map((res: any, idx: number) => {
            const isEligible = res.status === "ELIGIBLE";

            return (
              <div key={idx} className="p-3 flex items-start justify-between hover:bg-surface-variant/10">
                <div className="space-y-0.5">
                  <div className="font-bold text-foreground flex items-center gap-2">
                    <span>{res.date}</span>
                    <span className="text-secondary">•</span>
                    <span className="text-primary font-semibold">{res.employeeName}</span>
                  </div>
                  <div className="text-[11px] text-secondary">
                    {res.siteName} • {res.postName} • {res.shiftName} (Slot {res.slotIndex})
                  </div>
                </div>

                <div className="text-right shrink-0 ml-4">
                  {isEligible ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                      <CheckCircle2 className="h-3 w-3" /> Eligible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/20">
                      <AlertCircle className="h-3 w-3" /> {res.reasonCode}
                    </span>
                  )}
                  <p className="text-[10px] text-secondary mt-0.5 max-w-xs truncate">{res.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="border border-outline text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-surface-variant flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 flex items-center gap-2"
        >
          Next: Confirm Deployment <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
