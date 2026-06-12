"use client";

import React, { useState, useEffect } from "react";
import { LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Input, Button } from "@ahh-wfm/ui/src";

export default function MobileLeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  
  const [type, setType] = useState("Annual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const employeeId = "AA-1001";

  const fetchLeaves = async () => {
    try {
      const res = await fetch("/api/v1/leaves");
      if (res.ok) {
        const json = await res.json();
        setLeaves(json.filter((l: LeaveRequest) => l.employeeId === employeeId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBalancesAndTypes = async () => {
    try {
      const [balRes, typeRes, holRes] = await Promise.all([
        fetch(`/api/v1/leave-balances?employeeId=${employeeId}`),
        fetch("/api/v1/leave-types"),
        fetch("/api/v1/holidays")
      ]);
      if (balRes.ok) setBalances(await balRes.json());
      if (typeRes.ok) {
        const typesJson = await typeRes.json();
        setLeaveTypes(typesJson);
        if (typesJson.length > 0) {
          setType(typesJson[0].name);
        }
      }
      if (holRes.ok) setHolidays(await holRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchBalancesAndTypes();
  }, []);

  const formatDateRange = (startStr: string, endStr: string) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const startDay = start.getDate();
    const startMonth = months[start.getMonth()];
    const endDay = end.getDate();
    const endMonth = months[end.getMonth()];
    const year = start.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${startMonth} ${year}`;
    } else {
      return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
    }
  };

  // Weekend & holiday aware calculator for live preview
  const getWorkingDaysDetails = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return { workingDays: 0, weekendDays: 0, holidayDays: 0 };
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start > end) return { workingDays: 0, weekendDays: 0, holidayDays: 0 };
    
    let workingDays = 0;
    let weekendDays = 0;
    let holidayDays = 0;
    
    const curr = new Date(start.getTime());
    curr.setHours(12, 0, 0, 0);
    const target = new Date(end.getTime());
    target.setHours(12, 0, 0, 0);

    while (curr <= target) {
      const day = curr.getDay();
      const isWeekend = day === 5 || day === 6; // Fri & Sat
      const isHoliday = holidays.some(h => {
        const hDate = new Date(h.date);
        return hDate.getFullYear() === curr.getFullYear() &&
               hDate.getMonth() === curr.getMonth() &&
               hDate.getDate() === curr.getDate();
      });
      
      if (isWeekend) {
        weekendDays++;
      } else if (isHoliday) {
        holidayDays++;
      } else {
        workingDays++;
      }
      
      curr.setDate(curr.getDate() + 1);
    }
    return { workingDays, weekendDays, holidayDays };
  };

  const { workingDays, weekendDays, holidayDays } = getWorkingDaysDetails(startDate, endDate);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;
    if (workingDays <= 0) {
      alert("Selected date range does not contain any working days.");
      return;
    }

    setSubmitting(true);
    try {
      const formattedRange = formatDateRange(startDate, endDate);
      const res = await fetch("/api/v1/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          type,
          dateRange: formattedRange,
          reason
        })
      });
      if (res.ok) {
        setStartDate("");
        setEndDate("");
        setReason("");
        fetchLeaves();
        fetchBalancesAndTypes(); // refresh balances
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Find balance for selected type
  const selectedTypeObj = leaveTypes.find(t => t.name === type);
  const currentBalance = balances.find(b => b.leaveTypeId === selectedTypeObj?.id) || {
    allocatedDays: 0,
    usedDays: 0,
    pendingDays: 0,
    carriedOver: 0
  };
  
  const totalAllocated = currentBalance.allocatedDays + currentBalance.carriedOver;
  const taken = currentBalance.usedDays;
  const pending = currentBalance.pendingDays;
  const remaining = totalAllocated - taken - pending;

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
          <p className="text-xl font-extrabold mt-1">{totalAllocated.toFixed(1)}</p>
        </div>
        <div className="w-px bg-white/20 h-10 my-auto"></div>
        <div>
          <p className="text-[10px] text-outline-variant opacity-75 uppercase font-bold">Taken</p>
          <p className="text-xl font-extrabold mt-1">{taken.toFixed(1)}</p>
        </div>
        <div className="w-px bg-white/20 h-10 my-auto"></div>
        <div>
          <p className="text-[10px] text-outline-variant opacity-75 uppercase font-bold">Pending</p>
          <p className="text-xl font-extrabold mt-1 text-yellow-300">{pending.toFixed(1)}</p>
        </div>
        <div className="w-px bg-white/20 h-10 my-auto"></div>
        <div>
          <p className="text-[10px] text-outline-variant opacity-75 uppercase font-bold">Remaining</p>
          <p className="text-xl font-extrabold mt-1 text-secondary-container">{remaining.toFixed(1)}</p>
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
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30 text-xs space-y-1">
              <p className="font-bold text-primary">Leave Cost Preview:</p>
              <div className="flex justify-between text-[11px] text-on-surface-variant">
                <span>Calendar Duration:</span>
                <span>{((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 + 1).toFixed(0)} Days</span>
              </div>
              {weekendDays > 0 && (
                <div className="flex justify-between text-[11px] text-yellow-600 font-semibold">
                  <span>Excluded Weekend Days:</span>
                  <span>-{weekendDays} Days</span>
                </div>
              )}
              {holidayDays > 0 && (
                <div className="flex justify-between text-[11px] text-yellow-600 font-semibold">
                  <span>Excluded Holiday Days:</span>
                  <span>-{holidayDays} Days</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-extrabold text-primary border-t border-outline-variant/30 pt-1 mt-1">
                <span>Net Deductible Days:</span>
                <span className="text-secondary">{workingDays} Working Days</span>
              </div>
            </div>
          )}

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
                <div className="space-y-1">
                  <p className="text-xs font-bold text-primary">{l.type}</p>
                  <p className="text-[10px] text-on-surface-variant font-semibold">{l.dateRange}</p>
                  {l.totalDays !== undefined && (
                    <Badge variant="info" className="text-[9px] px-1 py-0.5">
                      {l.totalDays} working days charged
                    </Badge>
                  )}
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
