"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

interface AssignedEmployee {
  id: string;
  name: string;
  code: string;
  status: string;
  assignmentType: string;
}

interface CoverageItem {
  slotId: string;
  businessDate: string;
  operationType: string;
  companyId: string;
  companyName: string;
  clientId: string;
  clientName: string;
  contractId: string;
  contractTitle: string;
  contractNumber: string;
  projectId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  locationKey: string;
  shiftKey: string;
  slotIndex: number;
  snapshotPosition: string;
  snapshotShiftName: string;
  snapshotStartTime: string;
  snapshotEndTime: string;
  fulfillmentStatus: string;
  requiredQuantity: number;
  assignedCount: number;
  coverageStatus: "FILLED" | "UNCOVERED" | "OVER_COVERED";
  assignedEmployees: AssignedEmployee[];
  drillDownLinks: {
    rosterPlanner: string;
    reconciliation: string;
    workforceProfile: string;
  };
}

interface CoverageSummary {
  totalRequiredSlots: number;
  filledSlotsCount: number;
  uncoveredSlotsCount: number;
  overCoveredSlotsCount: number;
  coveragePercentage: number;
  relieverReadiness: {
    requiredRelieversCount: number;
    assignedRelieversCount: number;
    availableStandbyRelieversCount: number;
    uncoveredRelieverDemand: number;
    overallReadinessStatus: "READY" | "ATTENTION" | "CRITICAL";
    readinessReasons: string[];
  };
}

