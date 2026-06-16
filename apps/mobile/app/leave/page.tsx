"use client";

import React, { useEffect, useState, useCallback } from "react";

export default function LeavePage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [bData, lData] = await Promise.all([
        fetch("/api/v1/leaves/balances").then(r => r.json()),
        fetch("/api/v1/leaves").then(r => r.json()),
      ]);
      setBalances(bData.balances || []);
      setLeaves(lData.leaves || []);
    } catch (e) {
      console.error("Error fetching leave data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    setError(null);
    if (!leaveTypeId) { setError("Please select a leave type."); return; }
    if (!startDate) { setError("Please select a start date."); return; }
    if (!endDate) { setError("Please select an end date."); return; }
    if (endDate < startDate) { setError("End date cannot be before start date."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveTypeId, startDate, endDate, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit leave request.");
      } else {
        setSuccessMsg("Leave request submitted successfully!");
        setShowForm(false);
        setLeaveTypeId("");
        setStartDate("");
        setEndDate("");
        setReason("");
        // Refresh data
        await fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "APPROVED") return "bg-emerald-100 text-emerald-700";
    if (s === "REJECTED" || s === "DECLINED") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[11px] text-on-surface-variant">Loading leave data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-primary">Leave Management</h2>
          <p className="text-[11px] text-on-surface-variant">Balances and requests</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); }}
          className="bg-primary text-white p-2 rounded-full shadow-sm active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {successMsg}
        </div>
      )}

      {/* Request Form */}
      {showForm && (
        <div className="bg-surface border border-outline-variant/50 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-primary mb-3">Request Time Off</h3>
          <div className="space-y-3">
            {/* Leave Type */}
            <div>
              <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Leave Type</label>
              <select
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={leaveTypeId}
                onChange={e => setLeaveTypeId(e.target.value)}
              >
                <option value="">-- Select Leave Type --</option>
                {balances
                  .filter(b => {
                    const available = (b.allocatedDays || 0) + (b.carriedForwardDays || 0) + (b.adjustmentDays || 0) - (b.usedDays || 0) - (b.pendingDays || 0);
                    return b.leaveType?.isActive === true && available > 0;
                  })
                  .map(b => {
                    const available = (b.allocatedDays || 0) + (b.carriedForwardDays || 0) + (b.adjustmentDays || 0) - (b.usedDays || 0) - (b.pendingDays || 0);
                    return (
                      <option key={b.leaveTypeId || b.id} value={b.leaveTypeId || b.id}>
                        {b.leaveType?.name || b.type} ({available} days remaining)
                      </option>
                    );
                  })
                }
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  min={today}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  min={startDate || today}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Reason (Optional)</label>
              <textarea
                rows={2}
                placeholder="Brief reason for leave…"
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              className="w-full bg-[#b89d7e] text-white font-bold py-2.5 rounded-xl text-[11px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  Submit Request
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Balances */}
      <div>
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">My Balances</h3>
        <div className="grid grid-cols-2 gap-3">
          {balances.map(b => {
            const available = b.balance ?? Math.max(0, (b.allocatedDays ?? 0) - (b.usedDays ?? 0) - (b.pendingDays ?? 0));
            return (
              <div key={b.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-on-surface-variant truncate">{b.leaveType?.name || b.type}</p>
                <p className="text-xl font-bold text-primary mt-1">{available}</p>
                <p className="text-[9px] text-on-surface-variant mt-0.5">days available</p>
              </div>
            );
          })}
          {balances.length === 0 && (
            <div className="col-span-2 text-center py-4 text-[11px] text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
              No balances found
            </div>
          )}
        </div>
      </div>

      {/* Recent Requests */}
      <div>
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Recent Requests</h3>
        <div className="space-y-2">
          {leaves.map(l => (
            <div key={l.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-bold">{l.leaveType?.name || l.type || "Leave"}</p>
                <p className="text-[10px] text-on-surface-variant">
                  {l.startDate ? new Date(l.startDate).toLocaleDateString() : "—"}{" "}
                  –{" "}
                  {l.endDate ? new Date(l.endDate).toLocaleDateString() : "—"}
                </p>
                {l.reason && <p className="text-[9px] text-on-surface-variant italic mt-0.5 truncate max-w-[160px]">{l.reason}</p>}
              </div>
              <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase ${getStatusStyle(l.status)}`}>
                {(l.status || "PENDING").toUpperCase()}
              </span>
            </div>
          ))}
          {leaves.length === 0 && (
            <div className="text-center py-6 text-[11px] text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
              No leave requests yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
