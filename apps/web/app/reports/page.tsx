"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LayoutShell } from "@/components/layout-shell";
import Link from "next/link";

export default function ReportsHubPage() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as any)?.role || "EMPLOYEE";
  const userId = (session?.user as any)?.id || "";

  // Dynamic Tabs based on Role
  const availableTabs = [];
  if (["ADMIN", "HR", "FINANCE"].includes(userRole)) {
    availableTabs.push({ id: "executive", label: "Executive Dashboard", icon: "dashboard" });
  }
  if (["ADMIN", "HR", "SUPERVISOR", "EMPLOYEE"].includes(userRole)) {
    availableTabs.push({ id: "attendance", label: "Attendance Report", icon: "fact_check" });
    availableTabs.push({ id: "leaves", label: "Leave Report", icon: "event_busy" });
  }
  if (["ADMIN", "FINANCE", "SUPERVISOR", "EMPLOYEE"].includes(userRole)) {
    availableTabs.push({ id: "overtime", label: "Overtime Report", icon: "payments" });
  }
  if (["ADMIN", "HR", "SUPERVISOR", "EMPLOYEE"].includes(userRole)) {
    availableTabs.push({ id: "shifts", label: "Shift Roster Report", icon: "schedule" });
  }
  if (["ADMIN", "HR", "FINANCE"].includes(userRole)) {
    availableTabs.push({ id: "sap", label: "SAP Sync Report", icon: "sync_alt" });
  }

  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || "attendance");
  const [loading, setLoading] = useState(true);

  // Filter States
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [filterDept, setFilterDept] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Report Data States
  const [executiveData, setExecutiveData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [leaveData, setLeaveData] = useState<any>(null);
  const [overtimeData, setOvertimeData] = useState<any>(null);
  const [shiftData, setShiftData] = useState<any>(null);
  const [sapData, setSapData] = useState<any>(null);

  // Exporter Actions
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const fetchFilters = async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        fetch("/api/v1/departments"),
        fetch("/api/v1/employees")
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (e) {
      console.error("Failed to load filters", e);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (filterDept) queryParams.append("departmentId", filterDept);
    if (filterEmp) queryParams.append("employeeId", filterEmp);
    if (filterStartDate) queryParams.append("startDate", filterStartDate);
    if (filterEndDate) queryParams.append("endDate", filterEndDate);
    if (filterStatus) queryParams.append("status", filterStatus);

    try {
      if (activeTab === "executive" && ["ADMIN", "HR", "FINANCE"].includes(userRole)) {
        const res = await fetch(`/api/v1/reports/executive?${queryParams.toString()}`);
        if (res.ok) setExecutiveData(await res.json());
      } else if (activeTab === "attendance") {
        const res = await fetch(`/api/v1/reports/attendance?${queryParams.toString()}`);
        if (res.ok) setAttendanceData(await res.json());
      } else if (activeTab === "leaves") {
        const res = await fetch(`/api/v1/reports/leaves?${queryParams.toString()}`);
        if (res.ok) setLeaveData(await res.json());
      } else if (activeTab === "overtime") {
        const res = await fetch(`/api/v1/reports/overtime?${queryParams.toString()}`);
        if (res.ok) setOvertimeData(await res.json());
      } else if (activeTab === "shifts") {
        const res = await fetch(`/api/v1/reports/shifts?${queryParams.toString()}`);
        if (res.ok) setShiftData(await res.json());
      } else if (activeTab === "sap") {
        const res = await fetch(`/api/v1/reports/sap`);
        if (res.ok) setSapData(await res.json());
      }
    } catch (e) {
      console.error("Failed to load report data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchFilters();
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchReportData();
    }
  }, [activeTab, filterDept, filterEmp, filterStartDate, filterEndDate, filterStatus, status]);

  const handleExport = async (format: "CSV" | "JSON") => {
    setExporting(true);
    setExportMessage(null);
    try {
      const typeMap: Record<string, string> = {
        executive: "EXECUTIVE",
        attendance: "ATTENDANCE",
        leaves: "LEAVE",
        overtime: "OVERTIME",
        shifts: "SHIFTS",
        sap: "SAP"
      };

      const res = await fetch("/api/v1/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: typeMap[activeTab],
          exportFormat: format,
          reportName: `${activeTab.toUpperCase()} Export`,
          filters: {
            departmentId: filterDept || undefined,
            employeeId: filterEmp || undefined,
            startDate: filterStartDate || undefined,
            endDate: filterEndDate || undefined
          }
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setExportMessage(`Report exported: ${result.fileName}`);
        // Trigger secure download
        window.open(result.downloadUrl, "_blank");
      } else {
        setExportMessage("Export failed.");
      }
    } catch (e) {
      setExportMessage("Network error occurred during export.");
    } finally {
      setExporting(false);
    }
  };

  if (status === "loading") {
    return (
      <LayoutShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary">sync</span>
            <p className="mt-2 text-xs font-bold text-on-surface-variant">Loading reports console...</p>
          </div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      {/* Header and top links */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-3xl">analytics</span>
            Enterprise Reports & Analytics Hub
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Access operations dashboards, audit metrics lists, and run CSV/JSON secure exports.
          </p>
        </div>
        
        <div className="flex gap-2">
          {userRole === "ADMIN" && (
            <>
              <Link
                href="/reports/audit"
                className="bg-surface-container-high border border-border-subtle hover:bg-surface-container-highest text-primary font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">history_toggle_off</span>
                User Action Audits
              </Link>
              <Link
                href="/admin/backup"
                className="bg-surface-container-high border border-border-subtle hover:bg-surface-container-highest text-primary font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
                System Backups
              </Link>
              <Link
                href="/admin/production"
                className="bg-surface-container-high border border-border-subtle hover:bg-surface-container-highest text-primary font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">fact_check</span>
                Production Readiness
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle mb-6 overflow-x-auto gap-1">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setExportMessage(null);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-secondary text-secondary"
                : "border-transparent text-outline-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters SideBar Panel (Hide for Executive and SAP report depending on choice, but generally helpful) */}
      {activeTab !== "sap" && activeTab !== "executive" && (
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-4 mb-6 shadow-sm">
          <p className="text-xs font-bold text-primary mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-secondary">filter_alt</span>
            Filter Configuration Criteria
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Department */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">Department</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full bg-surface-container-low border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-primary font-semibold focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Employee */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">Operative</label>
              <select
                value={filterEmp}
                onChange={(e) => setFilterEmp(e.target.value)}
                className="w-full bg-surface-container-low border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-primary font-semibold focus:outline-none"
              >
                <option value="">All Employees</option>
                {employees.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full bg-surface-container-low border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-primary font-semibold focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-outline-variant mb-1">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full bg-surface-container-low border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-primary font-semibold focus:outline-none"
              />
            </div>

            {/* Actions: Exports */}
            <div className="flex items-end justify-end gap-2">
              <button
                onClick={() => handleExport("CSV")}
                disabled={exporting}
                className="flex-1 bg-secondary text-white hover:bg-secondary/90 disabled:bg-secondary/50 font-bold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px]">csv</span>
                Export CSV
              </button>
              <button
                onClick={() => handleExport("JSON")}
                disabled={exporting}
                className="flex-1 bg-surface-container-high border border-border-subtle text-primary hover:bg-surface-container-highest disabled:opacity-50 font-bold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px]">data_object</span>
                Export JSON
              </button>
            </div>
          </div>
          {exportMessage && (
            <p className="text-[10px] font-bold text-secondary mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">info</span>
              {exportMessage}
            </p>
          )}
        </div>
      )}

      {/* Main Reporting Canvas */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === "executive" && executiveData && (
            <div className="space-y-6">
              {/* Executive widgets deck */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-outline-variant tracking-wider">Operatives Summary</p>
                  <p className="text-3xl font-extrabold text-primary mt-2">{executiveData.activeEmployees} Active</p>
                  <p className="text-[10px] text-outline-variant font-medium mt-1">{executiveData.inactiveEmployees} Offboarded / Inactive</p>
                </div>
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-outline-variant tracking-wider">Attendance Compliance</p>
                  <p className="text-3xl font-extrabold text-status-success mt-2">{executiveData.complianceRate}%</p>
                  <p className="text-[10px] text-outline-variant font-medium mt-1">Live target standard: &gt;90%</p>
                </div>
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-outline-variant tracking-wider">Leave Utilization</p>
                  <p className="text-3xl font-extrabold text-secondary mt-2">{executiveData.leaveUtilizationSummary?.totalApprovedDays || 0} Days</p>
                  <p className="text-[10px] text-outline-variant font-medium mt-1">From {executiveData.leaveUtilizationSummary?.totalApprovedRequests || 0} approved requests</p>
                </div>
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-outline-variant tracking-wider">Overtime Cost Estimates</p>
                  <p className="text-3xl font-extrabold text-primary mt-2">
                    QAR {executiveData.overtimeQarCostSummary?.totalOtPayAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                  </p>
                  <p className="text-[10px] text-outline-variant font-medium mt-1">
                    Accumulated: {(executiveData.overtimeQarCostSummary?.totalApprovedOtMinutes / 60).toFixed(1)} hrs approved
                  </p>
                </div>
              </div>

              {/* Cost splits and health */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost Splitting */}
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm lg:col-span-2">
                  <p className="text-xs font-bold text-primary mb-4">Estimated Overtime Cost Splitting</p>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-primary">Standard Weekday OT (WT_OT_STD)</span>
                        <span className="text-primary font-bold">QAR {executiveData.overtimeQarCostSummary?.standardOtCost?.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${Math.min(100, (executiveData.overtimeQarCostSummary?.standardOtCost / (executiveData.overtimeQarCostSummary?.totalOtPayAmount || 1)) * 100)}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-primary">Weekend OT (WT_OT_WKD)</span>
                        <span className="text-primary font-bold">QAR {executiveData.overtimeQarCostSummary?.weekendOtCost?.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                        <div className="bg-secondary h-full" style={{ width: `${Math.min(100, (executiveData.overtimeQarCostSummary?.weekendOtCost / (executiveData.overtimeQarCostSummary?.totalOtPayAmount || 1)) * 100)}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-primary">Holiday/Event OT (WT_OT_HOL)</span>
                        <span className="text-primary font-bold">QAR {executiveData.overtimeQarCostSummary?.holidayOtCost?.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                        <div className="bg-status-warning h-full" style={{ width: `${Math.min(100, (executiveData.overtimeQarCostSummary?.holidayOtCost / (executiveData.overtimeQarCostSummary?.totalOtPayAmount || 1)) * 100)}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-primary">Night OT (WT_OT_NGT)</span>
                        <span className="text-primary font-bold">QAR {executiveData.overtimeQarCostSummary?.nightOtCost?.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full" style={{ width: `${Math.min(100, (executiveData.overtimeQarCostSummary?.nightOtCost / (executiveData.overtimeQarCostSummary?.totalOtPayAmount || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SAP Sync state */}
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-primary mb-3">SAP SuccessFactors Sync Hub Health</p>
                    <div className="text-center py-4">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-status-success/15 text-status-success text-2xl font-black mb-2">
                        {executiveData.syncHealthSummary?.successRate}%
                      </div>
                      <p className="text-xs font-bold text-primary">Job Transmission Success Rate</p>
                    </div>
                  </div>
                  <div className="border-t border-border-subtle/50 pt-3 space-y-2 text-xs font-medium text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>Total Sync Jobs Registered</span>
                      <span className="font-bold text-primary">{executiveData.syncHealthSummary?.totalJobs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending Outbound Queue</span>
                      <span className="font-bold text-primary">{executiveData.syncHealthSummary?.pendingExportsCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE REPORT */}
          {activeTab === "attendance" && attendanceData && (
            <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Attendance Activity Log</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                      <th className="px-6 py-3">Employee Name</th>
                      <th className="px-6 py-3">Effective Check-In</th>
                      <th className="px-6 py-3">Effective Check-Out</th>
                      <th className="px-6 py-3">Location Name</th>
                      <th className="px-6 py-3">Late Mins</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.dailyAttendance?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                          No attendance records matched criteria.
                        </td>
                      </tr>
                    ) : (
                      attendanceData.dailyAttendance.map((r: any) => (
                        <tr key={r.id} className="border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary">
                          <td className="px-6 py-4 font-bold">{r.employeeName} ({r.employeeId})</td>
                          <td className="px-6 py-4">{new Date(r.checkIn).toLocaleString()}</td>
                          <td className="px-6 py-4">{r.checkOut ? new Date(r.checkOut).toLocaleString() : "Active Session"}</td>
                          <td className="px-6 py-4 text-on-surface-variant">{r.locationName}</td>
                          <td className="px-6 py-4 font-bold text-on-surface-variant">{r.lateMinutes || 0}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              r.status === "ON_TIME" ? "bg-status-success/15 text-status-success" :
                              r.status === "LATE" ? "bg-status-warning/15 text-status-warning" :
                              r.status === "OUT_OF_ZONE" ? "bg-status-error/15 text-status-error" :
                              "bg-surface-container-low text-outline-variant"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LEAVE REPORT */}
          {activeTab === "leaves" && leaveData && (
            <div className="space-y-6">
              {/* Balance allotments */}
              <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border-subtle">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Leave Balance Allotments</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                        <th className="px-6 py-3">Employee ID</th>
                        <th className="px-6 py-3">Allocated Days</th>
                        <th className="px-6 py-3">Used Days</th>
                        <th className="px-6 py-3">Pending Days</th>
                        <th className="px-6 py-3">Carried Over</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveData.balances?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                            No balance allotments found.
                          </td>
                        </tr>
                      ) : (
                        leaveData.balances.map((b: any) => (
                          <tr key={b.id} className="border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary">
                            <td className="px-6 py-4 font-bold">{b.employeeId}</td>
                            <td className="px-6 py-4">{b.allocatedDays}</td>
                            <td className="px-6 py-4 text-status-error font-bold">{b.usedDays}</td>
                            <td className="px-6 py-4 text-status-warning font-bold">{b.pendingDays}</td>
                            <td className="px-6 py-4 text-on-surface-variant">{b.carriedOver}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Requests history list */}
              <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border-subtle">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Leave Request History Status</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                        <th className="px-6 py-3">Employee Name</th>
                        <th className="px-6 py-3">Leave Type</th>
                        <th className="px-6 py-3">Date Range</th>
                        <th className="px-6 py-3">Total Days</th>
                        <th className="px-6 py-3">Submitted Date</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveData.approvedRejectedLeaves?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                            No leave request logs recorded.
                          </td>
                        </tr>
                      ) : (
                        leaveData.approvedRejectedLeaves.map((l: any) => (
                          <tr key={l.id} className="border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary">
                            <td className="px-6 py-4 font-bold">{l.employeeName} ({l.employeeId})</td>
                            <td className="px-6 py-4 text-on-surface-variant">{l.type}</td>
                            <td className="px-6 py-4">{l.dateRange}</td>
                            <td className="px-6 py-4 font-bold">{l.totalDays || 0}</td>
                            <td className="px-6 py-4 text-on-surface-variant">{new Date(l.submittedAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                l.status === "Approved" ? "bg-status-success/15 text-status-success" :
                                l.status === "Rejected" ? "bg-status-error/15 text-status-error" :
                                "bg-status-warning/15 text-status-warning"
                              }`}>
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OVERTIME REPORT */}
          {activeTab === "overtime" && overtimeData && (
            <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Overtime Calculations & Wages Mapping</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                      <th className="px-6 py-3">Operative</th>
                      <th className="px-6 py-3">Clock Date</th>
                      <th className="px-6 py-3">Std OT (hrs)</th>
                      <th className="px-6 py-3">Wkd OT (hrs)</th>
                      <th className="px-6 py-3">Hol OT (hrs)</th>
                      <th className="px-6 py-3">Ngt OT (hrs)</th>
                      <th className="px-6 py-3">Est Pay (QAR)</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overtimeData.approvedOvertime?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                          No overtime calculations records.
                        </td>
                      </tr>
                    ) : (
                      overtimeData.approvedOvertime.map((o: any) => (
                        <tr key={o.id} className="border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary">
                          <td className="px-6 py-4 font-bold">{o.employeeName} ({o.employeeId})</td>
                          <td className="px-6 py-4">{new Date(o.checkIn).toLocaleDateString()}</td>
                          <td className="px-6 py-4">{(o.standardOtMinutes / 60).toFixed(1)}</td>
                          <td className="px-6 py-4">{(o.weekendOtMinutes / 60).toFixed(1)}</td>
                          <td className="px-6 py-4">{((o.holidayOtMinutes + o.specialEventOtMinutes) / 60).toFixed(1)}</td>
                          <td className="px-6 py-4">{(o.nightOtMinutes / 60).toFixed(1)}</td>
                          <td className="px-6 py-4 font-bold text-secondary">
                            {["ADMIN", "FINANCE"].includes(userRole) 
                              ? `QAR ${o.overtimePayAmount?.toFixed(2)}` 
                              : "Locked"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-status-success/15 text-status-success font-bold">
                              {o.otStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SHIFT ROSTER REPORT */}
          {activeTab === "shifts" && shiftData && (
            <div className="space-y-6">
              {/* Roster list */}
              <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border-subtle">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Roster Calendars List</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-[10px] uppercase font-bold text-outline-variant border-b border-border-subtle">
                        <th className="px-6 py-3">Employee ID</th>
                        <th className="px-6 py-3">Roster Date</th>
                        <th className="px-6 py-3">Active Shift Template ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftData.shiftAssignments?.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-xs font-bold text-outline-variant">
                            No shift assignments scheduled.
                          </td>
                        </tr>
                      ) : (
                        shiftData.shiftAssignments.map((a: any) => (
                          <tr key={a.id} className="border-b border-border-subtle/50 hover:bg-surface-container-low/20 transition-colors text-xs font-medium text-primary">
                            <td className="px-6 py-4 font-bold">{a.employeeId}</td>
                            <td className="px-6 py-4">{new Date(a.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-semibold text-secondary">{a.shiftTemplateId}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Coverage Gaps (Admin/HR/Supervisor view) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-border-subtle">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Coverage Headcount Gaps</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {shiftData.coverageGaps?.map((gap: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-xs border-b border-border-subtle/30 pb-2 last:border-0 last:pb-0 font-medium text-primary">
                        <div>
                          <p className="font-bold">{gap.shiftCode}</p>
                          <p className="text-[10px] text-outline-variant">Date: {gap.date}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            gap.gap < 0 ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"
                          }`}>
                            {gap.gap < 0 ? `${gap.gap} Understaffed` : "Optimized"}
                          </span>
                          <p className="text-[10px] text-outline-variant mt-0.5">Assigned: {gap.assignedHeadcount} / Required: {gap.requiredHeadcount}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Swaps summary */}
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-primary mb-3">Roster Shift Swaps Audit</p>
                    <div className="space-y-3 text-xs font-semibold text-primary mt-4">
                      <div className="flex justify-between border-b border-border-subtle/50 pb-2">
                        <span className="text-on-surface-variant">Pending Exchange Requests</span>
                        <span className="text-status-warning font-bold">{shiftData.swapAuditSummary?.PENDING}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-subtle/50 pb-2">
                        <span className="text-on-surface-variant">Approved & Committed Swaps</span>
                        <span className="text-status-success font-bold">{shiftData.swapAuditSummary?.APPROVED}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-on-surface-variant">Rejected Swaps</span>
                        <span className="text-status-error font-bold">{shiftData.swapAuditSummary?.REJECTED}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-outline-variant font-medium mt-4">
                    Shift swaps execute schedule exchanges atomically upon approval.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SAP SYNC REPORT */}
          {activeTab === "sap" && sapData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Queue summaries */}
              <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm lg:col-span-2">
                <p className="text-xs font-bold text-primary mb-4">SAP SuccessFactors Outbound Transfer Queues</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="bg-surface-container-low rounded-xl p-3">
                    <p className="text-[10px] font-bold text-outline-variant uppercase">Pending</p>
                    <p className="text-2xl font-black text-primary mt-1">{sapData.exportQueueStatus?.PENDING || 0}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-3">
                    <p className="text-[10px] font-bold text-outline-variant uppercase">Processing</p>
                    <p className="text-2xl font-black text-status-warning mt-1">{sapData.exportQueueStatus?.PROCESSING || 0}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-3">
                    <p className="text-[10px] font-bold text-outline-variant uppercase">Sent / Synced</p>
                    <p className="text-2xl font-black text-status-success mt-1">{sapData.exportQueueStatus?.SENT || 0}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-3">
                    <p className="text-[10px] font-bold text-outline-variant uppercase">Failed</p>
                    <p className="text-2xl font-black text-status-error mt-1">{sapData.exportQueueStatus?.FAILED || 0}</p>
                  </div>
                </div>

                {/* Failed exports */}
                <div className="mt-6">
                  <p className="text-xs font-bold text-primary mb-3">Sync Failures</p>
                  {sapData.failedExports?.length === 0 ? (
                    <p className="text-xs text-outline-variant font-bold">No synchronization failures registered.</p>
                  ) : (
                    <div className="space-y-3">
                      {sapData.failedExports.map((err: any) => (
                        <div key={err.id} className="text-xs bg-status-error/5 border border-status-error/10 p-3 rounded-lg font-medium text-primary">
                          <div className="flex justify-between font-bold text-[10px] mb-1 text-status-error">
                            <span>Module: {err.module}</span>
                            <span>ID: {err.recordId}</span>
                          </div>
                          <p className="text-on-surface-variant">Error: {err.lastError || "Unknown connection failure"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reconciliation Gaps & Acks */}
              <div className="space-y-6">
                {/* Reconciliations */}
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
                  <p className="text-xs font-bold text-primary mb-3">Overtime Reconciliation Discrepancies</p>
                  {sapData.reconciliationDiscrepancies?.length === 0 ? (
                    <p className="text-xs text-outline-variant font-bold py-4 text-center">No reconciliation variances detected.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {sapData.reconciliationDiscrepancies.map((rec: any) => (
                        <div key={rec.id} className="text-xs border-b border-border-subtle/30 pb-2 last:border-0 last:pb-0 font-medium text-primary">
                          <div className="flex justify-between font-bold">
                            <span>Emp: {rec.employeeId}</span>
                            <span className="text-status-error">{rec.discrepancy > 0 ? `+${rec.discrepancy}` : rec.discrepancy} hrs</span>
                          </div>
                          <p className="text-[10px] text-outline-variant mt-0.5">Period: {rec.period} | Local: {rec.wfmHours}h vs SAP: {rec.sapHours}h</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Acknowledgements */}
                <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
                  <p className="text-xs font-bold text-primary mb-3">SAP SuccessFactors Ack Registry</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto text-xs font-medium text-primary">
                    {sapData.acknowledgementTracking?.length === 0 ? (
                      <p className="text-xs text-outline-variant font-bold text-center py-4">No sync acknowledgements recorded.</p>
                    ) : (
                      sapData.acknowledgementTracking.map((ack: any) => (
                        <div key={ack.id} className="border-b border-border-subtle/30 pb-2 last:border-0 last:pb-0">
                          <div className="flex justify-between font-bold text-[10px] text-secondary">
                            <span>ID: {ack.sapAckId}</span>
                            <span>{ack.sapAckStatus}</span>
                          </div>
                          <p className="text-on-surface-variant mt-0.5">Export Queue ID: {ack.id}</p>
                          <p className="text-[9px] text-outline-variant font-medium">Ack Timestamp: {new Date(ack.sapAckTimestamp).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </LayoutShell>
  );
}
