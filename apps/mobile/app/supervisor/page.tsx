"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SupervisorDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    if ((session.user as any).role !== "SUPERVISOR" && (session.user as any).role !== "ADMIN") {
      router.replace("/");
      return;
    }

    fetch("/api/v1/supervisor/team-status")
      .then(res => {
        if (!res.ok) throw new Error("Unauthorized or failed to load");
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [session, router]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (error) {
    return <div className="text-status-error text-center p-4">{error}</div>;
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h2 className="text-xl font-bold text-primary">Team Status</h2>
        <p className="text-[11px] text-on-surface-variant">Live overview of your assigned personnel</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-status-success/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-status-success uppercase tracking-widest mb-1">Present</p>
          <p className="text-2xl font-black text-on-surface">{data?.summary?.present || 0}</p>
        </div>
        <div className="bg-surface border border-status-error/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-status-error uppercase tracking-widest mb-1">Absent</p>
          <p className="text-2xl font-black text-on-surface">{data?.summary?.absent || 0}</p>
        </div>
        <div className="bg-surface border border-status-pending/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-status-pending uppercase tracking-widest mb-1">Late</p>
          <p className="text-xl font-bold text-on-surface">{data?.summary?.late || 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Out of Zone</p>
          <p className="text-xl font-bold text-on-surface">{data?.summary?.outOfZone || 0}</p>
        </div>
      </div>

      {/* Scanner Placeholder */}
      <button className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
        <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
        <span className="text-[11px]">Bulk Attendance Scanner (Soon)</span>
      </button>

      {/* Roster */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Today's Roster</h3>
          <span className="text-[10px] text-primary font-bold">{data?.summary?.total} Total</span>
        </div>
        <div className="divide-y divide-outline-variant/20">
          {data?.roster?.map((r: any) => (
            <div key={r.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-[11px] font-bold text-on-surface">{r.name}</p>
                <p className="text-[9px] text-on-surface-variant mt-0.5">{r.designation}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  r.status === "ON_TIME" ? "bg-status-success/10 text-status-success" :
                  r.status === "ABSENT" ? "bg-status-error/10 text-status-error" :
                  r.status === "LATE" ? "bg-status-pending/10 text-status-pending" :
                  "bg-outline-variant/20 text-on-surface-variant"
                }`}>
                  {r.status?.replace("_", " ")}
                </span>
                {r.checkInTime && (
                  <span className="text-[9px] text-on-surface-variant font-medium mt-1">
                    {new Date(r.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                )}
              </div>
            </div>
          ))}
          {(!data?.roster || data.roster.length === 0) && (
            <div className="px-4 py-8 text-center text-[11px] text-on-surface-variant">
              No team members found.
            </div>
          )}
        </div>
      </div>
      
      {/* Session Report Placeholder */}
      <button className="w-full bg-surface border border-[#b89d7e]/40 text-[#b89d7e] font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform mt-4">
        <span className="material-symbols-outlined text-[18px]">summarize</span>
        <span className="text-[11px]">Generate Session Report</span>
      </button>

    </div>
  );
}
