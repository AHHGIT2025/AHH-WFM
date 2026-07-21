"use client";

import React, { useState, useEffect } from "react";

export default function SecFacWelfareChecksPage() {
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChecks();
  }, []);

  async function fetchChecks() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/secfac/welfare/checks");
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lone Worker Welfare Monitoring</h1>
          <p className="text-sm text-slate-500">
            Automated check-in tracking & setting precedence (Post → Site → Project → Company)
          </p>
        </div>
        <button
          onClick={fetchChecks}
          className="px-4 py-2 bg-indigo-600 text-white rounded font-medium text-sm hover:bg-indigo-500"
        >
          Refresh Data
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Guard / Employee</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Site</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Due At</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Grace Expires</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading checks...</td>
              </tr>
            ) : checks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No active welfare checks found.</td>
              </tr>
            ) : (
              checks.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.employee?.name || item.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600">{item.site?.name || item.siteId}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{new Date(item.dueAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{new Date(item.graceExpiresAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        item.status === "ACKNOWLEDGED"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "MISSED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.settingSourceType}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
