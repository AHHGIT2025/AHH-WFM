"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasPermission } from "../../../../lib/permissions";

interface Exception {
  id: string;
  assignmentId?: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  exceptionType: string;
  severity: "WARNING" | "BLOCKED";
  message: string;
  siteId?: string;
  siteName?: string;
  plannedShiftCode?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  resolved: boolean;
  overrideReason?: string;
}

export default function ExceptionsQueuePage() {
  const { data: session } = useSession();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [resolving, setResolving] = useState(false);

  const canManage = hasPermission(session?.user as any, "manpower.admin.full_access") ||
                    hasPermission(session?.user as any, "manpower.security.manage");

  const loadExceptions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/security/scheduling/exceptions?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setExceptions(data.exceptions);
        } else {
          setError(data.error || "Failed to load exceptions");
        }
      } else {
        if (res.status === 403) {
          setError("Access Forbidden: You do not have permission to view Security Guarding data.");
        } else {
          setError("Failed to fetch exceptions from server");
        }
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, [date]);

  const handleResolve = async () => {
    if (!selectedException || !overrideReason.trim()) return;
    setResolving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/v1/security/scheduling/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedException.assignmentId,
          employeeId: selectedException.employeeId,
          date: selectedException.date,
          exceptionType: selectedException.exceptionType,
          reason: overrideReason
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSuccess("Exception resolved successfully.");
          setOverrideReason("");
          setSelectedException(null);
          loadExceptions();
        } else {
          setError(data.error || "Failed to resolve exception.");
        }
      } else {
        setError("Resolution request failed.");
      }
    } catch (e: any) {
      setError(e.message || "Error submitting override");
    } finally {
      setResolving(false);
    }
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
            <span className="material-symbols-outlined text-rose-600">report_problem</span>
            Operations Exception Queue
          </h1>
          <p className="text-[11px] text-on-surface-variant">Verify and resolve deployment gaps, late arrivals, and off-site check-ins</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-on-surface">Target Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs text-on-surface"
          />
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

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exceptions List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1">
              Active Anomalies ({exceptions.filter(e => !e.resolved).length})
            </h2>
            {exceptions.length === 0 ? (
              <div className="bg-surface border rounded-xl p-8 text-center text-on-surface-variant text-xs">
                No exceptions detected for this date. Good job!
              </div>
            ) : (
              <div className="space-y-3">
                {exceptions.map((exc) => (
                  <div
                    key={exc.id}
                    className={`bg-surface border p-4 rounded-xl shadow-sm flex flex-col justify-between transition-all ${
                      exc.resolved 
                        ? "border-outline-variant/40 opacity-70" 
                        : exc.severity === "BLOCKED" 
                        ? "border-red-200 hover:border-red-300 bg-red-50/10" 
                        : "border-amber-200 hover:border-amber-300 bg-amber-50/10"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            exc.resolved 
                              ? "bg-outline-variant/40 text-on-surface-variant" 
                              : exc.severity === "BLOCKED" 
                              ? "bg-red-100 text-red-800" 
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {exc.exceptionType.replace("_", " ")}
                          </span>
                          {exc.resolved && (
                            <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              RESOLVED
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs font-bold text-on-surface mt-2">
                          {exc.employeeName} ({exc.employeeCode})
                        </h3>
                        <p className="text-xs text-on-surface mt-1 leading-relaxed">{exc.message}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 mt-3 text-[10px] text-on-surface-variant font-semibold">
                          <div><span className="opacity-70">Site:</span> {exc.siteName || "N/A"}</div>
                          {exc.plannedShiftCode && (
                            <div><span className="opacity-70">Planned:</span> {exc.plannedShiftCode} ({exc.plannedStartTime}-{exc.plannedEndTime})</div>
                          )}
                          {exc.actualCheckIn && (
                            <div><span className="opacity-70">Clock-in:</span> {new Date(exc.actualCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          )}
                          {exc.actualCheckOut && (
                            <div><span className="opacity-70">Clock-out:</span> {new Date(exc.actualCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          )}
                        </div>
                        {exc.resolved && exc.overrideReason && (
                          <div className="mt-3 p-2 bg-emerald-50/50 border border-emerald-100 rounded text-[10px] text-emerald-800 italic">
                            <span className="font-bold uppercase tracking-wider not-italic block text-[8px] mb-0.5">Override Reason:</span>
                            "{exc.overrideReason}"
                          </div>
                        )}
                      </div>
                      {!exc.resolved && canManage && (
                        <button
                          onClick={() => {
                            setSelectedException(exc);
                            setOverrideReason("");
                          }}
                          className="px-2.5 py-1.5 bg-primary text-white text-[10px] font-bold rounded hover:bg-primary/95 transition-all"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolve Panel (Sidebar) */}
          <div className="lg:col-span-1">
            <div className="bg-surface border border-outline-variant p-5 rounded-xl shadow-sm space-y-4 sticky top-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1">
                Exception Resolution Board
              </h2>
              {selectedException ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-surface-container-low border border-outline-variant/60 rounded-lg">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-surface-container-high text-on-surface-variant">
                      {selectedException.exceptionType.replace("_", " ")}
                    </span>
                    <h3 className="font-bold text-on-surface mt-2">{selectedException.employeeName}</h3>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">{selectedException.message}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-on-surface block">Override Remarks / Reason:</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Enter explanation (e.g. Traffic delay approved, Client requested timing, Acting duty approved by supervisor...)"
                      rows={4}
                      className="w-full bg-surface border border-outline-variant rounded p-2 text-xs text-on-surface focus:outline-primary"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleResolve}
                      disabled={resolving || !overrideReason.trim()}
                      className="flex-1 px-3 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                    >
                      {resolving ? "Submitting..." : "Apply Resolution"}
                    </button>
                    <button
                      onClick={() => setSelectedException(null)}
                      className="px-3 py-2 bg-surface-container-high text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-highest transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-on-surface-variant text-xs">
                  Select an exception from the active queue to apply a resolution override.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
