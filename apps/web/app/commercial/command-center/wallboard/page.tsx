"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface WallboardData {
  context: {
    businessDate: string;
    operationType: string;
    companyId: string | null;
  };
  primaryKpis: {
    overallHealthScore: number;
    activeContractsCount: number;
    overallCoveragePercentage: number;
    totalOpenEscalations: number;
    criticalEscalationsCount: number;
    relieverReadinessStatus: "READY" | "ATTENTION" | "CRITICAL";
    availableStandbyCount: number;
    uncoveredRelieverDemand: number;
  };
  attendancePulse: {
    presentToday: number;
    absentToday: number;
    lateToday: number;
    missingPunch: number;
    leavesToday: number;
    unresolvedCorrections: number;
  };
  rosterCoverage: {
    requiredSlotsCount: number;
    assignedSlotsCount: number;
    uncoveredSlotsCount: number;
    coveragePercentage: number;
    relieverReqsCount: number;
    assignedRelieversCount: number;
    availableStandbyCount: number;
    uncoveredRelieverDemand: number;
    readinessStatus: "READY" | "ATTENTION" | "CRITICAL";
  };
  escalationSummary: {
    metrics: {
      totalOpen: number;
      criticalCount: number;
      highCount: number;
      overdueCount: number;
    };
    topCriticalEscalations: Array<{
      id: string;
      sourceKey: string;
      sourceType: string;
      title: string;
      description: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      clientName: string;
      contractTitle: string;
      siteName: string;
      status: string;
      drillDownUrl: string;
    }>;
  };
  commercialPortfolio: {
    portfolioMetrics: {
      totalActiveContracts: number;
      healthyContractsCount: number;
      attentionContractsCount: number;
      criticalContractsCount: number;
      averageCoveragePercentage: number;
      totalRequiredManpower: number;
      totalAssignedManpower: number;
      totalUncoveredSlots: number;
      contractsWithSlaRiskCount: number;
      contractsWithEscalationsCount: number;
      contractsExpiringSoonCount: number;
      contractsExpiredCount: number;
    };
    contracts: Array<{
      contractId: string;
      contractNumber: string;
      contractTitle: string;
      clientName: string;
      operationType: string;
      daysToExpiry: number;
      expiryStatus: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE";
      coverage: {
        requiredSlots: number;
        assignedSlots: number;
        uncoveredSlots: number;
        coveragePercentage: number;
      };
      health: {
        status: "HEALTHY" | "ATTENTION" | "CRITICAL";
        score: number;
        reasons: string[];
      };
      slaExposure: {
        isSlaRisk: boolean;
        slaRiskReasons: string[];
      };
      drillDownUrls: {
        contractMaster: string;
        rosterCoverage: string;
        escalationQueue: string;
      };
    }>;
  };
  generatedAt: string;
}

