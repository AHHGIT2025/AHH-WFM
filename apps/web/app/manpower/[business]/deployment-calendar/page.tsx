"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../../../lib/permissions";

export default function DeploymentCalendarPage() {
  const params = useParams();
  const { data: session } = useSession();

  const business = params?.business as string; // "security-guarding" | "facility-management"
  const isSecurity = business === "security-guarding";
  const businessLabel = isSecurity ? "Security Guarding" : "Facility Management";

  // State
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [manpower, setManpower] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  // Selected entities for actions
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [selectedSiteRequirement, setSelectedSiteRequirement] = useState<any | null>(null);
  const [relieverAssignment, setRelieverAssignment] = useState<any | null>(null);

  // Form input for reliever
  const [relieverEmployeeId, setRelieverEmployeeId] = useState("");
  const [relieverReason, setRelieverReason] = useState("");
  
  // UI filter states
  const [leftSearch, setLeftSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  const canView = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                  hasPermission(session?.user as any, isSecurity ? "manpower.security.view" : "manpower.fm.view");
  const canManage = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                    hasPermission(session?.user as any, isSecurity ? "manpower.security.manage" : "manpower.fm.manage");

  async function loadInitialData() {
    try {
      const [sitesRes, reqsRes, manRes, catsRes, leavesRes] = await Promise.all([
        fetch(`/api/v1/manpower/${business}/sites`),
        fetch(`/api/v1/manpower/${business}/shifts`),
        fetch(`/api/v1/manpower/${business}/manpower`),
        fetch(`/api/v1/manpower/${business}/categories`),
        fetch(`/api/v1/leaves`)
      ]);

      if (sitesRes.ok) setSites(await sitesRes.json());
      if (reqsRes.ok) setRequirements(await reqsRes.json());
      if (manRes.ok) setManpower(await manRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
      if (leavesRes.ok) setLeaves(await leavesRes.json());
    } catch (e) {
      console.error("Failed to load initial calendar data", e);
    }
  }

  async function loadDeployments() {
    setLoading(true);
    setApiError("");
    setApiSuccess("");
    try {
      const res = await fetch(`/api/v1/manpower/${business}/deployments?date=${selectedDate}`);
      if (res.ok) {
        setDeployments(await res.json());
      }
    } catch (e) {
      console.error("Failed to load deployments", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (business && session) {
      loadInitialData();
    }
  }, [business, session]);

  useEffect(() => {
    if (business) {
      loadDeployments();
    }
  }, [business, selectedDate]);

  if (!canView) {
    return (
      <div className="p-8 text-center text-status-error font-bold">
        Access Denied: You do not have permission to view {businessLabel} operations.
      </div>
    );
  }

  // Action: Assign Selected Staff
  const handleAssign = async (requirementId: string) => {
    if (!selectedEmployee) {
      setApiError("Please select a staff member from the left panel first.");
      return;
    }
    setApiError("");
    setApiSuccess("");

    try {
      // Find if deployment already exists for this requirement
      let dep = deployments.find(d => d.shiftRequirementId === requirementId);
      if (!dep) {
        // Create deployment in DRAFT state first
        const createRes = await fetch(`/api/v1/manpower/${business}/deployments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_deployment",
            date: selectedDate,
            shiftRequirementId: requirementId
          })
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          setApiError(err.error || "Failed to create deployment slot");
          return;
        }
        dep = await createRes.json();
      }

      // Assign employee
      const assignRes = await fetch(`/api/v1/manpower/${business}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          deploymentId: dep.id,
          employeeId: selectedEmployee.id,
          date: selectedDate
        })
      });

      if (assignRes.ok) {
        setApiSuccess(`Assigned ${selectedEmployee.name} successfully.`);
        setSelectedEmployee(null);
        loadDeployments();
      } else {
        const err = await assignRes.json();
        setApiError(err.error || "Failed to assign staff member");
      }
    } catch (e) {
      setApiError("Connection failed");
    }
  };

  // Action: Unassign Staff
  const handleUnassign = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to unassign this staff member?")) return;
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch(`/api/v1/manpower/${business}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unassign",
          assignmentId
        })
      });
      if (res.ok) {
        setApiSuccess("Unassigned successfully.");
        loadDeployments();
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to unassign staff");
      }
    } catch (e) {
      setApiError("Connection failed");
    }
  };

  // Action: Relieve Staff
  const handleRelieveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relieverAssignment || !relieverEmployeeId) return;
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch(`/api/v1/manpower/${business}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "relieve",
          originalAssignmentId: relieverAssignment.id,
          relieverEmployeeId,
          reason: relieverReason,
          date: selectedDate
        })
      });
      if (res.ok) {
        setApiSuccess("Reliever assigned successfully.");
        setRelieverAssignment(null);
        setRelieverEmployeeId("");
        setRelieverReason("");
        loadDeployments();
      } else {
        const err = await res.json();
        setApiError(err.error || "Failed to assign reliever");
      }
    } catch (e) {
      setApiError("Connection failed");
    }
  };

  // Compute unassigned manpower: employees who are not assigned on selected date
  const isAssigned = (employeeId: string) => {
    return deployments.some(d => 
      d.assignments.some((a: any) => 
        a.employeeId === employeeId || 
        a.relieverAssignments.some((r: any) => r.relieverEmployeeId === employeeId)
      )
    );
  };

  const getLeaveStatus = (employeeId: string) => {
    const start = new Date(selectedDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setUTCHours(23, 59, 59, 999);

    const onLeave = leaves.find(l => {
      if (l.employeeId !== employeeId || l.status !== "APPROVED") return false;
      const lStart = new Date(l.startDate);
      const lEnd = new Date(l.endDate);
      return lStart <= end && lEnd >= start;
    });

    return onLeave ? `On Leave (${onLeave.leaveType || "Vacation"})` : null;
  };

  const filteredUnassignedManpower = manpower.filter(emp => {
    // Search
    const searchMatch = emp.name.toLowerCase().includes(leftSearch.toLowerCase()) || emp.id.toLowerCase().includes(leftSearch.toLowerCase());
    // Category filter
    const catMatch = !selectedCategoryFilter || emp.manpowerCategoryId === selectedCategoryFilter;
    // Not assigned
    const unassigned = !isAssigned(emp.id);

    return searchMatch && catMatch && unassigned;
  });

  return (
    <div className="flex-1 bg-surface-container-lowest flex h-[calc(100vh-4rem)] overflow-hidden">
      
      {/* LEFT PANEL: Unassigned Manpower Directory */}
      <div className="w-80 border-r border-outline-variant bg-surface p-4 flex flex-col h-full shrink-0">
        <div className="mb-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest">Available Manpower</h2>
          <p className="text-[10px] text-on-surface-variant">Select staff to assign to shift requirements</p>
        </div>

        {/* Filters */}
        <div className="space-y-2 mb-4">
          <input
            type="text"
            placeholder="Search staff ID or name..."
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
            value={leftSearch}
            onChange={(e) => setLeftSearch(e.target.value)}
          />
          <select
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:outline-none"
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredUnassignedManpower.length === 0 ? (
            <p className="text-center text-[11px] text-on-surface-variant py-8">No unassigned staff available.</p>
          ) : (
            filteredUnassignedManpower.map(emp => {
              const leaveStatus = getLeaveStatus(emp.id);
              const isSelected = selectedEmployee?.id === emp.id;
              
              return (
                <div
                  key={emp.id}
                  onClick={() => {
                    if (leaveStatus) return; // Prevent selecting staff on leave
                    setSelectedEmployee(isSelected ? null : emp);
                  }}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    leaveStatus 
                      ? "bg-surface-container-high border-outline-variant/30 opacity-50 cursor-not-allowed"
                      : isSelected 
                      ? isSecurity ? "bg-primary/5 border-primary" : "bg-secondary/5 border-secondary"
                      : "bg-surface hover:border-outline-variant"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-bold text-primary">{emp.name}</p>
                    <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container-low px-1.5 py-0.5 rounded">{emp.id}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-on-surface-variant">{categories.find(c => c.id === emp.manpowerCategoryId)?.name || emp.manpowerCategoryId}</span>
                    {leaveStatus ? (
                      <span className="text-[9px] font-bold text-status-error">{leaveStatus}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-status-success font-bold">
                        <span className="w-1.5 h-1.5 bg-status-success rounded-full"></span> Available
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedEmployee && (
          <div className="mt-4 pt-3 border-t border-outline-variant">
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex justify-between items-center">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Selected Staff</p>
                <p className="text-xs font-bold text-primary">{selectedEmployee.name}</p>
              </div>
              <button 
                onClick={() => setSelectedEmployee(null)}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CENTER PANEL: Roster Grid */}
      <div className="flex-1 bg-surface-container-lowest p-6 flex flex-col h-full overflow-y-auto">
        
        {/* Header toolbar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/manpower/${business}/dashboard`}
              className="w-8 h-8 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-primary">{businessLabel} Deployment Calendar</h1>
              <p className="text-[10px] text-on-surface-variant">Daily planner, shift allocations, and shortage monitors</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-bold">Date:</span>
            <input
              type="date"
              className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary font-bold"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

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

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className={`w-8 h-8 border-4 rounded-full animate-spin border-t-transparent ${isSecurity ? "border-primary" : "border-secondary"}`}></div>
          </div>
        ) : requirements.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface border border-outline-variant border-dashed rounded-xl">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">schedule</span>
            <p className="text-xs font-bold text-primary mb-1">No Shift Requirements Configured</p>
            <p className="text-[10px] text-on-surface-variant max-w-sm mb-4">You need to set up shift requirements in the master settings before planning deployments.</p>
            <Link 
              href={`/manpower/${business}/shifts`}
              className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg"
            >
              Setup Requirements
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {sites.map(site => {
              // Get requirements for this site
              const siteReqs = requirements.filter(r => r.siteId === site.id);
              if (siteReqs.length === 0) return null;

              return (
                <div key={site.id} className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">place</span>
                      <h3 className="text-xs font-bold text-primary">{site.name}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedSiteRequirement({ site })}
                      className="text-primary hover:underline text-[10px] font-bold"
                    >
                      View Details & Rules
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {siteReqs.map(req => {
                      // Find deployment record
                      const dep = deployments.find(d => d.shiftRequirementId === req.id);
                      const currentAssignments = dep?.assignments || [];
                      const countAssigned = currentAssignments.length;
                      const shortage = req.requiredCount - countAssigned;

                      return (
                        <div key={req.id} className="border border-outline-variant/60 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-xs font-bold text-primary">
                                {req.category?.name} {req.locationUnit ? `— ${req.locationUnit.name}` : ""}
                              </p>
                              <p className="text-[10px] text-on-surface-variant font-mono">
                                Shift: {req.shiftCode} | Target Count: {req.requiredCount} Required
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Shortage indicator */}
                              {shortage > 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-status-error/15 text-status-error">
                                  Shortage: {shortage} Staff
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-status-success/15 text-status-success">
                                  Fully Staffed
                                </span>
                              )}

                              {canManage && (
                                <button
                                  onClick={() => handleAssign(req.id)}
                                  className={`px-2.5 py-1 text-white text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 ${
                                    isSecurity ? "bg-primary" : "bg-secondary"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">add</span>
                                  Assign Selected
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Assigned Guards Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {currentAssignments.length === 0 ? (
                              <p className="col-span-full text-center text-[10px] text-on-surface-variant py-2 italic">
                                No staff assigned to this slot yet.
                              </p>
                            ) : (
                              currentAssignments.map((asg: any) => {
                                const rel = asg.relieverAssignments?.[0]; // Get reliever if any

                                return (
                                  <div key={asg.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 flex flex-col justify-between">
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <p className="text-xs font-bold text-on-surface">{asg.employee?.name}</p>
                                        <button
                                          onClick={() => handleUnassign(asg.id)}
                                          className="text-on-surface-variant hover:text-status-error"
                                          title="Remove assignment"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                      </div>
                                      <p className="text-[10px] text-on-surface-variant font-mono">ID: {asg.employeeId}</p>
                                      
                                      {rel && (
                                        <div className="mt-2 pt-2 border-t border-outline-variant/40 bg-status-warning/5 p-1 rounded">
                                          <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Relieved By:</p>
                                          <p className="text-xs font-black text-secondary">{rel.relieverEmployee?.name}</p>
                                          <p className="text-[8px] text-on-surface-variant">{rel.reason}</p>
                                        </div>
                                      )}
                                    </div>

                                    {!rel && canManage && (
                                      <button
                                        onClick={() => setRelieverAssignment(asg)}
                                        className="mt-2 text-[10px] font-bold text-secondary hover:underline self-start flex items-center gap-1"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
                                        Assign Reliever
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Worksite Rules / Reliever Form */}
      <div className="w-80 border-l border-outline-variant bg-surface p-4 flex flex-col h-full shrink-0 overflow-y-auto">
        {relieverAssignment ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-secondary uppercase tracking-widest">Assign Reliever</h2>
              <button onClick={() => setRelieverAssignment(null)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-4">
              Substitute <strong>{relieverAssignment.employee?.name}</strong> for the shift on {selectedDate}.
            </p>
            
            <form onSubmit={handleRelieveSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Select Reliever</label>
                <select
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-secondary"
                  value={relieverEmployeeId}
                  onChange={(e) => setRelieverEmployeeId(e.target.value)}
                >
                  <option value="">Choose Reliever...</option>
                  {manpower
                    .filter(emp => emp.id !== relieverAssignment.employeeId && !isAssigned(emp.id) && !getLeaveStatus(emp.id))
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Reason / Justification</label>
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-secondary"
                  rows={3}
                  placeholder="e.g. Double shift cover, emergency leave..."
                  value={relieverReason}
                  onChange={(e) => setRelieverReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-container transition-colors"
              >
                Confirm Substitute
              </button>
            </form>
          </div>
        ) : selectedSiteRequirement ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-primary uppercase tracking-widest">Site Rules & SLA</h2>
              <button onClick={() => setSelectedSiteRequirement(null)} className="text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Site Name</p>
                <p className="text-xs font-bold text-primary">{selectedSiteRequirement.site?.name}</p>
              </div>

              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/60">
                <p className="text-[9px] font-bold text-primary uppercase mb-2">Google Stitch SLA Rules:</p>
                <ul className="space-y-2 text-[10px] text-on-surface-variant leading-relaxed">
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[14px] text-status-success shrink-0">check_circle</span>
                    <span>No cross-business guard assignments.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[14px] text-status-success shrink-0">check_circle</span>
                    <span>Leave overlaps are automatically blocked.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[14px] text-status-success shrink-0">check_circle</span>
                    <span>Daily double-booking prevention in effect.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[14px] text-status-success shrink-0">check_circle</span>
                    <span>Max 12 hours continuous duty.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">info</span>
            <p className="text-xs font-bold text-primary mb-1">Select an Action</p>
            <p className="text-[10px] text-on-surface-variant max-w-xs">Click on any site details, assign reliever, or select unassigned staff to begin planning the roster.</p>
          </div>
        )}
      </div>

    </div>
  );
}
