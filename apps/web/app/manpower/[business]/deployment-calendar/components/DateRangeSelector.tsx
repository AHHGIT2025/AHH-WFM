"use client";

import React from "react";
import { Button, Badge } from "@ahh-wfm/ui/src";
import { Calendar, AlertTriangle, Lock } from "lucide-react";

interface DateRangeSelectorProps {
  viewMode: "month" | "custom";
  onViewModeChange: (mode: "month" | "custom") => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  periodLocked: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  viewMode,
  onViewModeChange,
  selectedMonth,
  onMonthChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  periodLocked,
  onRefresh,
  refreshing
}) => {
  // Validate custom date range
  const dateError = React.useMemo(() => {
    if (viewMode !== "custom") return null;
    if (!startDate || !endDate) return "Select both Start Date and End Date.";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return "Start Date cannot be after End Date.";
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    if (diffDays > 31) return `Selected range (${diffDays} days) exceeds maximum limit of 31 calendar days.`;
    return null;
  }, [viewMode, startDate, endDate]);

  return (
    <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-4 flex-1">
        {/* Mode Toggle */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-secondary mb-1">Planning View</label>
          <div className="inline-flex rounded-lg border border-outline p-0.5 bg-background h-10 items-center">
            <button
              type="button"
              onClick={() => onViewModeChange("month")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "month"
                  ? "bg-secondary text-white shadow-sm"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              Month View
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("custom")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "custom"
                  ? "bg-secondary text-white shadow-sm"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Inputs depending on mode */}
        {viewMode === "month" ? (
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-secondary mb-1">Target Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-secondary mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <span className="text-secondary font-medium mt-6">to</span>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-secondary mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Lock status and error message */}
      <div className="flex items-center gap-3">
        {periodLocked && (
          <Badge variant="error" className="h-9 px-3 gap-1.5 flex items-center">
            <Lock className="h-3.5 w-3.5" /> Period Locked (View Only)
          </Badge>
        )}
        {dateError && (
          <Badge variant="warning" className="h-9 px-3 gap-1.5 flex items-center">
            <AlertTriangle className="h-3.5 w-3.5" /> {dateError}
          </Badge>
        )}
      </div>
    </div>
  );
};