export default function RosterCoverageConsolePage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const todayStr = new Date().toISOString().split("T")[0];

  // Filter States
  const [businessDate, setBusinessDate] = useState<string>(todayStr);
  const [operationType, setOperationType] = useState<string>("ALL");
  const [companyId, setCompanyId] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");
  const [locationKey, setLocationKey] = useState<string>("");
  const [shiftKey, setShiftKey] = useState<string>("");
  const [coverageStatus, setCoverageStatus] = useState<string>("ALL");
  const [relieverReadiness, setRelieverReadiness] = useState<string>("ALL");

  // Data & Control States
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"GRID" | "UNCOVERED" | "RELIEVER" | "HIERARCHY">("GRID");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchCoverageData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (businessDate) params.set("businessDate", businessDate);
      if (operationType && operationType !== "ALL") params.set("operationType", operationType);
      if (companyId) params.set("companyId", companyId);
      if (contractId) params.set("contractId", contractId);
      if (siteId) params.set("siteId", siteId);
      if (locationKey) params.set("locationKey", locationKey);
      if (shiftKey) params.set("shiftKey", shiftKey);
      if (coverageStatus && coverageStatus !== "ALL") params.set("coverageStatus", coverageStatus);
      if (relieverReadiness && relieverReadiness !== "ALL") params.set("relieverReadiness", relieverReadiness);

      const res = await fetch(`/api/v1/commercial/command-center/roster-coverage?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || `HTTP ${res.status} Error`);
      }

      const data = await res.json();
      setSummary(data.summary);
      setItems(data.items || []);
      setHierarchy(data.hierarchy || []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error("Failed to load roster coverage data:", err);
      setError(err.message || "Failed to load roster coverage console data");
    } finally {
      setLoading(false);
    }
  }, [businessDate, operationType, companyId, contractId, siteId, locationKey, shiftKey, coverageStatus, relieverReadiness]);

  useEffect(() => {
    fetchCoverageData();
  }, [fetchCoverageData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchCoverageData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchCoverageData]);

  const handleClearFilters = () => {
    setBusinessDate(todayStr);
    setOperationType("ALL");
    setCompanyId(user?.companyId || "");
    setContractId("");
    setSiteId("");
    setLocationKey("");
    setShiftKey("");
    setCoverageStatus("ALL");
    setRelieverReadiness("ALL");
  };

  const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
  const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

  const getCoverageBadge = (status: "FILLED" | "UNCOVERED" | "OVER_COVERED") => {
    switch (status) {
      case "FILLED":
        return <Badge variant="success" className="bg-status-success/10 text-status-success border-status-success/30">FILLED</Badge>;
      case "UNCOVERED":
        return <Badge variant="error" className="bg-status-error/10 text-status-error border-status-error/30 font-bold">UNCOVERED</Badge>;
      case "OVER_COVERED":
        return <Badge variant="warning" className="bg-status-warning/10 text-status-warning border-status-warning/30">OVER-COVERED</Badge>;
    }
  };

  const getReadinessBadge = (status: "READY" | "ATTENTION" | "CRITICAL") => {
    switch (status) {
      case "READY":
        return <Badge variant="success" className="bg-status-success/10 text-status-success border-status-success/30">READY</Badge>;
      case "ATTENTION":
        return <Badge variant="warning" className="bg-status-warning/10 text-status-warning border-status-warning/30">ATTENTION</Badge>;
      case "CRITICAL":
        return <Badge variant="error" className="bg-status-error/10 text-status-error border-status-error/30">CRITICAL</Badge>;
    }
  };

  const uncoveredItems = items.filter((i) => i.coverageStatus === "UNCOVERED");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/commercial/command-center" className="hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">hub</span>
              Commercial Command Center
            </Link>
            <span>/</span>
            <span className="text-on-surface font-semibold">Roster Coverage Console</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">grid_view</span>
              Roster Coverage & Reliever Readiness Console
            </h1>
            <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/30">
              Phase CCC-2
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
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
            onClick={fetchCoverageData}
            disabled={loading}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh Now
          </Button>

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

          <Link href="/commercial/command-center">
            <Button variant="ghost" size="sm" className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Command Overview
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="bg-surface-container-low p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Coverage Filters & Search Parameters
          </h3>
          <span className="text-[11px] text-on-surface-variant">
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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

          {/* Operation Scope */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Operation Scope
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            >
              <option value="ALL">All Operations</option>
              {userAllowedSG && <option value="SECURITY_GUARDING">Security Guarding</option>}
              {userAllowedFM && <option value="FACILITY_MANAGEMENT">Facility Management</option>}
              <option value="WHITE_COLLAR">White Collar</option>
            </select>
          </div>

          {/* Coverage Status */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Coverage Status
            </label>
            <select
              value={coverageStatus}
              onChange={(e) => setCoverageStatus(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            >
              <option value="ALL">All Coverage Statuses</option>
              <option value="FILLED">Filled (Covered)</option>
              <option value="UNCOVERED">Uncovered (Gaps)</option>
              <option value="OVER_COVERED">Over-Covered</option>
            </select>
          </div>

          {/* Reliever Readiness */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Reliever Readiness
            </label>
            <select
              value={relieverReadiness}
              onChange={(e) => setRelieverReadiness(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            >
              <option value="ALL">All Readiness States</option>
              <option value="READY">Ready</option>
              <option value="ATTENTION">Attention</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Location Key Filter */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Location Filter
            </label>
            <Input
              type="text"
              placeholder="e.g. LOC:SITE-01"
              value={locationKey}
              onChange={(e) => setLocationKey(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Shift Key Filter */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Shift Filter
            </label>
            <Input
              type="text"
              placeholder="e.g. shift:DAY"
              value={shiftKey}
              onChange={(e) => setShiftKey(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs">
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Card className="bg-status-error/10 border border-status-error/30 p-4 text-xs text-status-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchCoverageData} className="text-status-error">
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && !summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4 space-y-2 animate-pulse bg-surface-container-low">
              <div className="h-3 w-20 bg-outline-variant/30 rounded" />
              <div className="h-7 w-12 bg-outline-variant/50 rounded" />
            </Card>
          ))}
        </div>
      )}

      {/* 5 KPI Scorecards Grid */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Required Slots */}
          <Card className="p-4 border-l-4 border-l-secondary bg-surface-container-low space-y-1">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Total Required Slots
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-on-surface">
                {summary.totalRequiredSlots}
              </span>
              <span className="text-xs text-on-surface-variant">Target Date</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">Requirement slots defined</p>
          </Card>

          {/* Filled Slots */}
          <Card className="p-4 border-l-4 border-l-status-success bg-surface-container-low space-y-1">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Filled (Covered)
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-status-success">
                {summary.filledSlotsCount}
              </span>
              <span className="text-xs font-bold text-status-success">
                {summary.coveragePercentage}%
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">Active single assignment</p>
          </Card>

          {/* Uncovered Slots (Gaps) */}
          <Card className="p-4 border-l-4 border-l-status-error bg-surface-container-low space-y-1">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Uncovered Gaps
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-status-error">
                {summary.uncoveredSlotsCount}
              </span>
              <Badge variant={summary.uncoveredSlotsCount > 0 ? "error" : "success"} className={summary.uncoveredSlotsCount > 0 ? "bg-status-error/10 text-status-error" : "bg-status-success/10 text-status-success"}>
                {summary.uncoveredSlotsCount > 0 ? "ATTENTION REQUIRED" : "ZERO GAPS"}
              </Badge>
            </div>
            <p className="text-[11px] text-on-surface-variant">Requirement slots unfilled</p>
          </Card>

          {/* Over-Covered Slots */}
          <Card className="p-4 border-l-4 border-l-status-warning bg-surface-container-low space-y-1">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Over-Covered Slots
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-status-warning">
                {summary.overCoveredSlotsCount}
              </span>
              <span className="text-xs text-on-surface-variant">Duplicate assign</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">&gt;1 active assignment</p>
          </Card>

          {/* Reliever Readiness */}
          <Card className="p-4 border-l-4 border-l-primary bg-surface-container-low space-y-1">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Reliever Readiness
            </span>
            <div className="flex items-baseline justify-between">
              {getReadinessBadge(summary.relieverReadiness.overallReadinessStatus)}
              <span className="text-xs font-bold text-on-surface">
                {summary.relieverReadiness.availableStandbyRelieversCount} Standby
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Demand: {summary.relieverReadiness.requiredRelieversCount} | Assigned: {summary.relieverReadiness.assignedRelieversCount}
            </p>
          </Card>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-outline-variant flex items-center gap-2">
        <button
          onClick={() => setActiveTab("GRID")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "GRID"
              ? "border-secondary text-secondary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">table_chart</span>
          Coverage Grid ({items.length})
        </button>

        <button
          onClick={() => setActiveTab("UNCOVERED")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "UNCOVERED"
              ? "border-status-error text-status-error"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">warning</span>
          Uncovered Gaps ({uncoveredItems.length})
        </button>

        <button
          onClick={() => setActiveTab("RELIEVER")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "RELIEVER"
              ? "border-secondary text-secondary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          Reliever Pool Console
        </button>

        <button
          onClick={() => setActiveTab("HIERARCHY")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "HIERARCHY"
              ? "border-secondary text-secondary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">account_tree</span>
          Coverage Hierarchy
        </button>
      </div>

      {/* Tab 1: High-Density Coverage Grid */}
      {activeTab === "GRID" && (
        <Card className="p-0 overflow-hidden bg-surface-container-low">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant font-bold">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Contract & Site</th>
                  <th className="py-2.5 px-3">Location & Shift</th>
                  <th className="py-2.5 px-3">Position</th>
                  <th className="py-2.5 px-3">Timing</th>
                  <th className="py-2.5 px-3">Assigned Employees</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-on-surface-variant text-xs">
                      No roster requirement slots match the current filters.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.slotId} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="py-2.5 px-3">{getCoverageBadge(item.coverageStatus)}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-on-surface">{item.contractTitle}</div>
                        <div className="text-[11px] text-on-surface-variant">{item.siteName} ({item.clientName})</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{item.locationKey}</div>
                        <div className="text-[11px] text-on-surface-variant">{item.shiftKey}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{item.snapshotPosition}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant">
                        {item.snapshotStartTime} - {item.snapshotEndTime}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.assignedEmployees.length === 0 ? (
                          <span className="text-status-error font-semibold italic text-[11px]">Unassigned (Vacant)</span>
                        ) : (
                          <div className="space-y-0.5">
                            {item.assignedEmployees.map((emp) => (
                              <div key={emp.id} className="text-xs font-medium flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px] text-secondary">person</span>
                                <span>{emp.name} ({emp.code})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link href={item.drillDownLinks.rosterPlanner}>
                          <Button variant="ghost" size="sm" className="text-secondary hover:underline text-xs inline-flex items-center gap-1">
                            <span>Planner</span>
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Uncovered Demand Queue */}
      {activeTab === "UNCOVERED" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Prioritized Uncovered Requirement Slots ({uncoveredItems.length})
            </h3>
            <span className="text-xs text-on-surface-variant">
              High Priority Operational Gaps
            </span>
          </div>

          {uncoveredItems.length === 0 ? (
            <Card className="p-8 text-center bg-surface-container-low text-on-surface-variant">
              <span className="material-symbols-outlined text-status-success text-3xl mb-1">check_circle</span>
              <p className="text-xs font-bold text-on-surface">Zero Uncovered Slot Gaps</p>
              <p className="text-[11px]">All defined requirement slots are assigned for this business date.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uncoveredItems.map((item) => (
                <Card key={item.slotId} className="p-4 border-l-4 border-l-status-error bg-surface-container-low space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="error" className="bg-status-error/10 text-status-error border-status-error/30 mb-1">
                        UNCOVERED GAP
                      </Badge>
                      <h4 className="text-xs font-bold text-on-surface">{item.contractTitle}</h4>
                      <p className="text-[11px] text-on-surface-variant">{item.siteName} — {item.clientName}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-on-surface bg-surface-container-high px-2 py-0.5 rounded">
                      {item.snapshotStartTime} - {item.snapshotEndTime}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-outline-variant/30">
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">Position Required</span>
                      <span className="font-semibold">{item.snapshotPosition}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">Shift / Location</span>
                      <span className="font-semibold">{item.snapshotShiftName || item.shiftKey}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-status-error font-medium">
                      Action Required: Assign Guard in Roster Engine
                    </span>
                    <Link href={item.drillDownLinks.rosterPlanner}>
                      <Button variant="secondary" size="sm" className="bg-status-error text-white hover:bg-status-error/90 text-xs">
                        Assign in Roster Planner
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Reliever Readiness Console */}
      {activeTab === "RELIEVER" && summary && (
        <div className="space-y-4">
          <Card className="p-4 bg-surface-container-low space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">groups</span>
                Reliever Capacity & Standby Readiness Evaluation
              </h3>
              {getReadinessBadge(summary.relieverReadiness.overallReadinessStatus)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="bg-surface-container-high p-3 rounded-lg">
                <span className="text-[11px] text-on-surface-variant block">Contract Reliever Demand</span>
                <span className="text-xl font-bold">{summary.relieverReadiness.requiredRelieversCount}</span>
              </div>
              <div className="bg-surface-container-high p-3 rounded-lg">
                <span className="text-[11px] text-on-surface-variant block">Assigned Relievers</span>
                <span className="text-xl font-bold text-status-success">{summary.relieverReadiness.assignedRelieversCount}</span>
              </div>
              <div className="bg-surface-container-high p-3 rounded-lg">
                <span className="text-[11px] text-on-surface-variant block">Available Off-Duty Standby</span>
                <span className="text-xl font-bold text-secondary">{summary.relieverReadiness.availableStandbyRelieversCount}</span>
              </div>
              <div className="bg-surface-container-high p-3 rounded-lg">
                <span className="text-[11px] text-on-surface-variant block">Uncovered Reliever Demand</span>
                <span className="text-xl font-bold text-status-error">{summary.relieverReadiness.uncoveredRelieverDemand}</span>
              </div>
            </div>

            {summary.relieverReadiness.readinessReasons.length > 0 && (
              <div className="pt-2 space-y-1">
                <span className="text-xs font-bold text-on-surface-variant block">Readiness Observations:</span>
                <ul className="list-disc pl-5 text-xs text-on-surface space-y-0.5">
                  {summary.relieverReadiness.readinessReasons.map((reason, idx) => (
                    <li key={idx} className="text-status-warning font-medium">{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-4 bg-surface-container-low space-y-3">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Authoritative Reliever Eligibility Policy Rules
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="border border-outline-variant/40 p-3 rounded-lg bg-surface-container-lowest">
                <span className="font-bold text-on-surface block mb-1">1. Active Duty & Standby Status</span>
                <p className="text-on-surface-variant text-[11px]">
                  Employee must be active, off-duty, and flagged as reliever/standby eligible in Workforce Directory.
                </p>
              </div>
              <div className="border border-outline-variant/40 p-3 rounded-lg bg-surface-container-lowest">
                <span className="font-bold text-on-surface block mb-1">2. Leave & Shift Overlap</span>
                <p className="text-on-surface-variant text-[11px]">
                  Employee must have no overlapping approved LeaveRequest or active primary shift assignment today.
                </p>
              </div>
              <div className="border border-outline-variant/40 p-3 rounded-lg bg-surface-container-lowest">
                <span className="font-bold text-on-surface block mb-1">3. Scope & Site Alignment</span>
                <p className="text-on-surface-variant text-[11px]">
                  Relievers are matched strictly against authorized operation scope (SG/FM) and company bounds.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Hierarchy Tree View */}
      {activeTab === "HIERARCHY" && (
        <Card className="p-4 bg-surface-container-low space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">account_tree</span>
            Operational Hierarchy Tree Breakdown
          </h3>

          {hierarchy.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No hierarchy nodes available for current selection.</p>
          ) : (
            <div className="space-y-4 text-xs">
              {hierarchy.map((comp) => (
                <div key={comp.companyId} className="border border-outline-variant/50 rounded-lg p-3 bg-surface-container-lowest space-y-3">
                  <div className="font-bold text-secondary text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
                    {comp.companyName}
                  </div>

                  <div className="pl-4 space-y-3 border-l-2 border-outline-variant/30">
                    {comp.contracts.map((con: any) => (
                      <div key={con.contractId} className="space-y-2">
                        <div className="font-semibold text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">description</span>
                          {con.contractTitle}
                        </div>

                        <div className="pl-4 space-y-2 border-l-2 border-outline-variant/20">
                          {con.sites.map((site: any) => (
                            <div key={site.siteId} className="space-y-1">
                              <div className="font-medium text-on-surface-variant flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                {site.siteName} ({site.slots.length} Slots)
                              </div>

                              <div className="pl-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                {site.slots.map((s: CoverageItem) => (
                                  <div key={s.slotId} className="p-2 border border-outline-variant/30 rounded bg-surface-container-low flex items-center justify-between text-[11px]">
                                    <div>
                                      <span className="font-semibold block">{s.snapshotPosition}</span>
                                      <span className="text-on-surface-variant block">{s.snapshotStartTime} - {s.snapshotEndTime}</span>
                                    </div>
                                    {getCoverageBadge(s.coverageStatus)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
