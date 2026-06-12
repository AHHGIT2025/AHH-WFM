"use client";

import React, { useState, useEffect } from "react";
import { LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

export default function LeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<"all" | "Pending Approval" | "Approved" | "Rejected">("all");

  // Adjustment state
  const [adjEmployeeId, setAdjEmployeeId] = useState("");
  const [adjLeaveTypeId, setAdjLeaveTypeId] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

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
      const [balRes, typeRes, empRes, holRes] = await Promise.all([
        fetch("/api/v1/leave-balances"),
        fetch("/api/v1/leave-types"),
        fetch("/api/v1/employees"),
        fetch("/api/v1/holidays")
      ]);
      if (balRes.ok) setBalances(await balRes.json());
      if (typeRes.ok) {
        const types = await typeRes.json();
        setLeaveTypes(types);
        if (types.length > 0 && !adjLeaveTypeId) setAdjLeaveTypeId(types[0].id);
      }
      if (empRes.ok) {
        const emps = await empRes.json();
        setEmployees(emps.filter((e: any) => e.isActive));
        if (emps.length > 0 && !adjEmployeeId) setAdjEmployeeId(emps[0].id);
      }
      if (holRes.ok) setHolidays(await holRes.json());
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

  const handleAction = async (id: string, status: "Approved" | "Rejected") => {
    try {
      const res = await fetch(`/api/v1/leaves/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchLeaves();
        fetchBalancesAndData();
      }
    } catch (e) {
      console.error(e);
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

  const filtered = leaves.filter((l) => {
    return activeTab === "all" || l.status === activeTab;
  });

  // Group balances by employee to show in summary table
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
          <p className="text-sm text-on-surface-variant">Review, approve, or reject employee leave and time off requests</p>
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

      {/* Tab controls */}
      <div className="flex border border-outline-variant rounded-lg overflow-hidden bg-white max-w-md text-xs font-bold mt-8">
        {(["all", "Pending Approval", "Approved", "Rejected"] as const).map((tab) => (
          <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`flex-1 py-2 px-4 border-r border-outline-variant last:border-none transition-colors ${
               activeTab === tab ? "bg-secondary text-white" : "hover:bg-surface-container text-on-surface-variant"
             }`}
          >
            {tab === "all" ? "All Requests" : tab}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Leave Type</th>
                <th className="p-4">Date Range</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Reason / Notes</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant">
                    No leave requests found in this category.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-primary">{req.employeeName}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant">{req.employeeId}</p>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-primary">{req.type}</td>
                    <td className="p-4 font-mono font-medium text-primary">{req.dateRange}</td>
                    <td className="p-4 font-semibold text-primary">
                      {req.totalDays !== undefined && req.totalDays !== null ? (
                        <span className="flex flex-col">
                          <span>{req.totalDays} working days</span>
                          <span className="text-[9px] text-on-surface-variant font-normal italic">(excluding weekends & holidays)</span>
                        </span>
                      ) : (
                        <span className="text-on-surface-variant italic">Uncalculated</span>
                      )}
                    </td>
                    <td className="p-4 text-on-surface-variant max-w-xs truncate">"{req.reason}"</td>
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
                      {req.status === "Pending Approval" ? (
                        <div className="flex gap-1.5 justify-end">
                          <Button
                            variant="success"
                            size="sm"
                            className="font-bold text-[10px] py-1 px-3"
                            onClick={() => handleAction(req.id, "Approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="error"
                            size="sm"
                            className="font-bold text-[10px] py-1 px-3"
                            onClick={() => handleAction(req.id, "Rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant italic font-medium">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
