"use client";

import React, { useState, useEffect } from "react";
import { Button, Badge } from "@ahh-wfm/ui/src";
import { 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Search,
  X,
  Info
} from "lucide-react";
import {
  resolveEmployeeTradePosition,
  resolveRosterDateStr
} from "@/lib/roster-display-utils";

interface RelieverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any;
  exception: any;
  primaryAssignment: any;
  onSuccess: () => void;
  periodLocked: boolean;
}

export const RelieverDrawer: React.FC<RelieverDrawerProps> = ({
  isOpen,
  onClose,
  slot,
  exception,
  primaryAssignment,
  onSuccess,
  periodLocked
}) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "ELIGIBLE" | "WARNING" | "BLOCKED">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warning override state
  const [selectedEmpForWarning, setSelectedEmpForWarning] = useState<any | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Authoritative Context Resolution
  const resolvedSlot = slot ?? primaryAssignment?.slot ?? null;
  const resolvedSlotId = resolvedSlot?.id ?? primaryAssignment?.slotId ?? null;
  const resolvedPrimaryAssignmentId = primaryAssignment?.id ?? null;
  const resolvedExceptionId = exception?.id ?? null;

  const isContextReady = Boolean(resolvedSlotId && resolvedPrimaryAssignmentId && resolvedExceptionId);

  useEffect(() => {
    if (isOpen && resolvedSlotId) {
      fetchEligibleEmployees(resolvedSlotId);
    }
  }, [isOpen, resolvedSlotId]);

  const fetchEligibleEmployees = async (slotId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/manpower/scheduling/eligible-employees?slotId=${slotId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setEmployees(json.employees || []);
      } else {
        setError(json.error || "Failed to fetch eligible reliever employees.");
      }
    } catch (e: any) {
      setError(e.message || "Network error fetching relievers.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const primaryEmployee = primaryAssignment?.employee;
  const primaryName = primaryEmployee?.name || primaryAssignment?.employeeName || "Primary Employee";
  const positionName = resolveEmployeeTradePosition(primaryEmployee);
  const formattedDate = resolveRosterDateStr(resolvedSlot?.businessDate ?? primaryAssignment?.businessDate);

  const filteredEmployees = employees.filter((item) => {
    const empName = item?.employee?.name || "";
    const empId = item?.employee?.id || "";
    const matchesSearch =
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empId.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (categoryFilter === "ELIGIBLE") return item.canDeploy && (item.warnings || []).length === 0;
    if (categoryFilter === "WARNING") return item.canDeploy && (item.warnings || []).length > 0;
    if (categoryFilter === "BLOCKED") return !item.canDeploy;
    return true;
  });

  const handleAssignReliever = async (empId: string, requiresOverride = false) => {
    if (!isContextReady) {
      setError("Unable to load the employee or roster slot details. Please close this window and try again.");
      return;
    }
    if (periodLocked) {
      setError("Period is locked. Action not allowed.");
      return;
    }
    if (requiresOverride && !overrideReason.trim()) {
      setError("Override reason is required for warning assignments.");
      return;
    }

    setSubmittingAssign(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/manpower/scheduling/slots/${resolvedSlotId}/assign-reliever`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empId,
          replacesAssignmentId: resolvedPrimaryAssignmentId,
          exceptionId: resolvedExceptionId,
          expectedSlotVersion: resolvedSlot?.rowVersion,
          overrideReason: requiresOverride ? overrideReason.trim() : undefined
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedEmpForWarning(null);
        setOverrideReason("");
        onSuccess();
        onClose();
      } else {
        setError(json.error || "Failed to assign reliever.");
      }
    } catch (err: any) {
      setError(err.message || "Network error assigning reliever.");
    } finally {
      setSubmittingAssign(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-surface border-l border-outline-variant shadow-2xl flex flex-col">
          {/* Header */}
          <header className="p-6 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Assign Reliever Coverage</h2>
              </div>
              {isContextReady ? (
                <p className="text-xs text-secondary mt-1">
                  Replacing <span className="font-semibold">{primaryName}</span> for {positionName} on {formattedDate}.
                </p>
              ) : (
                <p className="text-xs text-destructive mt-1">Context unverified.</p>
              )}
            </div>
            <button onClick={onClose} className="p-1 text-secondary hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </header>

          {!isContextReady ? (
            <div className="p-6 text-sm text-destructive bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Unable to load the employee or roster slot details. Please close this window and try again.</span>
            </div>
          ) : (
            <>
              {/* Search & Category Filter */}
              <div className="p-4 border-b border-outline-variant space-y-3 bg-surface">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary" />
                  <input
                    type="text"
                    placeholder="Search reliever employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-background border border-outline rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCategoryFilter("ALL")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                      categoryFilter === "ALL" ? "bg-primary text-white border-primary" : "bg-background text-secondary border-outline"
                    }`}
                  >
                    All ({employees.length})
                  </button>
                  <button
                    onClick={() => setCategoryFilter("ELIGIBLE")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                      categoryFilter === "ELIGIBLE" ? "bg-success text-white border-success" : "bg-background text-secondary border-outline"
                    }`}
                  >
                    Eligible ({employees.filter(e => e.canDeploy && (e.warnings || []).length === 0).length})
                  </button>
                  <button
                    onClick={() => setCategoryFilter("WARNING")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                      categoryFilter === "WARNING" ? "bg-amber-500 text-white border-amber-500" : "bg-background text-secondary border-outline"
                    }`}
                  >
                    Warnings ({employees.filter(e => e.canDeploy && (e.warnings || []).length > 0).length})
                  </button>
                  <button
                    onClick={() => setCategoryFilter("BLOCKED")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                      categoryFilter === "BLOCKED" ? "bg-destructive text-white border-destructive" : "bg-background text-secondary border-outline"
                    }`}
                  >
                    Blocked ({employees.filter(e => !e.canDeploy).length})
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {periodLocked && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2 text-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Period is locked. Action not allowed.</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {loading ? (
                  <div className="p-8 text-center text-xs text-secondary">Checking reliever eligibility across pool...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center text-xs text-secondary">No matching reliever employees found.</div>
                ) : (
                  filteredEmployees.map((item) => {
                    const warnings = item.warnings || [];
                    const isFullyEligible = item.canDeploy && warnings.length === 0;
                    const hasWarnings = item.canDeploy && warnings.length > 0;
                    const isWarningSelected = selectedEmpForWarning?.employee?.id === item.employee?.id;

                    return (
                      <div
                        key={item.employee?.id || Math.random()}
                        className={`p-4 rounded-xl border transition-all ${
                          isFullyEligible
                            ? "border-success/30 bg-success/5"
                            : hasWarnings
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-destructive/30 bg-destructive/5 opacity-80"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                              {item.employee?.name || "Staff"}
                              <span className="text-xs text-secondary font-mono">({item.employee?.id || "N/A"})</span>
                            </h4>
                            <p className="text-xs text-secondary mt-0.5">
                              {resolveEmployeeTradePosition(item.employee)} • {item.employee?.employeeCategory || "General"}
                            </p>
                          </div>
                          <Badge variant={isFullyEligible ? "success" : hasWarnings ? "warning" : "error"}>
                            {isFullyEligible ? "Eligible" : hasWarnings ? "Warning" : "Not Eligible"}
                          </Badge>
                        </div>

                        {/* Eligibility Checklist */}
                        <div className="mt-3 space-y-1 text-xs">
                          {(item.checklist || []).map((chk: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                              {chk.status === "PASS" ? (
                                <CheckCircle className="h-3 w-3 text-success shrink-0" />
                              ) : chk.status === "WARN" ? (
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              ) : chk.status === "FAIL" ? (
                                <X className="h-3 w-3 text-destructive shrink-0" />
                              ) : (
                                <Info className="h-3 w-3 text-secondary shrink-0" />
                              )}
                              <span className="text-secondary font-medium">{chk.rule}:</span>
                              <span className="text-foreground">{chk.details}</span>
                            </div>
                          ))}
                        </div>

                        {/* Warning override input dialog inline */}
                        {isWarningSelected && (
                          <div className="mt-3 p-3 bg-background border border-amber-500/30 rounded-lg space-y-2">
                            <label className="block text-xs font-semibold text-amber-600">
                              Mandatory Override Reason for Warning Assignment:
                            </label>
                            <input
                              type="text"
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="State reason for overriding warnings..."
                              className="w-full bg-surface border border-outline rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => setSelectedEmpForWarning(null)}
                                className="h-8 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="warning"
                                onClick={() => handleAssignReliever(item.employee.id, true)}
                                disabled={submittingAssign || periodLocked || !overrideReason.trim()}
                                className="h-8 text-xs"
                              >
                                {submittingAssign ? "Assigning..." : "Confirm Override Assign"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Action Button */}
                        {!isWarningSelected && (
                          <div className="mt-3 flex justify-end">
                            {isFullyEligible ? (
                              <Button
                                variant="primary"
                                onClick={() => handleAssignReliever(item.employee.id, false)}
                                disabled={submittingAssign || periodLocked}
                                className="h-9 gap-1.5 text-xs font-semibold"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                {submittingAssign ? "Assigning..." : "Assign"}
                              </Button>
                            ) : hasWarnings ? (
                              <Button
                                variant="warning"
                                onClick={() => setSelectedEmpForWarning(item)}
                                disabled={submittingAssign || periodLocked}
                                className="h-9 gap-1.5 text-xs font-semibold"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Assign with Warning
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                disabled
                                className="h-9 gap-1.5 text-xs font-semibold border border-outline-variant"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Not Eligible
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
