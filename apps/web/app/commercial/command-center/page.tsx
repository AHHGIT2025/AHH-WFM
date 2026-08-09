"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

interface CommandSummaryData {
  context: {
    businessDate: string;
    operationType: string;
    companyId: string | null;
    clientId: string | null;
    contractId: string | null;
    siteId: string | null;
    scopeIsolation: {
      userRole: string;
      companyBound: boolean;
      allowedSecurityGuarding: boolean;
      allowedFacilityManagement: boolean;
    };
  };
  operationalHealth: {
    status: "HEALTHY" | "ATTENTION" | "CRITICAL";
    score: number;
    reasons: string[];
  };
  manpowerCoverage: {
    requiredManpower: number;
    assignedManpower: number;
    activeOnDuty: number;
    uncoveredSlots: number;
    coveragePercentage: number;
    underCoverageCount: number;
    overCoverageCount: number;
  };
  attendance: {
    presentToday: number;
    absentToday: number;
    lateToday: number;
    missingPunch: number;
    onLeaveToday: number;
    unresolvedCorrections: number;
  };
  relieverReadiness: {
    requiredRelievers: number;
    assignedRelievers: number;
    availableStandby: number;
    uncoveredRelieverDemand: number;
    readinessStatus: string;
  };
  exceptions: {
    rosterPlanningExceptions: number;
    unexcusedReconciliations: number;
    totalOperationalExceptions: number;
  };
  contractExposure: {
    activeContractsCount: number;
    contractsBelowRequirementCount: number;
    potentialSlaRiskCount: number;
    extraDeploymentCount: number;
  };
  generatedAt: string;
}

