"use me";
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface PortfolioMetrics {
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
}

interface ContractHealthItem {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  clientId: string;
  clientName: string;
  companyId: string | null;
  operationType: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate: string;
  daysToExpiry: number;
  expiryStatus: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE";
  effectiveRequirements: {
    baseManpowerCount: number;
    addendaManpowerDelta: number;
    effectiveManpowerCount: number;
    baseRelieverCount: number;
    addendaRelieverDelta: number;
    effectiveRelieverCount: number;
  };
  coverage: {
    requiredSlots: number;
    assignedSlots: number;
    uncoveredSlots: number;
    overCoveredSlots: number;
    coveragePercentage: number;
  };
  relieverReadiness: {
    requiredRelievers: number;
    assignedRelievers: number;
    availableStandby: number;
    uncoveredDemand: number;
    readinessStatus: "READY" | "ATTENTION" | "CRITICAL";
  };
  attendanceExposure: {
    presentToday: number;
    absentToday: number;
    lateToday: number;
    missingPunch: number;
    unresolvedCorrections: number;
  };
  reconciliationExposure: {
    unresolvedReconciliations: number;
    unexcusedAbsences: number;
  };
  billingSupport: {
    billableAdvisoryManpower: number;
    varianceVsRequired: number;
    unresolvedBillingExceptions: number;
  };
  slaExposure: {
    isSlaRisk: boolean;
    slaRiskReasons: string[];
    openEscalationCount: number;
  };
  health: {
    status: "HEALTHY" | "ATTENTION" | "CRITICAL";
    score: number;
    reasons: string[];
  };
  drillDownUrls: {
    contractMaster: string;
    rosterCoverage: string;
    escalationQueue: string;
    reconciliation: string;
  };
}

