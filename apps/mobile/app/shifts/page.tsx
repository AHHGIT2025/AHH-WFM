"use client";

import React, { useState, useEffect } from "react";
import { ShiftAssignment, LeaveRequest, Holiday, ShiftSwapRequest, Employee, AttendanceRecord } from "@ahh-wfm/types";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

export default function MobileShiftsPage() {
  const [activeTab, setActiveTab] = useState<"calendar" | "swaps" | "overtime">("calendar");
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);

  // Swap Request Form State
  const [selectedOwnShiftId, setSelectedOwnShiftId] = useState("");
  const [targetEmpId, setTargetEmpId] = useState("");
  const [targetShiftTemplateId, setTargetShiftTemplateId] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [submittingSwap, setSubmittingSwap] = useState(false);

  const employeeId = "AA-1001"; // Ahmed Ali

  const fetchMobileData = async () => {
    try {
      const [assignRes, leavesRes, holRes, swapsRes, empRes, attRes] = await Promise.all([
        fetch("/api/v1/shifts/assignments"),
        fetch("/api/v1/leaves"),
        fetch("/api/v1/holidays"),
        fetch("/api/v1/shifts/swaps"),
        fetch("/api/v1/employees"),
        fetch("/api/v1/attendance")
      ]);

      if (assignRes.ok) {
        const json = await assignRes.json();
        const empShifts = json
          .filter((a: ShiftAssignment) => a.employeeId === employeeId)
          .sort((a: ShiftAssignment, b: ShiftAssignment) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setAssignments(empShifts);
        if (empShifts.length > 0 && !selectedOwnShiftId) {
          setSelectedOwnShiftId(empShifts[0].id);
        }
      }

      if (leavesRes.ok) {
        const json = await leavesRes.json();
        setLeaves(json.filter((l: LeaveRequest) => l.employeeId === employeeId && l.status === "Approved"));
      }

      if (holRes.ok) {
        setHolidays(await holRes.json());
      }

      if (swapsRes.ok) {
        const json = await swapsRes.json();
        setSwaps(json.filter((s: ShiftSwapRequest) => s.requestorId === employeeId || s.targetEmployeeId === employeeId));
      }

      if (empRes.ok) {
        const json = await empRes.json();
        setEmployees(json.filter((e: Employee) => e.id !== employeeId && e.isActive !== false));
      }

      if (attRes.ok) {
        const json = await attRes.json();
        setMyAttendance(json.filter((r: AttendanceRecord) => r.employeeId === employeeId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMobileData();
  }, []);

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnShiftId || !targetEmpId || !targetShiftTemplateId) {
      alert("Please fill in all required shift swap fields.");
      return;
    }
    setSubmittingSwap(true);
    try {
      const res = await fetch("/api/v1/shifts/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestorId: employeeId,
          targetEmployeeId: targetEmpId,
          requestorShiftId: selectedOwnShiftId,
          targetShiftId: targetShiftTemplateId,
          reason: swapReason
        })
      });
      if (res.ok) {
        alert("Shift swap request submitted successfully!");
        setSwapReason("");
        fetchMobileData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingSwap(false);
    }
  };

  const todayStr = new Date().toISOString().substring(0, 10);
  const todayShift = assignments.find(a => a.date === todayStr);

  const formatShiftDate = (dateStr: string) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const d = new Date(dateStr);
    return {
      dayName: days[d.getDay()],
      dateLabel: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
    };
  };

  // Check if a date has holiday or leave
  const getDayAnnotations = (dateStr: string) => {
    const hol = holidays.find(h => h.date.substring(0, 10) === dateStr);
    const leave = leaves.find(l => l.startDate && l.endDate && dateStr >= l.startDate && dateStr <= l.endDate);
    return { hol, leave };
  };

  return (
    <div className="space-y-5">
      <div className="flex border-b border-border-subtle gap-4 text-xs font-bold text-on-surface-variant">
        <button
          onClick={() => setActiveTab("calendar")}
          className={`pb-2 outline-none ${activeTab === "calendar" ? "border-b-2 border-primary text-primary" : "border-transparent"}`}
        >
          My Calendar
        </button>
        <button
          onClick={() => setActiveTab("swaps")}
          className={`pb-2 outline-none ${activeTab === "swaps" ? "border-b-2 border-primary text-primary" : "border-transparent"}`}
        >
          Shift Swaps
        </button>
        <button
          onClick={() => setActiveTab("overtime")}
          className={`pb-2 outline-none ${activeTab === "overtime" ? "border-b-2 border-primary text-primary" : "border-transparent"}`}
        >
          My Overtime
        </button>
      </div>

      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-primary">My Work Schedule</h2>
            <p className="text-[11px] text-on-surface-variant">View your active shifts, approved leave dates, and holidays.</p>
          </div>

          {/* Today's Shift Card */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">Today's Shift</h3>
            {todayShift ? (
              <Card className="bg-primary text-white border-none relative overflow-hidden p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-1 relative z-10">
                  <Badge variant="success" className="text-[9px] bg-white/10 border-white/20 text-yellow-300">Active Shift</Badge>
                  <h4 className="text-sm font-extrabold">{todayShift.shiftTemplate?.name}</h4>
                  <p className="text-xs opacity-90 font-mono mt-0.5">{todayShift.shiftTemplate?.startTime} - {todayShift.shiftTemplate?.endTime}</p>
                </div>
                <div className="text-white/20 relative z-10">
                  <span className="material-symbols-outlined text-3xl">schedule</span>
                </div>
              </Card>
            ) : (
              <Card className="p-3.5 border border-outline-variant bg-surface-container-low text-center italic text-xs text-on-surface-variant rounded-xl">
                Rest Day (No shifts scheduled today)
              </Card>
            )}
          </section>

          {/* Upcoming Schedule Log */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">Upcoming Roster (14 Days)</h3>
            <div className="space-y-2">
              {assignments.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic p-4 text-center">No assignments scheduled.</p>
              ) : (
                assignments.map((sa) => {
                  const { dayName, dateLabel } = formatShiftDate(sa.date);
                  const { hol, leave } = getDayAnnotations(sa.date);
                  
                  return (
                    <div key={sa.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                          {dayName} · {dateLabel}
                        </p>
                        <p className="text-xs font-bold text-primary">{sa.shiftTemplate?.name}</p>
                        {hol && <Badge variant="info" className="text-[8px] py-0">{hol.name}</Badge>}
                        {leave && <Badge variant="warning" className="text-[8px] py-0">ON LEAVE ({leave.type})</Badge>}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-primary block">
                          {sa.shiftTemplate?.startTime} - {sa.shiftTemplate?.endTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "swaps" && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Request Shift Swap</h3>
            <form onSubmit={handleSubmitSwap} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Your Shift</label>
                <select
                  value={selectedOwnShiftId}
                  onChange={(e) => setSelectedOwnShiftId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.date} - {a.shiftTemplate?.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Colleague</label>
                <select
                  value={targetEmpId}
                  onChange={(e) => setTargetEmpId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Swap to Shift Template</label>
                <select
                  value={targetShiftTemplateId}
                  onChange={(e) => setTargetShiftTemplateId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  <option value="">-- Choose Shift --</option>
                  {assignments.map(a => (
                    <option key={a.id} value={a.shiftTemplateId}>{a.shiftTemplate?.name} ({a.shiftTemplate?.startTime} - {a.shiftTemplate?.endTime})</option>
                  ))}
                </select>
              </div>

              <Input
                label="Reason for Swap"
                placeholder="e.g. Family emergency, travel plans"
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                required
              />

              <Button type="submit" disabled={submittingSwap} className="w-full py-2 font-bold text-xs">
                {submittingSwap ? "Submitting..." : "Submit Swap Offer"}
              </Button>
            </form>
          </Card>

          {/* Swaps History */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">Swap Request History</h3>
            <div className="space-y-2">
              {swaps.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic text-center p-4">No swap records found.</p>
              ) : (
                swaps.map(s => (
                  <div key={s.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-primary">Swap ID: {s.id}</p>
                      <p className="text-[11px] text-on-surface-variant">Colleague: {s.requestorId === employeeId ? s.targetEmployeeName : s.requestorName}</p>
                      {s.reason && <p className="italic text-[10px] text-on-surface-variant">"{s.reason}"</p>}
                    </div>
                    <Badge variant={s.status === "APPROVED" ? "success" : (s.status === "REJECTED" ? "error" : "warning")} className="font-bold text-[10px]">
                      {s.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "overtime" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-primary">My Overtime Claims</h2>
            <p className="text-[11px] text-on-surface-variant">Review overtime auto-calculations and payouts.</p>
          </div>

          <div className="space-y-2">
            {myAttendance.filter(r => (r.standardOtMinutes || 0) + (r.weekendOtMinutes || 0) + (r.holidayOtMinutes || 0) + (r.nightOtMinutes || 0) > 0).length === 0 ? (
              <p className="text-xs text-on-surface-variant italic text-center p-4">No overtime claims logged.</p>
            ) : (
              myAttendance.map((rec) => {
                const totalMinutes = (rec.standardOtMinutes || 0) + (rec.weekendOtMinutes || 0) + (rec.holidayOtMinutes || 0) + (rec.nightOtMinutes || 0);
                if (totalMinutes === 0) return null;
                
                return (
                  <div key={rec.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-primary">Date: {rec.checkIn.substring(0, 10)}</p>
                      <div className="text-[11px] text-on-surface-variant font-semibold space-y-0.5 mt-1">
                        <p>Total Calculated: {totalMinutes} mins</p>
                        {rec.otStatus === "APPROVED" && (
                          <p className="text-status-success">Payout Amount: {rec.overtimePayAmount?.toFixed(2)} QAR</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={rec.otStatus === "APPROVED" ? "success" : (rec.otStatus === "REJECTED" ? "error" : "warning")} className="font-bold text-[10px]">
                        {rec.otStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
