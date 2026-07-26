"use client";

import React, { useState, useEffect } from "react";

export default function ManpowerCalendarsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [ramadanPeriods, setRamadanPeriods] = useState<any[]>([]);
  const [holidayCalendars, setHolidayCalendars] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"profiles" | "ramadan" | "holidays">("profiles");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profRes, ramRes, holRes] = await Promise.all([
        fetch("/api/v1/manpower/work-calendar-profiles").then(r => r.ok ? r.json() : { profiles: [] }),
        fetch("/api/v1/manpower/ramadan-periods").then(r => r.ok ? r.json() : { periods: [] }),
        fetch("/api/v1/manpower/holiday-calendars").then(r => r.ok ? r.json() : { calendars: [] })
      ]);
      setProfiles(profRes.profiles || profRes.data || []);
      setRamadanPeriods(ramRes.periods || ramRes.data || []);
      setHolidayCalendars(holRes.calendars || holRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approveRamadanPeriod = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/ramadan-periods/${id}/approve`, { method: "POST" });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(`Error approving Ramadan period: ${err.error}`);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const approveWorkProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/work-calendar-profiles/${id}/approve`, { method: "POST" });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(`Error approving work profile: ${err.error}`);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const approveHolidayCalendar = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/manpower/holiday-calendars/${id}/approve`, { method: "POST" });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(`Error approving holiday calendar: ${err.error}`);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manpower Calendar Administration</h1>
          <p className="text-sm text-slate-500">
            Manage Work Calendar Profiles, Annual Ramadan Periods, and Company/Global Holiday Calendars
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("profiles")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "profiles" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Work Profiles ({profiles.length})
          </button>
          <button
            onClick={() => setActiveTab("ramadan")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "ramadan" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Ramadan Periods ({ramadanPeriods.length})
          </button>
          <button
            onClick={() => setActiveTab("holidays")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "holidays" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Holiday Calendars ({holidayCalendars.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading calendar administration data...</div>
      ) : (
        <div>
          {activeTab === "profiles" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 border-b font-semibold">
                  <tr>
                    <th className="p-3">Code / Name</th>
                    <th className="p-3">Scope / Category</th>
                    <th className="p-3">Daily / Weekly Mins</th>
                    <th className="p-3">Ramadan Mins</th>
                    <th className="p-3">Rest Config</th>
                    <th className="p-3">Version / Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">No work calendar profiles found.</td>
                    </tr>
                  ) : (
                    profiles.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-900">
                          {p.code}
                          <div className="text-xs text-slate-500">{p.name}</div>
                        </td>
                        <td className="p-3 text-slate-600">
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 font-mono">
                            {p.operationType}
                          </span>
                          <div className="text-xs text-slate-500">{p.workerCategory}</div>
                        </td>
                        <td className="p-3 text-slate-600">
                          {p.ordinaryDailyMinutes != null ? `${p.ordinaryDailyMinutes}m / ${p.ordinaryWeeklyMinutes}m` : <span className="text-amber-600 font-semibold">Unconfigured (DRAFT)</span>}
                        </td>
                        <td className="p-3 text-slate-600">
                          {p.ramadanDailyMinutes != null ? `${p.ramadanDailyMinutes}m / ${p.ramadanWeeklyMinutes}m` : "N/A"}
                        </td>
                        <td className="p-3 text-slate-600 text-xs">
                          {p.weeklyRestConfigType} ({p.weeklyRestFixedDay || "Unspecified"})
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            p.approvalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                            p.approvalStatus === "SUPERSEDED" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"
                          }`}>
                            v{p.version} - {p.approvalStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {p.approvalStatus === "DRAFT" && (
                            <button
                              onClick={() => approveWorkProfile(p.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "ramadan" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 border-b font-semibold">
                  <tr>
                    <th className="p-3">Year</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Start Date</th>
                    <th className="p-3">End Date</th>
                    <th className="p-3">Version / Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ramadanPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">No Ramadan periods configured.</td>
                    </tr>
                  ) : (
                    ramadanPeriods.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{r.year}</td>
                        <td className="p-3 text-slate-800">{r.name}</td>
                        <td className="p-3 text-slate-600">{new Date(r.startDate).toISOString().split("T")[0]}</td>
                        <td className="p-3 text-slate-600">{new Date(r.endDate).toISOString().split("T")[0]}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            r.approvalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                            r.approvalStatus === "SUPERSEDED" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"
                          }`}>
                            v{r.version} - {r.approvalStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {r.approvalStatus === "DRAFT" && (
                            <button
                              onClick={() => approveRamadanPeriod(r.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "holidays" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 border-b font-semibold">
                  <tr>
                    <th className="p-3">Year / ScopeKey</th>
                    <th className="p-3">Calendar Name</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Company Scope</th>
                    <th className="p-3">Version / Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidayCalendars.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">No holiday calendars configured.</td>
                    </tr>
                  ) : (
                    holidayCalendars.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-900">
                          {h.year}
                          <div className="text-xs text-slate-500 font-mono">{h.scopeKey || "GLOBAL"}</div>
                        </td>
                        <td className="p-3 text-slate-800">{h.name}</td>
                        <td className="p-3 text-slate-600 font-mono text-xs">{h.scope}</td>
                        <td className="p-3 text-slate-600 text-xs">
                          {h.companyId ? `Company (${h.companyId})` : "Global (All Companies)"}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            h.approvalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                            h.approvalStatus === "SUPERSEDED" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"
                          }`}>
                            v{h.version} - {h.approvalStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {h.approvalStatus === "DRAFT" && (
                            <button
                              onClick={() => approveHolidayCalendar(h.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
