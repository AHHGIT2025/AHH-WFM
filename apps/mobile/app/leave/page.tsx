"use client";

import React, { useEffect, useState } from "react";

export default function LeavePage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/leaves/balances").then(r => r.json()),
      fetch("/api/v1/leaves").then(r => r.json())
    ]).then(([bData, lData]) => {
      setBalances(bData.balances || []);
      setLeaves(lData.leaves || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-primary">Leave Management</h2>
          <p className="text-[11px] text-on-surface-variant">Balances and requests</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-white p-2 rounded-full shadow-sm active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-outline-variant/50 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-primary mb-3">Request Time Off</h3>
          {/* Simple placeholder form for now */}
          <div className="space-y-3">
            <div>
              <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase">Leave Type</label>
              <select className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white">
                <option>Annual Leave</option>
                <option>Sick Leave</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase">Start Date</label>
                <input type="date" className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase">End Date</label>
                <input type="date" className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-on-surface-variant mb-1 uppercase">Reason</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-outline-variant rounded-xl text-[11px] bg-white"></textarea>
            </div>
            <button className="w-full bg-[#b89d7e] text-white font-bold py-2.5 rounded-xl text-[11px]" onClick={() => alert("Submitted!")}>Submit Request</button>
          </div>
        </div>
      )}

      {/* Balances */}
      <div>
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">My Balances</h3>
        <div className="grid grid-cols-2 gap-3">
          {balances.map(b => (
            <div key={b.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 text-center shadow-sm">
              <p className="text-[10px] text-on-surface-variant truncate">{b.leaveType?.name}</p>
              <p className="text-xl font-bold text-primary mt-1">{b.balance}</p>
              <p className="text-[9px] text-on-surface-variant mt-0.5">days available</p>
            </div>
          ))}
          {balances.length === 0 && (
            <div className="col-span-2 text-center py-4 text-[11px] text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
              No balances found
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Recent Requests</h3>
        <div className="space-y-2">
          {leaves.map(l => (
            <div key={l.id} className="bg-surface border border-outline-variant/30 rounded-xl p-3 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-bold">{l.leaveType?.name || "Leave"}</p>
                <p className="text-[10px] text-on-surface-variant">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase ${
                l.status === "APPROVED" ? "bg-status-success/10 text-status-success" :
                l.status === "REJECTED" ? "bg-status-error/10 text-status-error" :
                "bg-status-pending/10 text-status-pending"
              }`}>
                {l.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
