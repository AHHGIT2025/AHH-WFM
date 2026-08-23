"use client";

import React, { useEffect, useState } from "react";
import { Button, Badge } from "@ahh-wfm/ui/src";
import {
  X,
  Calendar,
  MapPin,
  Shield,
  Building2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  initialData?: any;
  businessScope?: "security-guarding" | "facility-management" | string;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  initialData,
  businessScope = "security-guarding"
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "leaves">("overview");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchEmployeeDetails(employeeId);
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, employeeId]);

  const fetchEmployeeDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/employees/${id}/assignments`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load employee details.");
      }
    } catch (e: any) {
      setError(e.message || "Network error loading employee details.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const emp = data?.employee || initialData || {};
  const currentDuty = data?.currentDuty || {};
  const assignments = data?.assignments || [];
  const upcomingAssignments = data?.upcomingAssignments || [];
  const activeLeaves = data?.activeLeaves || [];

  const isEmpActive = emp.employmentStatus === "ACTIVE" || emp.isActive !== false;
  const isBlueCollar = emp.employeeCategory === "BLUE_COLLAR" || (!emp.employeeCategory && emp.positionCategoryId);

  const getDutyBadgeVariant = (duty: string) => {
    const d = (duty || "").toUpperCase();
    if (d === "ON_DUTY" || d === "ON DUTY") return "success";
    if (d === "ON_BREAK" || d === "ON BREAK") return "warning";
    if (d === "ON_LEAVE" || d === "ON LEAVE") return "pending";
    if (d === "SUSPENDED") return "error";
    return "neutral";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-detail-modal-title"
    >
      <div className="bg-surface text-on-surface border border-outline-variant rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-outline-variant/60 flex items-start justify-between bg-surface-container-lowest">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-black text-lg shrink-0 overflow-hidden shadow-inner">
              {emp.profilePhotoUrl ? (
                <img src={emp.profilePhotoUrl} alt={emp.name} className="w-full h-full object-cover" />
              ) : (
                (emp.name || "E").split(" ").map((n: string) => n[0]).join("").slice(0, 2)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 id="employee-detail-modal-title" className="text-lg font-bold text-foreground">
                  {emp.name || "Employee Details"}
                </h3>
                <span className="font-mono text-xs bg-surface-container-high px-2 py-0.5 rounded font-bold text-primary">
                  {emp.id || employeeId}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                {emp.role || "Staff"} • {emp.designation?.name || emp.designation || emp.tradePosition || "Employee"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={isEmpActive ? "success" : "neutral"}>
                  {isEmpActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={getDutyBadgeVariant(emp.dutyStatus)}>
                  {emp.dutyStatus === "ON_DUTY" ? "On Duty" :
                   emp.dutyStatus === "OFF_DUTY" ? "Offline" :
                   emp.dutyStatus === "ON_BREAK" ? "On Break" :
                   emp.dutyStatus === "ON_LEAVE" ? "On Leave" :
                   emp.dutyStatus === "SUSPENDED" ? "Suspended" :
                   emp.dutyStatus || "Offline"}
                </Badge>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-secondary/10 text-secondary uppercase">
                  {isBlueCollar ? "Blue Collar" : "White Collar"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-outline-variant px-6 bg-surface-container-low">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Overview & Organization
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "schedule"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Roster & Schedule</span>
            {upcomingAssignments.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {upcomingAssignments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("leaves")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "leaves"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Leaves & Availability</span>
            {activeLeaves.length > 0 && (
              <span className="bg-amber-500/20 text-amber-600 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {activeLeaves.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-xs text-on-surface-variant font-medium">Loading employee details & assignments...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-status-error shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-status-error">Error Loading Details</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">{error}</p>
                <Button variant="secondary" className="mt-3 text-xs h-7 py-0" onClick={() => employeeId && fetchEmployeeDetails(employeeId)}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Current Duty Spotlight Card */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Current Operational Status</div>
                          <div className="text-sm font-bold text-foreground mt-0.5">
                            {currentDuty.currentLocation || "Default Location"}
                          </div>
                        </div>
                      </div>
                      <Badge variant={getDutyBadgeVariant(emp.dutyStatus)}>
                        {emp.dutyStatus === "ON_DUTY" ? "On Duty Now" : emp.dutyStatus || "Offline"}
                      </Badge>
                    </div>

                    {currentDuty.currentAssignment && (
                      <div className="mt-3 pt-3 border-t border-primary/15 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-on-surface-variant font-medium block">Shift</span>
                          <span className="font-bold text-foreground">{currentDuty.currentAssignment.shiftName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant font-medium block">Hours</span>
                          <span className="font-bold text-foreground">
                            {currentDuty.currentAssignment.startTime} – {currentDuty.currentAssignment.endTime}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant font-medium block">Type</span>
                          <span className="font-bold text-primary">{currentDuty.currentAssignment.assignmentType}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Organization & Location Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Organization Details */}
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Building2 className="w-4 h-4" />
                        <span>Organization & Master Data</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-outline-variant/40">
                          <span className="text-on-surface-variant">Company:</span>
                          <span className="font-bold text-foreground text-right">
                            {emp.company ? `${emp.company.code} — ${emp.company.name}` : "Al Hattab Holding"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-outline-variant/40">
                          <span className="text-on-surface-variant">Department:</span>
                          <span className="font-bold text-foreground text-right">{emp.department || "Unassigned"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-outline-variant/40">
                          <span className="text-on-surface-variant">Designation:</span>
                          <span className="font-bold text-foreground text-right">{emp.designation?.name || emp.designation || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-on-surface-variant">Trade / Position:</span>
                          <span className="font-bold text-primary text-right">{emp.tradePosition || "Not specified"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Location & Contact Details */}
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <MapPin className="w-4 h-4" />
                        <span>Location & Contact</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-outline-variant/40">
                          <span className="text-on-surface-variant">Default Site/Location:</span>
                          <span className="font-bold text-foreground text-right">{emp.defaultLocation || "Default Office"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-outline-variant/40">
                          <span className="text-on-surface-variant">Operation Scope:</span>
                          <span className="font-bold text-foreground text-right">
                            {emp.operationType === "SECURITY_GUARDING" ? "Security Guarding" :
                             emp.operationType === "FACILITY_MANAGEMENT" ? "Facility Management" : "Universal"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-outline-variant/40">
                          <span className="text-on-surface-variant">Email:</span>
                          <span className="font-medium text-foreground text-right truncate max-w-[180px]">{emp.email || "—"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-on-surface-variant">Phone:</span>
                          <span className="font-medium text-foreground text-right">{emp.phone || "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "schedule" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Roster Schedule & Deployments</h4>
                      <p className="text-[11px] text-on-surface-variant">Active, upcoming, and reliever duties from Shift Planner</p>
                    </div>
                    <Link
                      href={`/manpower/${businessScope}/deployment-calendar`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <span>Open Shift Planner</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {assignments.length === 0 ? (
                    <div className="p-8 text-center bg-surface-container-low rounded-xl border border-outline-variant/60 text-xs text-on-surface-variant">
                      No active or scheduled roster assignments found for this employee in the current period.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map((asg: any) => (
                        <div
                          key={asg.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                            asg.isToday
                              ? "bg-primary/5 border-primary/30"
                              : asg.isPast
                              ? "bg-surface-container-lowest border-outline-variant/40 opacity-70"
                              : "bg-surface-container-low border-outline-variant/60"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${asg.isToday ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">{asg.businessDate}</span>
                                {asg.isToday && (
                                  <span className="bg-primary/20 text-primary text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                    Today
                                  </span>
                                )}
                                <span className="text-xs font-bold text-primary">• {asg.shiftName}</span>
                              </div>
                              <div className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-2">
                                <span>{asg.siteName}</span>
                                <span>({asg.postOrRequirement})</span>
                                <span>•</span>
                                <span className="font-medium">{asg.startTime} – {asg.endTime}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={asg.assignmentType === "RELIEVER" ? "warning" : "success"}>
                              {asg.assignmentType}
                            </Badge>
                            <Link
                              href={`/manpower/${businessScope}/deployment-calendar?date=${asg.businessDate}`}
                              className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                              title="View date in Shift Planner"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "leaves" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Approved Leaves & Absence</h4>
                      <p className="text-[11px] text-on-surface-variant">Approved leave records that impact scheduling availability</p>
                    </div>
                  </div>

                  {activeLeaves.length === 0 ? (
                    <div className="p-8 text-center bg-surface-container-low rounded-xl border border-outline-variant/60 text-xs text-on-surface-variant">
                      No approved leave requests registered for this employee in the current or upcoming period.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeLeaves.map((l: any) => (
                        <div
                          key={l.id}
                          className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-xs text-foreground flex items-center gap-2">
                              <span>{l.type} Leave</span>
                              <Badge variant="warning">Approved</Badge>
                            </div>
                            <div className="text-[11px] text-on-surface-variant mt-0.5">
                              {l.startDate} to {l.endDate} {l.reason ? `• Reason: ${l.reason}` : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
