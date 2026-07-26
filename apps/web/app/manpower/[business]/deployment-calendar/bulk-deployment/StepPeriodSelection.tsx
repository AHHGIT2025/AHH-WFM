"use client";

import React from "react";
import { Calendar, ArrowRight } from "lucide-react";

interface StepPeriodSelectionProps {
  mode: "SINGLE_DATE" | "DATE_RANGE" | "FULL_MONTH";
  setMode: (mode: "SINGLE_DATE" | "DATE_RANGE" | "FULL_MONTH") => void;
  singleDate: string;
  setSingleDate: (d: string) => void;
  fromDate: string;
  setFromDate: (d: string) => void;
  toDate: string;
  setToDate: (d: string) => void;
  targetMonth: string;
  setTargetMonth: (m: string) => void;
  onNext: () => void;
}

export const StepPeriodSelection: React.FC<StepPeriodSelectionProps> = ({
  mode,
  setMode,
  singleDate,
  setSingleDate,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  targetMonth,
  setTargetMonth,
  onNext
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-base font-bold text-foreground">Step 1 — Select Deployment Period</h4>
        <p className="text-xs text-secondary mt-1">
          Choose whether to deploy manpower for a single date, a custom date range, or an entire month.
        </p>
      </div>

      {/* Mode Radio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setMode("SINGLE_DATE")}
          className={`p-4 rounded-xl border text-left transition-all ${
            mode === "SINGLE_DATE"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-outline hover:border-primary/40 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-foreground">Single Date</span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs text-secondary">Assign manpower for 1 specific calendar day.</p>
        </button>

        <button
          type="button"
          onClick={() => setMode("DATE_RANGE")}
          className={`p-4 rounded-xl border text-left transition-all ${
            mode === "DATE_RANGE"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-outline hover:border-primary/40 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-foreground">Date Range</span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs text-secondary">Deploy across custom From and To dates (max 62 days).</p>
        </button>

        <button
          type="button"
          onClick={() => setMode("FULL_MONTH")}
          className={`p-4 rounded-xl border text-left transition-all ${
            mode === "FULL_MONTH"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-outline hover:border-primary/40 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-foreground">Full Month</span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs text-secondary">Deploy across all days (1st to last) of target month.</p>
        </button>
      </div>

      {/* Date Pickers based on mode */}
      <div className="p-4 rounded-xl border border-outline-variant bg-surface-variant/10 space-y-4">
        {mode === "SINGLE_DATE" && (
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Target Date</label>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="w-full bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        {mode === "DATE_RANGE" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {mode === "FULL_MONTH" && (
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Target Month (YYYY-MM)</label>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          className="bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 flex items-center gap-2"
        >
          Next: Select Requirement Series <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
