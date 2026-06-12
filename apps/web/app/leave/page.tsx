"use client";

import React, { useState, useEffect } from "react";
import { LeaveRequest, LeaveApprovalWorkflow, LeaveApprovalDelegation, LeaveApprovalHistory } from "@ahh-wfm/types";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";
import { useSession } from "next-auth/react";

export default function LeavePage() {
  const { data: session } = useSession();
  const currentUserRole = (session?.user as any)?.role || "SUPERVISOR";
  const currentUserEmail = session?.user?.email || "";

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<LeaveApprovalWorkflow[]>([]);
  const [delegations, setDelegations] = useState<LeaveApprovalDelegation[]>([]);
  
  // Console tabs
  const [consoleTab, setConsoleTab] = useState<"direct" | "delegated" | "escalated" | "all">("direct");
  const [activeStatusTab, setActiveStatusTab] = useState<"all" | "Pending Approval" | "Approved" | "Rejected">("all");

  // Adjustment state
  const [adjEmployeeId, setAdjEmployeeId] = useState("");
  const [adjLeaveTypeId, setAdjLeaveTypeId] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Delegation state
  const [delegEmployeeId, setDelegEmployeeId] = useState("");
  const [delegApproverId, setDelegApproverId] = useState("");
  const [delegValidFrom, setDelegValidFrom] = useState("");
  const [delegValidTo, setDelegValidTo] = useState("");
  const [delegReason, setDelegReason] = useState("");
  const [delegating, setDelegating] = useState(false);

  // Remarks state for actions
  const [actionRemarks, setActionRemarks] = useState<Record<string, string>>({});
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  // History / timeline modal state
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<LeaveApprovalHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchLeaves = async () => {
    try {
      const res = await fetch("/api/v1/leaves");
      if (res.ok) {
        setLeaves(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBalancesAndData = async () => {
    try {
      const [balRes, typeRes, empRes, holRes, wfRes, delRes] = await Promise.all([
        fetch("/api/v1/leave-balances"),
        fetch("/api/v1/leave-types"),
        fetch("/api/v1/employees"),
        fetch("/api/v1/holidays"),
        fetch("/api/v1/approval-workflows"),
        fetch("/api/v1/approval-delegations")
      ]);
      if (balRes.ok) setBalances(await balRes.json());
      if (typeRes.ok) {
        const types = await typeRes.json();
        setLeaveTypes(types);
        if (types.length > 0 && !adjLeaveTypeId) setAdjLeaveTypeId(types[0].id);
      }
      if (empRes.ok) {
        const emps = await empRes.json();
        const activeEmps = emps.filter((e: any) => e.isActive);
        setEmployees(activeEmps);
        if (activeEmps.length > 0) {
          if (!adjEmployeeId) setAdjEmployeeId(activeEmps[0].id);
          if (!delegEmployeeId) setDelegEmployeeId(activeEmps[0].id);
        }
      }
      if (holRes.ok) setHolidays(await holRes.json());
      if (wfRes.ok) setWorkflows(await wfRes.json());
      if (delRes.ok) setDelegations(await delRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchBalancesAndData();
    const interval = setInterval(() => {
      fetchLeaves();
      fetchBalancesAndData();
    }, 5000);
    return () => clearInterval(interval);
  }, [adjLeaveTypeId, adjEmployeeId]);

  const handleApprove = async (requestId: string) => {
    setActioning(prev => ({ ...prev, [requestId]: true }));
    try {
      const remarks = actionRemarks[requestId] || "";
      const res = await fetch("/api/v1/leaves/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, remarks })
      });
      if (res.ok) {
        setActionRemarks(prev => ({ ...prev, [requestId]: "" }));
        fetchLeaves();
        fetchBalancesAndData();
      } else {
        const err = await res.json();
        alert(`Failed to approve: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioning(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId: string) => {
    setActioning(prev => ({ ...prev, [requestId]: true }));
    try {
      const remarks = actionRemarks[requestId] || "";
      if (!remarks) {
        alert("Rejection remarks are required!");
        return;
      }
      const res = await fetch("/api/v1/leaves/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, remarks })
      });
      if (res.ok) {
        setActionRemarks(prev => ({ ...prev, [requestId]: "" }));
        fetchLeaves();
        fetchBalancesAndData();
      } else {
        const err = await res.json();
        alert(`Failed to reject: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioning(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjEmployeeId || !adjLeaveTypeId || !adjAmount || !adjReason) return;
    
    setAdjusting(true);
    try {
      const res = await fetch("/api/v1/leave-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: adjEmployeeId,
          leaveTypeId: adjLeaveTypeId,
          amount: parseFloat(adjAmount),
          reason: adjReason
        })
      });
      if (res.ok) {
        setAdjAmount("");
        setAdjReason("");
        alert("Balance adjusted successfully and written to audit ledger!");
        fetchBalancesAndData();
      } else {
        alert("Failed to adjust balance");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdjusting(false);
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegEmployeeId || !delegApproverId || !delegValidFrom || !delegValidTo) return;

    setDelegating(true);
    try {
      const res = await fetch("/api/v1/approval-delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: delegEmployeeId,
          delegateApproverId: delegApproverId,
          validFrom: delegValidFrom,
          validTo: delegValidTo,
          reason: delegReason
        })
      });
      if (res.ok) {
        setDelegApproverId("");
        setDelegReason("");
        setDelegValidFrom("");
        setDelegValidTo("");
        alert("Delegation rule created successfully!");
        fetchBalancesAndData();
      } else {
        alert("Failed to create delegation rule");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDelegating(false);
    }
  };

  const viewTimeline = async (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/v1/leaves/history?id=${leave.id}`);
      if (res.ok) {
        setSelectedHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper to resolve role required for a step
  const getRequiredRoleForStep = (req: LeaveRequest): string => {
    const wf = workflows.find(w => w.id === req.workflowId);
    if (!wf || !wf.steps) return "SUPERVISOR";
    const step = wf.steps.find(s => s.stepNumber === req.currentStep);
    return step ? step.roleRequired : "SUPERVISOR";
  };

  // Filter queues
  const directQueue = leaves.filter(l => {
    if (l.status === "Approved" || l.status === "Rejected") return false;
    const requiredRole = getRequiredRoleForStep(l);
    // Is escalated?
    if (l.escalationCount !== undefined && l.escalationCount > 0) return false;
    
    // Does it match active delegation?
    const hasActiveDelegation = delegations.some(d => {
      const now = new Date();
      const validFrom = new Date(d.validFrom);
      const validTo = new Date(d.validTo);
      return d.employeeId === l.employeeId && now >= validFrom && now <= validTo;
    });
    if (hasActiveDelegation) return false;

    // Normal direct routing
    if (currentUserRole === "ADMIN") return true;
    return currentUserRole === requiredRole;
  });

  const delegatedQueue = leaves.filter(l => {
    if (l.status === "Approved" || l.status === "Rejected") return false;
    const requiredRole = getRequiredRoleForStep(l);

    // Is active delegation mapping this employee to current user email?
    return delegations.some(d => {
      const now = new Date();
      const validFrom = new Date(d.validFrom);
      const validTo = new Date(d.validTo);
      const matchesDelegate = d.delegateApproverId === currentUserEmail || currentUserRole === "ADMIN";
      return d.employeeId === l.employeeId && now >= validFrom && now <= validTo && matchesDelegate;
    });
  });

  const escalatedQueue = leaves.filter(l => {
    if (l.status === "Approved" || l.status === "Rejected") return false;
    return l.escalationCount !== undefined && l.escalationCount > 0;
  });

  const allFiltered = leaves.filter(l => {
    return activeStatusTab === "all" || l.status === activeStatusTab;
  });

  const activeQueue = 
    consoleTab === "direct" ? directQueue :
    consoleTab === "delegated" ? delegatedQueue :
    consoleTab === "escalated" ? escalatedQueue : allFiltered;

  const getEmployeeBalances = (empId: string) => {
    const empBals = balances.filter((b) => b.employeeId === empId);
    const annual = empBals.find((b) => b.leaveType?.code === "ANNUAL");
    const sick = empBals.find((b) => b.leaveType?.code === "SICK");
    
    return {
      annualRemaining: annual ? (annual.allocatedDays + annual.carriedOver - annual.usedDays - annual.pendingDays) : 0,
      sickRemaining: sick ? (sick.allocatedDays + sick.carriedOver - sick.usedDays - sick.pendingDays) : 0
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Leave &amp; Approvals</h1>
          <p className="text-sm text-on-surface-variant">Review, approve, or reject employee leave requests and configure delegation parameters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balances Summary Table */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container">
            <h2 className="text-sm font-bold text-primary">Employee Leave Balances Summary</h2>
            <p className="text-[11px] text-on-surface-variant">Active remaining balances including pending requests</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Annual Leave Remaining</th>
                  <th className="p-3">Sick Leave Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-on-surface-variant italic">
                      No employees loaded.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const { annualRemaining, sickRemaining } = getEmployeeBalances(emp.id);
                    return (
                      <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3 font-semibold text-primary">
                          {emp.name} <span className="text-[10px] text-on-surface-variant font-normal">({emp.id})</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">
                          {annualRemaining.toFixed(1)} Days
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">
                          {sickRemaining.toFixed(1)} Days
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Manual Balance Adjustments Tool */}
        <Card className="p-4 space-y-4">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Manual Balance Adjustment</h2>
          <form onSubmit={handleAdjustment} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Select Employee</label>
              <select
                value={adjEmployeeId}
                onChange={(e) => setAdjEmployeeId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Leave Type</label>
              <select
                value={adjLeaveTypeId}
                onChange={(e) => setAdjLeaveTypeId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <Input
              label="Adjustment Amount (Days)"
              placeholder="e.g. 5 or -2"
              type="number"
              step="0.5"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              required
            />

            <Input
              label="Reason / Notes"
              placeholder="e.g. Overtime credit compensation"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              required
            />

            <Button type="submit" disabled={adjusting} className="w-full font-bold text-xs py-2 bg-primary text-white">
              {adjusting ? "Adjusting..." : "Apply Adjustment"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Delegation & Escalation Rules Dashboard Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container">
            <h2 className="text-sm font-bold text-primary">Active Approval Delegations</h2>
            <p className="text-[11px] text-on-surface-variant">List of active workflow delegation maps</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-3">Source Employee</th>
                  <th className="p-3">Delegate Approver</th>
                  <th className="p-3">Validity Range</th>
                  <th className="p-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {delegations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-on-surface-variant italic">
                      No active delegations.
                    </td>
                  </tr>
                ) : (
                  delegations.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-3 font-semibold text-primary">{d.employeeId}</td>
                      <td className="p-3 font-semibold text-secondary">{d.delegateApproverId}</td>
                      <td className="p-3 font-mono">{new Date(d.validFrom).toLocaleDateString()} - {new Date(d.validTo).toLocaleDateString()}</td>
                      <td className="p-3 text-on-surface-variant italic">"{d.reason}"</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Set Up Delegation Form */}
        <Card className="p-4 space-y-4">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Configure Delegation</h2>
          <form onSubmit={handleCreateDelegation} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Employee (To Delegate For)</label>
              <select
                value={delegEmployeeId}
                onChange={(e) => setDelegEmployeeId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                ))}
              </select>
            </div>

            <Input
              label="Delegate Email / User ID"
              placeholder="e.g. manager@ahh.com"
              value={delegApproverId}
              onChange={(e) => setDelegApproverId(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Valid From"
                type="date"
                value={delegValidFrom}
                onChange={(e) => setDelegValidFrom(e.target.value)}
                required
              />
              <Input
                label="Valid To"
                type="date"
                value={delegValidTo}
                onChange={(e) => setDelegValidTo(e.target.value)}
                required
              />
            </div>

            <Input
              label="Delegation Reason"
              placeholder="e.g. Annual leave coverage"
              value={delegReason}
              onChange={(e) => setDelegReason(e.target.value)}
            />

            <Button type="submit" disabled={delegating} className="w-full font-bold text-xs py-2">
              {delegating ? "Creating..." : "Save Delegation"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Approvals Console queues tabs */}
      <div className="flex border border-outline-variant rounded-lg overflow-hidden bg-white max-w-xl text-xs font-bold mt-8">
        <button
          onClick={() => setConsoleTab("direct")}
          className={`flex-1 py-2.5 px-4 border-r border-outline-variant last:border-none transition-colors flex justify-center items-center gap-1.5 ${
            consoleTab === "direct" ? "bg-primary text-white" : "hover:bg-surface-container text-on-surface-variant"
          }`}
        >
          Direct Queue
          <Badge variant={directQueue.length > 0 ? "error" : "neutral"} className="text-[9px] px-1.5 py-0">
            {directQueue.length}
          </Badge>
        </button>
        <button
          onClick={() => setConsoleTab("delegated")}
          className={`flex-1 py-2.5 px-4 border-r border-outline-variant last:border-none transition-colors flex justify-center items-center gap-1.5 ${
            consoleTab === "delegated" ? "bg-primary text-white" : "hover:bg-surface-container text-on-surface-variant"
          }`}
        >
          Delegated Queue
          <Badge variant={delegatedQueue.length > 0 ? "info" : "neutral"} className="text-[9px] px-1.5 py-0">
            {delegatedQueue.length}
          </Badge>
        </button>
        <button
          onClick={() => setConsoleTab("escalated")}
          className={`flex-1 py-2.5 px-4 border-r border-outline-variant last:border-none transition-colors flex justify-center items-center gap-1.5 ${
            consoleTab === "escalated" ? "bg-primary text-white" : "hover:bg-surface-container text-on-surface-variant"
          }`}
        >
          Escalated Queue
          <Badge variant={escalatedQueue.length > 0 ? "warning" : "neutral"} className="text-[9px] px-1.5 py-0">
            {escalatedQueue.length}
          </Badge>
        </button>
        <button
          onClick={() => setConsoleTab("all")}
          className={`flex-1 py-2.5 px-4 border-r border-outline-variant last:border-none transition-colors ${
            consoleTab === "all" ? "bg-primary text-white" : "hover:bg-surface-container text-on-surface-variant"
          }`}
        >
          All Requests
        </button>
      </div>

      {consoleTab === "all" && (
        <div className="flex border border-outline-variant rounded-lg overflow-hidden bg-white max-w-sm text-xs font-bold mt-2">
          {(["all", "Pending Approval", "Approved", "Rejected"] as const).map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveStatusTab(tab)}
               className={`flex-1 py-2 px-3 border-r border-outline-variant last:border-none transition-colors ${
                 activeStatusTab === tab ? "bg-secondary text-white" : "hover:bg-surface-container text-on-surface-variant"
               }`}
            >
              {tab === "all" ? "All statuses" : tab}
            </button>
          ))}
        </div>
      )}

      {/* Requests Console Table */}
      <Card className="p-0 overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Leave details</th>
                <th className="p-4">Duration &amp; SLA</th>
                <th className="p-4">Reason / Notes</th>
                <th className="p-4">Workflow Info</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {activeQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant italic">
                    No leave requests found in this queue.
                  </td>
                </tr>
              ) : (
                activeQueue.map((req) => {
                  const requiredRole = getRequiredRoleForStep(req);
                  const isActionable = 
                    (req.status !== "Approved" && req.status !== "Rejected") &&
                    (currentUserRole === "ADMIN" || 
                     currentUserRole === requiredRole || 
                     consoleTab === "delegated");

                  return (
                    <tr key={req.id} className="hover:bg-surface-container-low transition-colors align-top">
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-primary">{req.employeeName}</p>
                          <p className="text-[10px] font-mono text-on-surface-variant">{req.employeeId}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-primary">{req.type}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant">{req.dateRange}</p>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-primary">{req.totalDays} working days</p>
                          <div className="text-[9px] text-on-surface-variant space-y-0.5">
                            <span className="block font-mono">Submitted: {new Date(req.submittedAt || "").toLocaleDateString()}</span>
                            {req.escalationCount !== undefined && req.escalationCount > 0 && (
                              <span className="block text-status-warning font-bold uppercase">Escalation Count: {req.escalationCount}</span>
                            )}
                            {req.approvalDurationHours !== undefined && req.approvalDurationHours !== null && (
                              <span className="block font-semibold text-primary">SLA Duration: {req.approvalDurationHours.toFixed(1)} hrs</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-on-surface-variant max-w-xs">
                        <p className="italic">"{req.reason}"</p>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-on-surface-variant">
                            Step {req.currentStep} of {req.totalSteps}
                          </p>
                          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                            Requires: {requiredRole}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[9px] font-extrabold text-secondary hover:underline p-0"
                            onClick={() => viewTimeline(req)}
                          >
                            View history timeline
                          </Button>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            req.status === "Approved"
                              ? "success"
                              : req.status === "Rejected"
                              ? "error"
                              : "warning"
                          }
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {isActionable ? (
                          <div className="space-y-2 max-w-[200px] ml-auto">
                            <Input
                              placeholder="Enter action remarks..."
                              value={actionRemarks[req.id] || ""}
                              onChange={(e) => setActionRemarks(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="text-[11px] p-1.5"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <Button
                                variant="success"
                                size="sm"
                                className="font-bold text-[10px] py-1 px-3"
                                disabled={actioning[req.id]}
                                onClick={() => handleApprove(req.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="error"
                                size="sm"
                                className="font-bold text-[10px] py-1 px-3"
                                disabled={actioning[req.id]}
                                onClick={() => handleReject(req.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant italic font-medium">No action needed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* History Timeline Modal */}
      <Modal 
        isOpen={selectedLeave !== null} 
        onClose={() => setSelectedLeave(null)} 
        title={`Approval History: ${selectedLeave?.employeeName}'s ${selectedLeave?.type}`}
      >
        {selectedLeave && (
          <div className="space-y-4">
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="block font-semibold opacity-75 uppercase tracking-wider text-[9px]">Submitted At</span>
                <span className="font-mono">{new Date(selectedLeave.submittedAt || "").toLocaleString()}</span>
              </div>
              {selectedLeave.approvedAt && (
                <div>
                  <span className="block font-semibold opacity-75 uppercase tracking-wider text-[9px]">Approved At</span>
                  <span className="font-mono">{new Date(selectedLeave.approvedAt || "").toLocaleString()}</span>
                </div>
              )}
              {selectedLeave.approvalDurationHours !== undefined && selectedLeave.approvalDurationHours !== null && (
                <div className="col-span-2">
                  <span className="block font-semibold opacity-75 uppercase tracking-wider text-[9px]">Approval SLA Duration</span>
                  <span className="font-mono font-bold text-primary">{selectedLeave.approvalDurationHours.toFixed(1)} hours</span>
                </div>
              )}
              {selectedLeave.escalationCount !== undefined && selectedLeave.escalationCount > 0 && (
                <div className="col-span-2">
                  <span className="block text-status-warning font-bold uppercase text-[9px]">Total Escalations triggered</span>
                  <span className="font-mono text-status-warning font-extrabold">{selectedLeave.escalationCount}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Workflow Progression Actions Log</h4>
              {loadingHistory ? (
                <p className="text-xs italic text-on-surface-variant animate-pulse">Loading workflow actions...</p>
              ) : selectedHistory.length === 0 ? (
                <p className="text-xs italic text-on-surface-variant">No workflow actions registered yet.</p>
              ) : (
                <div className="border-l-2 border-outline-variant pl-4 space-y-4 relative ml-2">
                  {selectedHistory.map((hist, index) => (
                    <div key={hist.id || index} className="relative text-xs">
                      {/* Dot */}
                      <div className={`absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        hist.action === 'APPROVE' ? 'bg-status-success' : 'bg-status-error'
                      }`} />
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-primary">
                          {hist.action === 'APPROVE' ? 'APPROVED STEP' : 'REJECTED REQUEST'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-mono">{new Date(hist.createdAt || "").toLocaleString()}</span>
                      </div>
                      <p className="text-on-surface-variant font-medium mt-0.5">Actor: {hist.approverId}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        Status Transition: <span className="font-semibold">{hist.previousStatus}</span> → <span className="font-semibold text-secondary">{hist.newStatus}</span>
                      </p>
                      {hist.remarks && (
                        <p className="text-xs text-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 px-2 py-1 rounded border border-yellow-100 mt-1 italic">
                          Remarks: "{hist.remarks}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
