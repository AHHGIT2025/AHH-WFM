"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

interface ProspectClient {
  id: string;
  name: string;
  crNumber?: string | null;
}

interface PreContractCase {
  id: string;
  title: string;
  operationType?: string | null;
  companyId?: string | null;
  lifecycle: string;
  prospectClient?: ProspectClient | null;
}

interface PreContractSurvey {
  id: string;
  caseId: string;
  lifecycle: string;
  prospectiveSite?: { id: string; name: string; address?: string | null } | null;
}

interface CostingItem {
  id?: string;
  elementCode: string;
  elementName: string;
  categoryCode: string;
  isDirect: boolean;
  unitOfMeasure?: string | null;
  quantity: number;
  unitRate: number;
  totalAmount: number;
  calculationBasis: string;
  overrideReason?: string | null;
}

interface OverrideLog {
  id: string;
  fieldPath: string;
  priorValue: string;
  newValue: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

interface CostingVersion {
  id: string;
  versionNumber: number;
  status: string;
  pricingBasis: "MARGIN" | "MARKUP" | "MANUAL";
  currency: string;
  totalDirectCost: number;
  totalIndirectCost: number;
  totalCost: number;
  targetMarginPercentage?: number | null;
  targetMarkupPercentage?: number | null;
  sellingPrice: number;
  snapshotJson?: string | null;
  checksum?: string | null;
  createdBy: string;
  createdAt: string;
  items: CostingItem[];
  overrides?: OverrideLog[];
}

interface CostingEstimate {
  id: string;
  estimateNumber?: string | null;
  caseId: string;
  surveyId: string;
  companyId?: string | null;
  operationType?: string | null;
  currentVersionNumber: number;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  case: PreContractCase;
  survey: PreContractSurvey;
  versions: CostingVersion[];
}

export default function CostingPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [estimates, setEstimates] = useState<CostingEstimate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>("ALL");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [cases, setCases] = useState<PreContractCase[]>([]);
  const [surveys, setSurveys] = useState<PreContractSurvey[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [pricingBasis, setPricingBasis] = useState<"MARGIN" | "MARKUP" | "MANUAL">("MARGIN");
  const [targetMargin, setTargetMargin] = useState<number>(15.0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Selected Estimate Detail Modal State
  const [selectedEstimate, setSelectedEstimate] = useState<CostingEstimate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Workflow Action Modal State
  const [showWorkflowModal, setShowWorkflowModal] = useState<boolean>(false);
  const [workflowAction, setWorkflowAction] = useState<"SUBMIT" | "APPROVE" | "REJECT" | "RETURN">("SUBMIT");
  const [workflowRemarks, setWorkflowRemarks] = useState<string>("");
  const [workflowExecuting, setWorkflowExecuting] = useState<boolean>(false);

  // Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideElementCode, setOverrideElementCode] = useState<string>("BASIC_PAY");
  const [overrideUnitRate, setOverrideUnitRate] = useState<number>(3000);
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideExecuting, setOverrideExecuting] = useState<boolean>(false);

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (operationTypeFilter && operationTypeFilter !== "ALL") params.set("operationType", operationTypeFilter);

      const res = await fetch(`/api/v1/commercial/costing?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch commercial costing estimates.");

      const data = await res.json();
      setEstimates(data.estimates || []);
    } catch (err: any) {
      setError(err.message || "Error loading commercial costing estimates.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, operationTypeFilter]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  const fetchCasesAndSurveys = async () => {
    try {
      const [resCases, resSurveys] = await Promise.all([
        fetch("/api/v1/commercial/opportunities"),
        fetch("/api/v1/commercial/surveys")
      ]);
      if (resCases.ok) {
        const data = await resCases.json();
        setCases(data.cases || []);
      }
      if (resSurveys.ok) {
        const data = await resSurveys.json();
        // Filter COMPLETED surveys
        const completedSurveys = (data.surveys || []).filter((s: any) => s.lifecycle === "COMPLETED");
        setSurveys(completedSurveys);
      }
    } catch (err) {
      console.error("Failed to load cases/surveys for costing creation", err);
    }
  };

  const handleOpenCreateModal = () => {
    fetchCasesAndSurveys();
    setShowCreateModal(true);
  };

  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !selectedSurveyId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCaseId,
          surveyId: selectedSurveyId,
          pricingBasis,
          targetMarginPercentage: targetMargin
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create costing estimate.");
      }

      setShowCreateModal(false);
      setSelectedCaseId("");
      setSelectedSurveyId("");
      fetchEstimates();
    } catch (err: any) {
      alert(err.message || "Error creating costing estimate.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWorkflowAction = async () => {
    if (!selectedEstimate) return;
    setWorkflowExecuting(true);
    try {
      const res = await fetch(`/api/v1/commercial/costing/${selectedEstimate.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: workflowAction,
          remarks: workflowRemarks
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to execute workflow action.");
      }

      setShowWorkflowModal(false);
      setShowDetailModal(false);
      setWorkflowRemarks("");
      fetchEstimates();
    } catch (err: any) {
      alert(err.message || "Error executing workflow action.");
    } finally {
      setWorkflowExecuting(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!selectedEstimate) return;
    setOverrideExecuting(true);
    try {
      const res = await fetch(`/api/v1/commercial/costing/${selectedEstimate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [
            {
              elementCode: overrideElementCode,
              unitRate: overrideUnitRate,
              reason: overrideReason || "Manual rate calibration override"
            }
          ]
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to apply override.");
      }

      const data = await res.json();
      setSelectedEstimate(data.estimate);
      setShowOverrideModal(false);
      setOverrideReason("");
      fetchEstimates();
    } catch (err: any) {
      alert(err.message || "Error applying line override.");
    } finally {
      setOverrideExecuting(false);
    }
  };

  const formatCurrency = (val: number | string | undefined, curr: string = "QAR") => {
    if (val === undefined || val === null) return `0.00 ${curr}`;
    const num = typeof val === "number" ? val : parseFloat(val);
    return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-xl shadow-md border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-icons text-blue-400">payments</span>
            <h1 className="text-2xl font-bold">Pre-Contract Costing & Estimation</h1>
            <Badge variant="secondary" className="text-blue-300 border-blue-500/40">Phase CL-3</Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Build commercial manpower estimates, calibrate gross margins, log financial overrides, and execute governance workflow approvals.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 px-4 py-2 rounded-lg shadow"
        >
          <span className="material-icons text-sm">add</span>
          New Costing Estimate
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-slate-800/60 border-slate-700">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 gap-3 w-full md:w-auto">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search by title, client, or reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white pl-9 text-sm"
              />
              <span className="material-icons absolute left-2.5 top-2.5 text-slate-400 text-sm">search</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_WORKFLOW">In Workflow</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={operationTypeFilter}
              onChange={(e) => setOperationTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2"
            >
              <option value="ALL">All Operational Scopes</option>
              <option value="SECURITY_GUARDING">Security Guarding</option>
              <option value="FACILITY_MANAGEMENT">Facility Management</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-500/50 text-red-200 rounded-lg text-sm flex items-center gap-2">
          <span className="material-icons text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Costing Register Table */}
      <Card className="bg-slate-800/40 border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <span className="material-icons animate-spin text-2xl text-blue-400">sync</span>
            <span>Loading commercial costing estimates...</span>
          </div>
        ) : estimates.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <span className="material-icons text-4xl text-slate-500">request_quote</span>
            <span className="font-medium text-slate-300">No commercial costing estimates found.</span>
            <p className="text-xs text-slate-500">Create a new draft estimate from a completed site survey to begin calculation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-xs border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Ref / ID</th>
                  <th className="py-3 px-4">Opportunity & Client</th>
                  <th className="py-3 px-4">Operational Scope</th>
                  <th className="py-3 px-4">Revision</th>
                  <th className="py-3 px-4">Total Cost</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Margin %</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {estimates.map((est) => {
                  const latestVer = est.versions[0];
                  const displayId = est.estimateNumber || `COST-${est.id.slice(0, 8).toUpperCase()}`;
                  const marginPct = latestVer?.targetMarginPercentage ?? 0;

                  return (
                    <tr key={est.id} className="hover:bg-slate-800/60 transition">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-400">
                        {displayId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{est.case?.title || "Commercial Opportunity"}</div>
                        <div className="text-xs text-slate-400">{est.case?.prospectClient?.name || "Prospect Client"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={
                            est.operationType === "SECURITY_GUARDING"
                              ? "text-emerald-400 border-emerald-500/30"
                              : "text-amber-400 border-amber-500/30"
                          }
                        >
                          {est.operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-300">
                        Rev {latestVer?.versionNumber || est.currentVersionNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">
                        {formatCurrency(latestVer?.totalCost, latestVer?.currency)}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm font-semibold text-emerald-400">
                        {formatCurrency(latestVer?.sellingPrice, latestVer?.currency)}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">
                        <span className={marginPct < 15 ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {marginPct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            est.status === "APPROVED"
                              ? "bg-emerald-900/60 text-emerald-300 border-emerald-500/40"
                              : est.status === "IN_WORKFLOW"
                              ? "bg-blue-900/60 text-blue-300 border-blue-500/40"
                              : est.status === "REJECTED"
                              ? "bg-red-900/60 text-red-300 border-red-500/40"
                              : "bg-slate-700/60 text-slate-300 border-slate-600"
                          }
                        >
                          {est.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedEstimate(est);
                            setShowDetailModal(true);
                          }}
                          className="text-xs bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                        >
                          View / Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New Costing Estimate Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-icons text-blue-400">post_add</span>
                Create New Costing Estimate
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-icons text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateEstimate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  1. Select Commercial Opportunity Case
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
                >
                  <option value="">-- Choose Opportunity Case --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.operationType || "SG/FM"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  2. Select Completed Site Survey
                </label>
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
                >
                  <option value="">-- Choose Completed Site Survey --</option>
                  {surveys
                    .filter((s) => !selectedCaseId || s.caseId === selectedCaseId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Survey #{s.id.slice(0, 8).toUpperCase()} - {s.prospectiveSite?.name || "Prospective Site"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Pricing Basis
                  </label>
                  <select
                    value={pricingBasis}
                    onChange={(e) => setPricingBasis(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
                  >
                    <option value="MARGIN">Gross Margin %</option>
                    <option value="MARKUP">Markup %</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Target Gross Margin %
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(parseFloat(e.target.value))}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-800 border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !selectedCaseId || !selectedSurveyId}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4"
                >
                  {submitting ? "Calculating..." : "Create Draft Costing"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Costing Detail & Interactive Calculator Modal */}
      {showDetailModal && selectedEstimate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-blue-400 font-semibold">
                    {selectedEstimate.estimateNumber || `COST-${selectedEstimate.id.slice(0, 8).toUpperCase()}`}
                  </span>
                  <Badge variant="secondary" className="text-slate-300">
                    Rev {selectedEstimate.versions[0]?.versionNumber || 1}
                  </Badge>
                  <Badge
                    className={
                      selectedEstimate.status === "APPROVED"
                        ? "bg-emerald-900/60 text-emerald-300"
                        : "bg-blue-900/60 text-blue-300"
                    }
                  >
                    {selectedEstimate.status}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedEstimate.case?.title}</h2>
                <p className="text-xs text-slate-400">
                  Client: {selectedEstimate.case?.prospectClient?.name || "N/A"} | Site: {selectedEstimate.survey?.prospectiveSite?.name || "N/A"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.print()}
                  className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1"
                >
                  <span className="material-icons text-xs">print</span> Print
                </Button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-300 text-sm">
              {/* Financial Summary Cards */}
              {(() => {
                const ver = selectedEstimate.versions[0];
                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="p-4 bg-slate-800/60 border-slate-700">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Total Direct Cost</div>
                      <div className="text-lg font-mono font-bold text-white mt-1">
                        {formatCurrency(ver?.totalDirectCost, ver?.currency)}
                      </div>
                    </Card>

                    <Card className="p-4 bg-slate-800/60 border-slate-700">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Indirect Overhead</div>
                      <div className="text-lg font-mono font-bold text-white mt-1">
                        {formatCurrency(ver?.totalIndirectCost, ver?.currency)}
                      </div>
                    </Card>

                    <Card className="p-4 bg-slate-800/60 border-slate-700">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Total Estimate Cost</div>
                      <div className="text-lg font-mono font-bold text-blue-400 mt-1">
                        {formatCurrency(ver?.totalCost, ver?.currency)}
                      </div>
                    </Card>

                    <Card className="p-4 bg-emerald-950/40 border-emerald-500/40">
                      <div className="text-xs text-emerald-400 uppercase font-semibold">Selling Price & Margin</div>
                      <div className="text-lg font-mono font-bold text-emerald-300 mt-1">
                        {formatCurrency(ver?.sellingPrice, ver?.currency)}
                      </div>
                      <div className="text-xs text-emerald-400 mt-0.5 font-medium">
                        Gross Margin: {ver?.targetMarginPercentage?.toFixed(2)}%
                      </div>
                    </Card>
                  </div>
                );
              })()}

              {/* Cost Line Items Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    <span className="material-icons text-blue-400 text-sm">list_alt</span>
                    Costing Line Items Breakdown
                  </h4>
                  {selectedEstimate.status !== "APPROVED" && (
                    <Button
                      size="sm"
                      onClick={() => setShowOverrideModal(true)}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1 flex items-center gap-1 rounded"
                    >
                      <span className="material-icons text-xs">edit</span> Override Line Rate
                    </Button>
                  )}
                </div>

                <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/60">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Element Code</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Unit Rate</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-3">Basis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(selectedEstimate.versions[0]?.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono font-semibold text-blue-400">{item.elementCode}</td>
                          <td className="py-2 px-3 font-medium text-white">{item.elementName}</td>
                          <td className="py-2 px-3">
                            <Badge variant="secondary" className="text-xs text-slate-400 border-slate-700">
                              {item.categoryCode}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-mono">{Number(item.quantity).toFixed(2)}</td>
                          <td className="py-2 px-3 font-mono">{formatCurrency(item.unitRate, selectedEstimate.versions[0]?.currency)}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-100">
                            {formatCurrency(item.totalAmount, selectedEstimate.versions[0]?.currency)}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={item.calculationBasis === "OVERRIDE" ? "bg-amber-900/60 text-amber-300" : "bg-slate-800 text-slate-300"}>
                              {item.calculationBasis}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Override Log History */}
              {selectedEstimate.versions[0]?.overrides && selectedEstimate.versions[0].overrides.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="material-icons text-amber-400 text-sm">history</span>
                    Override Audit History
                  </h4>
                  <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
                    {selectedEstimate.versions[0].overrides.map((ov) => (
                      <div key={ov.id} className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <span className="font-mono text-amber-400 font-semibold">{ov.fieldPath}: </span>
                          <span className="text-slate-300">{ov.priorValue} → {ov.newValue} </span>
                          <span className="text-slate-400 italic">({ov.reason})</span>
                        </div>
                        <div className="text-slate-500 text-xs">
                          By {ov.overriddenBy} at {new Date(ov.overriddenAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer & Governance Actions */}
            <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Created by <span className="text-slate-200 font-medium">{selectedEstimate.createdBy}</span>
              </div>

              <div className="flex items-center gap-3">
                {selectedEstimate.status === "DRAFT" && (
                  <Button
                    onClick={() => {
                      setWorkflowAction("SUBMIT");
                      setShowWorkflowModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4"
                  >
                    Submit for Approval
                  </Button>
                )}

                {selectedEstimate.status === "IN_WORKFLOW" && (
                  <>
                    <Button
                      onClick={() => {
                        setWorkflowAction("APPROVE");
                        setShowWorkflowModal(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4"
                    >
                      Approve Costing
                    </Button>

                    <Button
                      onClick={() => {
                        setWorkflowAction("RETURN");
                        setShowWorkflowModal(true);
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3"
                    >
                      Return for Edit
                    </Button>

                    <Button
                      onClick={() => {
                        setWorkflowAction("REJECT");
                        setShowWorkflowModal(true);
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white text-xs px-3"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Action Confirmation Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-icons text-blue-400">gavel</span>
              Execute Workflow Action: {workflowAction}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Approval Remarks / Governance Notes
              </label>
              <textarea
                value={workflowRemarks}
                onChange={(e) => setWorkflowRemarks(e.target.value)}
                placeholder="Enter audit remarks or return reason..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <Button
                variant="secondary"
                onClick={() => setShowWorkflowModal(false)}
                className="bg-slate-800 border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWorkflowAction}
                disabled={workflowExecuting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4"
              >
                {workflowExecuting ? "Processing..." : `Confirm ${workflowAction}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-icons text-amber-400">edit_note</span>
              Override Cost Line Rate
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Element Code
              </label>
              <select
                value={overrideElementCode}
                onChange={(e) => setOverrideElementCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm"
              >
                <option value="BASIC_PAY">BASIC_PAY (Basic Pay / Manpower Wage)</option>
                <option value="ALLOWANCES">ALLOWANCES (Fixed Employment Allowances)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                New Unit Rate
              </label>
              <Input
                type="number"
                value={overrideUnitRate}
                onChange={(e) => setOverrideUnitRate(parseFloat(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Mandatory Override Reason
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Specify justification for rate override..."
                rows={2}
                required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <Button
                variant="secondary"
                onClick={() => setShowOverrideModal(false)}
                className="bg-slate-800 border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyOverride}
                disabled={overrideExecuting || !overrideReason.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-4"
              >
                {overrideExecuting ? "Applying..." : "Apply & Recalculate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
