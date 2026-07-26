"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { hasPermission } from "../../../../lib/permissions";
import { Badge, Button } from "@ahh-wfm/ui/src";
import { 
  ArrowLeft, 
  RefreshCw, 
  Upload, 
  Lock, 
  Unlock, 
  CalendarDays, 
  UserPlus, 
  TriangleAlert, 
  BarChart3, 
  Grid2X2, 
  Plus, 
  X, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  UserMinus 
} from "lucide-react";

import { DateRangeSelector } from "./components/DateRangeSelector";
import { RosterPublicationHistoryModal } from "../../../../components/manpower/RosterPublicationHistoryModal";
import { RosterChangeRequestModal } from "../../../../components/manpower/RosterChangeRequestModal";
import { History, FileText } from "lucide-react";
import { DayOffModal } from "./components/DayOffModal";
import { LeaveEffectModal } from "./components/LeaveEffectModal";
import { AbsenceModal } from "./components/AbsenceModal";
import { CancelResolveModal } from "./components/CancelResolveModal";
import { RelieverDrawer } from "./components/RelieverDrawer";
import { CellActionMenu } from "./components/CellActionMenu";
import { resolveEmployeeTradePosition } from "@/lib/roster-display-utils";
import { BulkDeploymentModal } from "./bulk-deployment/BulkDeploymentModal";
import { SlotDetailsDrawer } from "./components/SlotDetailsDrawer";
import { BulkUnassignmentModal } from "./bulk-unassignment/BulkUnassignmentModal";

interface RosterSlot {
  id: string;
  operationType: string;
  contractId: string;
  projectId: string;
  siteId: string | null;
  businessDate: string;
  shiftKey: string;
  slotIndex: number;
  generationKey: string;
  snapshotPosition: string;
  snapshotShiftName: string;
  snapshotStartTime: string;
  snapshotEndTime: string;
  fulfillmentStatus: "VACANT" | "FILLED" | "CANCELLED";
  scheduleStatus: "DRAFT" | "REVIEWED" | "PUBLISHED" | "LOCKED" | "COMPLETED";
  rowVersion: number;
  contract: {
    title: string;
    contractNumber: string;
  };
  site?: {
    name: string;
  } | null;
  planningExceptions?: any[];
  assignments: Array<{
    id: string;
    employeeId: string;
    assignmentType: string;
    historyStatus: string;
    validationSnapshot: any;
    planningException?: any;
    replaces?: any;
    employee: {
      id: string;
      name: string;
      email: string;
      phone: string;
      employeeCategory: string;
      designation?: {
        name: string;
      } | null;
    };
  }>;
}

interface EligibleEmployee {
  employee: {
    id: string;
    name: string;
    email: string;
    phone: string;
    employeeCategory: string;
    designation: {
      name: string;
      code: string;
    } | null;
  };
  canDeploy: boolean;
  errors: string[];
  warnings: string[];
  checklist: any[];
}

