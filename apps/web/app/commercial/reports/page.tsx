"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  PieChart,
  DollarSign,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSpreadsheet
} from "lucide-react";

export default function ReportsPage() {
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [marginData, setMarginData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [operationFilter, setOperationFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      setLoading(true);
      setErrorMsg("");

      const [pRes, mRes] = await Promise.all([
        fetch("/api/v1/commercial/reports/pipeline"),
        fetch("/api/v1/commercial/reports/margins")
      ]);

      if (pRes.ok) {
        const pData = await pRes.json();
        setPipelineData(pData);
      }
      if (mRes.ok) {
        const mData = await mRes.json();
        setMarginData(mData);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load report analytics.");
    } finally {
      setLoading(false);
    }
  }

  const filteredMargins = marginData?.items?.filter((item: any) => {
    if (operationFilter === "ALL") return true;
    return item.operationType === operationFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-surface p-6 text-on-surface">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <BarChart3 className="h-4 w-4" />
            <span>Commercial Lifecycle — CL-6</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Commercial Analytics & Reporting Dashboard
          </h1>
          <p className="text-sm text-on-surface-variant">
            Access deal pipeline funnel analytics, win/loss rates, and profit margin heatmaps across all cost packages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="rounded-lg border border-outline bg-surface-container px-3 py-2 text-xs font-medium text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="ALL">All Operations</option>
            <option value="SECURITY_GUARDING">Security Guarding</option>
            <option value="FACILITY_MANAGEMENT">Facility Management</option>
          </select>

          <button
            onClick={fetchReports}
            className="flex items-center gap-2 rounded-lg border border-outline px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-variant"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
          {errorMsg}
        </div>
      )}

      {/* Analytics KPI Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline bg-surface-container p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">Total Pipeline Deals</span>
            <PieChart className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-on-surface">
            {pipelineData?.summary?.totalCases || 0}
          </div>
          <div className="mt-1 text-xs text-on-surface-variant">Tracked Enquiries & Opportunities</div>
        </div>

        <div className="rounded-xl border border-outline bg-surface-container p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">Commercial Win Rate</span>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div className="mt-2 text-2xl font-bold text-success">
            {pipelineData?.summary?.winRatePercentage || 0}%
          </div>
          <div className="mt-1 text-xs text-on-surface-variant">Proposals Accepted vs Rejected</div>
        </div>

        <div className="rounded-xl border border-outline bg-surface-container p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">Average Target Margin</span>
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-on-surface">
            {marginData?.summary?.averageMarginPct || 0}%
          </div>
          <div className="mt-1 text-xs text-on-surface-variant">Across Audited Cost Packages</div>
        </div>

        <div className="rounded-xl border border-outline bg-surface-container p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">Healthy Margin Models</span>
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div className="mt-2 text-2xl font-bold text-on-surface">
            {marginData?.summary?.marginBands?.healthy || 0}
          </div>
          <div className="mt-1 text-xs text-on-surface-variant">Gross Profit &gt;= 20% Target</div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Deal Pipeline Funnel Visualizer */}
        <div className="rounded-xl border border-outline bg-surface-container p-6 lg:col-span-1">
          <h2 className="text-base font-bold text-on-surface mb-4">Deal Pipeline Funnel</h2>

          {loading ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">Loading funnel...</div>
          ) : !pipelineData ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">No pipeline data available.</div>
          ) : (
            <div className="space-y-4">
              <FunnelStep
                label="Enquiries & Qualification"
                count={pipelineData.summary.pipelineFunnel.enquiries}
                percentage={100}
                color="bg-primary"
              />
              <FunnelStep
                label="Site Surveys Completed"
                count={pipelineData.summary.pipelineFunnel.surveysCompleted}
                percentage={
                  pipelineData.summary.pipelineFunnel.enquiries > 0
                    ? Math.round((pipelineData.summary.pipelineFunnel.surveysCompleted / pipelineData.summary.pipelineFunnel.enquiries) * 100)
                    : 0
                }
                color="bg-primary/80"
              />
              <FunnelStep
                label="Costings Configured"
                count={pipelineData.summary.pipelineFunnel.costingsCompleted}
                percentage={
                  pipelineData.summary.pipelineFunnel.enquiries > 0
                    ? Math.round((pipelineData.summary.pipelineFunnel.costingsCompleted / pipelineData.summary.pipelineFunnel.enquiries) * 100)
                    : 0
                }
                color="bg-primary/60"
              />
              <FunnelStep
                label="Proposals Issued"
                count={pipelineData.summary.pipelineFunnel.proposalsIssued}
                percentage={
                  pipelineData.summary.pipelineFunnel.enquiries > 0
                    ? Math.round((pipelineData.summary.pipelineFunnel.proposalsIssued / pipelineData.summary.pipelineFunnel.enquiries) * 100)
                    : 0
                }
                color="bg-primary/40"
              />
              <FunnelStep
                label="Client Accepted / Converted"
                count={pipelineData.summary.pipelineFunnel.accepted}
                percentage={
                  pipelineData.summary.pipelineFunnel.enquiries > 0
                    ? Math.round((pipelineData.summary.pipelineFunnel.accepted / pipelineData.summary.pipelineFunnel.enquiries) * 100)
                    : 0
                }
                color="bg-success"
              />
            </div>
          )}
        </div>

        {/* Margin Heatmap & Gross Profit Audits Ledger */}
        <div className="rounded-xl border border-outline bg-surface-container p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-on-surface">Margin Heatmap & Gross Profit Audits</h2>
              <p className="text-xs text-on-surface-variant">Real-time margin compliance score per costing model.</p>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 font-bold text-success">
                Healthy &ge;20%
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-2 py-0.5 font-bold text-warning">
                Warn 10-19%
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-error/10 px-2 py-0.5 font-bold text-error">
                Critical &lt;10%
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">Loading margin heatmaps...</div>
          ) : filteredMargins.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline p-8 text-center text-xs text-on-surface-variant">
              No cost package models match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline/50 bg-surface-variant/50 text-on-surface-variant uppercase text-[10px] tracking-wider font-bold">
                    <th className="p-3">Costing Model</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Monthly Cost</th>
                    <th className="p-3">Sell Price</th>
                    <th className="p-3">Target Margin %</th>
                    <th className="p-3">Compliance Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/30">
                  {filteredMargins.map((item: any) => {
                    const isHealthy = item.marginBand === "HEALTHY";
                    const isWarn = item.marginBand === "WARN";
                    const isCritical = item.marginBand === "CRITICAL";

                    return (
                      <tr key={item.id} className="hover:bg-surface-variant/30 transition-colors">
                        <td className="p-3 font-semibold text-on-surface">{item.title}</td>
                        <td className="p-3">
                          <span className="rounded bg-surface-variant px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                            {item.operationType || "SG"}
                          </span>
                        </td>
                        <td className="p-3 font-mono">{item.totalMonthlyCost ? item.totalMonthlyCost.toLocaleString() : "N/A"}</td>
                        <td className="p-3 font-mono">{item.totalMonthlySellPrice ? item.totalMonthlySellPrice.toLocaleString() : "N/A"}</td>
                        <td className="p-3 font-bold font-mono text-on-surface">{item.targetMarginPct}%</td>
                        <td className="p-3">
                          {isHealthy && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success">
                              <CheckCircle className="h-3 w-3" /> Healthy
                            </span>
                          )}
                          {isWarn && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-bold text-warning">
                              <AlertTriangle className="h-3 w-3" /> Warning
                            </span>
                          )}
                          {isCritical && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-0.5 text-[11px] font-bold text-error">
                              <XCircle className="h-3 w-3" /> Critical
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelStep({ label, count, percentage, color }: { label: string; count: number; percentage: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-on-surface">{label}</span>
        <span className="font-bold text-on-surface-variant font-mono">{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-surface rounded-full h-3 overflow-hidden border border-outline/30">
        <div
          className={`${color} h-3 rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(percentage, 3)}%` }}
        ></div>
      </div>
    </div>
  );
}