export default function CommercialCommandCenterPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  // Filter States
  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [operationType, setOperationType] = useState<string>("ALL");
  const [companyId, setCompanyId] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");

  // Options Data
  const [companies, setCompanies] = useState<{ id: string; companyName: string }[]>([]);
  const [contracts, setContracts] = useState<{ id: string; title: string }[]>([]);

  // Page States
  const [data, setData] = useState<CommandSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"overview" | "coverage" | "attendance" | "relievers" | "contracts">("overview");

  // Fetch Filter Master Data
  useEffect(() => {
    async function fetchMasters() {
      try {
        const [compRes, contRes] = await Promise.all([
          fetch("/api/v1/companies"),
          fetch("/api/v1/manpower/contracts")
        ]);
        if (compRes.ok) {
          const compData = await compRes.json();
          setCompanies(Array.isArray(compData) ? compData : compData.companies || []);
        }
        if (contRes.ok) {
          const contData = await contRes.json();
          setContracts(Array.isArray(contData) ? contData : contData.contracts || []);
        }
      } catch (err) {
        console.error("Error fetching filter master data:", err);
      }
    }
    fetchMasters();
  }, []);

  // Fetch Summary Data
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (businessDate) params.set("businessDate", businessDate);
      if (operationType && operationType !== "ALL") params.set("operationType", operationType);
      if (companyId) params.set("companyId", companyId);
      if (contractId) params.set("contractId", contractId);
      if (siteId) params.set("siteId", siteId);

      const res = await fetch(`/api/v1/commercial/command-center/summary?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const json: CommandSummaryData = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load Commercial Command Center data.");
    } finally {
      setLoading(false);
    }
  }, [businessDate, operationType, companyId, contractId, siteId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Auto-refresh interval (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchSummary();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSummary]);

  // Scope Isolation helpers
  const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
  const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">hub</span>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              Commercial Command Center
            </h1>
            <Badge variant="primary" className="ml-2">Phase CCC-1</Badge>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time operational health, manpower coverage, reliever readiness, and contract SLA exposure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={autoRefresh ? "success" : "secondary"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">
              {autoRefresh ? "sync" : "sync_disabled"}
            </span>
            {autoRefresh ? "Auto Refresh: 30s" : "Enable Auto-Refresh"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchSummary}
            disabled={loading}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh Now
          </Button>

          <Link href="/commercial/command-center/roster-coverage">
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5 bg-secondary text-white hover:bg-[#0047a3]">
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              Roster Coverage Console
            </Button>
          </Link>

          <Link href="/commercial/command-center/escalations">
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5 bg-error text-white hover:bg-[#b91c1c]">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Operational Escalations (CCC-3)
            </Button>
          </Link>

          <Link href="/commercial/command-center/commercial-health">
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5 bg-indigo-700 text-white hover:bg-indigo-800">
              <span className="material-symbols-outlined text-[16px]">analytics</span>
              Commercial &amp; SLA Health (CCC-4)
            </Button>
          </Link>

          <Link href="/commercial/command-center/wallboard">
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5 bg-slate-900 text-white border border-slate-700 hover:bg-slate-800">
              <span className="material-symbols-outlined text-[16px]">tv</span>
              Executive Wallboard (CCC-5)
            </Button>
          </Link>

          <Link href="/commercial/dashboard">
            <Button variant="ghost" size="sm" className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Commercial Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="bg-surface-container-low p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Operational Scope & Filters
          </h3>
          <span className="text-[11px] text-on-surface-variant">
            Last updated: {lastRefreshed.toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Business Date */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Business Date
            </label>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            />
          </div>

          {/* Operation Type */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Operation Scope
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            >
              <option value="ALL">All Operational Scopes</option>
              {userAllowedSG && <option value="SECURITY_GUARDING">Security Guarding</option>}
              {userAllowedFM && <option value="FACILITY_MANAGEMENT">Facility Management</option>}
              <option value="WHITE_COLLAR">White Collar</option>
            </select>
          </div>

          {/* Company */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Company
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={Boolean(user?.companyId)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:opacity-60"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Contract */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Contract
            </label>
            <select
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            >
              <option value="">All Active Contracts</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setBusinessDate(new Date().toISOString().split("T")[0]);
                setOperationType("ALL");
                setCompanyId("");
                setContractId("");
                setSiteId("");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading & Error States */}
      {loading && !data && (
        <Card className="p-8 text-center space-y-3">
          <div className="inline-block animate-spin text-secondary">
            <span className="material-symbols-outlined text-3xl">sync</span>
          </div>
          <p className="text-sm font-medium text-on-surface">
            Aggregating Commercial Command Center operational health metrics...
          </p>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-status-error/10 border-status-error/30 text-status-error flex items-start gap-3">
          <span className="material-symbols-outlined text-xl mt-0.5">error</span>
          <div>
            <h4 className="font-bold text-sm">Operational Aggregation Error</h4>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </Card>
      )}

      {/* Main Content Dashboard */}
      {data && (
        <div className="space-y-6">
          {/* Section 1: Overall Operational Health Banner */}
          <Card
            className={`p-5 border-2 transition-all ${
              data.operationalHealth.status === "HEALTHY"
                ? "bg-status-success/5 border-status-success/30"
                : data.operationalHealth.status === "ATTENTION"
                ? "bg-status-warning/5 border-status-warning/30"
                : "bg-status-error/5 border-status-error/30"
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white ${
                    data.operationalHealth.status === "HEALTHY"
                      ? "bg-status-success"
                      : data.operationalHealth.status === "ATTENTION"
                      ? "bg-status-warning"
                      : "bg-status-error"
                  }`}
                >
                  {data.operationalHealth.score}%
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-on-surface">
                      Operational Health: {data.operationalHealth.status}
                    </h2>
                    <Badge
                      variant={
                        data.operationalHealth.status === "HEALTHY"
                          ? "success"
                          : data.operationalHealth.status === "ATTENTION"
                          ? "warning"
                          : "error"
                      }
                    >
                      {data.operationalHealth.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Deterministic operational health classification for date{" "}
                    <span className="font-bold">{data.context.businessDate}</span> across scope{" "}
                    <span className="font-bold">{data.context.operationType}</span>.
                  </p>
                </div>
              </div>

              {/* Health Action Button */}
              <div className="flex items-center gap-2">
                <Link href="/manpower/security-guarding/deployment-calendar">
                  <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                    Open Deployment Planner
                  </Button>
                </Link>
              </div>
            </div>

            {/* Health Reasons Explanation (if degraded) */}
            {data.operationalHealth.reasons.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/60 space-y-1.5">
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-status-warning">info</span>
                  Operational Health Degradation Factors:
                </h4>
                <ul className="list-disc list-inside text-xs text-on-surface-variant space-y-1 pl-1">
                  {data.operationalHealth.reasons.map((reason, idx) => (
                    <li key={idx} className="font-medium">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Section 2: Key Operational Metric Scorecards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Manpower Coverage */}
            <Card padded className="space-y-2 border-l-4 border-l-secondary">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Manpower Coverage</span>
                <span className="material-symbols-outlined text-secondary">badge</span>
              </div>
              <div className="text-2xl font-black text-on-surface">
                {data.manpowerCoverage.coveragePercentage}%
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">
                  {data.manpowerCoverage.assignedManpower} / {data.manpowerCoverage.requiredManpower} Assigned
                </span>
                {data.manpowerCoverage.uncoveredSlots > 0 ? (
                  <Badge variant="error">{data.manpowerCoverage.uncoveredSlots} Unfilled</Badge>
                ) : (
                  <Badge variant="success">Fully Filled</Badge>
                )}
              </div>
            </Card>

            {/* Card 2: Attendance Today */}
            <Card padded className="space-y-2 border-l-4 border-l-status-success">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Attendance Today</span>
                <span className="material-symbols-outlined text-status-success">check_circle</span>
              </div>
              <div className="text-2xl font-black text-on-surface">
                {data.attendance.presentToday} Present
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-status-error font-bold">
                  {data.attendance.absentToday} Absent
                </span>
                <span className="text-status-warning font-bold">
                  {data.attendance.lateToday} Late
                </span>
              </div>
            </Card>

            {/* Card 3: Reliever Readiness */}
            <Card padded className="space-y-2 border-l-4 border-l-status-warning">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Reliever Readiness</span>
                <span className="material-symbols-outlined text-status-warning">person_add</span>
              </div>
              <div className="text-2xl font-black text-on-surface">
                {data.relieverReadiness.availableStandby} Standby
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">
                  {data.relieverReadiness.uncoveredRelieverDemand} Deficit
                </span>
                <Badge
                  variant={
                    data.relieverReadiness.readinessStatus === "READY"
                      ? "success"
                      : data.relieverReadiness.readinessStatus === "ATTENTION"
                      ? "warning"
                      : "error"
                  }
                >
                  {data.relieverReadiness.readinessStatus}
                </Badge>
              </div>
            </Card>

            {/* Card 4: Operational Exceptions */}
            <Card padded className="space-y-2 border-l-4 border-l-status-error">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Active Exceptions</span>
                <span className="material-symbols-outlined text-status-error">warning</span>
              </div>
              <div className="text-2xl font-black text-on-surface">
                {data.exceptions.totalOperationalExceptions}
              </div>
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>{data.exceptions.rosterPlanningExceptions} Planning</span>
                <span>{data.exceptions.unexcusedReconciliations} Unexcused</span>
              </div>
            </Card>

            {/* Card 5: Contract SLA Exposure */}
            <Card padded className="space-y-2 border-l-4 border-l-primary">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-xs font-bold uppercase tracking-wider">Contract SLA Exposure</span>
                <span className="material-symbols-outlined text-primary">gavel</span>
              </div>
              <div className="text-2xl font-black text-on-surface">
                {data.contractExposure.activeContractsCount} Contracts
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">
                  {data.contractExposure.contractsBelowRequirementCount} Below Target
                </span>
                {data.contractExposure.potentialSlaRiskCount > 0 ? (
                  <Badge variant="error">{data.contractExposure.potentialSlaRiskCount} SLA Risks</Badge>
                ) : (
                  <Badge variant="success">0 SLA Risk</Badge>
                )}
              </div>
            </Card>
          </div>

          {/* Section 3: Sub-Navigation Tabs & Detailed Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "overview"
                    ? "bg-secondary text-white"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Operational Breakdown
              </button>
              <button
                onClick={() => setActiveTab("coverage")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "coverage"
                    ? "bg-secondary text-white"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Manpower Coverage ({data.manpowerCoverage.coveragePercentage}%)
              </button>
              <button
                onClick={() => setActiveTab("attendance")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "attendance"
                    ? "bg-secondary text-white"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Attendance & Leave ({data.attendance.presentToday} Present)
              </button>
              <button
                onClick={() => setActiveTab("relievers")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "relievers"
                    ? "bg-secondary text-white"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Reliever Standby ({data.relieverReadiness.availableStandby} Ready)
              </button>
              <button
                onClick={() => setActiveTab("contracts")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "contracts"
                    ? "bg-secondary text-white"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Contract Exposure ({data.contractExposure.contractsBelowRequirementCount} Risk)
              </button>
            </div>

            {/* Tab 1: Operational Breakdown */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card padded className="space-y-4">
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant pb-2">
                    <span className="material-symbols-outlined text-secondary">analytics</span>
                    Manpower & Roster Fulfillment Summary
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Required Requirement Slots</span>
                      <span className="font-bold text-on-surface">{data.manpowerCoverage.requiredManpower}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Active Assigned Slots</span>
                      <span className="font-bold text-on-surface">{data.manpowerCoverage.assignedManpower}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Unfilled Slot Shortage</span>
                      <span className="font-bold text-status-error">{data.manpowerCoverage.uncoveredSlots}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Under-Coverage Slots</span>
                      <span className="font-bold text-status-warning">{data.manpowerCoverage.underCoverageCount}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-on-surface-variant">Over-Coverage Slots</span>
                      <span className="font-bold text-on-surface">{data.manpowerCoverage.overCoverageCount}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link href="/manpower/security-guarding/deployment-calendar">
                      <Button variant="secondary" size="sm" className="w-full text-xs">
                        View Detailed Roster Calendar
                      </Button>
                    </Link>
                  </div>
                </Card>

                <Card padded className="space-y-4">
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant pb-2">
                    <span className="material-symbols-outlined text-status-error">warning</span>
                    Operational Exceptions & Reconciliation Queue
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Active Roster Planning Exceptions</span>
                      <span className="font-bold text-status-error">{data.exceptions.rosterPlanningExceptions}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Unexcused Reconciliation Discrepancies</span>
                      <span className="font-bold text-status-warning">{data.exceptions.unexcusedReconciliations}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-outline-variant/40">
                      <span className="text-on-surface-variant">Pending Attendance Corrections</span>
                      <span className="font-bold text-on-surface">{data.attendance.unresolvedCorrections}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-on-surface-variant">Total Actionable Exceptions</span>
                      <span className="font-bold text-on-surface">{data.exceptions.totalOperationalExceptions}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <Link href="/manpower/security-guarding/reconciliation" className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full text-xs">
                        Open Reconciliation Manager
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            )}

            {/* Tab 2: Coverage Details */}
            {activeTab === "coverage" && (
              <Card padded className="space-y-3">
                <h3 className="text-sm font-bold text-on-surface">Manpower Requirement Slot Coverage</h3>
                <p className="text-xs text-on-surface-variant">
                  Authoritative requirement slot allocation aggregated from RosterRequirementSlot and RosterSlotAssignment.
                </p>
                <div className="p-4 bg-surface-container-low rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Target Date: <strong>{data.context.businessDate}</strong></span>
                    <span>Coverage Rate: <strong>{data.manpowerCoverage.coveragePercentage}%</strong></span>
                  </div>
                  <div className="w-full bg-outline-variant rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${
                        data.manpowerCoverage.coveragePercentage >= 95
                          ? "bg-status-success"
                          : data.manpowerCoverage.coveragePercentage >= 80
                          ? "bg-status-warning"
                          : "bg-status-error"
                      }`}
                      style={{ width: `${Math.min(100, data.manpowerCoverage.coveragePercentage)}%` }}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Tab 3: Attendance */}
            {activeTab === "attendance" && (
              <Card padded className="space-y-3">
                <h3 className="text-sm font-bold text-on-surface">Attendance & Time Tracking Status</h3>
                <p className="text-xs text-on-surface-variant">
                  Live clock-ins and attendance records aggregated for date {data.context.businessDate}.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Present Today</span>
                    <span className="text-lg font-bold text-status-success">{data.attendance.presentToday}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Absent Today</span>
                    <span className="text-lg font-bold text-status-error">{data.attendance.absentToday}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Late Check-ins</span>
                    <span className="text-lg font-bold text-status-warning">{data.attendance.lateToday}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Approved Leaves</span>
                    <span className="text-lg font-bold text-secondary">{data.attendance.onLeaveToday}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Tab 4: Relievers */}
            {activeTab === "relievers" && (
              <Card padded className="space-y-3">
                <h3 className="text-sm font-bold text-on-surface">Reliever Pool & Standby Readiness</h3>
                <p className="text-xs text-on-surface-variant">
                  Standby employee availability evaluated from ShiftRelieverAssignment and Employee eligibility indicators.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Contract Reliever Requirements</span>
                    <span className="text-lg font-bold text-on-surface">{data.relieverReadiness.requiredRelievers}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Available Standby Pool</span>
                    <span className="text-lg font-bold text-status-success">{data.relieverReadiness.availableStandby}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Uncovered Reliever Demand</span>
                    <span className="text-lg font-bold text-status-error">{data.relieverReadiness.uncoveredRelieverDemand}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Tab 5: Contracts */}
            {activeTab === "contracts" && (
              <Card padded className="space-y-3">
                <h3 className="text-sm font-bold text-on-surface">Contract Manpower SLA & Exposure Monitor</h3>
                <p className="text-xs text-on-surface-variant">
                  Operational contract compliance evaluated from ManpowerContract and requirement slot fulfillment.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Active Contracts</span>
                    <span className="text-lg font-bold text-on-surface">{data.contractExposure.activeContractsCount}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Contracts Below Requirement</span>
                    <span className="text-lg font-bold text-status-warning">{data.contractExposure.contractsBelowRequirementCount}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="text-on-surface-variant block">Potential SLA Risk Contracts</span>
                    <span className="text-lg font-bold text-status-error">{data.contractExposure.potentialSlaRiskCount}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
