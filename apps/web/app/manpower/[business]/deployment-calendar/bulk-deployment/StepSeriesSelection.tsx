"use client";

import React from "react";
import { CheckSquare, Square, ArrowRight, ArrowLeft } from "lucide-react";

export interface RequirementSeriesItem {
  seriesId: string;
  contractId: string;
  projectId: string;
  siteId: string;
  shiftRequirementId?: string;
  locationUnitId?: string;
  snapshotPosition: string;
  snapshotShiftName: string;
  slotIndex: number;
  line1: string;
  line2: string;
  siteName: string;
  postOrZone: string;
  vacantSlotCount: number;
}

interface StepSeriesSelectionProps {
  availableSeries: RequirementSeriesItem[];
  selectedSeriesIds: string[];
  setSelectedSeriesIds: (ids: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const StepSeriesSelection: React.FC<StepSeriesSelectionProps> = ({
  availableSeries,
  selectedSeriesIds,
  setSelectedSeriesIds,
  onNext,
  onBack
}) => {
  const isAllSelected = availableSeries.length > 0 && selectedSeriesIds.length === availableSeries.length;

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedSeriesIds([]);
    } else {
      setSelectedSeriesIds(availableSeries.map((s) => s.seriesId));
    }
  };

  const toggleSeries = (id: string) => {
    if (selectedSeriesIds.includes(id)) {
      setSelectedSeriesIds(selectedSeriesIds.filter((item) => item !== id));
    } else {
      setSelectedSeriesIds([...selectedSeriesIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-foreground">Step 2 — Select Requirement Series</h4>
          <p className="text-xs text-secondary mt-1">
            Select one or multiple vacant Post/Shift/Slot requirement series rows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {isAllSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2 border border-outline-variant rounded-xl p-3 bg-background">
        {availableSeries.length === 0 ? (
          <div className="p-8 text-center text-xs text-secondary">
            No vacant requirement series found in current filter view.
          </div>
        ) : (
          availableSeries.map((item) => {
            const isChecked = selectedSeriesIds.includes(item.seriesId);

            return (
              <div
                key={item.seriesId}
                onClick={() => toggleSeries(item.seriesId)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  isChecked
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-outline hover:border-primary/40 bg-surface"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary">
                    {isChecked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-secondary" />}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">{item.line1}</h5>
                    <p className="text-xs text-secondary mt-0.5">{item.line2}</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-secondary/10 text-secondary">
                  {item.vacantSlotCount} vacant slots
                </span>
              </div>
            );
          })
        )}
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
          disabled={selectedSeriesIds.length === 0}
          onClick={onNext}
          className="bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next: Select Manpower ({selectedSeriesIds.length}) <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
