"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Calendar, 
  UserX, 
  UserCheck, 
  UserMinus, 
  XCircle, 
  CheckCircle, 
  ChevronDown,
  Info
} from "lucide-react";

interface CellActionMenuProps {
  slot: any;
  assignment: any; // active assignment (primary or reliever)
  exception: any; // active exception on primary assignment or slot
  onOpenDetails: () => void;
  onOpenDayOff: () => void;
  onOpenLeaveEffect: () => void;
  onOpenAbsent: () => void;
  onOpenAssignReliever: () => void;
  onOpenUnassignReliever: () => void;
  onOpenCancelException: () => void;
  onOpenResolveException: () => void;
  periodLocked: boolean;
}

export const CellActionMenu: React.FC<CellActionMenuProps> = ({
  slot,
  assignment,
  exception,
  onOpenDetails,
  onOpenDayOff,
  onOpenLeaveEffect,
  onOpenAbsent,
  onOpenAssignReliever,
  onOpenUnassignReliever,
  onOpenCancelException,
  onOpenResolveException,
  periodLocked
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isReliever = assignment?.assignmentType === "RELIEVER";
  const isPrimary = assignment?.assignmentType === "PERMANENT" || assignment?.assignmentType === "PRIMARY";
  const hasException = !!exception;
  const exceptionStatus = exception?.status; // "OPEN" | "COVERAGE_REQUIRED" | "RELIEVER_ASSIGNED" | "RESOLVED" | "CANCELLED"

  // Render cell badge / button
  let cellText = "Vacant Slot";
  const employeeName = assignment?.employee?.name || "Employee";

  if (assignment) {
    if (isReliever) {
      cellText = `Reliever: ${employeeName}`;
    } else if (hasException) {
      if (exception.exceptionType === "DAY_OFF") cellText = `Day Off: ${employeeName}`;
      else if (exception.exceptionType === "LEAVE_EFFECT") cellText = `Leave: ${employeeName}`;
      else if (exception.exceptionType === "ABSENT") cellText = `Absent: ${employeeName}`;
      else cellText = `Exception: ${employeeName}`;
    } else {
      cellText = employeeName;
    }
  }

  const slotIndex = slot?.slotIndex ?? 1;

  return (
    <div className="relative inline-block text-left w-full" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-2 text-xs rounded-lg border text-left flex items-center justify-between gap-1 transition-all ${
          assignment
            ? isReliever
              ? "bg-secondary/10 border-secondary/30 text-secondary font-semibold hover:bg-secondary/20"
              : hasException
              ? exception.exceptionType === "ABSENT"
                ? "bg-status-error/10 border-status-error/30 text-status-error font-semibold hover:bg-status-error/20"
                : "bg-status-warning/10 border-status-warning/30 text-status-warning font-semibold hover:bg-status-warning/20"
              : "bg-status-success/10 border-status-success/30 text-status-success font-semibold hover:bg-status-success/20"
            : "bg-background border-dashed border-outline text-secondary hover:bg-surface-container-high"
        }`}
      >
        <span className="truncate">{cellText}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {/* Action Menu Dropdown */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-1 w-56 rounded-xl shadow-2xl bg-surface border border-outline-variant z-50 py-1.5 focus:outline-none">
          <div className="px-3 py-1.5 border-b border-outline-variant text-[11px] text-secondary font-semibold uppercase tracking-wider">
            Actions for Slot #{slotIndex}
          </div>

          <button
            onClick={() => { setIsOpen(false); onOpenDetails(); }}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-surface-container-high flex items-center gap-2"
          >
            <Info className="h-3.5 w-3.5 text-secondary" /> View Slot & Assignment Details
          </button>

          {/* Primary Employee Actions (if assigned & no active exception) */}
          {assignment && isPrimary && !hasException && !periodLocked && (
            <>
              <button
                onClick={() => { setIsOpen(false); onOpenDayOff(); }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-surface-container-high flex items-center gap-2"
              >
                <Calendar className="h-3.5 w-3.5 text-secondary" /> Mark Day Off
              </button>
              <button
                onClick={() => { setIsOpen(false); onOpenLeaveEffect(); }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-surface-container-high flex items-center gap-2"
              >
                <Calendar className="h-3.5 w-3.5 text-purple-600" /> Record Leave Effect
              </button>
              <button
                onClick={() => { setIsOpen(false); onOpenAbsent(); }}
                className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-2"
              >
                <UserX className="h-3.5 w-3.5 text-destructive" /> Mark Absent
              </button>
            </>
          )}

          {/* Exception Coverage Required -> Assign Reliever */}
          {hasException && exceptionStatus === "COVERAGE_REQUIRED" && !periodLocked && (
            <button
              onClick={() => { setIsOpen(false); onOpenAssignReliever(); }}
              className="w-full text-left px-3 py-2 text-xs text-primary font-semibold hover:bg-primary/10 flex items-center gap-2"
            >
              <UserCheck className="h-3.5 w-3.5 text-primary" /> Assign Reliever
            </button>
          )}

          {/* Reliever Assigned -> Unassign Reliever */}
          {isReliever && !periodLocked && (
            <button
              onClick={() => { setIsOpen(false); onOpenUnassignReliever(); }}
              className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <UserMinus className="h-3.5 w-3.5 text-destructive" /> Unassign Reliever
            </button>
          )}

          {/* Exception Cancel / Resolve */}
          {hasException && (exceptionStatus === "OPEN" || exceptionStatus === "COVERAGE_REQUIRED" || exceptionStatus === "RELIEVER_ASSIGNED") && !periodLocked && (
            <>
              <div className="border-t border-outline-variant my-1" />
              <button
                onClick={() => { setIsOpen(false); onOpenCancelException(); }}
                className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-2"
              >
                <XCircle className="h-3.5 w-3.5 text-destructive" /> Cancel Exception
              </button>
              <button
                onClick={() => { setIsOpen(false); onOpenResolveException(); }}
                className="w-full text-left px-3 py-2 text-xs text-success hover:bg-success/10 flex items-center gap-2"
              >
                <CheckCircle className="h-3.5 w-3.5 text-success" /> Resolve Exception
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
