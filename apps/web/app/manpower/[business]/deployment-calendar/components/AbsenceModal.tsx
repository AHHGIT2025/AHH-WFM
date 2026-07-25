"use client";

import React, { useState } from "react";
import { Button } from "@ahh-wfm/ui/src";
import { AlertTriangle, ShieldAlert, UserX } from "lucide-react";
import {
  resolveEmployeeTradePosition,
  resolveRosterShiftName,
  resolveRosterShiftTimes,
  resolveRosterDateStr
} from "@/lib/roster-display-utils";

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryAssignment: any;
  slot?: any;
  employee?: any;
  onSuccess: () => void;
  periodLocked: boolean;
}

export const AbsenceModal: React.FC<AbsenceModalProps> = ({
  isOpen,
  onClose,
  primaryAssignment,
  slot,
  employee,
  onSuccess,
  periodLocked
}) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Authoritative Context Resolution
  const resolvedEmployee = employee ?? primaryAssignment?.employee ?? null;
  const resolvedSlot = slot ?? primaryAssignment?.slot ?? null;
  const resolvedSlotId = resolvedSlot?.id ?? primaryAssignment?.slotId ?? null;
  const resolvedEmployeeId = resolvedEmployee?.id ?? primaryAssignment?.employeeId ?? null;
  const resolvedBusinessDate = resolvedSlot?.businessDate ?? primaryAssignment?.businessDate ?? null;

  const isContextReady = Boolean(
    primaryAssignment?.id &&
    resolvedSlotId &&
    resolvedEmployeeId &&
    resolvedBusinessDate
  );

  const designationName = resolveEmployeeTradePosition(resolvedEmployee);
  const shiftName = resolveRosterShiftName(resolvedSlot);
  const shiftTimes = resolveRosterShiftTimes(resolvedSlot);
  const formattedDate = resolveRosterDateStr(resolvedBusinessDate);
  const employeeName = resolvedEmployee?.name || primaryAssignment?.employeeName || "Employee";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isContextReady) {
      setError("Unable to load the employee or roster slot details. Please close this window and try again.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is mandatory for recording Absence.");
      return;
    }
    if (periodLocked) {
      setError("Period is locked. Action not allowed.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/manpower/scheduling/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exceptionType: "ABSENT",
          primaryAssignmentIds: [primaryAssignment.id],
          slotId: resolvedSlotId,
          employeeId: resolvedEmployeeId,
          businessDate: resolvedBusinessDate,
          reason: reason.trim()
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setReason("");
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to record Absence exception.");
      }
    } catch (err: any) {
      setError(err.message || "Network error submitting Absence.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-outline-variant rounded-xl shadow-2xl max-w-md w-full z-10 overflow-hidden flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-2 text-destructive">
            <UserX className="h-5 w-5" />
            <h3 className="text-lg font-bold text-foreground">Mark Unplanned Absence</h3>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-foreground">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm text-foreground">
          {!isContextReady && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Unable to load the employee or roster slot details. Please close this window and try again.</span>
            </div>
          )}

          {periodLocked && isContextReady && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>This period is locked. Write actions are prohibited.</span>
            </div>
          )}

          {error && isContextReady && (
            <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isContextReady && (
            <div className="bg-background border border-outline p-3 rounded-lg space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-secondary font-medium">Employee:</span>
                <span className="font-semibold">{employeeName} ({resolvedEmployeeId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-secondary font-medium">Trade/Position:</span>
                <span>{designationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-secondary font-medium">Shift:</span>
                <span>{shiftName} {shiftTimes ? `(${shiftTimes})` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-secondary font-medium">Date:</span>
                <span className="font-semibold text-destructive">{formattedDate}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">
              Mandatory Absence Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for absence (e.g. Unannounced No-Show, Emergency)..."
              className="w-full bg-background border border-outline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={!isContextReady || submitting || periodLocked}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="error" type="submit" disabled={!isContextReady || submitting || periodLocked}>
              {submitting ? "Recording..." : "Confirm Absence"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
