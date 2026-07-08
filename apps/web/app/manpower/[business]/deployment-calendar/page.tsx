"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission, isAdminUser } from "../../../../lib/permissions";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

interface SlotAssignment {
  id: string;
  deploymentId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  grade: string;
  shiftStartTime: string;
  shiftEndTime: string;
  shiftCode: string;
  postName: string;
  status: "ASSIGNED" | "WARNING_APPROVED" | "BLOCKED" | "CANCELLED" | "RELIEVER";
  isReliever: boolean;
  isOvertime: boolean;
  validationStatus: "OK" | "WARNING" | "BLOCKED";
  validationIssues: string[];
  payrollAdvisories: string[];
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
}

interface CalendarSlot {
  id: string;
  siteId: string;
  siteName: string;
  projectCode: string;
  contractCode: string;
  postName: string;
  shiftCode: string;
  shiftStartTime: string;
  shiftEndTime: string;
  requiredCount: number;
  assignedCount: number;
  coverageStatus: "FULL" | "PARTIAL" | "VACANT";
  assignments: SlotAssignment[];
}

interface CoverageSummary {
  requiredManpower: number;
  assignedManpower: number;
  vacantPosts: number;
  overstaffedPosts: number;
  warningDeployments: number;
  blockedAttempts: number;
  pendingApprovals: number;
  relieversAssigned: number;
}

interface EmployeeCard {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  grade: string;
  defaultSiteId: string;
  securityLicenseExpiry: string | null;
  siteGatePassExpiry: string | null;
  availabilityStatus: "Available" | "On Leave" | "Assigned";
  isLicenseExpired: boolean;
  isGatePassExpired: boolean;
  skills: string[];
}

