"use client";

import React, { useEffect, useState } from "react";

export default function SchedulePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/schedule")
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
        <h2 className="text-xl font-bold text-primary">My Schedule</h2>
        <p className="text-[11px] text-on-surface-variant">Upcoming shifts and assignments</p>
      </div>

      <div className="space-y-3">
        {data?.deployments?.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Deployments</h3>
            {data.deployments.map((d: any) => (
              <div key={d.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 mb-2 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-bold">{d.project?.projectName}</p>
                  <p className="text-[10px] text-on-surface-variant">{d.site?.siteName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{new Date(d.deploymentDate).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {data?.shifts?.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Shifts</h3>
            {data.shifts.map((s: any) => (
              <div key={s.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 mb-2 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-on-surface">{s.shiftTemplate?.name || "Standard"}</p>
                  <span className="text-[9px] font-bold bg-status-success/10 text-status-success px-1.5 py-0.5 rounded uppercase">{s.assignmentStatus}</span>
                </div>
                <p className="text-[10px] text-on-surface-variant">{s.project?.projectName || s.officeLocation?.locationName || "No specific location"}</p>
                <div className="mt-2 text-[10px] font-semibold text-primary">
                  {s.shiftTemplate?.startTime} - {s.shiftTemplate?.endTime}
                </div>
              </div>
            ))}
          </div>
        )}

        {data?.onCalls?.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">On-Call Duty</h3>
            {data.onCalls.map((o: any) => (
              <div key={o.id} className="bg-secondary-container/20 border border-secondary-container rounded-xl p-3 mb-2 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs font-bold text-secondary">On-Call Assignment</p>
                  <span className="text-[9px] font-bold bg-secondary/10 text-secondary px-1.5 py-0.5 rounded uppercase">{new Date(o.assignmentDate).toLocaleDateString()}</span>
                </div>
                <p className="text-[10px] text-on-surface-variant">{o.project?.projectName || "General Duty"}</p>
              </div>
            ))}
          </div>
        )}

        {(!data?.deployments?.length && !data?.shifts?.length && !data?.onCalls?.length) && (
          <div className="text-center py-8 text-on-surface-variant text-[11px]">
            No upcoming schedules found.
          </div>
        )}
      </div>
    </div>
  );
}
