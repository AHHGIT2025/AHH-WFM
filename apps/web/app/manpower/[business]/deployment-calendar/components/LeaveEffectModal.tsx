"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@ahh-wfm/ui/src";
import { AlertTriangle, Calendar, ShieldAlert } from "lucide-react";
import {
  resolveEmployeeTradePosition,
  resolveRosterDateStr
} from "@/lib/roster-display-utils";

interface LeaveEffectModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryAssignment: any;
  slot?: any;
  employee?: any;
  onSuccess: () => void;
  periodLocked: boolean;
}

export const LeaveEffectModal: React.FC<LeaveEffectModalProps> = ({
  isOpen,
  onClose,
  primaryAssignment,
  slot,
  employee,
  onSuccess,
  periodLocked
}) => {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [selectedLeaveId, setSelectedLeaveId] = useState("");
  const [reason, setReason] = useState("");
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen && resolvedEmployeeId) {
      fetchLeaves(resolvedEmployeeId);
    }
  }, [isOpen, resolvedEmployeeId]);

  const fetchLeaves = async (empId: string) => {
    setLoadingLeaves(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/manpower/leaves?employeeId=${empId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setLeaveRequests(json.leaveRequests || []);
        if (json.leaveRequests?.length > 0) {
          setSelectedLeaveId(json.leaveRequests[0].id);
        }
      } else {
        setError(json.error || "Failed to load leave requests");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch leave requests");
    } finally {
      setLoadingLeaves(false);
    }
  };

  if (!isOpen) return null;

  const designationName = resolveEmployeeTradePosition(resolvedEmployee);
  const formattedDate = resolveRosterDateStr(resolvedBusinessDate);
  const employeeName = resolvedEmployee?.name || primaryAssignment?.employeeName || "Employee";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isContextReady) {
      setError("Unable to load the employee or roster slot details. Please close this window and try again.");
      return;
    }
    if (!selectedLeaveId) {
      setError("Matching approved leave request must be selected.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is mandatory.");
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
          exceptionType: "LEAVE_EFFECT",
          primaryAssignmentIds: [primaryAssignment.id],
          slotId: resolvedSlotId,
          employeeId: resolvedEmployeeId,
          businessDate: resolvedBusinessDate,
          leaveRequestId: selectedLeaveId,
          reason: reason.trim()
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setReason("");
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to record Leave Effect exception.");
      }
    } catch (err: any) {
      setError(err.message || "Network error submitting Leave Effect.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-outline-variant rounded-xl shadow-2xl max-w-md w-full z-10 overflow-hidden flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-secondary" />
            <h3 className="text-lg font-bold text-foreground">Record Leave Effect</h3>
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
                <span className="text-xs text-secondary font-medium">Date:</span>
                <span className="font-semibold text-secondary">{formattedDate}</span>
              </div>
            </div>
          )}

          {isContextReady && (
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                Select Approved Leave Request <span className="text-destructive">*</span>
              </label>
              {loadingLeaves ? (
                <div className="text-xs text-secondary py-2">Loading approved leave requests...</div>
              ) : leaveRequests.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg text-xs">
                  No approved leave requests found for this employee covering this date. Approved leave is required before recording Leave Effect.
                </div>
              ) : (
                <select
                  value={selectedLeaveId}
                  onChange={(e) => setSelectedLeaveId(e.target.value)}
                  className="w-full bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={submitting || periodLocked}
                >
                  {leaveRequests.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.type} ({new Date(l.startDate).toISOString().split("T")[0]} to {new Date(l.endDate).toISOString().split("T")[0]})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">
              Reason / Remarks <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter remarks for recording Leave Effect..."
              className="w-full bg-background border border-outline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={!isContextReady || submitting || periodLocked}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!isContextReady || submitting || periodLocked || leaveRequests.length === 0}>
              {submitting ? "Recording..." : "Confirm Leave Effect"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
