"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function MobileCommandSuite() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [activeTab, setActiveTab] = useState<"overview" | "escalations" | "coverage" | "health">("overview");
  const [operationType, setOperationType] = useState<string>("ALL");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Escalation Action Modal state
  const [selectedEscalation, setSelectedEscalation] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"ACKNOWLEDGE" | "ASSIGN" | "COMMENT" | "RESOLVE" | "CANCEL">("ACKNOWLEDGE");
  const [actionOwnerId, setActionOwnerId] = useState("");
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lastFetchTimeRef = useRef<number>(Date.now());
  const currentUserIdRef = useRef<string | null>(null);

  // Clean in-memory cache on user account switch
  useEffect(() => {
    const userId = (session?.user as any)?.id || null;
    if (currentUserIdRef.current && currentUserIdRef.current !== userId) {
      setData(null);
      setIsStale(false);
    }
    currentUserIdRef.current = userId;
  }, [session]);

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true);
    setError(null);

    try {
      const url = `/api/v1/commercial/command-center/wallboard?operationType=${operationType}`;
      const res = await fetch(url, { cache: "no-store" });

      if (res.status === 401 || res.status === 403) {
        setError(res.status === 401 ? "Unauthorized. Please log in." : "Forbidden. Requires commercial.commandCenter.view permission.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json);
      setIsStale(false);
      lastFetchTimeRef.current = Date.now();
      setCountdown(60);
    } catch (e: any) {
      console.error("Mobile Command Suite fetch error:", e);
      setError(e.message || "Failed to load Command Center data");
      if (data) setIsStale(true); // Preserve last successful load on transient error
    } finally {
      setLoading(false);
    }
  };

  // Auth check & initial fetch
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    fetchData(true);
  }, [session, authStatus, operationType]);

  // 60-second auto-refresh timer & stale detection
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(false);
          return 60;
        }
        return prev - 1;
      });

      if (Date.now() - lastFetchTimeRef.current > 60000) {
        setIsStale(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [operationType]);

  // Action execution handler
  const handleExecuteAction = async () => {
    if (!selectedEscalation) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const escalationId = selectedEscalation.id || selectedEscalation.sourceKey;
      const res = await fetch(`/api/v1/commercial/command-center/escalations/${escalationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          ownerId: actionOwnerId || undefined,
          remarks: actionRemarks || undefined
        })
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || `Failed to execute action ${actionType}`);
      }

      // Action succeeded - close modal & refresh data
      setSelectedEscalation(null);
      setActionRemarks("");
      setActionOwnerId("");
      fetchData(false);
    } catch (e: any) {
      setActionError(e.message || "Action execution failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  if (authStatus === "loading" || (loading && !data)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-on-surface-variant">Loading Mobile Command Suite...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-status-error/10 border border-status-error/30 rounded-2xl p-5 text-center">
          <span className="material-symbols-outlined text-status-error text-[36px] mb-2">lock</span>
          <h3 className="text-sm font-bold text-status-error">Access Restricted</h3>
          <p className="text-xs text-on-surface-variant mt-1">{error}</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const primaryKpis = data?.primaryKpis || {};
  const attendancePulse = data?.attendancePulse || {};
  const rosterCoverage = data?.rosterCoverage || {};
  const escalationSummary = data?.escalationSummary || {};
  const topEscalations = escalationSummary?.topCriticalEscalations || escalationSummary?.escalations || [];
  const commercialPortfolio = data?.commercialPortfolio || {};
  const portfolioMetrics = commercialPortfolio?.portfolioMetrics || {};

  const hasCriticalAlerts = (rosterCoverage?.uncoveredSlotsCount || 0) > 0 || (escalationSummary?.metrics?.criticalCount || 0) > 0;

  return (
    <div className="space-y-4 pb-12">
      {/* Mobile Control-Room Header */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">space_dashboard</span>
                Command Suite
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">Live Executive Operations Console</p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center gap-1 text-[10px] font-bold active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span>{countdown}s</span>
          </button>
        </div>

        {/* Scope Selector & Business Date */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <span className="text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
            📅 {data?.context?.businessDate || "Today"}
          </span>
          <select
            value={operationType}
            onChange={(e) => setOperationType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-bold rounded-lg px-2 py-1 outline-none"
          >
            <option value="ALL">All Operations</option>
            <option value="SECURITY_GUARDING">Security Guarding</option>
            <option value="FACILITY_MANAGEMENT">Facility Management</option>
          </select>
        </div>
      </div>

      {/* Stale Data Warning Banner */}
      {isStale && (
        <div className="bg-status-warning/15 border border-status-warning/40 text-status-warning px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] animate-pulse">cloud_off</span>
            <span>STALE DATA — Reconnecting...</span>
          </div>
          <button onClick={() => fetchData(true)} className="underline text-[10px] font-extrabold">Retry</button>
        </div>
      )}

      {/* Critical Alert Banner */}
      {hasCriticalAlerts && (
        <div className="bg-status-error/10 border border-status-error/30 text-status-error p-3 rounded-2xl flex items-center gap-2.5 shadow-sm">
          <span className="material-symbols-outlined text-status-error text-[22px]">warning</span>
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider">Critical Operational Alerts</p>
            <p className="text-[10px] text-on-surface-variant font-medium">
              {rosterCoverage?.uncoveredSlotsCount || 0} uncovered slot(s) & {escalationSummary?.metrics?.criticalCount || 0} critical escalation(s) require immediate action.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        {[
          { id: "overview", label: "Overview", icon: "equalizer" },
          { id: "escalations", label: `Escalations (${topEscalations.length})`, icon: "notification_important" },
          { id: "coverage", label: "Coverage", icon: "shield" },
          { id: "health", label: "Contracts", icon: "workspace_premium" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded-xl flex items-center gap-1 text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-primary/20 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Health Score</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-primary">{primaryKpis.overallHealthScore ?? 100}</span>
                <span className="text-[10px] font-bold text-status-success bg-status-success/10 px-1.5 py-0.5 rounded">
                  {portfolioMetrics.healthyContractsCount || 0}/{portfolioMetrics.totalActiveContracts || 0} Active
                </span>
              </div>
            </div>

            <div className="bg-surface border border-status-success/20 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Roster Coverage</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-status-success">{rosterCoverage.coveragePercentage ?? 100}%</span>
                <span className="text-[10px] font-bold text-on-surface-variant">
                  {rosterCoverage.assignedSlotsCount || 0}/{rosterCoverage.requiredSlotsCount || 0} Posts
                </span>
              </div>
            </div>

            <div className="bg-surface border border-status-error/20 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Uncovered Slots</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-status-error">{rosterCoverage.uncoveredSlotsCount || 0}</span>
                <span className="text-[10px] font-bold text-status-error bg-status-error/10 px-1.5 py-0.5 rounded">Action Req</span>
              </div>
            </div>

            <div className="bg-surface border border-status-warning/20 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Reliever Readiness</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-sm font-black text-status-warning">{primaryKpis.relieverReadinessStatus || "HEALTHY"}</span>
                <span className="text-[10px] font-bold text-on-surface-variant">
                  {rosterCoverage.availableStandbyCount || 0} Standby
                </span>
              </div>
            </div>
          </div>

          {/* Operational Attendance Pulse */}
          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-on-surface flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">groups</span>
                Attendance Pulse Today
              </span>
              <span className="text-[10px] text-on-surface-variant">Qatar Standard</span>
            </h3>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-status-success/5 border border-status-success/20 p-2 rounded-xl">
                <p className="text-[9px] font-bold text-status-success uppercase">Present</p>
                <p className="text-base font-black text-on-surface mt-0.5">{attendancePulse.presentToday || 0}</p>
              </div>
              <div className="bg-status-error/5 border border-status-error/20 p-2 rounded-xl">
                <p className="text-[9px] font-bold text-status-error uppercase">Absent</p>
                <p className="text-base font-black text-on-surface mt-0.5">{attendancePulse.absentToday || 0}</p>
              </div>
              <div className="bg-status-warning/5 border border-status-warning/20 p-2 rounded-xl">
                <p className="text-[9px] font-bold text-status-warning uppercase">Late</p>
                <p className="text-base font-black text-on-surface mt-0.5">{attendancePulse.lateToday || 0}</p>
              </div>
              <div className="bg-surface-container-high border border-outline-variant/20 p-2 rounded-xl">
                <p className="text-[9px] font-bold text-on-surface-variant uppercase">No Punch</p>
                <p className="text-base font-black text-on-surface mt-0.5">{attendancePulse.missingPunch || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRITICAL ESCALATIONS */}
      {activeTab === "escalations" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-on-surface">Active Escalations ({topEscalations.length})</h3>
            <span className="text-[10px] text-status-error font-bold">{escalationSummary?.metrics?.criticalCount || 0} Critical</span>
          </div>

          <div className="divide-y divide-outline-variant/20 bg-surface border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
            {topEscalations.map((item: any, idx: number) => {
              const isClosed = item.status === "RESOLVED" || item.status === "CANCELLED";
              return (
                <div key={item.id || idx} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                      item.severity === "CRITICAL" ? "bg-status-error/10 text-status-error border border-status-error/20" :
                      item.severity === "HIGH" ? "bg-status-warning/10 text-status-warning border border-status-warning/20" :
                      "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      {item.severity || "MEDIUM"}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                      isClosed ? "bg-slate-800 text-slate-300" : "bg-status-info/10 text-status-info"
                    }`}>
                      {item.status || "OPEN"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-on-surface">{item.title || item.sourceType?.replace(/_/g, " ")}</h4>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-2">{item.description || "Exception details requiring operational action."}</p>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-on-surface-variant font-medium">
                      <span>👤 {item.clientName || "Client Unspecified"}</span>
                      <span>•</span>
                      <span>📍 {item.siteName || "Site Unspecified"}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setSelectedEscalation(item);
                        setActionType(isClosed ? "COMMENT" : "ACKNOWLEDGE");
                        setActionError(null);
                      }}
                      className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-xl flex items-center gap-1 shadow-sm active:scale-95 min-h-[36px]"
                    >
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                      <span>{isClosed ? "View & Comment" : "Action Item"}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {topEscalations.length === 0 && (
              <div className="p-8 text-center text-xs text-on-surface-variant">
                No open escalations for current operational scope.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COVERAGE & RELIEVER POOL */}
      {activeTab === "coverage" && (
        <div className="space-y-3">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-on-surface">Roster Requirement Breakdown</h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant font-medium">Required Shift Slots</span>
                <span className="font-bold text-on-surface">{rosterCoverage.requiredSlotsCount || 0}</span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-status-success h-full transition-all"
                  style={{ width: `${rosterCoverage.coveragePercentage || 100}%` }}
                ></div>
                <div
                  className="bg-status-error h-full transition-all"
                  style={{ width: `${100 - (rosterCoverage.coveragePercentage || 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-on-surface-variant font-bold pt-1">
                <span>Filled: {rosterCoverage.assignedSlotsCount || 0}</span>
                <span className="text-status-error">Uncovered: {rosterCoverage.uncoveredSlotsCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-on-surface">Reliever Standby Readiness</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Standby Available</p>
                <p className="text-xl font-black text-status-success mt-1">{rosterCoverage.availableStandbyCount || 0}</p>
              </div>
              <div className="bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Uncovered Demand</p>
                <p className="text-xl font-black text-status-error mt-1">{rosterCoverage.uncoveredRelieverDemand || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMMERCIAL HEALTH */}
      {activeTab === "health" && (
        <div className="space-y-3">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-on-surface">Portfolio Health Distribution</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-status-success/10 border border-status-success/20 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-status-success uppercase">Healthy</p>
                <p className="text-lg font-black text-on-surface mt-0.5">{portfolioMetrics.healthyContractsCount || 0}</p>
              </div>
              <div className="bg-status-warning/10 border border-status-warning/20 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-status-warning uppercase">Attention</p>
                <p className="text-lg font-black text-on-surface mt-0.5">{portfolioMetrics.attentionContractsCount || 0}</p>
              </div>
              <div className="bg-status-error/10 border border-status-error/20 p-2.5 rounded-xl">
                <p className="text-[9px] font-bold text-status-error uppercase">Critical</p>
                <p className="text-lg font-black text-on-surface mt-0.5">{portfolioMetrics.criticalContractsCount || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-slate-300 text-[10px] space-y-1">
            <p className="font-bold text-slate-100 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-amber-400">info</span>
              SLA Authority & Operational Risk Benchmark
            </p>
            <p className="text-slate-400">
              Coverage SLA target displays <code className="text-amber-300">FORMAL_CONTRACT_COVERAGE_SLA_NOT_CONFIGURED</code> when unpersisted. 90% serves as an operational risk advisory threshold only.
            </p>
          </div>
        </div>
      )}

      {/* ESCALATION ACTION MODAL / DRAWER */}
      {selectedEscalation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div>
                <span className="text-[9px] font-black uppercase text-primary tracking-wider">Escalation Action</span>
                <h3 className="text-sm font-bold text-on-surface truncate">{selectedEscalation.title || selectedEscalation.sourceType}</h3>
              </div>
              <button
                onClick={() => setSelectedEscalation(null)}
                className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Authoritative Source Warning if AttendanceCorrection */}
            {selectedEscalation.sourceType === "ATTENDANCE_CORRECTION_PENDING" && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-[10px] text-amber-600 font-medium">
                ⚠️ Authoritative Source Protection Rule: Resolving this item will NOT approve the AttendanceCorrection. Approval belongs exclusively to Attendance module.
              </div>
            )}

            {/* Terminal State Warning if Closed */}
            {(selectedEscalation.status === "RESOLVED" || selectedEscalation.status === "CANCELLED") && (
              <div className="bg-slate-800 text-slate-300 p-2.5 rounded-xl text-[10px] font-bold">
                🔒 Closed Item ({selectedEscalation.status}). Closed escalations cannot be re-opened. Only post-closure COMMENT action is permitted.
              </div>
            )}

            {actionError && (
              <div className="bg-status-error/10 border border-status-error/30 text-status-error p-2.5 rounded-xl text-[11px] font-bold">
                {actionError}
              </div>
            )}

            {/* Action Type Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Select Action</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-xl p-2.5 outline-none"
              >
                {selectedEscalation.status !== "RESOLVED" && selectedEscalation.status !== "CANCELLED" && (
                  <>
                    <option value="ACKNOWLEDGE">Acknowledge Exception</option>
                    <option value="ASSIGN">Assign Owner</option>
                    <option value="RESOLVE">Resolve Exception</option>
                    <option value="CANCEL">Cancel Exception</option>
                  </>
                )}
                <option value="COMMENT">Add Post-Closure Comment</option>
              </select>
            </div>

            {actionType === "ASSIGN" && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Owner Employee ID</label>
                <input
                  type="text"
                  placeholder="e.g. emp-123"
                  value={actionOwnerId}
                  onChange={(e) => setActionOwnerId(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-xl p-2.5 outline-none"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Remarks / Notes</label>
              <textarea
                rows={3}
                placeholder="Enter action remarks..."
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-medium rounded-xl p-2.5 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedEscalation(null)}
                className="flex-1 py-2.5 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-xl min-h-[44px]"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleExecuteAction}
                className="flex-1 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                {actionSubmitting ? "Executing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