export default function RosterBoardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;

  const business = params?.business as string; // "security-guarding" | "facility-management"
  const isSecurity = business === "security-guarding";
  const operationType = isSecurity ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";
  const businessLabel = isSecurity ? "Security Guarding" : "Facility Management";

  // Planning view mode: "month" vs "custom"
  const [viewMode, setViewMode] = useState<"month" | "custom">("month");

  // Roster month filter (format: YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  // Custom date range filter (format: YYYY-MM-DD)
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
  });

  // Hierarchy filters
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedContract, setSelectedContract] = useState("all");
  const [selectedSite, setSelectedSite] = useState("all");

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState<RosterSlot[]>([]);
  const [coverageMetrics, setCoverageMetrics] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Selected drawer objects
  const [activeDrawer, setActiveDrawer] = useState<"assign" | "details" | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<RosterSlot | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Slot Details & Bulk Unassignment state
  const [detailsSlotId, setDetailsSlotId] = useState<string | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState<boolean>(false);
  const [unassignAssignmentId, setUnassignAssignmentId] = useState<string | null>(null);
  const [unassignMode, setUnassignMode] = useState<"SINGLE_DAY" | "ENTIRE_ASSIGNMENT_PERIOD">("SINGLE_DAY");
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState<boolean>(false);
  
  // MP-3A Exception & Reliever Modals State
  const [dayOffModalAssignment, setDayOffModalAssignment] = useState<any | null>(null);
  const [leaveEffectModalAssignment, setLeaveEffectModalAssignment] = useState<any | null>(null);
  const [absentModalAssignment, setAbsentModalAssignment] = useState<any | null>(null);
  const [relieverDrawerData, setRelieverDrawerData] = useState<{ slot: any; exception: any; primaryAssignment: any } | null>(null);
  const [cancelResolveModalData, setCancelResolveModalData] = useState<{ mode: "cancel" | "resolve"; exception: any } | null>(null);

  // Assignment state
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [eligibleSearch, setEligibleSearch] = useState("");
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [overrideAllowed, setOverrideAllowed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);
 
  // Period lock state
  const [periodLocked, setPeriodLocked] = useState(false);
  const [processingLock, setProcessingLock] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
 
  // Sync & Publication operations
  const [syncingContracts, setSyncingContracts] = useState(false);
  const [publishingRoster, setPublishingRoster] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showChangeRequestsModal, setShowChangeRequestsModal] = useState(false);
 
  // 1. Fetch filter metadata options
  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch(`/api/v1/manpower/scheduling/filters?business=${business}&month=${selectedMonth}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            setClients(json.clients || []);
            setContracts(json.contracts || []);
            setProjects(json.projects || []);
            setSites(json.sites || []);
          }
        }
      } catch (e) {
        console.error("Failed to load scheduling filters", e);
      }
    }
    loadFilters();
  }, [business, selectedMonth]);
 
  // 2. Fetch slots and coverage metrics
  const fetchRosterData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);
    setApiError(null);
 
    try {
      const urlParams = new URLSearchParams();
      urlParams.set("business", business);
      if (viewMode === "month") {
        urlParams.set("month", selectedMonth);
      } else {
        urlParams.set("startDate", startDate);
        urlParams.set("endDate", endDate);
      }

      if (selectedContract !== "all") urlParams.set("contractId", selectedContract);
      if (selectedSite !== "all") urlParams.set("siteId", selectedSite);
 
      const rosterRes = await fetch(`/api/v1/manpower/scheduling/roster?${urlParams.toString()}`);
      const coverageRes = await fetch(`/api/v1/manpower/scheduling/coverage?${urlParams.toString()}`);
 
      if (rosterRes.ok && coverageRes.ok) {
        const rosterJson = await rosterRes.json();
        const coverageJson = await coverageRes.json();
        if (rosterJson.success && coverageJson.success) {
          setSlots(rosterJson.slots || []);
          setCoverageMetrics(coverageJson.summary || null);
          setPeriodLocked(coverageJson.locked || false);
        } else {
          const rawErr = rosterJson.error || coverageJson.error || "Failed to parse data";
          const userMsg = typeof rawErr === "string" && (rawErr.includes("prisma") || rawErr.includes("invocation") || rawErr.includes("column") || rawErr.includes("database"))
            ? "Unable to load roster data. Please contact the system administrator."
            : rawErr;
          setApiError(userMsg);
          setSlots([]);
          setCoverageMetrics(null);
        }
      } else {
        const errRes = !rosterRes.ok ? rosterRes : coverageRes;
        const errJson = await errRes.json().catch(() => ({}));
        const rawErr = errJson.error || `Server error (${errRes.status})`;
        const userMsg = typeof rawErr === "string" && (rawErr.includes("prisma") || rawErr.includes("invocation") || rawErr.includes("column") || rawErr.includes("database"))
          ? "Unable to load roster data. Please contact the system administrator."
          : rawErr;
        setApiError(userMsg);
        setSlots([]);
        setCoverageMetrics(null);
      }
    } catch (e: any) {
      console.error("Failed to fetch roster scheduling data", e);
      const rawMsg = e.message || "Failed to fetch roster scheduling data";
      const userMsg = typeof rawMsg === "string" && (rawMsg.includes("prisma") || rawMsg.includes("invocation") || rawMsg.includes("column") || rawMsg.includes("database"))
        ? "Unable to load roster data. Please contact the system administrator."
        : rawMsg;
      setApiError(userMsg);
      setSlots([]);
      setCoverageMetrics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
 
  useEffect(() => {
    fetchRosterData();
  }, [viewMode, selectedMonth, startDate, endDate, selectedContract, selectedSite, business]);

  // 3. Load eligible employee pool when assign drawer is opened
  const loadEligibleEmployees = async (slotId: string) => {
    setLoadingEligible(true);
    try {
      const res = await fetch(`/api/v1/manpower/scheduling/eligible-employees?slotId=${slotId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setEligibleEmployees(json.employees || []);
        }
      }
    } catch (e) {
      console.error("Failed to load eligible employee pool", e);
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleOpenAssign = (slot: RosterSlot) => {
    if (periodLocked) return;
    setSelectedSlot(slot);
    setEligibleSearch("");
    setOverrideAllowed(false);
    setOverrideReason("");
    setActiveDrawer("assign");
    loadEligibleEmployees(slot.id);
  };

  const handleOpenDetails = (slot: RosterSlot) => {
    setSelectedSlot(slot);
    setDetailsSlotId(slot.id);
    setIsDetailsDrawerOpen(true);
  };

  // 4. Assign slot
  const handleAssign = async (employeeId: string, ignoreEligibility = false) => {
    if (!selectedSlot) return;
    setSubmittingAssign(true);
    try {
      const res = await fetch(`/api/v1/manpower/scheduling/slots/${selectedSlot.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          expectedSlotVersion: selectedSlot.rowVersion,
          ignoreEligibility,
          overrideReason: ignoreEligibility ? overrideReason || "Manual override" : undefined
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setActiveDrawer(null);
        fetchRosterData(true);
      } else {
        alert(json.error || "Failed to assign employee to slot.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // 5. Unassign slot
  const handleUnassign = async () => {
    if (!selectedSlot) return;
    if (confirm("Are you sure you want to unassign this employee?")) {
      try {
        const res = await fetch(`/api/v1/manpower/scheduling/slots/${selectedSlot.id}/unassign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setActiveDrawer(null);
          fetchRosterData(true);
        } else {
          alert(json.error || "Failed to unassign employee.");
        }
      } catch (e: any) {
        alert("Error: " + e.message);
      }
    }
  };

  // 6. Sync slots
  const handleSyncSlots = async () => {
    if (selectedContract === "all") {
      alert("Please select a specific contract to synchronize.");
      return;
    }
    setSyncingContracts(true);
    try {
      // Pick first day and last day of selected month
      const [year, month] = selectedMonth.split("-").map(Number);
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endStr = new Date(year, month, 0).toISOString().split("T")[0];

      const res = await fetch("/api/v1/manpower/scheduling/slots/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: selectedContract,
          startDate: startStr,
          endDate: endStr
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(`Synchronized slots successfully! Generated: ${json.generated}, Cancelled: ${json.cancelled}`);
        fetchRosterData(true);
      } else {
        alert(json.error || "Synchronization failed.");
      }
    } catch (e: any) {
      alert("Error during sync: " + e.message);
    } finally {
      setSyncingContracts(false);
    }
  };

  // 7. Publish roster
  const handlePublishRoster = async () => {
    if (selectedContract === "all") {
      alert("Please select a specific contract to publish.");
      return;
    }
    if (confirm(`Are you sure you want to publish the initial roster for contract and range?`)) {
      setPublishingRoster(true);
      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
        const endStr = new Date(year, month, 0).toISOString().split("T")[0];
        const opType = business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

        const res = await fetch("/api/v1/manpower/scheduling/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationType: opType,
            contractId: selectedContract,
            startDate: startStr,
            endDate: endStr
          })
        });
        const json = await res.json();
        if (res.ok && json.success) {
          alert(`Roster Version 1 published successfully!`);
          fetchRosterData(true);
        } else if (res.status === 409) {
          alert(`Active publication already exists. Post-publication changes require an approved RosterChangeRequest.`);
          setShowChangeRequestsModal(true);
        } else {
          alert(json.error || "Failed to publish roster.");
        }
      } catch (e: any) {
        alert("Error publishing: " + e.message);
      } finally {
        setPublishingRoster(false);
      }
    }
  };

  // 8. Toggle lock
  const handleToggleLock = async () => {
    if (periodLocked) {
      setShowUnlockModal(true);
      return;
    }

    if (!confirm(`Are you sure you want to lock the period ${selectedMonth} for ${operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}?`)) {
      return;
    }

    setProcessingLock(true);
    try {
      const res = await fetch("/api/v1/manpower/scheduling/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType,
          period: selectedMonth,
          locked: true
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPeriodLocked(true);
        fetchRosterData(true);
      } else {
        alert(json.error || "Failed to lock period.");
      }
    } catch (e: any) {
      alert("Error locking period: " + e.message);
    } finally {
      setProcessingLock(false);
    }
  };

  const handleConfirmUnlock = async () => {
    if (!unlockReason || !unlockReason.trim()) {
      setUnlockError("An unlock reason is required.");
      return;
    }

    setProcessingLock(true);
    setUnlockError(null);

    try {
      const res = await fetch("/api/v1/manpower/scheduling/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType,
          period: selectedMonth,
          locked: false,
          unlockReason: unlockReason.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPeriodLocked(false);
        setShowUnlockModal(false);
        setUnlockReason("");
        fetchRosterData(true);
      } else {
        setUnlockError(json.error || "Failed to unlock period.");
      }
    } catch (e: any) {
      setUnlockError("Error: " + e.message);
    } finally {
      setProcessingLock(false);
    }
  };

  // Group slots for the grid view
  const groupedRows = useMemo(() => {
    const groups: { [key: string]: { 
      label: string; 
      line1: string; 
      line2: string; 
      siteName: string; 
      postOrZone: string; 
      slotsByDate: { [dateStr: string]: RosterSlot[] } 
    } } = {};

    const targetSlots = selectedSite === "all" ? slots : slots.filter(s => s.siteId === selectedSite);
    
    targetSlots.forEach(slot => {
      const siteName = slot.site?.name || (slot as any).project?.name || "Site Not Specified";
      const locationUnit = (slot as any).shiftRequirement?.locationUnit;
      let postOrZone = "Post Not Specified";

      if (locationUnit && locationUnit.name) {
        postOrZone = locationUnit.name;
      }
      
      const line1 = `${siteName} • ${postOrZone}`;
      const line2 = `${slot.snapshotPosition} • ${slot.snapshotShiftName} • Slot ${slot.slotIndex}`;
      const key = `${slot.contractId}-${slot.siteId || 'none'}-${slot.snapshotPosition}-${slot.snapshotShiftName}-${slot.slotIndex}`;
      const label = `${line1} | ${line2}`;
      
      if (!groups[key]) {
        groups[key] = { label, line1, line2, siteName, postOrZone, slotsByDate: {} };
      }
      
      const dateStr = slot.businessDate.split("T")[0];
      if (!groups[key].slotsByDate[dateStr]) {
        groups[key].slotsByDate[dateStr] = [];
      }
      groups[key].slotsByDate[dateStr].push(slot);
    });
    
    return Object.values(groups);
  }, [slots, selectedSite]);

  // Days array for grid (month or custom range)
  const daysInMonth = useMemo(() => {
    if (viewMode === "month") {
      if (!selectedMonth) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const date = new Date(year, month - 1, 1);
      const result: string[] = [];
      while (date.getMonth() === month - 1) {
        result.push(date.toISOString().split("T")[0]);
        date.setDate(date.getDate() + 1);
      }
      return result;
    } else {
      if (!startDate || !endDate) return [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) return [];
      const result: string[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        result.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
      }
      return result;
    }
  }, [viewMode, selectedMonth, startDate, endDate]);

  const filteredEmployees = useMemo(() => {
    return eligibleEmployees.filter(item => 
      item.employee.name.toLowerCase().includes(eligibleSearch.toLowerCase()) ||
      item.employee.id.toLowerCase().includes(eligibleSearch.toLowerCase())
    );
  }, [eligibleEmployees, eligibleSearch]);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between border-b border-outline-variant pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/manpower/${business}/dashboard`} className="text-secondary hover:text-primary transition-colors flex items-center" aria-label="Go Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Roster Board & Shift Planner</h1>
            <Badge className="bg-primary/10 text-primary border border-primary/20">{businessLabel}</Badge>
          </div>
          <p className="text-sm text-secondary mt-1">Schedule requirement slots, manage employee assignments, and publish standard rosters.</p>
        </div>

        <div className="flex flex-col items-end gap-1 mt-4 md:mt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleSyncSlots}
              disabled={syncingContracts || selectedContract === "all" || periodLocked || (selectedContract !== "all" && !contracts.find(c => c.id === selectedContract)?.syncEligible)}
              className="h-10 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncingContracts ? "animate-spin" : ""}`} aria-hidden="true" />
              {syncingContracts ? "Syncing..." : "Sync Contract Slots"}
            </Button>

            <Button
              variant="primary"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={periodLocked}
              className="h-10 gap-2"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Bulk Deploy Manpower
            </Button>
            
            <Button
              variant="primary"
              onClick={handlePublishRoster}
              disabled={publishingRoster || selectedContract === "all" || periodLocked}
              className="h-10 gap-2"
              aria-label="Publish Month Roster"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {publishingRoster ? "Publishing..." : "Publish Month Roster"}
            </Button>

            <Button
              variant="secondary"
              onClick={() => setShowHistoryModal(true)}
              disabled={selectedContract === "all"}
              className="h-10 gap-2"
              aria-label="View Version History"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Version History
            </Button>

            <Button
              variant="secondary"
              onClick={() => setShowChangeRequestsModal(true)}
              disabled={selectedContract === "all"}
              className="h-10 gap-2"
              aria-label="Change Requests Inbox"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Change Requests
            </Button>

            <Button
              variant={periodLocked ? "error" : "secondary"}
              onClick={handleToggleLock}
              disabled={processingLock}
              className="h-10 gap-2"
            >
              {periodLocked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Unlock className="h-4 w-4" aria-hidden="true" />}
              {periodLocked ? "Locked" : "Lock Period"}
            </Button>
          </div>
          {/* Explanation tags */}
          {selectedContract === "all" && (
            <span className="text-[11px] text-amber-600 font-medium mt-1">Select a specific active contract to generate roster slots.</span>
          )}
          {selectedContract !== "all" && periodLocked && (
            <span className="text-[11px] text-destructive font-medium mt-1">Period is locked. Action not allowed.</span>
          )}
          {selectedContract !== "all" && !periodLocked && !contracts.find(c => c.id === selectedContract)?.syncEligible && (
            <span className="text-[11px] text-destructive font-medium mt-1">
              Cannot Sync: {contracts.find(c => c.id === selectedContract)?.syncBlockReasons?.map((r: string) => {
                if (r === "CONTRACT_NOT_ACTIVE") return "Contract is not active";
                if (r === "NO_EFFECTIVE_MANPOWER_REQUIREMENTS") return "No manpower requirements";
                if (r === "NO_ACTIVE_SHIFT_REQUIREMENTS") return "No active shift requirements";
                if (r === "NO_ELIGIBLE_SITE") return "No project/site allocation";
                if (r === "OUTSIDE_CONTRACT_PERIOD") return "Selected month is outside contract dates";
                return r;
              }).join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* KPI stats bar */}
      {!apiError && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Total Required Slots</span>
              <span className="text-2xl font-bold tracking-tight text-foreground">{coverageMetrics?.requiredCount || 0}</span>
            </div>
            <CalendarDays className="h-8 w-8 text-secondary bg-secondary/10 p-1.5 rounded-lg" aria-hidden="true" />
          </div>
          <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Filled Assignments</span>
              <span className="text-2xl font-bold tracking-tight text-success">{coverageMetrics?.filledCount || 0}</span>
            </div>
            <UserPlus className="h-8 w-8 text-success bg-success/10 p-1.5 rounded-lg" aria-hidden="true" />
          </div>
          <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Vacant Positions</span>
              <span className="text-2xl font-bold tracking-tight text-amber-500">{coverageMetrics?.vacantCount || 0}</span>
            </div>
            <TriangleAlert className="h-8 w-8 text-amber-500 bg-amber-500/10 p-1.5 rounded-lg" aria-hidden="true" />
          </div>
          <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Roster Coverage Rate</span>
              <span className="text-2xl font-bold tracking-tight text-primary">
                {coverageMetrics?.requiredCount ? Math.round((coverageMetrics.filledCount / coverageMetrics.requiredCount) * 100) : 0}%
              </span>
            </div>
            <BarChart3 className="h-8 w-8 text-primary bg-primary/10 p-1.5 rounded-lg" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Date Range & Planning View Selector */}
      <DateRangeSelector
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        periodLocked={periodLocked}
        onRefresh={() => fetchRosterData(true)}
        refreshing={refreshing}
      />

      {/* Filters bar */}
      <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-col flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-secondary mb-1">Contract Requirement</label>
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Active Contracts</option>
            {contracts.map(c => (
              <option key={c.id} value={c.id}>{c.contractNumber} - {c.title}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-secondary mb-1">Deployment Worksite / Site</label>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Sites</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <Button
          variant="secondary"
          onClick={() => fetchRosterData(true)}
          className="h-10 w-10 p-0 self-end"
          aria-label="Refresh Roster Board"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Roster matrix grid */}
      <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span className="text-sm font-medium text-secondary">Loading Roster slots...</span>
          </div>
        ) : apiError ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-destructive">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <h3 className="text-lg font-bold">API Request Failed</h3>
            <p className="text-sm max-w-md mt-1 mb-4">{apiError}</p>
            <Button
              variant="ghost"
              onClick={() => fetchRosterData(true)}
              className="border border-status-error/20 text-status-error hover:bg-status-error/10 text-xs font-semibold py-2 px-4 rounded-lg gap-2"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Grid2X2 className="h-12 w-12 text-secondary mb-3" />
            <h3 className="text-lg font-bold text-foreground">No Active Contracts</h3>
            <p className="text-sm text-secondary max-w-md mt-1">No active contracts found for the selected operation scope.</p>
          </div>
        ) : selectedContract === "all" && groupedRows.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Grid2X2 className="h-12 w-12 text-secondary mb-3" />
            <h3 className="text-lg font-bold text-foreground">Select a Contract to Sync</h3>
            <p className="text-sm text-secondary max-w-md mt-1">Select an active contract and site, then click Sync Contract Slots.</p>
          </div>
        ) : selectedContract !== "all" && groupedRows.length === 0 ? (
          (() => {
            const activeContractMeta = contracts.find(c => c.id === selectedContract);
            const reasons = activeContractMeta?.syncBlockReasons || [];

            if (reasons.includes("NO_EFFECTIVE_MANPOWER_REQUIREMENTS")) {
              return (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <TriangleAlert className="h-12 w-12 text-amber-500 mb-3" />
                  <h3 className="text-lg font-bold text-foreground">No Effective Manpower Requirements</h3>
                  <p className="text-sm text-secondary max-w-md mt-1">This contract has no effective manpower and shift requirements for the selected month.</p>
                </div>
              );
            }
            if (reasons.includes("NO_ACTIVE_SHIFT_REQUIREMENTS")) {
              return (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <TriangleAlert className="h-12 w-12 text-amber-500 mb-3" />
                  <h3 className="text-lg font-bold text-foreground">No Active Shift Requirements</h3>
                  <p className="text-sm text-secondary max-w-md mt-1">This contract has no effective manpower and shift requirements for the selected month.</p>
                </div>
              );
            }
            if (reasons.includes("NO_ELIGIBLE_SITE")) {
              return (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <TriangleAlert className="h-12 w-12 text-amber-500 mb-3" />
                  <h3 className="text-lg font-bold text-foreground">No Valid Site Allocation</h3>
                  <p className="text-sm text-secondary max-w-md mt-1">This contract is missing a valid project/site allocation or event location.</p>
                </div>
              );
            }
            if (reasons.includes("OUTSIDE_CONTRACT_PERIOD")) {
              return (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <TriangleAlert className="h-12 w-12 text-amber-500 mb-3" />
                  <h3 className="text-lg font-bold text-foreground">Outside Contract Period</h3>
                  <p className="text-sm text-secondary max-w-md mt-1">The selected target month is outside this contract's active period.</p>
                </div>
              );
            }
            if (periodLocked) {
              return (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Lock className="h-12 w-12 text-destructive mb-3" />
                  <h3 className="text-lg font-bold text-foreground">Period Locked</h3>
                  <p className="text-sm text-secondary max-w-md mt-1">This period is locked. Synchronization and assignments are disabled.</p>
                </div>
              );
            }

            return (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Grid2X2 className="h-12 w-12 text-secondary mb-3" />
                <h3 className="text-lg font-bold text-foreground">No Slots Synchronized</h3>
                <p className="text-sm text-secondary max-w-md mt-1">Roster sync completed with zero slots. Click Sync Contract Slots to generate requirements.</p>
              </div>
            );
          })()
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-surface-variant border-b border-outline-variant text-secondary font-bold select-none">
                <tr>
                  <th className="p-3 border-r border-outline-variant min-w-[280px] sticky left-0 bg-surface-variant z-10">Requirement Slots</th>
                  {daysInMonth.map(dateStr => {
                    const dateObj = new Date(dateStr);
                    const dayNum = dateObj.getDate();
                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                    return (
                      <th key={dateStr} className="p-2 border-r border-outline-variant min-w-[90px] text-center">
                        <div className="font-semibold text-[10px] uppercase tracking-wider">{dayName}</div>
                        <div className="text-lg font-bold text-foreground">{dayNum}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {groupedRows.map(row => (
                  <tr key={row.label} className="hover:bg-surface-variant/20 transition-colors">
                    <td className="p-3 border-r border-outline-variant font-medium text-foreground sticky left-0 bg-surface shadow-sm z-10">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-foreground tracking-tight">{row.line1}</span>
                        <span className="text-[11px] text-secondary font-normal mt-0.5">{row.line2}</span>
                      </div>
                    </td>
                    {daysInMonth.map(dateStr => {
                      const matchedSlots = row.slotsByDate[dateStr] || [];
                      if (matchedSlots.length === 0) {
                        return <td key={dateStr} className="p-2 border-r border-outline-variant bg-surface-variant/10 text-center text-secondary">-</td>;
                      }

                      const slot = matchedSlots[0];
                      const activeAssignment = slot.assignments[0];
                      const isVacant = slot.fulfillmentStatus === "VACANT";
                      const isCancelled = slot.fulfillmentStatus === "CANCELLED";
                      const activeException = (slot as any).planningExceptions?.[0] || activeAssignment?.planningException;

                      if (isCancelled) {
                        return (
                          <td key={dateStr} className="p-1 border-r border-outline-variant bg-destructive/5 text-center">
                            <span className="text-[10px] font-bold text-destructive/50 uppercase tracking-wider">CANCELLED</span>
                          </td>
                        );
                      }

                      if (isVacant || !activeAssignment) {
                        return (
                          <td
                            key={dateStr}
                            className="p-1 border-r border-outline-variant"
                          >
                            <button
                              type="button"
                              disabled={periodLocked}
                              onClick={() => !periodLocked && handleOpenAssign(slot)}
                              className="w-full h-11 rounded-lg border border-dashed border-outline-variant hover:border-primary/50 flex flex-col items-center justify-center text-secondary gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-semibold">VACANT</span>
                            </button>
                          </td>
                        );
                      }

                      return (
                        <td key={dateStr} className="p-1 border-r border-outline-variant min-w-[130px]">
                          <CellActionMenu
                            slot={slot}
                            assignment={activeAssignment}
                            exception={activeException}
                            periodLocked={periodLocked}
                            onOpenDetails={() => handleOpenDetails(slot)}
                            onOpenDayOff={() => setDayOffModalAssignment({ assignment: activeAssignment, slot })}
                            onOpenLeaveEffect={() => setLeaveEffectModalAssignment({ assignment: activeAssignment, slot })}
                            onOpenAbsent={() => setAbsentModalAssignment({ assignment: activeAssignment, slot })}
                            onOpenAssignReliever={() => setRelieverDrawerData({ slot, exception: activeException, primaryAssignment: activeAssignment })}
                            onOpenUnassignReliever={async () => {
                              if (confirm("Are you sure you want to unassign this reliever?")) {
                                try {
                                  const res = await fetch(`/api/v1/manpower/scheduling/assignments/${activeAssignment.id}/unassign-reliever`, { method: "POST" });
                                  const json = await res.json();
                                  if (res.ok && json.success) fetchRosterData(true);
                                  else alert(json.error || "Failed to unassign reliever");
                                } catch (e: any) {
                                  alert(e.message || "Failed to unassign reliever");
                                }
                              }
                            }}
                            onOpenCancelException={() => setCancelResolveModalData({ mode: "cancel", exception: activeException })}
                            onOpenResolveException={() => setCancelResolveModalData({ mode: "resolve", exception: activeException })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DRAWERS & DIALOGS */}
      {activeDrawer === "assign" && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-surface w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="border-b border-outline-variant p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-foreground">Assign Employee Slot</h3>
                <p className="text-xs text-secondary mt-0.5">
                  {selectedSlot.snapshotPosition} ({selectedSlot.snapshotStartTime} - {selectedSlot.snapshotEndTime})
                </p>
              </div>
              <button onClick={() => setActiveDrawer(null)} className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center" aria-label="Close Drawer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Eligible employees list search */}
            <div className="p-4 border-b border-outline-variant bg-surface-variant/10">
              <input
                type="text"
                value={eligibleSearch}
                onChange={(e) => setEligibleSearch(e.target.value)}
                placeholder="Search by name or employee code..."
                className="w-full bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingEligible ? (
                <div className="p-8 flex flex-col items-center justify-center gap-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="text-xs text-secondary">Checking scheduling eligibility...</span>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-secondary">No matching eligible employees found.</div>
              ) : (
                filteredEmployees.map(item => {
                  const hasErrors = item.errors.length > 0;
                  const hasWarnings = item.warnings.length > 0;
                  const canClick = !hasErrors || (overrideAllowed && overrideReason.trim().length > 0);

                  return (
                    <div
                      key={item.employee.id}
                      className={`border p-3 rounded-xl transition-all ${
                        hasErrors 
                          ? "border-destructive/20 bg-destructive/5 opacity-80" 
                          : hasWarnings 
                            ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40" 
                            : "border-outline hover:border-primary/40 bg-surface"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{item.employee.name}</h4>
                          <p className="text-xs text-secondary mt-0.5">{item.employee.id} • {resolveEmployeeTradePosition(item.employee)}</p>
                        </div>
                        {hasErrors ? (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Blocked</Badge>
                        ) : hasWarnings ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Warnings</Badge>
                        ) : (
                          <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Eligible</Badge>
                        )}
                      </div>

                      {/* Warnings / Errors details */}
                      {(item.errors.length > 0 || item.warnings.length > 0) && (
                        <div className="mt-2 space-y-1 pl-2 border-l border-outline-variant text-[11px]">
                          {item.errors.map(err => (
                            <div key={err} className="text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" /> {err}
                            </div>
                          ))}
                          {item.warnings.map(warn => (
                            <div key={warn} className="text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> {warn}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-3 flex items-center justify-end gap-2">
                        {hasErrors && (
                          <div className="flex items-center gap-2 mr-auto">
                            <input
                              type="checkbox"
                              id={`override-${item.employee.id}`}
                              checked={overrideAllowed}
                              onChange={(e) => setOverrideAllowed(e.target.checked)}
                              className="rounded border-outline text-primary focus:ring-primary"
                            />
                            <label htmlFor={`override-${item.employee.id}`} className="text-xs font-semibold text-secondary">Allow Override</label>
                          </div>
                        )}

                        <Button
                          variant={hasErrors ? "secondary" : hasWarnings ? "warning" : "primary"}
                          disabled={hasErrors ? true : submittingAssign || !canClick}
                          onClick={() => handleAssign(item.employee.id, hasErrors)}
                          size="sm"
                        >
                          {hasErrors ? "Not Eligible" : submittingAssign ? "Assigning..." : hasWarnings ? "Assign with Warning" : "Assign"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Override reasoning section if override checkbox is clicked */}
            {overrideAllowed && (
              <div className="border-t border-outline-variant p-4 bg-amber-500/5 space-y-2">
                <label className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Override Audit Reason Required
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter the justification reason for this rule override..."
                  rows={2}
                  className="w-full bg-background border border-amber-500/20 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeDrawer === "details" && selectedSlot && selectedSlot.assignments[0] && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-surface w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="border-b border-outline-variant p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-foreground">Assignment Details</h3>
                <p className="text-xs text-secondary mt-0.5">Roster Slot ID: {selectedSlot.id}</p>
              </div>
              <button onClick={() => setActiveDrawer(null)} className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center" aria-label="Close Details">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Assignment contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Employee section */}
              <div>
                <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block mb-2">Assigned Staff</span>
                <div className="flex items-center gap-3 bg-surface-variant/20 p-4 rounded-xl border border-outline-variant">
                  <div className="h-10 w-10 bg-primary/10 text-primary font-bold rounded-full flex items-center justify-center">
                    {selectedSlot.assignments[0].employee.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{selectedSlot.assignments[0].employee.name}</h4>
                    <p className="text-xs text-secondary mt-0.5">QID / Employee Code: {selectedSlot.assignments[0].employee.id}</p>
                  </div>
                </div>
              </div>

              {/* Requirement details */}
              <div>
                <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block mb-2">Slot Requirements</span>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                    <span className="text-xs text-secondary">Contract Position</span>
                    <span className="text-xs font-semibold text-foreground">{selectedSlot.snapshotPosition}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                    <span className="text-xs text-secondary">Shift Coverage</span>
                    <span className="text-xs font-semibold text-foreground">{selectedSlot.snapshotShiftName}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                    <span className="text-xs text-secondary">Timing hours</span>
                    <span className="text-xs font-semibold text-foreground">{selectedSlot.snapshotStartTime} - {selectedSlot.snapshotEndTime}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs text-secondary">Calendar Date</span>
                    <span className="text-xs font-semibold text-foreground">{selectedSlot.businessDate.split("T")[0]}</span>
                  </div>
                </div>
              </div>

              {/* Validation snapshot */}
              {selectedSlot.assignments[0].validationSnapshot && (
                <div>
                  <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block mb-2">Eligibility Checklist Snapshot</span>
                  <div className="border border-outline-variant rounded-xl divide-y divide-outline-variant overflow-hidden">
                    {selectedSlot.assignments[0].validationSnapshot.checklist?.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between bg-surface">
                        <div>
                          <div className="text-xs font-semibold text-foreground">{item.rule}</div>
                          <div className="text-[10px] text-secondary mt-0.5">{item.details}</div>
                        </div>
                        {item.status === "PASS" ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : item.status === "FAIL" ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Info className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Unassign action footer */}
            <div className="border-t border-outline-variant p-4 flex items-center justify-end">
              <Button
                variant="error"
                onClick={handleUnassign}
                className="h-10 gap-2"
              >
                <UserMinus className="h-4 w-4" /> Unassign Slot
              </Button>
            </div>
          </div>
        </div>
      )}

      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-xl border border-outline-variant shadow-2xl p-6 space-y-4 animate-fade-in">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" /> Unlock Planning Period
              </h3>
              <p className="text-xs text-secondary mt-1">
                You are about to unlock the scheduling period. This will enable slot synchronization and roster assignment actions.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-outline-variant pb-2">
                <span className="text-secondary">Operation Scope:</span>
                <span className="font-semibold text-foreground">
                  {operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
                </span>
              </div>
              <div className="flex justify-between border-b border-outline-variant pb-2">
                <span className="text-secondary">Planning Period:</span>
                <span className="font-semibold text-foreground">{selectedMonth}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">
                Unlock Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                value={unlockReason}
                onChange={(e) => {
                  setUnlockReason(e.target.value);
                  setUnlockError(null);
                }}
                placeholder="Enter the mandatory business reason for unlocking this period..."
                rows={3}
                className="w-full bg-background border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {unlockError && (
                <span className="text-[11px] text-destructive font-medium block mt-1">{unlockError}</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockReason("");
                  setUnlockError(null);
                }}
                disabled={processingLock}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleConfirmUnlock}
                disabled={processingLock}
                size="sm"
                className="gap-1.5"
              >
                {processingLock ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Unlocking...
                  </>
                ) : (
                  "Confirm Unlock"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MP-3A Modals & Drawers */}
      <DayOffModal
        isOpen={!!dayOffModalAssignment}
        onClose={() => setDayOffModalAssignment(null)}
        primaryAssignment={dayOffModalAssignment?.assignment || dayOffModalAssignment}
        slot={dayOffModalAssignment?.slot}
        employee={dayOffModalAssignment?.assignment?.employee || dayOffModalAssignment?.employee}
        onSuccess={() => fetchRosterData(true)}
        periodLocked={periodLocked}
      />

      <LeaveEffectModal
        isOpen={!!leaveEffectModalAssignment}
        onClose={() => setLeaveEffectModalAssignment(null)}
        primaryAssignment={leaveEffectModalAssignment?.assignment || leaveEffectModalAssignment}
        slot={leaveEffectModalAssignment?.slot}
        employee={leaveEffectModalAssignment?.assignment?.employee || leaveEffectModalAssignment?.employee}
        onSuccess={() => fetchRosterData(true)}
        periodLocked={periodLocked}
      />

      <AbsenceModal
        isOpen={!!absentModalAssignment}
        onClose={() => setAbsentModalAssignment(null)}
        primaryAssignment={absentModalAssignment?.assignment || absentModalAssignment}
        slot={absentModalAssignment?.slot}
        employee={absentModalAssignment?.assignment?.employee || absentModalAssignment?.employee}
        onSuccess={() => fetchRosterData(true)}
        periodLocked={periodLocked}
      />

      <CancelResolveModal
        isOpen={!!cancelResolveModalData}
        mode={cancelResolveModalData?.mode || "cancel"}
        onClose={() => setCancelResolveModalData(null)}
        exception={cancelResolveModalData?.exception}
        onSuccess={() => fetchRosterData(true)}
        periodLocked={periodLocked}
      />

      <RelieverDrawer
        isOpen={!!relieverDrawerData}
        onClose={() => setRelieverDrawerData(null)}
        slot={relieverDrawerData?.slot}
        exception={relieverDrawerData?.exception}
        primaryAssignment={relieverDrawerData?.primaryAssignment}
        onSuccess={() => fetchRosterData(true)}
        periodLocked={periodLocked}
      />

      <RosterPublicationHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        operationType={business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT"}
        contractId={selectedContract}
        siteId={selectedSite !== "all" ? selectedSite : null}
        onCancelSuccess={() => fetchRosterData(true)}
      />

      <RosterChangeRequestModal
        isOpen={showChangeRequestsModal}
        onClose={() => setShowChangeRequestsModal(false)}
        operationType={business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT"}
        contractId={selectedContract}
        siteId={selectedSite !== "all" ? selectedSite : null}
        currentUserEmployeeId={(session?.user as any)?.employeeId || (session?.user as any)?.id}
        currentUserRole={(session?.user as any)?.role}
        onReviewSuccess={() => fetchRosterData(true)}
      />

      <BulkDeploymentModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        operationType={business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT"}
        contractId={selectedContract}
        selectedMonth={selectedMonth}
        slots={slots}
        employees={eligibleEmployees.map(e => e.employee)}
        onSuccess={(summaryText) => {
          fetchRosterData(true);
        }}
      />

      <SlotDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={() => setIsDetailsDrawerOpen(false)}
        slotId={detailsSlotId}
        onTriggerUnassign={async (mode) => {
          setIsDetailsDrawerOpen(false);
          if (!detailsSlotId) return;
          try {
            const res = await fetch(`/api/v1/manpower/scheduling/slots/${detailsSlotId}/details`);
            const data = await res.json();
            if (data.currentAssignment?.id) {
              setUnassignAssignmentId(data.currentAssignment.id);
              setUnassignMode(mode);
              setIsUnassignModalOpen(true);
            }
          } catch (e) {
            console.error("Failed to fetch assignment for unassignment", e);
          }
        }}
      />

      <BulkUnassignmentModal
        isOpen={isUnassignModalOpen}
        onClose={() => setIsUnassignModalOpen(false)}
        assignmentId={unassignAssignmentId}
        mode={unassignMode}
        onSuccess={() => {
          fetchRosterData(true);
        }}
      />
    </div>
  );
}
