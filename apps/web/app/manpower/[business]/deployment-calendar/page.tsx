"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { hasPermission } from "../../../../lib/permissions";

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
  assignments: Array<{
    id: string;
    employeeId: string;
    assignmentType: string;
    historyStatus: string;
    validationSnapshot: any;
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

  // Roster month filter (format: YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
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
  
  // Selected drawer objects
  const [activeDrawer, setActiveDrawer] = useState<"assign" | "details" | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<RosterSlot | null>(null);
  
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

  // Sync operations
  const [syncingContracts, setSyncingContracts] = useState(false);
  const [publishingRoster, setPublishingRoster] = useState(false);

  // 1. Fetch filter metadata options
  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch(`/api/v1/manpower/scheduling/filters?business=${business}`);
        if (res.ok) {
          const json = await res.ok ? await res.json() : null;
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
  }, [business]);

  // 2. Fetch slots and coverage metrics
  const fetchRosterData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);

    try {
      const urlParams = new URLSearchParams();
      urlParams.set("month", selectedMonth);
      urlParams.set("business", business);
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
        }
      }
    } catch (e) {
      console.error("Failed to fetch roster scheduling data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRosterData();
  }, [selectedMonth, selectedContract, selectedSite, business]);

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
    setActiveDrawer("details");
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
    if (confirm(`Are you sure you want to publish the roster for contract and range?`)) {
      setPublishingRoster(true);
      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
        const endStr = new Date(year, month, 0).toISOString().split("T")[0];

        const res = await fetch("/api/v1/manpower/scheduling/publications", {
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
          alert(`Roster published successfully! ${json.slotsPublishedCount} slots snapshot created.`);
          fetchRosterData(true);
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
    setProcessingLock(true);
    try {
      const res = await fetch("/api/v1/manpower/scheduling/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType,
          period: selectedMonth,
          locked: !periodLocked
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPeriodLocked(!periodLocked);
        fetchRosterData(true);
      } else {
        alert(json.error || "Failed to toggle period lock.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setProcessingLock(false);
    }
  };

  // Group slots for the grid view
  const groupedRows = useMemo(() => {
    const groups: { [key: string]: { label: string; slotsByDate: { [dateStr: string]: RosterSlot[] } } } = {};
    
    slots.forEach(slot => {
      // Grouping key: Site - Position - Shift - Slot Index
      const siteName = slot.site?.name || "Event / Temporary Venue";
      const key = `${slot.contractId}-${slot.siteId}-${slot.snapshotPosition}-${slot.snapshotShiftName}-${slot.slotIndex}`;
      const label = `${siteName} • ${slot.snapshotPosition} (${slot.snapshotShiftName}) #Slot ${slot.slotIndex}`;
      
      if (!groups[key]) {
        groups[key] = { label, slotsByDate: {} };
      }
      
      const dateStr = slot.businessDate.split("T")[0];
      if (!groups[key].slotsByDate[dateStr]) {
        groups[key].slotsByDate[dateStr] = [];
      }
      groups[key].slotsByDate[dateStr].push(slot);
    });
    
    return Object.values(groups);
  }, [slots]);

  // Days in month array
  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    const result: string[] = [];
    while (date.getMonth() === month - 1) {
      result.push(date.toISOString().split("T")[0]);
      date.setDate(date.getDate() + 1);
    }
    return result;
  }, [selectedMonth]);

  const filteredEmployees = useMemo(() => {
    return eligibleEmployees.filter(item => 
      item.employee.name.toLowerCase().includes(eligibleSearch.toLowerCase()) ||
      item.employee.id.toLowerCase().includes(eligibleSearch.toLowerCase())
    );
  }, [eligibleEmployees, eligibleSearch]);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-outline-variant pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/manpower/${business}/dashboard`} className="text-secondary hover:text-primary transition-colors flex items-center">
              <span className="material-icons text-xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Roster Board & Shift Planner</h1>
            <Badge className="bg-primary/10 text-primary border border-primary/20">{businessLabel}</Badge>
          </div>
          <p className="text-sm text-secondary mt-1">Schedule requirement slots, manage employee assignments, and publish standard rosters.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={handleSyncSlots}
            disabled={syncingContracts || selectedContract === "all"}
            className="btn btn-outline border border-outline hover:bg-surface-variant text-sm font-medium h-10 px-4 rounded-lg inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-lg">sync</span>
            {syncingContracts ? "Syncing..." : "Sync Contract Slots"}
          </button>
          
          <button
            onClick={handlePublishRoster}
            disabled={publishingRoster || selectedContract === "all"}
            className="btn bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-medium h-10 px-4 rounded-lg inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-lg">publish</span>
            {publishingRoster ? "Publishing..." : "Publish Month Roster"}
          </button>

          <button
            onClick={handleToggleLock}
            disabled={processingLock}
            className={`btn text-sm font-medium h-10 px-4 rounded-lg inline-flex items-center gap-2 border ${
              periodLocked
                ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15"
                : "border-outline hover:bg-surface-variant text-foreground"
            }`}
          >
            <span className="material-icons text-lg">{periodLocked ? "lock" : "lock_open"}</span>
            {periodLocked ? "Locked" : "Unlock Period"}
          </button>
        </div>
      </div>

      {/* KPI stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Total Required Slots</span>
            <span className="text-2xl font-bold tracking-tight text-foreground">{coverageMetrics?.requiredCount || 0}</span>
          </div>
          <span className="material-icons text-secondary text-3xl bg-secondary/10 p-2 rounded-lg">calendar_today</span>
        </div>
        <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Filled Assignments</span>
            <span className="text-2xl font-bold tracking-tight text-success">{coverageMetrics?.filledCount || 0}</span>
          </div>
          <span className="material-icons text-success text-3xl bg-success/10 p-2 rounded-lg">person_add</span>
        </div>
        <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Vacant Positions</span>
            <span className="text-2xl font-bold tracking-tight text-amber-500">{coverageMetrics?.vacantCount || 0}</span>
          </div>
          <span className="material-icons text-amber-500 text-3xl bg-amber-500/10 p-2 rounded-lg">warning_amber</span>
        </div>
        <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-secondary font-medium uppercase tracking-wider block">Roster Coverage Rate</span>
            <span className="text-2xl font-bold tracking-tight text-primary">
              {coverageMetrics?.requiredCount ? Math.round((coverageMetrics.filledCount / coverageMetrics.requiredCount) * 100) : 0}%
            </span>
          </div>
          <span className="material-icons text-primary text-3xl bg-primary/10 p-2 rounded-lg">query_stats</span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-secondary mb-1">Target Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-background border border-outline rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

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

        <button
          onClick={() => fetchRosterData(true)}
          className="btn border border-outline hover:bg-surface-variant h-10 w-10 rounded-lg inline-flex items-center justify-center self-end"
        >
          <span className="material-icons text-xl">refresh</span>
        </button>
      </div>

      {/* Roster matrix grid */}
      <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span className="text-sm font-medium text-secondary">Loading Roster slots...</span>
          </div>
        ) : groupedRows.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <span className="material-icons text-secondary text-5xl mb-3">grid_off</span>
            <h3 className="text-lg font-bold text-foreground">No Roster Slots Generated</h3>
            <p className="text-sm text-secondary max-w-md mt-1">Ensure you have selected an active contract and clicked "Sync Contract Slots" to generate requirement slots for the month.</p>
          </div>
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
                      {row.label}
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

                      let cellBgClass = "bg-surface border border-dashed border-outline-variant hover:border-primary/50 cursor-pointer";
                      let content = (
                        <div className="flex flex-col items-center justify-center h-full text-secondary gap-1 select-none">
                          <span className="material-icons text-sm">add</span>
                          <span className="text-[10px] font-semibold">VACANT</span>
                        </div>
                      );

                      if (activeAssignment) {
                        const hasWarnings = activeAssignment.validationSnapshot?.checklist?.some((i: any) => i.status === "FAIL" || i.status === "WARN") || false;
                        cellBgClass = `bg-emerald-500/10 border ${
                          hasWarnings ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/20"
                        } hover:shadow-sm cursor-pointer p-2 rounded-lg`;
                        content = (
                          <div className="flex flex-col h-full text-left relative">
                            <span className="font-semibold text-foreground truncate max-w-[80px]">{activeAssignment.employee.name}</span>
                            <span className="text-[10px] text-secondary mt-0.5 truncate">{activeAssignment.employee.id}</span>
                            {hasWarnings && (
                              <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-amber-500 rounded-full" title="Contains validation warnings/overrides"></span>
                            )}
                          </div>
                        );
                      } else if (isCancelled) {
                        cellBgClass = "bg-destructive/5 border border-destructive/10 text-destructive/50 p-2 rounded-lg pointer-events-none select-none text-center";
                        content = <span className="text-[10px] font-bold uppercase tracking-wider">CANCELLED</span>;
                      }

                      if (periodLocked && !isCancelled) {
                        cellBgClass = "bg-surface-variant/40 border border-outline-variant text-secondary p-2 rounded-lg cursor-not-allowed select-none text-center flex items-center justify-center gap-1";
                        if (activeAssignment) {
                          content = (
                            <div className="flex items-center justify-between w-full opacity-60">
                              <div className="flex flex-col text-left truncate">
                                <span className="font-semibold text-foreground truncate max-w-[70px]">{activeAssignment.employee.name}</span>
                                <span className="text-[9px] text-secondary truncate">{activeAssignment.employee.id}</span>
                              </div>
                              <span className="material-icons text-xs">lock</span>
                            </div>
                          );
                        } else {
                          content = (
                            <div className="flex items-center gap-1 text-secondary opacity-40">
                              <span className="material-icons text-xs">lock</span>
                              <span className="text-[9px] font-bold">LOCKED</span>
                            </div>
                          );
                        }
                      }

                      return (
                        <td
                          key={dateStr}
                          className="p-1 border-r border-outline-variant"
                          onClick={() => {
                            if (periodLocked) return;
                            if (isCancelled) return;
                            if (isVacant) handleOpenAssign(slot);
                            else handleOpenDetails(slot);
                          }}
                        >
                          <div className={`h-11 rounded-lg transition-all flex flex-col justify-center ${cellBgClass}`}>
                            {content}
                          </div>
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
              <button onClick={() => setActiveDrawer(null)} className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center">
                <span className="material-icons">close</span>
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
                          <p className="text-xs text-secondary mt-0.5">{item.employee.id} • {item.employee.designation?.name || "Staff"}</p>
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
                              <span className="material-icons text-[12px]">error</span> {err}
                            </div>
                          ))}
                          {item.warnings.map(warn => (
                            <div key={warn} className="text-amber-600 flex items-center gap-1">
                              <span className="material-icons text-[12px]">warning</span> {warn}
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

                        <button
                          onClick={() => handleAssign(item.employee.id, hasErrors)}
                          disabled={submittingAssign || !canClick}
                          className="btn btn-sm bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {submittingAssign ? "Assigning..." : "Assign"}
                        </button>
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
                  <span className="material-icons text-sm">warning</span> Override Audit Reason Required
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
              <button onClick={() => setActiveDrawer(null)} className="h-8 w-8 rounded-full hover:bg-surface-variant flex items-center justify-center">
                <span className="material-icons">close</span>
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
                          <span className="material-icons text-success text-lg">check_circle</span>
                        ) : item.status === "FAIL" ? (
                          <span className="material-icons text-destructive text-lg">cancel</span>
                        ) : (
                          <span className="material-icons text-amber-500 text-lg">info</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Unassign action footer */}
            <div className="border-t border-outline-variant p-4 flex items-center justify-end">
              <button
                onClick={handleUnassign}
                className="btn border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10 text-sm font-semibold h-10 px-4 rounded-lg flex items-center gap-2"
              >
                <span className="material-icons text-lg">person_remove</span> Unassign Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
