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
  status: "ASSIGNED" | "WARNING_APPROVED" | "BLOCKED" | "CANCELLED" | "RELIEVER" | "LEAVE" | "ABSENT" | "NO_SHOW" | "REPLACED";
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
  requiredRelieverCount?: number;
  assignedCount: number;
  assignedRelieverCount?: number;
  vacantCount?: number;
  vacantRelieverCount?: number;
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

interface DebugCounts {
  totalSecurityEmployees: number;
  inactiveExcluded: number;
  leaveExcluded: number;
  conflictExcluded: number;
  eligibleCount: number;
}

interface ProjectInstruction {
  id?: string;
  projectId: string;
  instructionTitle: string;
  instructionDescription: string;
  requirementType: "DOCUMENT" | "LICENSE" | "GATE_PASS" | "TRAINING" | "DESIGNATION" | "GRADE" | "CLIENT_APPROVAL" | "UNIFORM" | "EQUIPMENT" | "GENERAL";
  severity: "HARD_BLOCK" | "WARNING_ONLY" | "INFO_ONLY";
  expiryWarningDays: number;
  isActive: boolean;
}

interface SiteAllowanceConfig {
  siteId: string;
  siteAllowanceEnabled: boolean;
  siteAllowanceAmount: number;
  siteAllowanceFrequency: "MONTHLY" | "DAILY" | "FIXED_FOR_PERIOD";
  allowanceDescription: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive: boolean;
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

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [warningDetails, setWarningDetails] = useState<any[]>([]);
  const [isWarningPanelExpanded, setIsWarningPanelExpanded] = useState(false);
  const [employeePool, setEmployeePool] = useState<EmployeeCard[]>([]);
  const [debugCounts, setDebugCounts] = useState<DebugCounts | null>(null);
  
  // Roster layout tabs
  const [activeTab, setActiveTab] = useState<"calendar" | "project_details" | "site_shifts" | "site_allowance" | "project_instructions">("calendar");

