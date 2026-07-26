"use client";

import React, { useState, useMemo } from "react";
import { X, Check } from "lucide-react";
import { StepPeriodSelection } from "./StepPeriodSelection";
import { StepSeriesSelection, RequirementSeriesItem } from "./StepSeriesSelection";
import { StepEmployeeSelection, EmployeeItem } from "./StepEmployeeSelection";
import { StepMappingGrid, MappingPair } from "./StepMappingGrid";
import { StepPreviewSummary } from "./StepPreviewSummary";
import { StepConfirmation } from "./StepConfirmation";

interface BulkDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationType: string;
  contractId: string;
  selectedMonth: string;
  slots: any[];
  employees: any[];
  onSuccess: (summary: string) => void;
}

export const BulkDeploymentModal: React.FC<BulkDeploymentModalProps> = ({
  isOpen,
  onClose,
  operationType,
  contractId,
  selectedMonth,
  slots,
  employees,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [mode, setMode] = useState<"SINGLE_DATE" | "DATE_RANGE" | "FULL_MONTH">("FULL_MONTH");
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [fromDate, setFromDate] = useState<string>(`${selectedMonth}-01`);
  const [toDate, setToDate] = useState<string>(`${selectedMonth}-31`);
  const [targetMonth, setTargetMonth] = useState<string>(selectedMonth || "2026-08");

  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<"MANUAL_MAPPING" | "AUTO_FILL">("AUTO_FILL");
  const [mappings, setMappings] = useState<MappingPair[]>([]);
  const [allowPartial, setAllowPartial] = useState<boolean>(true);

  const [previewData, setPreviewData] = useState<any>(null);
  const [previewToken, setPreviewToken] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [submittingConfirm, setSubmittingConfirm] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Extract unique requirement series from current slots
  const availableSeries = useMemo(() => {
    const map = new Map<string, RequirementSeriesItem>();

    slots.forEach((slot) => {
      const siteName = slot.site?.name || slot.project?.name || "Site Not Specified";
      const locationUnit = slot.shiftRequirement?.locationUnit;
      const postOrZone = locationUnit?.name || "Post Not Specified";
      const line1 = `${siteName} • ${postOrZone}`;
      const line2 = `${slot.snapshotPosition} • ${slot.snapshotShiftName} • Slot ${slot.slotIndex}`;
      const seriesId = `${slot.contractId}-${slot.siteId || "none"}-${slot.snapshotPosition}-${slot.snapshotShiftName}-${slot.slotIndex}`;

      if (!map.has(seriesId)) {
        map.set(seriesId, {
          seriesId,
          contractId: slot.contractId,
          projectId: slot.projectId,
          siteId: slot.siteId,
          shiftRequirementId: slot.shiftRequirementId,
          locationUnitId: locationUnit?.id,
          snapshotPosition: slot.snapshotPosition,
          snapshotShiftName: slot.snapshotShiftName,
          slotIndex: slot.slotIndex,
          line1,
          line2,
          siteName,
          postOrZone,
          vacantSlotCount: 1
        });
      } else {
        const item = map.get(seriesId)!;
        item.vacantSlotCount += 1;
      }
    });

    return Array.from(map.values());
  }, [slots]);

  // Extract available employees
  const availableEmployees = useMemo(() => {
    return employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      operationType: emp.operationType || operationType,
      tradePosition: emp.positionCategory?.name || emp.designation?.name || emp.role || "Security Guard",
      categoryName: emp.employeeCategory,
      isActive: emp.isActive !== false
    }));
  }, [employees, operationType]);

  const selectedSeriesItems = useMemo(() => {
    return availableSeries.filter((s) => selectedSeriesIds.includes(s.seriesId));
  }, [availableSeries, selectedSeriesIds]);

  const selectedEmployeeItems = useMemo(() => {
    return availableEmployees.filter((e) => selectedEmployeeIds.includes(e.id));
  }, [availableEmployees, selectedEmployeeIds]);

  // Handle Step 4 -> 5: Generate Preview
  const handleGeneratePreview = async () => {
    setLoadingPreview(true);
    setErrorMessage("");

    try {
      const payload = {
        operationType,
        contractId: contractId !== "all" ? contractId : undefined,
        mode,
        targetMonth,
        fromDate: mode === "SINGLE_DATE" ? singleDate : (mode === "DATE_RANGE" ? fromDate : undefined),
        toDate: mode === "SINGLE_DATE" ? singleDate : (mode === "DATE_RANGE" ? toDate : undefined),
        targetSeries: selectedSeriesItems.map((s) => ({
          contractId: s.contractId,
          projectId: s.projectId,
          siteId: s.siteId,
          shiftRequirementId: s.shiftRequirementId,
          locationUnitId: s.locationUnitId,
          snapshotPosition: s.snapshotPosition,
          snapshotShiftName: s.snapshotShiftName,
          slotIndex: s.slotIndex
        })),
        employeeIds: selectedEmployeeIds,
        strategy,
        mappings,
        policy: allowPartial ? "PARTIAL" : "STRICT"
      };

      const res = await fetch("/api/v1/manpower/scheduling/bulk-deployment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate bulk deployment preview");
      }

      setPreviewData(data.preview);
      setPreviewToken(data.previewToken);
      setCurrentStep(5);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to generate preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Handle Step 6: Confirm Deployment
  const handleConfirmDeployment = async () => {
    setSubmittingConfirm(true);
    setErrorMessage("");

    try {
      const idempotencyKey = `bulk-deploy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch("/api/v1/manpower/scheduling/bulk-deployment/confirm", {
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
        throw new Error(data.error || "Failed to confirm bulk deployment");
      }

      const summaryText = `${data.createdCount} assignments created. ${data.skippedCount} combinations skipped.`;
      onSuccess(summaryText);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to confirm deployment");
    } finally {
      setSubmittingConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="border-b border-outline-variant p-4 flex items-center justify-between bg-surface">
          <div>
            <h3 className="font-bold text-lg text-foreground">Bulk Deploy Manpower</h3>
            <p className="text-xs text-secondary mt-0.5">Multi-Employee, Multi-Vacancy Scheduling Wizard</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-3 border-b border-outline-variant bg-surface-variant/10 flex items-center justify-between text-xs font-semibold">
          {[
            { num: 1, label: "Period" },
            { num: 2, label: "Series" },
            { num: 3, label: "Manpower" },
            { num: 4, label: "Mapping" },
            { num: 5, label: "Preview" },
            { num: 6, label: "Confirm" }
          ].map((step) => {
            const isDone = currentStep > step.num;
            const isCurrent = currentStep === step.num;

            return (
              <div key={step.num} className="flex items-center gap-2">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isDone
                      ? "bg-success text-white"
                      : isCurrent
                      ? "bg-primary text-white"
                      : "bg-surface-variant text-secondary"
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : step.num}
                </div>
                <span className={isCurrent ? "text-primary font-bold" : isDone ? "text-foreground" : "text-secondary"}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
            {errorMessage}
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {currentStep === 1 && (
            <StepPeriodSelection
              mode={mode}
              setMode={setMode}
              singleDate={singleDate}
              setSingleDate={setSingleDate}
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
              targetMonth={targetMonth}
              setTargetMonth={setTargetMonth}
              onNext={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 2 && (
            <StepSeriesSelection
              availableSeries={availableSeries}
              selectedSeriesIds={selectedSeriesIds}
              setSelectedSeriesIds={setSelectedSeriesIds}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <StepEmployeeSelection
              availableEmployees={availableEmployees}
              selectedEmployeeIds={selectedEmployeeIds}
              setSelectedEmployeeIds={setSelectedEmployeeIds}
              onNext={() => {
                // Default auto fill mappings
                const count = Math.min(selectedSeriesItems.length, selectedEmployeeItems.length);
                const defaultMaps: MappingPair[] = [];
                for (let i = 0; i < count; i++) {
                  defaultMaps.push({ employeeId: selectedEmployeeItems[i].id, targetSeriesIndex: i });
                }
                setMappings(defaultMaps);
                setCurrentStep(4);
              }}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <StepMappingGrid
              strategy={strategy}
              setStrategy={setStrategy}
              selectedSeries={selectedSeriesItems}
              selectedEmployees={selectedEmployeeItems}
              mappings={mappings}
              setMappings={setMappings}
              onNext={handleGeneratePreview}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && (
            <StepPreviewSummary
              previewData={previewData}
              onNext={() => setCurrentStep(6)}
              onBack={() => setCurrentStep(4)}
            />
          )}

          {currentStep === 6 && (
            <StepConfirmation
              previewData={previewData}
              previewToken={previewToken}
              allowPartial={allowPartial}
              setAllowPartial={setAllowPartial}
              submitting={submittingConfirm}
              onConfirm={handleConfirmDeployment}
              onBack={() => setCurrentStep(5)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
