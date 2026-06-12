"use client";

import React, { useState, useEffect } from "react";
import { Employee, AttendanceRecord, LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function MobileHomePage() {
  const [data, setData] = useState<{
    employees: Employee[];
    attendance: AttendanceRecord[];
    leaves: LeaveRequest[];
  }>({ employees: [], attendance: [], leaves: [] });

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [checking, setChecking] = useState(false);

  const employeeId = "AA-1001"; // Mock authenticated employee (Ahmed Ali)

  const fetchDb = async () => {
    try {
      const [empRes, attRes, lvRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/attendance"),
        fetch("/api/v1/leaves")
      ]);
      if (empRes.ok && attRes.ok && lvRes.ok) {
        const [employees, attendance, leaves] = await Promise.all([
          empRes.json(),
          attRes.json(),
          lvRes.json()
        ]);
        setData({ employees, attendance, leaves });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
    // Clock interval
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setDate(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const employee = data.employees.find(e => e.id === employeeId);
  const activeRecord = data.attendance.find(a => a.employeeId === employeeId && !a.checkOut);
  const employeeRecords = data.attendance.filter(a => a.employeeId === employeeId);

  const handleAttendanceToggle = async () => {
    setChecking(true);
    try {
      if (activeRecord) {
        // Clock out
        await fetch("/api/v1/attendance/check-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId })
        });
      } else {
        // Clock in
        await fetch("/api/v1/attendance/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            lat: 25.2861,
            lng: 51.5348,
            device: "iPhone 15 Pro Max · GPS Active",
            locationName: "Al Hattab HQ Doha"
          })
        });
      }
      fetchDb();
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  // Stats calculation
  const approvedLeaves = data.leaves.filter(l => l.employeeId === employeeId && l.status === "Approved").length;

  return (
    <div className="space-y-6">
      {/* Hero Time Card */}
      <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-on-primary shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-container/20 rounded-full -ml-12 -mb-12 blur-xl"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">{date || "Monday, 23 October 2023"}</p>
          <div className="text-4xl font-extrabold text-glow tracking-tight leading-none mb-6 font-mono">{time || "08:45:12"}</div>
          
          <div className="w-full bg-white/10 backdrop-blur-md rounded-xl p-3 flex justify-between items-center border border-white/10">
            <div className="flex flex-col">
              <span className="text-[10px] opacity-75 font-semibold uppercase">Current Status</span>
              <span className="text-sm font-bold mt-0.5">
                {activeRecord ? "Clocked In" : "Checked Out"}
              </span>
            </div>
            <Button
              disabled={checking}
              onClick={handleAttendanceToggle}
              className="bg-white text-primary font-bold text-xs py-2 px-5 rounded-lg shadow-md hover:bg-white/95 active:scale-95 transition-transform"
            >
              {checking ? "Processing..." : activeRecord ? "Check Out" : "Check In"}
            </Button>
          </div>
        </div>
      </section>

      {/* Geo-fence Status Banner */}
      <section>
        <Card className="p-4 border border-outline-variant flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-status-success/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-status-success text-xl">location_on</span>
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-bold text-primary">Office Geo-fence</h3>
            <p className="text-[11px] text-status-success font-bold mt-0.5">Within HQ Doha Zone</p>
          </div>
        </Card>
      </section>

      {/* Stats Summary Bento Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wider px-1">This Month</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="col-span-2 p-4 border-l-4 border-l-primary flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase">Attendance Rate</span>
              <span className="material-symbols-outlined text-primary/40 text-lg">analytics</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-primary">91%</span>
              <span className="text-[10px] text-on-surface-variant font-medium">(20 / 22 Days)</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: "91%" }}></div>
            </div>
          </Card>

          <Card className="p-4 border border-outline-variant flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-status-error/10 flex items-center justify-center text-status-error">
              <span className="material-symbols-outlined text-base">schedule</span>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Late Arrivals</p>
              <p className="text-lg font-bold text-primary mt-0.5">1 <span className="text-[10px] font-normal text-on-surface-variant">Day</span></p>
            </div>
          </Card>

          <Card className="p-4 border border-outline-variant flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-status-pending/10 flex items-center justify-center text-status-pending">
              <span className="material-symbols-outlined text-base">event_busy</span>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Leave Approved</p>
              <p className="text-lg font-bold text-primary mt-0.5">{approvedLeaves} <span className="text-[10px] font-normal text-on-surface-variant">Days</span></p>
            </div>
          </Card>
        </div>
      </section>

      {/* Recent Activity logs */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wider px-1">Recent Activity</h2>
        <div className="space-y-2.5">
          {employeeRecords.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic p-4 text-center">No clock-ins recorded yet.</p>
          ) : (
            employeeRecords.slice(0, 3).map((rec) => (
              <div key={rec.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex items-center gap-3.5 hover:bg-surface-container-high transition-colors">
                <div className="w-2 h-2 rounded-full bg-status-success shrink-0"></div>
                <div className="flex-grow">
                  <p className="text-xs font-bold text-primary">
                    {rec.checkOut ? "Checked Out" : "Checked In"}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                    {rec.locationName}
                  </p>
                </div>
                <span className="text-[10px] text-on-surface-variant font-mono font-medium">
                  {new Date(rec.checkOut || rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
