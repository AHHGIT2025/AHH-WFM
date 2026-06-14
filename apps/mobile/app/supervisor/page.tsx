"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SupervisorDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [statusRes, leaveRes] = await Promise.all([
        fetch("/api/v1/supervisor/team-status"),
        fetch("/api/v1/supervisor/leave-requests")
      ]);

      if (!statusRes.ok) throw new Error("Unauthorized or failed to load status");
      
      setData(await statusRes.json());
      
      if (leaveRes.ok) {
        setLeaves(await leaveRes.json());
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    if ((session.user as any).role !== "SUPERVISOR" && (session.user as any).role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchData();
  }, [session, router]);

  const handleLeaveAction = async (id: string, action: "approve" | "reject") => {
    if (!confirm(`Are you sure you want to ${action} this leave?`)) return;
    try {
      const res = await fetch(`/api/v1/supervisor/leave-requests/${id}/${action}`, {
        method: "POST"
      });
      if (res.ok) {
        fetchData(); // Refresh data
      } else {
        const err = await res.json();
        alert(err.error || `Failed to ${action} leave`);
      }
    } catch (e) {
      alert("Network error");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (error) {
    return <div className="text-status-error text-center p-4">{error}</div>;
  }

  const pendingLeaves = leaves.filter(l => l.status === "Pending Approval" || l.status === "Pending");

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
          <p className="text-2xl font-black text-on-surface">{data?.counts?.present || 0}</p>
        </div>
        <div className="bg-surface border border-status-error/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-status-error uppercase tracking-widest mb-1">Absent</p>
          <p className="text-2xl font-black text-on-surface">{data?.counts?.absent || 0}</p>
        </div>
        <div className="bg-surface border border-status-pending/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-status-pending uppercase tracking-widest mb-1">On Leave</p>
          <p className="text-xl font-bold text-on-surface">{data?.counts?.onLeave || 0}</p>
        </div>
        <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Total</p>
          <p className="text-xl font-bold text-on-surface">{data?.counts?.total || 0}</p>
        </div>
      </div>

      {/* Pending Leaves */}
      {pendingLeaves.length > 0 && (
        <div className="bg-surface border border-status-warning/30 rounded-2xl shadow-sm overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-status-warning/20 flex justify-between items-center bg-status-warning/5">
            <h3 className="text-[10px] font-bold text-status-warning uppercase tracking-wider">Pending Leaves</h3>
            <span className="text-[10px] text-status-warning font-bold">{pendingLeaves.length} Action(s)</span>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {pendingLeaves.map((l: any) => (
              <div key={l.id} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-bold text-on-surface">{l.employeeName}</p>
                    <p className="text-[9px] text-on-surface-variant">{l.type}</p>
                    <p className="text-[9px] text-on-surface-variant">{l.dateRange}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <button onClick={() => handleLeaveAction(l.id, "reject")} className="px-3 py-1.5 bg-status-error/10 text-status-error font-bold text-[10px] rounded">Reject</button>
                  <button onClick={() => handleLeaveAction(l.id, "approve")} className="px-3 py-1.5 bg-status-success/10 text-status-success font-bold text-[10px] rounded">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Team Roster</h3>
        </div>
        <div className="divide-y divide-outline-variant/20">
          {data?.members?.map((r: any) => (
            <div key={r.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-[11px] font-bold text-on-surface">{r.name}</p>
                <p className="text-[9px] text-on-surface-variant mt-0.5">{r.role}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  r.status === "On Duty" ? "bg-status-success/10 text-status-success" :
                  r.status === "Absent" || r.status === "Offline" ? "bg-status-error/10 text-status-error" :
                  r.status === "On Leave" ? "bg-status-warning/10 text-status-warning" :
                  "bg-outline-variant/20 text-on-surface-variant"
                }`}>
                  {r.status}
                </span>
                {r.attendance?.checkIn && (
                  <span className="text-[9px] text-on-surface-variant font-medium mt-1">
                    In: {new Date(r.attendance.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                )}
              </div>
            </div>
          ))}
          {(!data?.members || data.members.length === 0) && (
            <div className="px-4 py-8 text-center text-[11px] text-on-surface-variant">
              No team members found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
