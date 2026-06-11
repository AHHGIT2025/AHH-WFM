"use client";

import React, { useState, useEffect } from "react";
import { AttendanceRecord } from "@ahh-wfm/types";
import { Card, Badge } from "@ahh-wfm/ui/src";

export default function MobileHistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const employeeId = "AA-1001";

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const json = await res.json();
        setRecords(json.attendance.filter((rec: AttendanceRecord) => rec.employeeId === employeeId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const formatHours = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return "Active";
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Attendance History</h2>
        <p className="text-xs text-on-surface-variant">Your chronological clock-in logs and work hours summary</p>
      </div>

      <div className="space-y-4">
        {records.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic p-4 text-center">No history records found.</p>
        ) : (
          records.map((rec) => (
            <Card key={rec.id} className="p-4 border border-outline-variant hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-xs font-bold text-primary">{rec.locationName}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-1">
                    In: {new Date(rec.checkIn).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                    Out: {rec.checkOut ? new Date(rec.checkOut).toLocaleString() : "Still active"}
                  </p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <Badge variant={rec.status === "On Time" ? "success" : "warning"}>
                    {rec.status}
                  </Badge>
                  <p className="text-xs font-mono font-bold text-primary mt-1">
                    {formatHours(rec.checkIn, rec.checkOut)}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