  // Dynamic filter lists
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Selected filters (Client -> Contract -> Project -> Site hierarchy)
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedContract, setSelectedContract] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedSite, setSelectedSite] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Pool Filters
  const [poolSearch, setPoolSearch] = useState("");
  const [poolDesignation, setPoolDesignation] = useState("all");
  const [poolGrade, setPoolGrade] = useState("all");
  const [poolLicenseValid, setPoolLicenseValid] = useState("all");
  const [poolGatePassValid, setPoolGatePassValid] = useState("all");

  // Selected details for inspection drawer
  const [selectedAssignment, setSelectedAssignment] = useState<SlotAssignment | null>(null);
  const [selectedSlotReq, setSelectedSlotReq] = useState<CalendarSlot | null>(null);

  // Configuration forms
  const [siteShifts, setSiteShifts] = useState<any[]>([]);
  const [newShiftForm, setNewShiftForm] = useState({
    id: "",
    categoryId: "",
    shiftCode: "GEN-001",
    requiredCount: 1,
    shiftStartTime: "08:00",
    shiftEndTime: "20:00",
    isActive: true
  });

  const [allowanceConfig, setAllowanceConfig] = useState<SiteAllowanceConfig>({
    siteId: "",
    siteAllowanceEnabled: false,
    siteAllowanceAmount: 0,
    siteAllowanceFrequency: "MONTHLY",
    allowanceDescription: "",
    isActive: true
  });

  const [projectInstructions, setProjectInstructions] = useState<ProjectInstruction[]>([]);
  const [newInstructionForm, setNewInstructionForm] = useState<ProjectInstruction>({
    projectId: "",
    instructionTitle: "",
    instructionDescription: "",
    requirementType: "GENERAL",
    severity: "WARNING_ONLY",
    expiryWarningDays: 30,
    isActive: true
  });

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

  // Load clients list (Security Guarding clients only)
  const fetchClients = async () => {
    try {
      const res = await fetch("/api/v1/security/scheduling/clients");
      if (res.ok) setClients(await res.json());
    } catch (e) {
      console.error("Failed to load clients", e);
    }
  };

  // Load contracts cascading based on selectedClient
  const fetchContracts = async (clientId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/contracts?clientId=${clientId}`);
      if (res.ok) {
        setContracts(await res.json());
        setSelectedContract("all");
        setSelectedProject("all");
        setSelectedSite("all");
        setProjects([]);
        setSites([]);
      }
    } catch (e) {
      console.error("Failed to load contracts", e);
    }
  };

  // Load projects cascading based on selectedContract
  const fetchProjects = async (contractId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/projects?contractId=${contractId}`);
      if (res.ok) {
        setProjects(await res.json());
        setSelectedProject("all");
        setSelectedSite("all");
        setSites([]);
      }
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  };

  // Load sites cascading based on selectedProject
  const fetchSites = async (projectId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/sites?projectId=${projectId}`);
      if (res.ok) {
        setSites(await res.json());
        setSelectedSite("all");
      }
    } catch (e) {
      console.error("Failed to load sites", e);
    }
  };

  // Load designations categories
  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/v1/manpower/${business}/categories`);
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  };

  // Load Roster Shift Calendar Grid
  const fetchCalendar = async (showIndicator = false) => {
    if (selectedProject === "all") return;
    if (showIndicator) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedClient && selectedClient !== "all") params.set("clientId", selectedClient);
      if (selectedContract && selectedContract !== "all") params.set("contractId", selectedContract);
      if (selectedProject && selectedProject !== "all") params.set("projectId", selectedProject);
      if (selectedSite && selectedSite !== "all") params.set("siteId", selectedSite);
      params.set("startDate", selectedDate);
      params.set("endDate", selectedDate);

      const res = await fetch(`/api/v1/security/scheduling/calendar?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSlots(json.slots);
          setSummary(json.summary);
          setWarningDetails(json.warningDetails || []);
        }
      }
    } catch (e) {
      console.error("Failed to load calendar data", e);
    } finally {
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
        const data = await res.json();
        if (data.success) {
          setEmployeePool(data.pool);
          setDebugCounts(data.debugCounts);
        }
      }
    } catch (e) {
      console.error("Failed to load employee pool", e);
    }
  };

  // Load site shifts setup
  const fetchSiteShifts = async (siteId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/site-shifts?siteId=${siteId}`);
      if (res.ok) setSiteShifts(await res.json());
    } catch (e) {
      console.error("Failed to load site shifts", e);
    }
  };

  // Load allowance config
  const fetchSiteAllowance = async (siteId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/site-allowance?siteId=${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setAllowanceConfig(data);
      }
    } catch (e) {
      console.error("Failed to load site allowance", e);
    }
  };

  // Load project instructions
  const fetchProjectInstructions = async (projectId: string) => {
    try {
      const res = await fetch(`/api/v1/security/scheduling/project-instructions?projectId=${projectId}`);
      if (res.ok) setProjectInstructions(await res.json());
    } catch (e) {
      console.error("Failed to load project instructions", e);
    }
  };

  // Trigger load on mount
  useEffect(() => {
    if (canView) {
      fetchClients();
      fetchCategories();
      fetchEmployeePool();
    }
  }, [session]);

  // Handle cascaded filters
  useEffect(() => {
    if (selectedClient !== "all") {
      fetchContracts(selectedClient);
    } else {
      setContracts([]);
      setProjects([]);
      setSites([]);
      setSelectedContract("all");
      setSelectedProject("all");
      setSelectedSite("all");
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedContract !== "all") {
      fetchProjects(selectedContract);
    } else {
      setProjects([]);
      setSites([]);
      setSelectedProject("all");
      setSelectedSite("all");
    }
  }, [selectedContract]);

  useEffect(() => {
    if (selectedProject !== "all") {
      fetchSites(selectedProject);
      fetchProjectInstructions(selectedProject);
      fetchCalendar(true);
    } else {
      setSites([]);
      setSelectedSite("all");
      setSlots([]);
      setSummary(null);
    }
  }, [selectedProject, selectedDate]);

  useEffect(() => {
    if (selectedSite !== "all") {
      fetchSiteShifts(selectedSite);
      fetchSiteAllowance(selectedSite);
      fetchCalendar(true);
    } else {
      setSiteShifts([]);
      setAllowanceConfig({ siteId: "", siteAllowanceEnabled: false, siteAllowanceAmount: 0, siteAllowanceFrequency: "MONTHLY", allowanceDescription: "", isActive: true });
      fetchCalendar(true);
    }
  }, [selectedSite]);

  // Load pool when filters change
  useEffect(() => {
    if (canView) {
      fetchEmployeePool();
    }
  }, [poolSearch, poolDesignation, poolGrade, poolLicenseValid, poolGatePassValid, selectedDate, selectedSite]);

  // Drag-and-drop mechanics
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
          setValidationModal({
            isOpen: true,
            employee,
            slot,
            result,
            overrideReason: ""
          });
        } else {
          await executeAssignment(employee.id, slot.id, "ASSIGNED", [], []);
        }
      }
    } catch (err) {
      setApiError("Drop validation call failed.");
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
        setApiError(err.error || "Failed to save assignment");
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

  // Roster Shift Configuration Save
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || selectedSite === "all") {
      setApiError("Select a specific site to add shift requirements.");
      return;
    }
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/v1/security/scheduling/site-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newShiftForm,
          siteId: selectedSite
        })
      });
      if (res.ok) {
        setApiSuccess("Shift requirement saved successfully!");
        fetchSiteShifts(selectedSite);
        fetchCalendar(false);
        setNewShiftForm({
          id: "",
          categoryId: "",
          shiftCode: "GEN-001",
          requiredCount: 1,
          shiftStartTime: "08:00",
          shiftEndTime: "20:00",
          isActive: true
        });
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to save shift requirement.");
      }
    } catch (e) {
      setApiError("Failed to save shift.");
    }
  };

  // Site Allowance Configuration Save
  const handleSaveAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || selectedSite === "all") {
      setApiError("Select a specific site to save allowance config.");
      return;
    }
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/v1/security/scheduling/site-allowance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...allowanceConfig,
          siteId: selectedSite
        })
      });
      if (res.ok) {
        setApiSuccess("Site allowance config saved successfully!");
        fetchSiteAllowance(selectedSite);
        fetchCalendar(false);
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to save allowance.");
      }
    } catch (e) {
      setApiError("Failed to save allowance.");
    }
  };

  // Project Instructions Save
  const handleSaveInstruction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || selectedProject === "all") {
      setApiError("Select a specific project to save instructions.");
      return;
    }
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/v1/security/scheduling/project-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newInstructionForm,
          projectId: selectedProject
        })
      });
      if (res.ok) {
        setApiSuccess("Project instruction saved successfully!");
        fetchProjectInstructions(selectedProject);
        setNewInstructionForm({
          projectId: selectedProject,
          instructionTitle: "",
          instructionDescription: "",
          requirementType: "GENERAL",
          severity: "WARNING_ONLY",
          expiryWarningDays: 30,
          isActive: true
        });
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to save instruction.");
      }
    } catch (e) {
      setApiError("Failed to save instruction.");
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

        {/* Directory List & Debug Counts */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {debugCounts && (
            <div className="p-2.5 bg-surface-container-low rounded-lg mb-3 text-[9px] text-on-surface-variant font-semibold space-y-1">
              <p>Total Security Guards: {debugCounts.totalSecurityEmployees}</p>
              <p className="text-status-error/95">Inactive Excluded: {debugCounts.inactiveExcluded}</p>
              <p className="text-pending/95">On Leave Excluded: {debugCounts.leaveExcluded}</p>
              <p className="text-status-warning/95">Conflict Excluded: {debugCounts.conflictExcluded}</p>
              <p className="text-status-success font-bold">Eligible Available: {debugCounts.eligibleCount}</p>
            </div>
          )}

          {employeePool.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[10px] text-on-surface-variant font-medium">No available guards matched.</p>
              <p className="text-[8px] text-on-surface-variant/80 mt-1">Guards must be active and not double-booked or on leave.</p>
            </div>
          ) : (
            employeePool.map(emp => (
              <div
                key={emp.id}
                draggable
                onDragStart={(e) => handleDragStart(e, emp)}
                className="border rounded-lg p-3 cursor-grab bg-surface hover:border-primary transition-all active:cursor-grabbing border-outline-variant/60 shadow-sm"
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
                    <Badge variant="warning" className="text-[8px] py-0.5 px-1 font-semibold">No Gate Pass</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. CENTER PANEL: Roster Calendar & Dynamic Settings Grid */}
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
              <h1 className="text-xl font-bold text-primary">{businessLabel} Shift Planner</h1>
              <p className="text-[10px] text-on-surface-variant">Define client requirements, configure site shifts, allowances, policies, and run daily rosters</p>
            </div>
          </div>

          {/* Cascading Hierarchy Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <select
              className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] focus:outline-none font-bold text-primary"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="all">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            
            <select
              className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] focus:outline-none font-bold text-primary disabled:opacity-50"
              value={selectedContract}
              disabled={selectedClient === "all"}
              onChange={(e) => setSelectedContract(e.target.value)}
            >
              <option value="all">Select Contract</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNumber} - {c.title}</option>)}
            </select>

            <select
              className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] focus:outline-none font-bold text-primary disabled:opacity-50"
              value={selectedProject}
              disabled={selectedContract === "all"}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="all">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>

            <select
              className="bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] focus:outline-none font-bold text-primary disabled:opacity-50"
              value={selectedSite}
              disabled={selectedProject === "all"}
              onChange={(e) => setSelectedSite(e.target.value)}
            >
              <option value="all">Select Site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input
              type="date"
              className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-[11px] focus:outline-none focus:border-primary font-bold text-primary"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Layout Tabs */}
        {selectedProject !== "all" && (
          <div className="flex border-b border-outline-variant mb-4">
            <button
              onClick={() => setActiveTab("calendar")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === "calendar" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Roster Calendar
            </button>
            <button
              onClick={() => setActiveTab("project_details")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === "project_details" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Project & Sites Summary
            </button>
            <button
              onClick={() => setActiveTab("site_shifts")}
              disabled={selectedSite === "all"}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all disabled:opacity-50 ${
                activeTab === "site_shifts" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Site Shifts Setup
            </button>
            <button
              onClick={() => setActiveTab("site_allowance")}
              disabled={selectedSite === "all"}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all disabled:opacity-50 ${
                activeTab === "site_allowance" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Site Allowance Config
            </button>
            <button
              onClick={() => setActiveTab("project_instructions")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === "project_instructions" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              Project Policy Instructions
            </button>
          </div>
        )}

        {/* Coverage summary strip */}
        {summary && activeTab === "calendar" && (
          <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-6 animate-fade-in">
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-primary bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Required Staff</span>
              <h3 className="text-base font-extrabold text-primary mt-1">{summary.requiredManpower}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-success bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Assigned Staff</span>
              <h3 className="text-base font-extrabold text-status-success mt-1">{summary.assignedManpower}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-error bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Vacant Slots</span>
              <h3 className="text-base font-extrabold text-status-error mt-1">{summary.vacantPosts}</h3>
            </Card>
            <Card className="p-3 flex flex-col justify-between border-l-2 border-l-status-warning bg-surface-container-lowest shadow-sm">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Compliance Alerts</span>
              <h3 className="text-base font-extrabold text-status-warning mt-1">{warningDetails.length}</h3>
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

        {/* Compliance Warning Accordion Panel */}
        {activeTab === "calendar" && selectedProject !== "all" && (
          <div className="mb-4 border border-outline-variant/60 rounded-xl overflow-hidden shadow-sm bg-surface">
            <button
              onClick={() => setIsWarningPanelExpanded(!isWarningPanelExpanded)}
              className="w-full px-4 py-3 flex justify-between items-center bg-surface-container-low/60 hover:bg-surface-container-low transition-all"
            >
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${warningDetails.length > 0 ? "text-status-warning animate-bounce" : "text-status-success"}`}>
                  {warningDetails.length > 0 ? "warning" : "verified"}
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface">
                  Roster Compliance Warnings
                </span>
                <Badge variant={warningDetails.length > 0 ? "warning" : "success"} className="text-[10px] ml-1">
                  {warningDetails.length > 0 ? `${warningDetails.length} Warnings` : "No Warnings"}
                </Badge>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                {isWarningPanelExpanded ? "expand_less" : "expand_more"}
              </span>
            </button>

            {isWarningPanelExpanded && (
              <div className="p-4 border-t border-outline-variant/40 bg-surface-container-lowest divide-y divide-outline-variant/30 max-h-[300px] overflow-y-auto">
                {warningDetails.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-2 font-medium">
                    No roster warnings for selected period.
                  </p>
                ) : (
                  warningDetails.map((w, idx) => (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={w.severity === "BLOCKING" ? "error" : w.severity === "INFO" ? "neutral" : "warning"} className="text-[8px] py-0.5 px-1 uppercase tracking-wider font-extrabold">
                            {w.type} · {w.severity === "INFO" ? "NON-BLOCKING" : w.severity}
                          </Badge>
                          <span className="font-bold text-on-surface">{w.employeeName} ({w.employeeId})</span>
                          <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container-low px-1 py-0.5 rounded">
                            {w.date} · Shift {w.shiftId.substring(0, 8)}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface font-medium">{w.reason}</p>
                      </div>
                      <div className="md:text-right flex flex-col gap-0.5">
                        <span className="text-[9px] font-extrabold text-primary uppercase tracking-wider">Suggested Action:</span>
                        <span className="text-[10px] text-on-surface-variant font-semibold">{w.suggestedAction}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Roster Calendar */}
        {activeTab === "calendar" && (
          <div className="flex-1 flex flex-col">
            {selectedProject === "all" ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface border border-outline-variant border-dashed rounded-xl">
                <span className="material-symbols-outlined text-4xl text-primary mb-2">business_center</span>
                <h3 className="text-sm font-bold text-on-surface">Select Project Hierarchy</h3>
                <p className="text-[11px] text-on-surface-variant mt-1"> Roster planning requires choosing a Client, Contract, and Project above.</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface border border-outline-variant border-dashed rounded-xl">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">schedule</span>
                <h3 className="text-sm font-bold text-on-surface">No Site Shift Requirements Active</h3>
                <p className="text-[11px] text-on-surface-variant mt-1">Configure shift targets in the "Site Shifts Setup" tab first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {slots.map(slot => (
                  <div
                    key={slot.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, slot)}
                    className="border rounded-xl p-4 transition-all bg-surface border-outline-variant/60 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xs font-bold text-primary">{slot.siteName} · {slot.postName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container-low px-1.5 py-0.5 rounded">{slot.shiftCode} ({slot.shiftStartTime} - {slot.shiftEndTime})</span>
                          <span className="text-[9px] font-bold text-on-surface-variant">Required: {slot.requiredCount} Permanent {isSecurity && (slot.requiredRelieverCount || 0) > 0 && `+ ${slot.requiredRelieverCount} Reliever`}</span>
                        </div>
                      </div>
                      <Badge variant={slot.coverageStatus === "FULL" ? "success" : slot.coverageStatus === "PARTIAL" ? "warning" : "error"}>
                        {slot.coverageStatus} COVERAGE
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
                      {slot.assignments.map(asg => (
                        <div
                          key={asg.id}
                          onClick={() => {
                            setSelectedAssignment(asg);
                            setSelectedSlotReq(slot);
                          }}
                          className={`p-3 rounded-lg border cursor-pointer hover:border-primary transition-all flex flex-col gap-1.5 ${
                            asg.status === "WARNING_APPROVED"
                              ? "bg-status-warning/5 border-status-warning"
                              : ["CANCELLED", "LEAVE", "ABSENT", "NO_SHOW", "REPLACED"].includes(asg.status)
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
                              <Badge variant="warning" className="text-[8px] py-0.5 px-1 font-bold">Warning Overridden</Badge>
                            )}
                            {asg.isReliever && (
                              <Badge variant="neutral" className="text-[8px] py-0.5 px-1 bg-secondary/20 text-secondary border-none font-bold">Reliever</Badge>
                            )}
                            {asg.status !== "ASSIGNED" && asg.status !== "WARNING_APPROVED" && (
                              <Badge variant={asg.status === "LEAVE" ? "warning" : asg.status === "CANCELLED" ? "neutral" : "error"} className="text-[8px] py-0.5 px-1 uppercase font-bold">
                                {asg.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Permanent vacant slots */}
                      {Array.from({ length: slot.vacantCount !== undefined ? slot.vacantCount : Math.max(0, slot.requiredCount - slot.assignedCount) }).map((_, i) => (
                        <div
                          key={`vacant-${i}`}
                          className="border-2 border-dashed border-outline-variant/40 rounded-lg p-4 flex flex-col items-center justify-center text-center text-on-surface-variant min-h-[70px] bg-surface-container-lowest/50"
                        >
                          <span className="material-symbols-outlined text-[18px] text-outline-variant/60 animate-pulse">add_circle</span>
                          <span className="text-[9px] font-bold mt-1 uppercase tracking-wider text-outline-variant/60">Drop Guard here</span>
                        </div>
                      ))}

                      {/* Reliever vacant slots */}
                      {isSecurity && Array.from({ length: slot.vacantRelieverCount !== undefined ? slot.vacantRelieverCount : Math.max(0, (slot.requiredRelieverCount || 0) - (slot.assignedRelieverCount || 0)) }).map((_, i) => (
                        <div
                          key={`reliever-vacant-${i}`}
                          className="border-2 border-dashed border-secondary/30 rounded-lg p-4 flex flex-col items-center justify-center text-center text-secondary min-h-[70px] bg-secondary/5"
                        >
                          <span className="material-symbols-outlined text-[18px] text-secondary/60 animate-pulse">support_agent</span>
                          <span className="text-[9px] font-bold mt-1 uppercase tracking-wider text-secondary/60">Drop Reliever here</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Project & Sites Summary */}
        {activeTab === "project_details" && (
          <div className="space-y-6 animate-fade-in">
            {/* Project Details Panel */}
            <Card className="p-6 bg-surface-container shadow-sm border border-outline-variant/60">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Project Context Details</span>
                  <h2 className="text-lg font-bold text-primary mt-1">
                    {projects.find(p => p.id === selectedProject)?.name} ({projects.find(p => p.id === selectedProject)?.code})
                  </h2>
                </div>
                <Badge variant="success">ACTIVE PROJECT</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs mt-2">
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/30">
                  <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Client / Partner</p>
                  <p className="font-extrabold text-primary mt-1">{clients.find(c => c.id === selectedClient)?.name}</p>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/30">
                  <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Active Contract</p>
                  <p className="font-extrabold text-primary mt-1">{contracts.find(c => c.id === selectedContract)?.contractNumber}</p>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/30">
                  <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Scope of Operations</p>
                  <p className="font-extrabold text-primary mt-1">{businessLabel}</p>
                </div>
              </div>
            </Card>

            {/* Sites Table */}
            <div>
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest mb-3">Project Sites ({sites.length} Active)</h3>
              <div className="overflow-x-auto border border-outline-variant/50 rounded-xl bg-surface-container-lowest">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] font-extrabold uppercase tracking-wider text-primary">
                      <th className="p-3">Site Code</th>
                      <th className="p-3">Site Name</th>
                      <th className="p-3">Geofence Location</th>
                      <th className="p-3 text-center">Site Allowance</th>
                      <th className="p-3 text-center">Policies/Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map(s => (
                      <tr key={s.id} className="border-b border-outline-variant/40 hover:bg-surface-container-lowest/80 text-xs">
                        <td className="p-3 font-mono text-[10px] font-bold text-primary">{s.id.substring(0, 8).toUpperCase()}</td>
                        <td className="p-3 font-extrabold text-on-surface">{s.name}</td>
                        <td className="p-3 text-on-surface-variant font-medium">{s.lat ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} (Radius: ${s.radiusMeters}m)` : "No GPS lock"}</td>
                        <td className="p-3 text-center font-bold text-primary">QAR 300 / month</td>
                        <td className="p-3 text-center">
                          <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Site Shifts Setup */}
        {activeTab === "site_shifts" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in">
            {/* Form */}
            <Card className="xl:col-span-1 p-5 border border-outline-variant shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">Add Shift Target</h3>
              <form onSubmit={handleSaveShift} className="space-y-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-primary uppercase">Required Designation Category *</label>
                  <select
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold text-primary"
                    value={newShiftForm.categoryId}
                    onChange={(e) => setNewShiftForm({ ...newShiftForm, categoryId: e.target.value })}
                  >
                    <option value="">Select Designation</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-primary uppercase">Shift Code *</label>
                    <input
                      type="text"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                      value={newShiftForm.shiftCode}
                      onChange={(e) => setNewShiftForm({ ...newShiftForm, shiftCode: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-primary uppercase">Guards Count *</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                      value={newShiftForm.requiredCount}
                      onChange={(e) => setNewShiftForm({ ...newShiftForm, requiredCount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-primary uppercase">Start Time *</label>
                    <input
                      type="time"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                      value={newShiftForm.shiftStartTime}
                      onChange={(e) => setNewShiftForm({ ...newShiftForm, shiftStartTime: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-primary uppercase">End Time *</label>
                    <input
                      type="time"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                      value={newShiftForm.shiftEndTime}
                      onChange={(e) => setNewShiftForm({ ...newShiftForm, shiftEndTime: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full font-bold text-xs bg-primary text-white border-none py-2 mt-2">
                  Save Shift Requirement
                </Button>
              </form>
            </Card>

            {/* List */}
            <div className="xl:col-span-2 space-y-3">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">Active Site Roster Setup</h3>
              <div className="overflow-x-auto border border-outline-variant/50 rounded-xl bg-surface-container-lowest">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] font-extrabold uppercase tracking-wider text-primary">
                      <th className="p-3">Shift Code</th>
                      <th className="p-3">Required Designation</th>
                      <th className="p-3">Timing</th>
                      <th className="p-3 text-center">Required Guards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteShifts.map(ss => (
                      <tr key={ss.id} className="border-b border-outline-variant/40 hover:bg-surface-container-lowest/80 text-xs">
                        <td className="p-3 font-mono font-bold text-primary">{ss.shiftCode}</td>
                        <td className="p-3 font-extrabold text-on-surface">{ss.category?.name || "Security Guard"}</td>
                        <td className="p-3 text-on-surface-variant font-medium">{ss.shiftStartTime} - {ss.shiftEndTime}</td>
                        <td className="p-3 text-center font-extrabold text-primary">{ss.requiredCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Site Allowance Config */}
        {activeTab === "site_allowance" && (
          <div className="max-w-xl animate-fade-in">
            <Card className="p-6 border border-outline-variant shadow-sm flex flex-col gap-4">
              <div className="border-b border-outline-variant pb-3">
                <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">Site Allowance Configuration</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Enabling this triggers allowance payroll advisories for deployed guards</p>
              </div>

              <form onSubmit={handleSaveAllowance} className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="siteAllowanceEnabled"
                    className="w-4 h-4 rounded border-outline-variant accent-primary focus:ring-primary"
                    checked={allowanceConfig.siteAllowanceEnabled}
                    onChange={(e) => setAllowanceConfig({ ...allowanceConfig, siteAllowanceEnabled: e.target.checked })}
                  />
                  <label htmlFor="siteAllowanceEnabled" className="text-xs font-bold text-primary cursor-pointer select-none">
                    Enable Site Allowance for this location
                  </label>
                </div>

                {allowanceConfig.siteAllowanceEnabled && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-extrabold text-primary uppercase">Allowance Amount (QAR) *</label>
                        <input
                          type="number"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                          value={allowanceConfig.siteAllowanceAmount}
                          onChange={(e) => setAllowanceConfig({ ...allowanceConfig, siteAllowanceAmount: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-extrabold text-primary uppercase">Frequency *</label>
                        <select
                          className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold text-primary"
                          value={allowanceConfig.siteAllowanceFrequency}
                          onChange={(e) => setAllowanceConfig({ ...allowanceConfig, siteAllowanceFrequency: e.target.value as any })}
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="DAILY">Daily</option>
                          <option value="FIXED_FOR_PERIOD">Fixed for Period</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold text-primary uppercase">Remarks / Advisory Notes</label>
                      <textarea
                        className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary min-h-[60px]"
                        placeholder="State reason (e.g. Remote site allowance, high hazard allowance)..."
                        value={allowanceConfig.allowanceDescription}
                        onChange={(e) => setAllowanceConfig({ ...allowanceConfig, allowanceDescription: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" size="sm" className="font-bold text-xs bg-primary text-white border-none py-2 px-6">
                  Save Allowance Policy
                </Button>
              </form>
            </Card>
          </div>
        )}

        {/* TAB 5: Project Policy Instructions */}
        {activeTab === "project_instructions" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in">
            {/* Form */}
            <Card className="xl:col-span-1 p-5 border border-outline-variant shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">Create Policy Instruction</h3>
              <form onSubmit={handleSaveInstruction} className="space-y-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-primary uppercase">Instruction Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. MOI License strictly required"
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                    value={newInstructionForm.instructionTitle}
                    onChange={(e) => setNewInstructionForm({ ...newInstructionForm, instructionTitle: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-primary uppercase">Policy Requirement Type *</label>
                  <select
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold text-primary"
                    value={newInstructionForm.requirementType}
                    onChange={(e) => setNewInstructionForm({ ...newInstructionForm, requirementType: e.target.value as any })}
                  >
                    <option value="GENERAL">General Policy Reminder</option>
                    <option value="LICENSE">MOI Security License Check</option>
                    <option value="GATE_PASS">Gate Pass Validation</option>
                    <option value="DOCUMENT">QID/Document Validation</option>
                    <option value="DESIGNATION">Designation Matching</option>
                    <option value="GRADE">Salary Grade Validation</option>
                    <option value="CLIENT_APPROVAL">Client Approval Requirement</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-primary uppercase">Enforcement Severity *</label>
                    <select
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold text-primary"
                      value={newInstructionForm.severity}
                      onChange={(e) => setNewInstructionForm({ ...newInstructionForm, severity: e.target.value as any })}
                    >
                      <option value="HARD_BLOCK">Hard Block (Cannot Deploy)</option>
                      <option value="WARNING_ONLY">Warning Only</option>
                      <option value="INFO_ONLY">Information Only</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-primary uppercase">Warning Buffer (Days)</label>
                    <input
                      type="number"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary font-bold"
                      value={newInstructionForm.expiryWarningDays}
                      onChange={(e) => setNewInstructionForm({ ...newInstructionForm, expiryWarningDays: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-primary uppercase">Description / Details</label>
                  <textarea
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-primary min-h-[60px]"
                    placeholder="Enter compliance validation messages..."
                    value={newInstructionForm.instructionDescription}
                    onChange={(e) => setNewInstructionForm({ ...newInstructionForm, instructionDescription: e.target.value })}
                  />
                </div>
                <Button type="submit" size="sm" className="w-full font-bold text-xs bg-primary text-white border-none py-2 mt-2">
                  Add Project Instruction
                </Button>
              </form>
            </Card>

            {/* List */}
            <div className="xl:col-span-2 space-y-3">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">Active Inherited Project Policies</h3>
              <div className="overflow-x-auto border border-outline-variant/50 rounded-xl bg-surface-container-lowest">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] font-extrabold uppercase tracking-wider text-primary">
                      <th className="p-3">Policy Title</th>
                      <th className="p-3">Check Type</th>
                      <th className="p-3 text-center">Severity</th>
                      <th className="p-3 text-center">Warning Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectInstructions.map((pi, idx) => (
                      <tr key={idx} className="border-b border-outline-variant/40 hover:bg-surface-container-lowest/80 text-xs">
                        <td className="p-3 font-extrabold text-on-surface">{pi.instructionTitle}</td>
                        <td className="p-3 font-medium text-on-surface-variant">{pi.requirementType}</td>
                        <td className="p-3 text-center font-bold">
                          <Badge variant={pi.severity === "HARD_BLOCK" ? "error" : pi.severity === "WARNING_ONLY" ? "warning" : "neutral"}>
                            {pi.severity}
                          </Badge>
                        </td>
                        <td className="p-3 text-center font-semibold text-primary">{pi.expiryWarningDays}</td>
                      </tr>
                    ))}
                    {projectInstructions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-on-surface-variant text-[11px] font-semibold">
                          No project site policy instructions configured. Sites inherit defaults.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
              }}
              className="text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="space-y-4">
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
