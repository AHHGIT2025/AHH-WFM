"use client";

import React, { useState, useEffect } from "react";
import { AttendanceRecord } from "@ahh-wfm/types";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const json = await res.json();
        setAttendance(json.attendance);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = attendance.filter((rec) => {
    return rec.employeeName.toLowerCase().includes(search.toLowerCase()) || rec.employeeId.toLowerCase().includes(search.toLowerCase()) || rec.locationName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Attendance Monitor</h1>
          <p className="text-sm text-on-surface-variant">Daily log ledger of employee check-ins and check-outs with GPS verification</p>
        </div>
        <Button className="font-bold flex items-center gap-1.5 self-start sm:self-auto">
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span>Export logs</span>
        </Button>
      </div>

      <Card className="p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Filter by employee name, ID or location..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Check In</th>
                <th className="p-4">Check Out</th>
                <th className="p-4">Location</th>
                <th className="p-4">Device Info</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant">
                    No attendance logs found.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-primary">{rec.employeeName}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant">{rec.employeeId}</p>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-medium text-primary">
                      {new Date(rec.checkIn).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono font-medium text-primary">
                      {rec.checkOut ? new Date(rec.checkOut).toLocaleString() : (
                        <span className="text-status-success font-bold animate-pulse">On Duty</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-primary">{rec.locationName}</p>
                        <p className="text-[10px] text-on-surface-variant">GPS: {rec.lat.toFixed(4)}, {rec.lng.toFixed(4)}</p>
                      </div>
                    </td>
                    <td className="p-4 text-on-surface-variant font-medium">{rec.device}</td>
                    <td className="p-4">
                      <Badge variant={rec.status === "On Time" ? "success" : "warning"}>
                        {rec.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-secondary hover:underline font-bold text-[11px] flex items-center gap-1 ml-auto">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        <span>Show Map</span>
                      </button>
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
