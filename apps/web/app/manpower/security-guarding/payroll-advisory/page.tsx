"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../../../lib/permissions";

interface Advisory {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  siteId: string;
  siteName: string;
  shiftCode: string;
  hoursWorked: number;
  attendanceStatus: string;
  checkIn?: string;
  checkOut?: string;
  attendanceRemarks: string;
  actingDuty?: {
    scheduledDesignation: string;
    actualDesignation: string;
    advisory: string;
  } | null;
  allowance?: {
    allowanceId: string;
    description: string;
    frequency: string;
    amountAdvisory: number;
  } | null;
  unresolvedExceptionsCount: number;
  isOverridden: boolean;
  overrides: any[];
}

export default function PayrollAdvisoryPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lockLoading, setLockLoading] = useState(false);

  const canManage = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                    hasPermission(session?.user as any, "manpower.security.manage");

  const loadAdvisoryData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/security/scheduling/payroll-advisory?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdvisories(data.advisories);
          setIsLocked(data.isLocked);
        } else {
          setError(data.error || "Failed to load payroll advisory data");
        }
      } else {
        if (res.status === 403) {
          setError("Access Forbidden: You do not have permission to view Security Guarding data.");
        } else {
          setError("Failed to fetch payroll advisory data");
        }
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvisoryData();
  }, [period]);

  const handleToggleLock = async () => {
    if (!canManage) return;
    setLockLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/v1/security/scheduling/period-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          locked: !isLocked
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSuccess(`Roster period for ${period} ${!isLocked ? "locked" : "unlocked"} successfully.`);
          setIsLocked(!isLocked);
        } else {
          setError(data.error || "Failed to toggle period lock.");
        }
      } else {
        setError("Request failed.");
      }
    } catch (e: any) {
      setError(e.message || "Error toggling lock");
    } finally {
      setLockLoading(false);
    }
  };

  const handleExport = () => {
    // Basic CSV Export helper
    const headers = ["Date", "Employee Code", "Employee Name", "Scheduled Site", "Shift Code", "Hours Worked", "Attendance Status", "Acting Duty Advisory", "Allowance Advisory", "Status Override"];
    const rows = advisories.map(a => [
      a.date,
      a.employeeCode,
      a.employeeName,
      a.siteName,
      a.shiftCode,
      a.hoursWorked,
      a.attendanceStatus,
      a.actingDuty ? `${a.actingDuty.scheduledDesignation} as ${a.actingDuty.actualDesignation}` : "None",
      a.allowance ? `${a.allowance.description} (${a.allowance.amountAdvisory} QAR)` : "None",
      a.isOverridden ? "Overridden" : "Standard"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_payroll_advisory_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-surface-container-lowest p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <Link href="/manpower/security-guarding/dashboard" className="text-xs text-primary hover:underline flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-[12px]">arrow_back</span> Back to Command Center
          </Link>
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">receipt_long</span>
            Payroll Advisory Preparation board
          </h1>
          <p className="text-[11px] text-on-surface-variant">Review acting duties, allowance advisories, and timesheet remarks for HR sync</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-on-surface">Target Month:</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface"
            />
          </div>
          {canManage && (
            <button
              onClick={handleToggleLock}
              disabled={lockLoading}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                isLocked 
                  ? "bg-amber-600 hover:bg-amber-700 text-white" 
                  : "bg-primary hover:bg-primary-container text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isLocked ? "lock_open" : "lock"}
              </span>
              {isLocked ? "Unlock Period" : "Freeze & Lock Month"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-xs font-semibold border border-emerald-200">
          {success}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs leading-relaxed space-y-1">
        <h3 className="font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">info</span>
          ADVISORY DOCUMENT ONLY
        </h3>
        <p>This panel does not calculate salaries, generate payslips, WPS files, or execute bank transfers. It is an operational sync advisory board detailing timesheet overrides, allowances, and acting duty deviations for HR review.</p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-on-surface-variant">
              Advisory Records for {period}: <span className="text-primary">{advisories.length} entries</span>
            </span>
            <button
              onClick={handleExport}
              disabled={advisories.length === 0}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">download</span> Export Review Format
            </button>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-surface-container-low text-on-surface font-bold border-b border-outline-variant/60">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Guard Code</th>
                  <th className="p-3">Guard Name</th>
                  <th className="p-3">Assigned Site</th>
                  <th className="p-3 text-center">Hours Worked</th>
                  <th className="p-3">Acting Duty Advisory</th>
                  <th className="p-3">Allowance Advisory</th>
                  <th className="p-3">Roster Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {advisories.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-on-surface-variant font-medium">
                      No operational logs found for this period.
                    </td>
                  </tr>
                ) : (
                  advisories.map((adv) => (
                    <tr key={adv.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="p-3 font-semibold text-on-surface">{adv.date}</td>
                      <td className="p-3 font-semibold text-primary">{adv.employeeCode}</td>
                      <td className="p-3 font-bold text-on-surface">{adv.employeeName}</td>
                      <td className="p-3 text-on-surface-variant">{adv.siteName}</td>
                      <td className="p-3 text-center font-bold text-on-surface">{adv.hoursWorked} hrs</td>
                      <td className="p-3">
                        {adv.actingDuty ? (
                          <div className="text-amber-800 bg-amber-50 border border-amber-100 p-1.5 rounded text-[10px]">
                            <span className="font-extrabold uppercase tracking-wider block text-[8px]">Acting as {adv.actingDuty.scheduledDesignation}</span>
                            Grade adjustment recommended
                          </div>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant opacity-60">None</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-on-surface">
                        {adv.allowance ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-[10px]">
                            {adv.allowance.description} ({adv.allowance.amountAdvisory} QAR)
                          </span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant opacity-60">None</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          adv.isOverridden 
                            ? "bg-rose-50 text-rose-800 border border-rose-100" 
                            : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                        }`}>
                          {adv.isOverridden ? "Override Applied" : "Standard"}
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
    </div>
  );
}
