"use client";

import React, { useEffect, useState } from "react";
import { X, Calendar, User, Shield, Building2, MapPin, Clock, AlertTriangle, FileText, CheckCircle2, History, ArrowRight, Loader2 } from "lucide-react";
import { Badge, Button } from "@ahh-wfm/ui/src";

interface SlotDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string | null;
  onTriggerUnassign: (mode: "SINGLE_DAY" | "ENTIRE_ASSIGNMENT_PERIOD") => void;
}

export const SlotDetailsDrawer: React.FC<SlotDetailsDrawerProps> = ({
  isOpen,
  onClose,
  slotId,
  onTriggerUnassign
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !slotId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/manpower/scheduling/slots/${slotId}/details`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load slot details");
        }
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to fetch details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, slotId]);

  if (!isOpen) return null;

  const slot = data?.slot;
  const asg = data?.currentAssignment;
  const gov = data?.governance;
  const period = data?.relatedPeriod;
  const historyList = data?.history || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="bg-surface w-full max-w-xl h-full border-l border-outline-variant flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface">
          <div>
            <h3 className="font-bold text-lg text-foreground">Slot & Assignment Details</h3>
            <p className="text-xs text-secondary mt-0.5">Comprehensive identity, assignment status, and history</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-20 text-secondary gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading slot details...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          {!loading && !error && slot && (
            <>
              {/* Governance & Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={slot.fulfillmentStatus === "FILLED" ? "bg-success/10 text-success border-success/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                  {slot.fulfillmentStatus === "FILLED" ? "Occupied / Filled" : "Vacant Slot"}
                </Badge>
                {gov?.isPeriodLocked && (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                    Period Locked
                  </Badge>
                )}
                {gov?.isPublished && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Roster Published
                  </Badge>
                )}
                {gov?.attendanceStatus?.hasActiveAttendance && (
                  <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                    Active Check-in
                  </Badge>
                )}
              </div>

              {/* Slot Identity */}
              <div className="p-4 rounded-xl border border-outline-variant bg-surface-variant/10 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-secondary flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Slot Identity
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-secondary block">Client & Contract</span>
                    <span className="font-bold text-foreground block mt-0.5">{slot.contract.clientName} ({slot.contract.contractNumber})</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Project & Site</span>
                    <span className="font-bold text-foreground block mt-0.5">{slot.site?.name || slot.project?.name}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Post / Location Unit</span>
                    <span className="font-bold text-foreground block mt-0.5">{slot.locationUnit?.name || "Unspecified Post"}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Shift & Slot Index</span>
                    <span className="font-bold text-foreground block mt-0.5">{slot.snapshotShiftName} ({slot.snapshotStartTime}–{slot.snapshotEndTime}) • Slot #{slot.slotIndex}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Required Position</span>
                    <span className="font-bold text-foreground block mt-0.5">{slot.snapshotPosition}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Business Date</span>
                    <span className="font-bold text-foreground block mt-0.5">{slot.businessDate}</span>
                  </div>
                </div>
              </div>

              {/* Current Assignment */}
              {asg ? (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <User className="h-4 w-4" /> Current Active Assignment
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-secondary block">Assigned Employee</span>
                      <span className="font-bold text-foreground block mt-0.5">{asg.employee.name}</span>
                    </div>
                    <div>
                      <span className="text-secondary block">Employee Contact</span>
                      <span className="font-medium text-foreground block mt-0.5">{asg.employee.phone || asg.employee.email || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-secondary block">Assignment Type</span>
                      <span className="font-bold text-foreground block mt-0.5">{asg.assignmentType}</span>
                    </div>
                    <div>
                      <span className="text-secondary block">Assigned By</span>
                      <span className="font-medium text-foreground block mt-0.5">{asg.assignedBy?.name || "System"}</span>
                    </div>
                    <div>
                      <span className="text-secondary block">Assigned Date</span>
                      <span className="font-medium text-foreground block mt-0.5">{new Date(asg.assignedAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-secondary block">Source Operation</span>
                      <span className="font-medium text-foreground block mt-0.5">{asg.bulkOperation ? `Bulk (${asg.bulkOperation.mode})` : "Single Assignment"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-outline-variant text-center py-6 text-xs text-secondary">
                  No active employee assignment on this slot date. Slot is currently vacant.
                </div>
              )}

              {/* Related Period Summary */}
              {period && (
                <div className="p-4 rounded-xl border border-outline-variant bg-surface-variant/10 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-secondary flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Related Assignment Period
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-secondary block">Original Period Range</span>
                      <span className="font-bold text-foreground block mt-0.5">{period.originalFromDate} to {period.originalToDate}</span>
                    </div>
                    <div>
                      <span className="text-secondary block">Total Related Dates</span>
                      <span className="font-bold text-foreground block mt-0.5">{period.totalExpectedCount} dates ({period.activeCount} Active, {period.unassignedCount} Unassigned)</span>
                    </div>
                  </div>
                  {!period.hasReliableGroupLink && (
                    <div className="text-[11px] text-amber-700 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      No linked assignment period is available for this assignment. Entire-period unassignment is unavailable.
                    </div>
                  )}
                </div>
              )}

              {/* History Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-secondary flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Assignment Audit History
                </h4>
                <div className="space-y-2">
                  {historyList.length === 0 ? (
                    <div className="text-xs text-secondary italic">No history records found.</div>
                  ) : (
                    historyList.map((h: any) => (
                      <div key={h.id} className="p-3 rounded-lg border border-outline-variant bg-surface text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{h.employeeName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.historyStatus === "ACTIVE" ? "bg-success/10 text-success" : "bg-surface-variant text-secondary"}`}>
                            {h.historyStatus}
                          </span>
                        </div>
                        <div className="text-secondary text-[11px] flex justify-between">
                          <span>Assigned by {h.assignedByName} on {new Date(h.assignedAt).toLocaleDateString()}</span>
                          {h.unassignedAt && <span>Unassigned on {new Date(h.unassignedAt).toLocaleDateString()}</span>}
                        </div>
                        {h.unassignmentReason && (
                          <div className="text-amber-800 bg-amber-500/10 p-2 rounded mt-1 text-[11px]">
                            Reason: {h.unassignmentReason}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {asg && (
          <div className="p-4 border-t border-outline-variant bg-surface flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => onTriggerUnassign("SINGLE_DAY")}
              disabled={gov?.isPeriodLocked || gov?.isPublished}
              className="flex-1 h-10 text-xs"
            >
              Unassign This Day
            </Button>
            <Button
              variant="primary"
              onClick={() => onTriggerUnassign("ENTIRE_ASSIGNMENT_PERIOD")}
              disabled={!period?.hasReliableGroupLink || gov?.isPeriodLocked || gov?.isPublished}
              className="flex-1 h-10 text-xs"
            >
              Unassign Entire Assignment Period
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
