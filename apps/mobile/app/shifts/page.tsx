"use client";

import React, { useState, useEffect } from "react";
import { ShiftAssignment, ShiftTemplate } from "@ahh-wfm/types";
import { Card, Badge } from "@ahh-wfm/ui/src";

export default function MobileShiftsPage() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const employeeId = "AA-1001"; // Ahmed Ali (authenticated employee ID)

  const fetchShifts = async () => {
    try {
      const res = await fetch("/api/v1/shifts/assignments");
      if (res.ok) {
        const json = await res.json();
        // Filter assignments for the current employee, order by date ascending
        const empShifts = json
          .filter((a: ShiftAssignment) => a.employeeId === employeeId)
          .sort((a: ShiftAssignment, b: ShiftAssignment) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setAssignments(empShifts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const todayStr = new Date().toISOString().substring(0, 10);
  const todayShift = assignments.find(a => a.date === todayStr);
  const upcomingShifts = assignments.filter(a => a.date > todayStr);

  const formatShiftDate = (dateStr: string) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const d = new Date(dateStr);
    return {
      dayName: days[d.getDay()],
      dateLabel: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">My Work Schedule</h2>
        <p className="text-xs text-on-surface-variant">View your active shift details and upcoming scheduled assignments</p>
      </div>

      {/* Today's Shift Card */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">Today's Shift</h3>
        {todayShift ? (
          <Card className="bg-primary text-white border-none relative overflow-hidden p-4 rounded-xl flex items-center justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="space-y-1 relative z-10">
              <Badge variant="success" className="text-[9px] bg-white/10 border-white/20 text-yellow-300">Active Shift</Badge>
              <h4 className="text-base font-extrabold">{todayShift.shiftTemplate?.name}</h4>
              <p className="text-xs opacity-90 font-mono mt-0.5">{todayShift.shiftTemplate?.startTime} - {todayShift.shiftTemplate?.endTime}</p>
              {todayShift.shiftTemplate?.isSplit && (
                <p className="text-[10px] opacity-75 italic">Split block: {todayShift.shiftTemplate?.splitStart} - {todayShift.shiftTemplate?.splitEnd}</p>
              )}
            </div>
            <div className="text-white/20 relative z-10">
              <span className="material-symbols-outlined text-4xl">schedule</span>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border border-outline-variant bg-surface-container-low text-center italic text-xs text-on-surface-variant">
            No shift assigned for today (Rest Day).
          </Card>
        )}
      </section>

      {/* Upcoming Shifts Roster Calendar */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">Upcoming Roster (14-Day View)</h3>
        <div className="space-y-2.5">
          {upcomingShifts.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic p-4 text-center">No upcoming shifts scheduled.</p>
          ) : (
            upcomingShifts.slice(0, 14).map((sa) => {
              const { dayName, dateLabel } = formatShiftDate(sa.date);
              const isSplit = sa.shiftTemplate?.isSplit;

              return (
                <div key={sa.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex items-center justify-between gap-3 hover:bg-surface-container-high transition-colors">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      {dayName} · {dateLabel}
                    </p>
                    <p className="text-xs font-bold text-primary">{sa.shiftTemplate?.name}</p>
                    {isSplit && (
                      <p className="text-[9px] text-yellow-700 bg-yellow-50 dark:bg-yellow-950/20 px-1.5 py-0.5 rounded border border-yellow-100/50 inline-block font-bold">
                        Split blocks scheduled
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-primary block">
                      {sa.shiftTemplate?.startTime} - {sa.shiftTemplate?.endTime}
                    </span>
                    {isSplit && (
                      <span className="text-[9px] font-mono text-on-surface-variant block opacity-75 mt-0.5">
                        &amp; {sa.shiftTemplate?.splitStart} - {sa.shiftTemplate?.splitEnd}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