export default function DeploymentCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isSuperOrAdmin = isAdminUser(user);

  const business = params?.business as string; // "security-guarding" | "facility-management"
  const isSecurity = business === "security-guarding";
  const businessLabel = isSecurity ? "Security Guarding" : "Facility Management";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [employeePool, setEmployeePool] = useState<EmployeeCard[]>([]);
  
  // Dynamic filter lists
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);

  // Selected filters
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedContract, setSelectedContract] = useState("all");
  const [selectedSite, setSelectedSite] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("day");

  // Pool Filters
  const [poolSearch, setPoolSearch] = useState("");
  const [poolDesignation, setPoolDesignation] = useState("all");
  const [poolGrade, setPoolGrade] = useState("all");
  const [poolLicenseValid, setPoolLicenseValid] = useState("all"); // all | true | false
  const [poolGatePassValid, setPoolGatePassValid] = useState("all");

  // Selected assignment for drawer display
  const [selectedAssignment, setSelectedAssignment] = useState<SlotAssignment | null>(null);
  const [selectedSlotReq, setSelectedSlotReq] = useState<CalendarSlot | null>(null);
  const [siteRequirements, setSiteRequirements] = useState<any | null>(null);

  // Validation modal state
  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    employee: EmployeeCard;
    slot: CalendarSlot;
    result: any;
    overrideReason: string;
  } | null>(null);

  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  const canView = isSuperOrAdmin || 
                  hasPermission(user, "manpower.admin.full_access") ||
                  hasPermission(user, isSecurity ? "manpower.security.view" : "manpower.fm.view") ||
                  hasPermission(user, "security.scheduling.view");

  const canManage = isSuperOrAdmin || 
                    hasPermission(user, "manpower.admin.full_access") ||
                    hasPermission(user, isSecurity ? "manpower.security.manage" : "manpower.fm.manage") ||
                    hasPermission(user, "security.scheduling.assign");

  // Load filter dropdown values dynamically
  const fetchFilterMasters = async () => {
    try {
      const [clientRes, contractRes, siteRes] = await Promise.all([
        fetch("/api/v1/masters/companies"), // Clients are holding companies / party A
        fetch("/api/v1/masters/companies"), // Placeholder or manpower contracts
        fetch(`/api/v1/masters/locations`) // Sites mapped to locations
      ]);
      if (clientRes.ok) setClients(await clientRes.json());
      if (contractRes.ok) setContracts(await contractRes.json());
      if (siteRes.ok) {
        const rawSites = await siteRes.json();
        setSites(rawSites.filter((s: any) => s.isActive !== false));
      }
    } catch (e) {
      console.error("Failed to load master filters", e);
    }
  };

  // Load calendar slots & coverage summary
  const fetchCalendar = async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedClient && selectedClient !== "all") params.set("clientId", selectedClient);
      if (selectedContract && selectedContract !== "all") params.set("contractId", selectedContract);
      if (selectedSite && selectedSite !== "all") params.set("siteId", selectedSite);
      params.set("startDate", selectedDate);
      params.set("endDate", selectedDate);

      const res = await fetch(`/api/v1/security/scheduling/calendar?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSlots(json.slots);
          setSummary(json.summary);
        }
      }
    } catch (e) {
      console.error("Failed to load calendar data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load Available Employee Pool
  const fetchEmployeePool = async () => {
    try {
      const params = new URLSearchParams();
      params.set("date", selectedDate);
      if (poolSearch) params.set("search", poolSearch);
      if (poolDesignation && poolDesignation !== "all") params.set("designation", poolDesignation);
      if (poolGrade && poolGrade !== "all") params.set("grade", poolGrade);
      if (poolLicenseValid && poolLicenseValid !== "all") params.set("licenseValid", poolLicenseValid);
      if (poolGatePassValid && poolGatePassValid !== "all") params.set("gatePassValid", poolGatePassValid);
      if (selectedSite && selectedSite !== "all") params.set("siteId", selectedSite);

      const res = await fetch(`/api/v1/security/scheduling/available-employees?${params.toString()}`);
      if (res.ok) {
        setEmployeePool(await res.json());
      }
    } catch (e) {
      console.error("Failed to load employee pool", e);
    }
  };

  // Fetch slot checklist details
  const fetchSlotRequirements = async (slotId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/site-requirements?shiftRequirementId=${slotId}`);
      if (res.ok) {
        setSiteRequirements(await res.json());
      }
    } catch (e) {
      console.error("Failed to load site requirements", e);
    }
  };

  // Trigger load on mount & parameters change
  useEffect(() => {
    if (canView) {
      fetchFilterMasters();
    }
  }, [session]);

  useEffect(() => {
    if (canView) {
      fetchCalendar(true);
      fetchEmployeePool();
    }
  }, [selectedClient, selectedContract, selectedSite, selectedDate, calendarView]);

  useEffect(() => {
    if (canView) {
      fetchEmployeePool();
    }
  }, [poolSearch, poolDesignation, poolGrade, poolLicenseValid, poolGatePassValid]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, employee: EmployeeCard) => {
    e.dataTransfer.setData("application/json", JSON.stringify(employee));
  };

  const handleDrop = async (e: React.DragEvent, slot: CalendarSlot) => {
    e.preventDefault();
    if (!canManage) {
      setApiError("You do not have permission to assign or modify deployments.");
      return;
    }
    const empDataStr = e.dataTransfer.getData("application/json");
    if (!empDataStr) return;
    
    const employee = JSON.parse(empDataStr) as EmployeeCard;
    setApiError("");
    setApiSuccess("");

    // Validate drop target deployment eligibility
    try {
      const valRes = await fetch("/api/v1/security/scheduling/validate-deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          shiftRequirementId: slot.id,
          date: selectedDate,
          deploymentMode: "REGULAR"
        })
      });

      if (valRes.ok) {
        const result = await valRes.json();
        
        if (result.severity === "BLOCKED") {
          setApiError(`Blocked Attempt: ${result.blockingIssues.join(" | ")}`);
        } else if (result.severity === "WARNING") {
          // Open override validation modal
          setValidationModal({
            isOpen: true,
            employee,
            slot,
            result,
            overrideReason: ""
          });
        } else {
          // Direct assignment
          await executeAssignment(employee.id, slot.id, "ASSIGNED", [], []);
        }
      }
    } catch (err) {
      setApiError("Deployment validation call failed.");
    }
  };

  const executeAssignment = async (
    employeeId: string,
    slotId: string,
    status: string,
    warnings: string[],
    advisories: string[],
    overrideReason?: string
  ) => {
    try {
      const res = await fetch("/api/v1/security/scheduling/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          shiftRequirementId: slotId,
          date: selectedDate,
          deploymentMode: "REGULAR",
          overrideReason,
          payrollAdvisories: advisories,
          validationIssues: warnings,
          validationStatus: warnings.length > 0 ? "WARNING" : "OK"
        })
      });

      if (res.ok) {
        setApiSuccess("Guard deployed successfully!");
        setValidationModal(null);
        fetchCalendar(false);
        fetchEmployeePool();
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to finalize assignment");
      }
    } catch (err) {
      setApiError("Connection failed");
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!canManage) {
      setApiError("You do not have permission to modify deployments.");
      return;
    }
    if (!confirm("Are you sure you want to unassign this guard slot? Future schedules will be deleted; historical records will be cancelled safely.")) return;
    
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/v1/security/scheduling/unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId })
      });
      if (res.ok) {
        setApiSuccess("Guard unassigned successfully.");
        setSelectedAssignment(null);
        fetchCalendar(false);
        fetchEmployeePool();
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to unassign");
      }
    } catch (err) {
      setApiError("Unassign connection failed");
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-center text-status-error font-bold">
        Access Denied: You do not have permission to view {businessLabel} operations.
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-container-lowest flex h-[calc(100vh-4rem)] overflow-hidden">
      
      {/* 1. LEFT PANEL: Available Employee Pool */}
      <div className="w-80 border-r border-outline-variant bg-surface p-4 flex flex-col h-full shrink-0">
        <div className="mb-4">
          <h2 className="text-xs font-extrabold text-primary uppercase tracking-widest">Available Guards Pool</h2>
          <p className="text-[10px] text-on-surface-variant">Drag and drop guards to assign to shifts</p>
        </div>

        {/* Filters */}
        <div className="space-y-2 mb-4">
          <input
            type="text"
            placeholder="Search guard ID or name..."
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary font-medium"
            value={poolSearch}
            onChange={(e) => setPoolSearch(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-[10px] focus:outline-none font-semibold text-primary"
              value={poolDesignation}
              onChange={(e) => setPoolDesignation(e.target.value)}
            >
              <option value="all">Designations</option>
              <option value="Security Guard">Security Guard</option>
              <option value="Head Guard">Head Guard</option>
              <option value="CCTV Operator">CCTV Operator</option>
            </select>
            <select
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-[10px] focus:outline-none font-semibold text-primary"
              value={poolGrade}
              onChange={(e) => setPoolGrade(e.target.value)}
            >
              <option value="all">Grades</option>
              <option value="G1">Grade 1</option>
              <option value="G2">Grade 2</option>
              <option value="G3">Grade 3</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-[10px] focus:outline-none font-semibold text-primary"
              value={poolLicenseValid}
              onChange={(e) => setPoolLicenseValid(e.target.value)}
            >
              <option value="all">MOI License</option>
              <option value="true">Valid</option>
              <option value="false">Expired/None</option>
            </select>
            <select
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 text-[10px] focus:outline-none font-semibold text-primary"
              value={poolGatePassValid}
              onChange={(e) => setPoolGatePassValid(e.target.value)}
            >
              <option value="all">Gate Pass</option>
              <option value="true">Valid</option>
              <option value="false">Expired/None</option>
            </select>
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {employeePool.length === 0 ? (
            <p className="text-center text-[10px] text-on-surface-variant py-8 font-medium">No available guards matched.</p>
          ) : (
            employeePool.map(emp => (
              <div
                key={emp.id}
                draggable
                onDragStart={(e) => handleDragStart(e, emp)}
                className={`border rounded-lg p-3 cursor-grab bg-surface hover:border-primary transition-all active:cursor-grabbing border-outline-variant/60 shadow-sm`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-primary">{emp.name}</h4>
                  <span className="text-[9px] text-on-surface-variant font-mono bg-surface-container-low px-1.5 py-0.5 rounded">{emp.employeeCode}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="neutral" className="text-[8px] py-0.5 px-1 bg-surface-container-high">{emp.designation}</Badge>
                  <Badge variant="neutral" className="text-[8px] py-0.5 px-1 bg-surface-container-high">{emp.grade}</Badge>
                  {emp.isLicenseExpired ? (
                    <Badge variant="error" className="text-[8px] py-0.5 px-1">MOI Expired</Badge>
                  ) : (
                    <Badge variant="success" className="text-[8px] py-0.5 px-1">MOI Valid</Badge>
                  )}
                  {emp.isGatePassExpired && (
                    <Badge variant="warning" className="text-[8px] py-0.5 px-1">No Gate Pass</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. CENTER PANEL: Roster Calendar Grid */}
      <div className="flex-1 bg-surface-container-lowest p-6 flex flex-col h-full overflow-y-auto">
        
        {/* Header toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/manpower/${business}/dashboard`}
              className="w-8 h-8 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-primary">{businessLabel} Smart Scheduling</h1>
              <p className="text-[10px] text-on-surface-variant">Daily planner, shift allocations, compliance filters, and roster controls</p>
            </div>
          </div>

          {/* Filters strip */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <select
              className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] focus:outline-none font-semibold text-primary"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name}</option>)}
            </select>
            <select
              className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] focus:outline-none font-semibold text-primary"
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
            >
              <option value="all">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.locationName || s.name}</option>)}
            </select>
            <input
              type="date"
              className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-[11px] focus:outline-none focus:border-primary font-bold text-primary"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <Button
              onClick={() => fetchCalendar(true)}
              disabled={refreshing}
              variant="secondary"
              size="sm"
              className="font-bold flex items-center gap-1 text-[11px] py-1.5 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <span className={`material-symbols-outlined text-[15px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
            </Button>
          </div>
        </div>

        {/* Coverage summary strip */}
        {summary && (
          <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-primary bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Required Staff</span>
              <h3 className="text-base font-extrabold text-primary mt-1">{summary.requiredManpower}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-success bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Assigned Staff</span>
              <h3 className="text-base font-extrabold text-status-success mt-1">{summary.assignedManpower}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-error bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Vacant Posts</span>
              <h3 className="text-base font-extrabold text-status-error mt-1">{summary.vacantPosts}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-warning bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Warnings</span>
              <h3 className="text-base font-extrabold text-status-warning mt-1">{summary.warningDeployments}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-secondary bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Relievers</span>
              <h3 className="text-base font-extrabold text-secondary mt-1">{summary.relieversAssigned}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-pending bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Pending Appr.</span>
              <h3 className="text-base font-extrabold text-pending mt-1">{summary.pendingApprovals}</h3>
            </Card>
          </section>
        )}

        {/* Notifications */}
        {apiError && (
          <div className="mb-4 p-3 bg-status-error/10 text-status-error text-xs rounded-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {apiError}
          </div>
        )}
        {apiSuccess && (
          <div className="mb-4 p-3 bg-status-success/10 text-status-success text-xs rounded-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {apiSuccess}
          </div>
        )}

        {/* Calendar Grid area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface border border-outline-variant border-dashed rounded-xl">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">schedule</span>
            <h3 className="text-sm font-bold text-on-surface">No Security Shift Requirements Configured</h3>
            <p className="text-[11px] text-on-surface-variant mt-1">Configure shift templates or project site targets in Settings.</p>
          </div>
        ) : (
          <div className={`space-y-4 transition-all duration-300 ${refreshing ? "opacity-50" : ""}`}>
            {slots.map(slot => (
              <div
                key={slot.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, slot)}
                className={`border rounded-xl p-4 transition-all bg-surface border-outline-variant/60 shadow-sm flex flex-col gap-3`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-primary">{slot.siteName} · {slot.postName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container-low px-1.5 py-0.5 rounded">{slot.shiftCode} ({slot.shiftStartTime} - {slot.shiftEndTime})</span>
                      <span className="text-[9px] font-bold text-on-surface-variant">Required: {slot.requiredCount} Guards</span>
                    </div>
                  </div>
                  <Badge variant={slot.coverageStatus === "FULL" ? "success" : slot.coverageStatus === "PARTIAL" ? "warning" : "error"}>
                    {slot.coverageStatus} COVERAGE
                  </Badge>
                </div>

                {/* Drop Zone for Guards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
                  {slot.assignments.map(asg => (
                    <div
                      key={asg.id}
                      onClick={() => {
                        setSelectedAssignment(asg);
                        setSelectedSlotReq(slot);
                        fetchSlotRequirements(slot.id);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer hover:border-primary transition-all flex flex-col gap-1.5 ${
                        asg.status === "WARNING_APPROVED"
                          ? "bg-status-warning/5 border-status-warning"
                          : asg.status === "CANCELLED"
                          ? "bg-surface-container-high border-outline-variant opacity-60 line-through"
                          : "bg-surface-container-lowest border-outline-variant/60 shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-on-surface">{asg.employeeName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnassign(asg.id);
                          }}
                          className="text-on-surface-variant hover:text-status-error ml-2"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[8px] px-1 bg-surface-container-high rounded text-on-surface-variant font-semibold">{asg.employeeCode}</span>
                        <span className="text-[8px] px-1 bg-surface-container-high rounded text-on-surface-variant font-semibold">{asg.designation}</span>
                        {asg.status === "WARNING_APPROVED" && (
                          <Badge variant="warning" className="text-[8px] py-0.5 px-1">Warning Overridden</Badge>
                        )}
                        {asg.isReliever && (
                          <Badge variant="neutral" className="text-[8px] py-0.5 px-1 bg-secondary/20 text-secondary border-none">Reliever</Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Vacant slots slots indicators */}
                  {Array.from({ length: Math.max(0, slot.requiredCount - slot.assignedCount) }).map((_, i) => (
                    <div
                      key={i}
                      className="border-2 border-dashed border-outline-variant/40 rounded-lg p-4 flex flex-col items-center justify-center text-center text-on-surface-variant min-h-[70px] bg-surface-container-lowest/50"
                    >
                      <span className="material-symbols-outlined text-[18px] text-outline-variant/60 animate-pulse">add_circle</span>
                      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider text-outline-variant/60">Drop Guard here</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. RIGHT DRAWER: Selected Slot Details & Checklists */}
      {selectedAssignment && selectedSlotReq && (
        <div className="w-80 border-l border-outline-variant bg-surface p-4 flex flex-col h-full shrink-0 overflow-y-auto shadow-lg">
          <div className="flex justify-between items-start border-b border-outline-variant pb-3 mb-4">
            <div>
              <h3 className="text-xs font-extrabold text-primary uppercase">Deployment Inspector</h3>
              <p className="text-[9px] text-on-surface-variant mt-0.5">Validation checklists & payroll advisories</p>
            </div>
            <button
              onClick={() => {
                setSelectedAssignment(null);
                setSelectedSlotReq(null);
                setSiteRequirements(null);
              }}
              className="text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Slot details */}
            <Card className="p-3 bg-surface-container-low border-none flex flex-col gap-1.5 text-[11px]">
              <p className="text-on-surface"><strong>Site</strong>: {selectedSlotReq.siteName}</p>
              <p className="text-on-surface"><strong>Post</strong>: {selectedSlotReq.postName}</p>
              <p className="text-on-surface"><strong>Shift</strong>: {selectedSlotReq.shiftCode} ({selectedSlotReq.shiftStartTime} - {selectedSlotReq.shiftEndTime})</p>
              <p className="text-on-surface"><strong>Guard</strong>: {selectedAssignment.employeeName} ({selectedAssignment.employeeCode})</p>
              <p className="text-on-surface"><strong>Designation/Grade</strong>: {selectedAssignment.designation} / {selectedAssignment.grade}</p>
            </Card>

            {/* Validation Issues / Warnings */}
            <div>
              <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-wider mb-2">Compliance Warnings</h4>
              {selectedAssignment.validationIssues.length === 0 ? (
                <p className="text-[10px] text-status-success font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-status-success rounded-full"></span> Compliant</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedAssignment.validationIssues.map((issue, idx) => (
                    <li key={idx} className="text-[10px] text-status-warning bg-status-warning/10 p-2 rounded border border-status-warning/20 font-semibold flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[14px] mt-0.5">warning</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Payroll Advisory details */}
            <div>
              <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-wider mb-2">Payroll & Allowance Advisories</h4>
              {selectedAssignment.payrollAdvisories.length === 0 ? (
                <p className="text-[10px] text-on-surface-variant font-medium">No payroll advisory adjustments needed.</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedAssignment.payrollAdvisories.map((adv, idx) => (
                    <li key={idx} className="text-[10px] text-secondary bg-secondary/5 p-2 rounded border border-secondary/20 font-bold flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[14px] mt-0.5">payments</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Override notes if warning-approved */}
            {selectedAssignment.overrideReason && (
              <div className="p-3 bg-surface-container-high rounded-lg text-[10px]">
                <p className="font-bold text-primary">Override Reason:</p>
                <p className="italic text-on-surface-variant mt-1">"{selectedAssignment.overrideReason}"</p>
                <p className="text-[8px] text-on-surface-variant mt-2">Overridden by {selectedAssignment.overriddenBy} on {new Date(selectedAssignment.overriddenAt || "").toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. OVERRIDE VALIDATION MODAL */}
      {validationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-surface p-6 rounded-xl flex flex-col gap-4 shadow-2xl border border-outline-variant">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-extrabold text-primary uppercase">Deployment Compliance Override</h3>
                <p className="text-[10px] text-on-surface-variant">Warnings detected. A reason is required to proceed.</p>
              </div>
              <button
                onClick={() => setValidationModal(null)}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-status-warning/10 p-3 rounded-lg border border-status-warning/20">
                <h4 className="text-[10px] font-bold text-status-warning uppercase tracking-wider mb-1">Compliance Warnings:</h4>
                <ul className="list-disc list-inside text-[10px] text-status-warning font-semibold space-y-1">
                  {validationModal.result.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {validationModal.result.payrollAdvisories.length > 0 && (
                <div className="bg-secondary/10 p-3 rounded-lg border border-secondary/20">
                  <h4 className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Payroll Advisories:</h4>
                  <ul className="list-disc list-inside text-[10px] text-secondary font-bold space-y-1">
                    {validationModal.result.payrollAdvisories.map((pa: string, idx: number) => (
                      <li key={idx}>{pa}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-primary uppercase">Override Justification / Reason *</label>
                <textarea
                  className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary min-h-[80px]"
                  placeholder="Enter reason (e.g. Reliever requested by client, temporary cover, training OJT)..."
                  value={validationModal.overrideReason}
                  onChange={(e) => setValidationModal({ ...validationModal, overrideReason: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setValidationModal(null)}
                className="font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                disabled={!validationModal.overrideReason.trim()}
                onClick={() => executeAssignment(
                  validationModal.employee.id,
                  validationModal.slot.id,
                  "WARNING_APPROVED",
                  validationModal.result.warnings,
                  validationModal.result.payrollAdvisories,
                  validationModal.overrideReason
                )}
                className="font-bold text-xs bg-status-warning hover:bg-status-warning/90 text-white border-none"
              >
                Override & Assign Slot
              </Button>
            </div>
          </Card>
        </div>
      )}
      
    </div>
  );
}