export default function CommercialHealthConsolePage() {
  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [operationType, setOperationType] = useState<string>("ALL");
  const [healthStatus, setHealthStatus] = useState<string>("ALL");
  const [slaRisk, setSlaRisk] = useState<string>("ALL");
  const [expiryStatus, setExpiryStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [contracts, setContracts] = useState<ContractHealthItem[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractHealthItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<"summary" | "requirements" | "coverage" | "attendance" | "billing">("summary");

  const fetchCommercialHealthData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (businessDate) params.append("businessDate", businessDate);
      if (operationType && operationType !== "ALL") params.append("operationType", operationType);
      if (healthStatus && healthStatus !== "ALL") params.append("healthStatus", healthStatus);
      if (slaRisk && slaRisk !== "ALL") params.append("slaRisk", slaRisk);
      if (expiryStatus && expiryStatus !== "ALL") params.append("expiryStatus", expiryStatus);

      const res = await fetch(`/api/v1/commercial/command-center/commercial-health?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setPortfolioMetrics(data.portfolioMetrics || null);
      setContracts(data.contracts || []);
    } catch (err: any) {
      console.error("Failed to load commercial health analytics:", err);
      setError(err.message || "Failed to load commercial health data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommercialHealthData();
  }, [businessDate, operationType, healthStatus, slaRisk, expiryStatus]);

  const filteredContracts = contracts.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.contractTitle.toLowerCase().includes(q) ||
      item.contractNumber.toLowerCase().includes(q) ||
      item.clientName.toLowerCase().includes(q)
    );
  });

  const getHealthBadge = (status: string, score: number) => {
    switch (status) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse"></span>
            CRITICAL ({score})
          </span>
        );
      case "ATTENTION":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
            ATTENTION ({score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
            HEALTHY (100)
          </span>
        );
    }
  };

  const getExpiryBadge = (expiryStatus: string, days: number) => {
    if (expiryStatus === "EXPIRED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          EXPIRED
        </span>
      );
    }
    if (expiryStatus === "EXPIRING_SOON") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
          Expiring in {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
        Active ({days}d)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-indigo-600 rounded-lg text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    Commercial Command Center — Commercial &amp; SLA Health
                  </h1>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Management-level contract performance, effective requirement breakdown &amp; SLA risk console
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchCommercialHealthData}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <nav className="flex space-x-1 mt-6 border-b border-slate-800">
            <Link
              href="/commercial/command-center"
              className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white border-b-2 border-transparent hover:border-slate-500"
            >
              Operational Health Overview
            </Link>
            <Link
              href="/commercial/command-center/roster-coverage"
              className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white border-b-2 border-transparent hover:border-slate-500"
            >
              Roster Coverage Console
            </Link>
            <Link
              href="/commercial/command-center/escalations"
              className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white border-b-2 border-transparent hover:border-slate-500"
            >
              Escalation Queue
            </Link>
            <Link
              href="/commercial/command-center/commercial-health"
              className="px-4 py-2.5 text-sm font-semibold text-indigo-400 border-b-2 border-indigo-500"
            >
              Commercial &amp; SLA Health
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Portfolio KPI Scorecards */}
        {portfolioMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Contracts</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{portfolioMetrics.totalActiveContracts}</div>
              <div className="text-xs text-slate-500 mt-1">{portfolioMetrics.totalRequiredManpower} total manpower</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Healthy</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-700">{portfolioMetrics.healthyContractsCount}</div>
              <div className="text-xs text-emerald-600 mt-1">Operating at target</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Attention</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-700">{portfolioMetrics.attentionContractsCount}</div>
              <div className="text-xs text-amber-600 mt-1">Minor issues pending</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/20">
              <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Critical</div>
              <div className="mt-2 text-2xl font-extrabold text-rose-700">{portfolioMetrics.criticalContractsCount}</div>
              <div className="text-xs text-rose-600 mt-1">Immediate action</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Coverage</div>
              <div className="mt-2 text-2xl font-extrabold text-indigo-600">{portfolioMetrics.averageCoveragePercentage}%</div>
              <div className="text-xs text-slate-500 mt-1">{portfolioMetrics.totalUncoveredSlots} uncovered slots</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA Risk</div>
              <div className="mt-2 text-2xl font-extrabold text-amber-600">{portfolioMetrics.contractsWithSlaRiskCount}</div>
              <div className="text-xs text-slate-500 mt-1">{portfolioMetrics.contractsWithEscalationsCount} with escalations</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiring Soon</div>
              <div className="mt-2 text-2xl font-extrabold text-purple-600">{portfolioMetrics.contractsExpiringSoonCount}</div>
              <div className="text-xs text-slate-500 mt-1">{portfolioMetrics.contractsExpiredCount} expired</div>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Business Date</label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Operation Scope</label>
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Operations</option>
                <option value="SECURITY_GUARDING">Security Guarding</option>
                <option value="FACILITY_MANAGEMENT">Facility Management</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Health Status</label>
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="HEALTHY">Healthy</option>
                <option value="ATTENTION">Attention</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SLA Risk</label>
              <select
                value={slaRisk}
                onChange={(e) => setSlaRisk(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All SLA States</option>
                <option value="AT_RISK">At SLA Risk</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Status</label>
              <select
                value={expiryStatus}
                onChange={(e) => setExpiryStatus(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Expiries</option>
                <option value="EXPIRING_SOON">Expiring Soon (&le; 30d)</option>
                <option value="EXPIRED">Expired</option>
                <option value="ACTIVE">Active</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Search Contract / Client</label>
              <input
                type="text"
                placeholder="Search name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Contract Health Register Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Contract Commercial Health Register ({filteredContracts.length})
            </h2>
            <span className="text-xs text-slate-500">
              Filtered for {businessDate}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading Commercial Health Analytics...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 bg-rose-50 border-b border-rose-200">
              {error}
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No active contract health records match the selected filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Client &amp; Contract</th>
                    <th className="py-3.5 px-4">Operation</th>
                    <th className="py-3.5 px-4">Expiry</th>
                    <th className="py-3.5 px-4">Effective Req</th>
                    <th className="py-3.5 px-4">Roster Coverage</th>
                    <th className="py-3.5 px-4">Reliever Pool</th>
                    <th className="py-3.5 px-4">SLA Risk</th>
                    <th className="py-3.5 px-4">Escalations</th>
                    <th className="py-3.5 px-4">Health Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredContracts.map((item) => (
                    <tr key={item.contractId} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.clientName}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.contractNumber} &mdash; {item.contractTitle}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.operationType === "SECURITY_GUARDING"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}>
                          {item.operationType === "SECURITY_GUARDING" ? "Security" : "Facility Mgmt"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {getExpiryBadge(item.expiryStatus, item.daysToExpiry)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {item.effectiveRequirements.effectiveManpowerCount} Guards
                        </div>
                        {item.effectiveRequirements.addendaManpowerDelta !== 0 && (
                          <div className="text-xs text-indigo-600 font-medium">
                            {item.effectiveRequirements.addendaManpowerDelta > 0 ? "+" : ""}
                            {item.effectiveRequirements.addendaManpowerDelta} via Addenda
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${
                                item.coverage.coveragePercentage >= 95
                                  ? "bg-emerald-500"
                                  : item.coverage.coveragePercentage >= 80
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, item.coverage.coveragePercentage)}%` }}
                            ></div>
                          </div>
                          <span className="font-semibold text-slate-800 text-xs">
                            {item.coverage.coveragePercentage}%
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.coverage.assignedSlots} / {item.coverage.requiredSlots} filled
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.relieverReadiness.readinessStatus === "READY"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.relieverReadiness.readinessStatus === "ATTENTION"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {item.relieverReadiness.readinessStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {item.slaExposure.isSlaRisk ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
                            SLA RISK
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                            Normal
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {item.slaExposure.openEscalationCount > 0 ? (
                          <span className="text-rose-600 font-bold">{item.slaExposure.openEscalationCount} Open</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {getHealthBadge(item.health.status, item.health.score)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedContract(item)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                        >
                          Inspect Contract
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Contract Detail Drawer */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold">{selectedContract.clientName}</h2>
                  {getHealthBadge(selectedContract.health.status, selectedContract.health.score)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {selectedContract.contractNumber} &mdash; {selectedContract.contractTitle}
                </div>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Tab Header */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setDrawerTab("summary")}
                className={`py-3 px-4 border-b-2 ${drawerTab === "summary" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent"}`}
              >
                Health &amp; SLA
              </button>
              <button
                onClick={() => setDrawerTab("requirements")}
                className={`py-3 px-4 border-b-2 ${drawerTab === "requirements" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent"}`}
              >
                Effective Req
              </button>
              <button
                onClick={() => setDrawerTab("coverage")}
                className={`py-3 px-4 border-b-2 ${drawerTab === "coverage" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent"}`}
              >
                Coverage
              </button>
              <button
                onClick={() => setDrawerTab("attendance")}
                className={`py-3 px-4 border-b-2 ${drawerTab === "attendance" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent"}`}
              >
                Attendance
              </button>
              <button
                onClick={() => setDrawerTab("billing")}
                className={`py-3 px-4 border-b-2 ${drawerTab === "billing" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent"}`}
              >
                Billing &amp; Drill-Down
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {drawerTab === "summary" && (
                <div className="space-y-6">
                  {/* Health Score Gauge Box */}
                  <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase">Health Rating</div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1">
                        {selectedContract.health.status} ({selectedContract.health.score}/100)
                      </div>
                    </div>
                    <div>
                      {getHealthBadge(selectedContract.health.status, selectedContract.health.score)}
                    </div>
                  </div>

                  {/* Health Reasons */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Health Explanation &amp; Factors</h3>
                    {selectedContract.health.reasons.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedContract.health.reasons.map((r, i) => (
                          <li key={i} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                        Zero degradation factors detected. Contract operating smoothly at optimal standard.
                      </div>
                    )}
                  </div>

                  {/* SLA Exposure Reasons */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">SLA Risk Assessment</h3>
                    {selectedContract.slaExposure.isSlaRisk ? (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                        <div className="text-xs font-bold text-rose-800 uppercase">SLA Breach / Risk Flags Detected</div>
                        <ul className="space-y-1">
                          {selectedContract.slaExposure.slaRiskReasons.map((reason, i) => (
                            <li key={i} className="text-xs text-rose-700 flex items-center space-x-2">
                              <span>&bull;</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                        No active SLA risks. Operational coverage and escalation levels remain within target bounds.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === "requirements" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Contractual Manpower Requirement Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500">Base Manpower Count</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {selectedContract.effectiveRequirements.baseManpowerCount}
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                      <div className="text-xs text-indigo-700">Addenda Adjustments</div>
                      <div className="text-xl font-bold text-indigo-900 mt-1">
                        {selectedContract.effectiveRequirements.addendaManpowerDelta >= 0 ? "+" : ""}
                        {selectedContract.effectiveRequirements.addendaManpowerDelta}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase">Effective Contractual Requirement</div>
                      <div className="text-2xl font-extrabold mt-1">
                        {selectedContract.effectiveRequirements.effectiveManpowerCount} Guards
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 text-right">
                      {selectedContract.effectiveRequirements.effectiveRelieverCount} Relievers Assigned
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "coverage" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Roster &amp; Standby Reliever Coverage</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Required Slots</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">{selectedContract.coverage.requiredSlots}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Filled Slots</div>
                      <div className="text-lg font-bold text-emerald-600 mt-1">{selectedContract.coverage.assignedSlots}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Uncovered Slots</div>
                      <div className="text-lg font-bold text-rose-600 mt-1">{selectedContract.coverage.uncoveredSlots}</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-700">Reliever Pool Readiness</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Available Standby Pool:</span>
                      <span className="font-bold text-slate-900">{selectedContract.relieverReadiness.availableStandby} employees</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Uncovered Reliever Demand:</span>
                      <span className="font-bold text-rose-600">{selectedContract.relieverReadiness.uncoveredDemand} relievers</span>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "attendance" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Attendance &amp; Reconciliation Exposure</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Present Today</div>
                      <div className="text-lg font-bold text-emerald-600 mt-1">{selectedContract.attendanceExposure.presentToday}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Absent Today</div>
                      <div className="text-lg font-bold text-rose-600 mt-1">{selectedContract.attendanceExposure.absentToday}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Late Check-Ins</div>
                      <div className="text-lg font-bold text-amber-600 mt-1">{selectedContract.attendanceExposure.lateToday}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500">Missing Punches</div>
                      <div className="text-lg font-bold text-amber-600 mt-1">{selectedContract.attendanceExposure.missingPunch}</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-700">Reconciliation &amp; Exceptions</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Unresolved Reconciliations:</span>
                      <span className="font-bold text-rose-600">{selectedContract.reconciliationExposure.unresolvedReconciliations}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Pending Attendance Corrections:</span>
                      <span className="font-bold text-amber-600">{selectedContract.attendanceExposure.unresolvedCorrections}</span>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "billing" && (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Billing-Support Advisory Indicators</h3>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200">
                      <span className="text-slate-600">Billable Advisory Manpower:</span>
                      <span className="font-bold text-slate-900">{selectedContract.billingSupport.billableAdvisoryManpower} Guards</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200">
                      <span className="text-slate-600">Variance vs Effective Required:</span>
                      <span className={`font-bold ${selectedContract.billingSupport.varianceVsRequired < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {selectedContract.billingSupport.varianceVsRequired >= 0 ? "+" : ""}
                        {selectedContract.billingSupport.varianceVsRequired}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Corrective Action &amp; Audit Drill-Downs</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href={selectedContract.drillDownUrls.contractMaster}
                        className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 text-center transition"
                      >
                        Inspect Contract Master
                      </Link>
                      <Link
                        href={selectedContract.drillDownUrls.rosterCoverage}
                        className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 text-center transition"
                      >
                        Roster Coverage Console
                      </Link>
                      <Link
                        href={selectedContract.drillDownUrls.escalationQueue}
                        className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 text-center transition"
                      >
                        Escalation Queue
                      </Link>
                      <Link
                        href={selectedContract.drillDownUrls.reconciliation}
                        className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 text-center transition"
                      >
                        Reconciliation Console
                      </Link>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
