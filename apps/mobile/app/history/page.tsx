"use client";

import React, { useEffect, useState } from "react";

export default function HistoryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/attendance/history")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-primary">Attendance History</h2>
        <p className="text-[11px] text-on-surface-variant">Your recent punches</p>
      </div>

      <div className="space-y-3">
        {data?.records?.length > 0 ? (
          data.records.map((r: any) => (
            <div key={r.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-bold text-on-surface">{new Date(r.checkIn).toLocaleDateString()}</p>
                  <p className="text-[10px] text-on-surface-variant">{r.locationName || "Unknown"}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  r.status === "ON_TIME" ? "bg-status-success/10 text-status-success" :
                  r.status === "OUT_OF_ZONE" ? "bg-status-error/10 text-status-error" :
                  "bg-status-pending/10 text-status-pending"
                }`}>
                  {r.status?.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-4 border-t border-outline-variant/20 pt-2 mt-1">
                <div className="flex flex-col">
                  <span className="text-[9px] text-on-surface-variant uppercase">In</span>
                  <span className="text-[11px] font-bold">{new Date(r.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-on-surface-variant uppercase">Out</span>
                  <span className="text-[11px] font-bold">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}</span>
                </div>
                {r.lateMinutes > 0 && (
                  <div className="ml-auto text-right flex flex-col">
                    <span className="text-[9px] text-status-error uppercase">Late</span>
                    <span className="text-[11px] font-bold text-status-error">{r.lateMinutes}m</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-on-surface-variant text-[11px]">
            No attendance records found.
          </div>
        )}
      </div>
    </div>
  );
}