export default function WallboardPage() {
  const [data, setData] = useState<WallboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const lastSuccessfulFetchRef = useRef<number>(Date.now());

  const fetchWallboardData = useCallback(async () => {
    try {
      setLoading((prev) => (data ? false : true));
      const res = await fetch("/api/v1/commercial/command-center/wallboard", {
        headers: { "Cache-Control": "no-cache" }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status} error`);
      }
      const json: WallboardData = await res.json();
      setData(json);
      setError(null);
      setIsStale(false);
      lastSuccessfulFetchRef.current = Date.now();
    } catch (err: any) {
      console.error("Wallboard fetch failed:", err);
      setError(err.message || "Failed to load Wallboard data.");
      setIsStale(true);
    } finally {
      setLoading(false);
      setCountdown(30);
    }
  }, [data]);

  useEffect(() => {
    fetchWallboardData();
  }, []);

  // 30-Second Refresh Interval & Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchWallboardData();
          return 30;
        }
        return prev - 1;
      });

      if (Date.now() - lastSuccessfulFetchRef.current > 60000) {
        setIsStale(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchWallboardData]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => {
        console.error("Fullscreen failed:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false));
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans leading-relaxed">
      {/* Executive Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            COMMERCIAL COMMAND CENTER <span className="text-indigo-400 font-extrabold">WALLBOARD</span>
          </h1>
          {data?.context?.businessDate && (
            <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded font-mono border border-slate-700">
              DATE: {data.context.businessDate}
            </span>
          )}
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex bg-slate-900 border border-slate-800 rounded p-1 space-x-1">
            <Link
              href="/commercial/command-center"
              className="px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 font-medium transition-colors"
            >
              CCC-1 Health
            </Link>
            <Link
              href="/commercial/command-center/roster-coverage"
              className="px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 font-medium transition-colors"
            >
              CCC-2 Roster
            </Link>
            <Link
              href="/commercial/command-center/escalations"
              className="px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 font-medium transition-colors"
            >
              CCC-3 Queue
            </Link>
            <Link
              href="/commercial/command-center/commercial-health"
              className="px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 font-medium transition-colors"
            >
              CCC-4 Analytics
            </Link>
          </div>

          <button
            onClick={fetchWallboardData}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded font-mono font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
            <span className="text-slate-400">({countdown}s)</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded font-medium transition-colors shadow-sm"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          </button>
        </div>
      </header>

      {/* Stale Data Warning Banner */}
      {isStale && (
        <div className="bg-amber-950/80 border border-amber-600/60 text-amber-200 px-4 py-2.5 rounded-lg mb-6 flex items-center justify-between text-sm animate-pulse">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-amber-400">STALE DATA — Reconnecting...</span>
            <span className="text-xs text-amber-300">
              {error ? `Reason: ${error}` : "Data feed has not updated within 60 seconds."}
            </span>
          </div>
          <button
            onClick={fetchWallboardData}
            className="bg-amber-800 hover:bg-amber-700 text-white text-xs px-2.5 py-1 rounded transition-colors font-medium"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {!data && loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-lg border border-slate-800" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Section 1: Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* KPI 1: Overall Health Score */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Portfolio Health
              </div>
              <div className="text-3xl font-extrabold text-emerald-400">
                {data.primaryKpis.overallHealthScore}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {data.commercialPortfolio.portfolioMetrics.healthyContractsCount} / {data.primaryKpis.activeContractsCount} Healthy Contracts
              </div>
            </div>

            {/* KPI 2: Overall Coverage */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Roster Coverage
              </div>
              <div
                className={`text-3xl font-extrabold ${
                  data.primaryKpis.overallCoveragePercentage >= 95
                    ? "text-emerald-400"
                    : data.primaryKpis.overallCoveragePercentage >= 90
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {data.primaryKpis.overallCoveragePercentage}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {data.rosterCoverage.assignedSlotsCount} / {data.rosterCoverage.requiredSlotsCount} Posts Filled
              </div>
            </div>

            {/* KPI 3: Open Escalations */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Open Escalations
              </div>
              <div
                className={`text-3xl font-extrabold ${
                  data.primaryKpis.totalOpenEscalations === 0
                    ? "text-emerald-400"
                    : data.primaryKpis.criticalEscalationsCount > 0
                    ? "text-rose-500"
                    : "text-amber-400"
                }`}
              >
                {data.primaryKpis.totalOpenEscalations}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                <span className="text-rose-400 font-bold">{data.primaryKpis.criticalEscalationsCount} Critical</span> |{" "}
                {data.escalationSummary.metrics.overdueCount} Overdue
              </div>
            </div>

            {/* KPI 4: Reliever Readiness */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Reliever Pool
              </div>
              <div
                className={`text-2xl font-extrabold ${
                  data.primaryKpis.relieverReadinessStatus === "READY"
                    ? "text-emerald-400"
                    : data.primaryKpis.relieverReadinessStatus === "ATTENTION"
                    ? "text-amber-400"
                    : "text-rose-500"
                }`}
              >
                {data.primaryKpis.relieverReadinessStatus}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {data.primaryKpis.availableStandbyCount} Standby Available ({data.primaryKpis.uncoveredRelieverDemand} Deficit)
              </div>
            </div>

            {/* KPI 5: Active Contracts */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Active Contracts
              </div>
              <div className="text-3xl font-extrabold text-indigo-400">
                {data.primaryKpis.activeContractsCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {data.commercialPortfolio.portfolioMetrics.contractsExpiringSoonCount} Expiring Soon
              </div>
            </div>
          </div>

          {/* Section 2: Operational Pulse & Escalations Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Operational Attendance Pulse */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white tracking-wide">OPERATIONAL PULSE</h2>
                <Link
                  href="/commercial/command-center"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  View Console &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-xs text-slate-400">Present Today</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">
                    {data.attendancePulse.presentToday}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-xs text-slate-400">Absent Today</div>
                  <div className="text-xl font-bold text-rose-400 mt-0.5">
                    {data.attendancePulse.absentToday}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-xs text-slate-400">Late Punches</div>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">
                    {data.attendancePulse.lateToday}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-xs text-slate-400">Missing Punch</div>
                  <div className="text-xl font-bold text-indigo-400 mt-0.5">
                    {data.attendancePulse.missingPunch}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-xs text-slate-400">Pending Corrections</div>
                  <div className="text-xl font-bold text-slate-200 mt-0.5">
                    {data.attendancePulse.unresolvedCorrections}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-xs text-slate-400">Approved Leaves</div>
                  <div className="text-xl font-bold text-slate-200 mt-0.5">
                    {data.attendancePulse.leavesToday}
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Escalations Ticker */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white tracking-wide">EXECUTIVE EXCEPTION QUEUE</h2>
                  <span className="bg-rose-950 text-rose-300 text-xs px-2 py-0.5 rounded border border-rose-800/60 font-semibold">
                    {data.escalationSummary.topCriticalEscalations.length} High Priority
                  </span>
                </div>
                <Link
                  href="/commercial/command-center/escalations"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Full Queue &rarr;
                </Link>
              </div>

              {data.escalationSummary.topCriticalEscalations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No critical or high-priority escalations currently active.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {data.escalationSummary.topCriticalEscalations.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950 p-3 rounded border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.severity === "CRITICAL"
                                ? "bg-rose-900/80 text-rose-200 border border-rose-700"
                                : "bg-amber-900/80 text-amber-200 border border-amber-700"
                            }`}
                          >
                            {item.severity}
                          </span>
                          <span className="font-semibold text-slate-200">{item.title}</span>
                        </div>
                        <p className="text-slate-400 line-clamp-1">{item.description}</p>
                        <div className="text-slate-500 text-[11px]">
                          Client: <span className="text-slate-300">{item.clientName}</span> | Site:{" "}
                          <span className="text-slate-300">{item.siteName}</span>
                        </div>
                      </div>
                      <Link
                        href={item.drillDownUrl || "/commercial/command-center/escalations"}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded text-[11px] font-medium shrink-0 transition-colors"
                      >
                        Action
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Commercial Portfolio Table */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white tracking-wide">COMMERCIAL PORTFOLIO MONITOR</h2>
              <Link
                href="/commercial/command-center/commercial-health"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Analytics & Sla Console &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Contract</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Scope</th>
                    <th className="py-2.5 px-3">Health Status</th>
                    <th className="py-2.5 px-3">Coverage %</th>
                    <th className="py-2.5 px-3">SLA Risk</th>
                    <th className="py-2.5 px-3">Expiry</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data.commercialPortfolio.contracts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        No active contracts registered in portfolio.
                      </td>
                    </tr>
                  ) : (
                    data.commercialPortfolio.contracts.map((c) => (
                      <tr key={c.contractId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-100">
                          <div>{c.contractTitle}</div>
                          <div className="text-[10px] font-mono text-slate-400">{c.contractNumber}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{c.clientName}</td>
                        <td className="py-2.5 px-3">
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-mono">
                            {c.operationType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.health.status === "HEALTHY"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : c.health.status === "ATTENTION"
                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                : "bg-rose-950 text-rose-300 border border-rose-800"
                            }`}
                          >
                            {c.health.status} ({c.health.score})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold">
                          {c.coverage.coveragePercentage}%
                        </td>
                        <td className="py-2.5 px-3">
                          {c.slaExposure.isSlaRisk ? (
                            <span className="text-amber-400 font-semibold flex items-center space-x-1">
                              <span>Risk Advisory</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">Normal</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {c.expiryStatus === "EXPIRED" ? (
                            <span className="text-rose-400 font-bold">Expired</span>
                          ) : c.expiryStatus === "EXPIRING_SOON" ? (
                            <span className="text-amber-400">{c.daysToExpiry}d left</span>
                          ) : (
                            <span className="text-slate-400">{c.daysToExpiry}d left</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={c.drillDownUrls.contractMaster}
                            className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline text-[11px]"
                          >
                            View Contract
                          </Link>
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
    </div>
  );
}
