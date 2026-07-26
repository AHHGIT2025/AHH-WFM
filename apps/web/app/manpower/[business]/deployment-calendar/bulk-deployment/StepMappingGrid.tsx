"use client";

import React from "react";
import { RequirementSeriesItem } from "./StepSeriesSelection";
import { EmployeeItem } from "./StepEmployeeSelection";
import { Sliders, RefreshCw, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";

export interface MappingPair {
  employeeId: string;
  targetSeriesIndex: number;
}

interface StepMappingGridProps {
  strategy: "MANUAL_MAPPING" | "AUTO_FILL";
  setStrategy: (strat: "MANUAL_MAPPING" | "AUTO_FILL") => void;
  selectedSeries: RequirementSeriesItem[];
  selectedEmployees: EmployeeItem[];
  mappings: MappingPair[];
  setMappings: (mappings: MappingPair[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const StepMappingGrid: React.FC<StepMappingGridProps> = ({
  strategy,
  setStrategy,
  selectedSeries,
  selectedEmployees,
  mappings,
  setMappings,
  onNext,
  onBack
}) => {
  const handleAutoFill = () => {
    setStrategy("AUTO_FILL");
    const count = Math.min(selectedSeries.length, selectedEmployees.length);
    const newMappings: MappingPair[] = [];
    for (let i = 0; i < count; i++) {
      newMappings.push({
        employeeId: selectedEmployees[i].id,
        targetSeriesIndex: i
      });
    }
    setMappings(newMappings);
  };

  const handleManualMapChange = (seriesIndex: number, employeeId: string) => {
    setStrategy("MANUAL_MAPPING");
    const existingIndex = mappings.findIndex((m) => m.targetSeriesIndex === seriesIndex);
    if (!employeeId) {
      if (existingIndex !== -1) {
        setMappings(mappings.filter((_, idx) => idx !== existingIndex));
      }
    } else {
      if (existingIndex !== -1) {
        const next = [...mappings];
        next[existingIndex] = { employeeId, targetSeriesIndex: seriesIndex };
        setMappings(next);
      } else {
        setMappings([...mappings, { employeeId, targetSeriesIndex: seriesIndex }]);
      }
    }
  };

  const mappedEmployeeIds = new Set(mappings.map((m) => m.employeeId));
  const unfilledSeriesCount = Math.max(0, selectedSeries.length - mappings.length);
  const unusedEmployeeCount = Math.max(0, selectedEmployees.length - mappedEmployeeIds.size);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-foreground">Step 4 — Map Employees to Vacancy Series</h4>
          <p className="text-xs text-secondary mt-1">
            Choose whether to map employees manually or run deterministic Auto-Fill.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoFill}
            className="bg-secondary/10 hover:bg-secondary/20 text-foreground font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Auto-Fill Mappings
          </button>
        </div>
      </div>

      {/* Warnings */}
      {(unfilledSeriesCount > 0 || unusedEmployeeCount > 0) && (
        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 space-y-1 text-xs text-amber-700">
          {unfilledSeriesCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span><strong>Notice:</strong> {unfilledSeriesCount} requirement series will remain unfilled.</span>
            </div>
          )}
          {unusedEmployeeCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span><strong>Notice:</strong> {unusedEmployeeCount} selected employees will not be assigned.</span>
            </div>
          )}
        </div>
      )}

      {/* Mapping Table */}
      <div className="border border-outline-variant rounded-xl overflow-hidden bg-background">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-variant/30 border-b border-outline-variant font-bold text-foreground">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Target Vacancy Series</th>
              <th className="p-3">Position & Shift</th>
              <th className="p-3">Mapped Employee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {selectedSeries.map((series, idx) => {
              const currentMapping = mappings.find((m) => m.targetSeriesIndex === idx);
              const selectedEmpId = currentMapping?.employeeId || "";

              return (
                <tr key={series.seriesId} className="hover:bg-surface-variant/10">
                  <td className="p-3 font-bold text-secondary">{idx + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-foreground">{series.line1}</div>
                    <div className="text-[11px] text-secondary">{series.siteName}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-foreground">{series.snapshotPosition}</div>
                    <div className="text-[11px] text-secondary">{series.snapshotShiftName} (Slot {series.slotIndex})</div>
                  </td>
                  <td className="p-3">
                    <select
                      value={selectedEmpId}
                      onChange={(e) => handleManualMapChange(idx, e.target.value)}
                      className="w-full bg-background border border-outline rounded-lg h-9 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Unassigned --</option>
                      {selectedEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.id})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          disabled={mappings.length === 0}
          onClick={onNext}
          className="bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next: Generate Preview ({mappings.length} Mapped) <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
