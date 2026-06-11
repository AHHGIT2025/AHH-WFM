"use client";

import React, { useState, useEffect } from "react";
import { LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Input, Button } from "@ahh-wfm/ui/src";

export default function MobileLeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [type, setType] = useState("Annual Leave");
  const [dateRange, setDateRange] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const employeeId = "AA-1001";

  const fetchLeaves = async () => {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const json = await res.json();
        setLeaves(json.leaves.filter((l: LeaveRequest) => l.employeeId === employeeId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange || !reason) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "applyLeave",
          payload: {
            employeeId,
            type,
            dateRange,
            reason
          }
        })
      });
      if (res.ok) {
        setDateRange("");
        setReason("");
        fetchLeaves();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Leave balances mock
  const totalAllocated = 30;
  const taken = leaves.filter(l => l.status === "Approved").length * 3; // mock 3 days per request
  const remaining = totalAllocated - taken;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Leave Management</h2>
        <p className="text-xs text-on-surface-variant">Check your leave balances and request time off</p>
      </div>

      {/* Balance Widget */}
      <Card className="bg-primary text-white border-none flex justify-around p-4 rounded-xl text-center">
        <div>
          <p className="text-[10px] text-outline-variant opacity-75 uppercase font-bold">Allocated</p>
          <p className="text-xl font-extrabold mt-1">{totalAllocated}</p>
        </div>
        <div className="w-px bg-white/20 h-10 my-auto"></div>
        <div>
          <p className="text-[10px] text-outline-variant opacity-75 uppercase font-bold">Taken</p>
          <p className="text-xl font-extrabold mt-1">{taken}</p>
        </div>
        <div className="w-px bg-white/20 h-10 my-auto"></div>
        <div>
          <p className="text-[10px] text-outline-variant opacity-75 uppercase font-bold">Remaining</p>
          <p className="text-xl font-extrabold mt-1 text-secondary-container">{remaining}</p>
        </div>
      </Card>

      {/* Apply Leave Form */}
      <Card className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Request Time Off</h3>
        <form onSubmit={handleApply} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Leave Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="Annual Leave">Annual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Unpaid Leave">Unpaid Leave</option>
              <option value="Maternity/Paternity Leave">Maternity/Paternity Leave</option>
            </select>
          </div>
          <Input
            label="Date Range"
            placeholder="e.g. 25 Oct - 27 Oct 2026"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            required
          />
          <Input
            label="Reason / Notes"
            placeholder="e.g. Family wedding trip"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <Button type="submit" disabled={submitting} className="w-full font-bold">
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </Card>

      {/* Status History */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">Your Requests</h3>
        <div className="space-y-2.5">
          {leaves.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic p-4 text-center">No leave requests submitted yet.</p>
          ) : (
            leaves.map((l) => (
              <div key={l.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex justify-between items-center gap-3">
                <div>
                  <p className="text-xs font-bold text-primary">{l.type}</p>
                  <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">{l.dateRange}</p>
                  <p className="text-[9px] italic text-on-surface-variant mt-1">"{l.reason}"</p>
                </div>
                <Badge variant={l.status === "Approved" ? "success" : l.status === "Rejected" ? "error" : "warning"}>
                  {l.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
