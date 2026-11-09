"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";
import { hasPermission, isAdminUser } from "@/lib/permissions";

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
  quantity: number | string;
  unitRate: number | string;
  totalAmount: number | string;
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
  totalDirectCost: number | string;
  totalIndirectCost: number | string;
  totalCost: number | string;
  targetMarginPercentage?: number | string | null;
  targetMarkupPercentage?: number | string | null;
  sellingPrice: number | string;
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

function toSafeNumber(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return Number.isFinite(val) ? val : fallback;
  if (typeof val === "object" && val !== null && "toNumber" in val && typeof (val as any).toNumber === "function") {
    const num = (val as any).toNumber();
    return Number.isFinite(num) ? num : fallback;
  }
  const parsed = typeof val === "string" ? parseFloat(val) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMarginPercentage(val: unknown, decimals: number = 2): string {
  return `${toSafeNumber(val, 0).toFixed(decimals)}%`;
}

function formatCostingCurrency(val: unknown, curr: string = "QAR"): string {
  const num = toSafeNumber(val, 0);
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
}

export default function CostingPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [estimates, setEstimates] = useState<CostingEstimate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const [targetMargin, setTargetMargin] = useState<string>("15.0");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected Estimate Detail Modal State
  const [selectedEstimate, setSelectedEstimate] = useState<CostingEstimate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Workflow Action Modal State
  const [showWorkflowModal, setShowWorkflowModal] = useState<boolean>(false);
  const [workflowAction, setWorkflowAction] = useState<"SUBMIT" | "APPROVE" | "REJECT" | "RETURN">("SUBMIT");
  const [workflowRemarks, setWorkflowRemarks] = useState<string>("");
  const [workflowExecuting, setWorkflowExecuting] = useState<boolean>(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideElementCode, setOverrideElementCode] = useState<string>("BASIC_PAY");
  const [overrideUnitRate, setOverrideUnitRate] = useState<string>("3000");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideExecuting, setOverrideExecuting] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const canManageCosting =
    isAdminUser(user) ||
    hasPermission(user, "precontract.costing.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  const canOverrideCosting =
    isAdminUser(user) ||
    hasPermission(user, "precontract.costing.override") ||
    hasPermission(user, "manpower.admin.full_access");

  const canSubmitCosting =
    isAdminUser(user) ||
    hasPermission(user, "precontract.workflow.submit") ||
    hasPermission(user, "precontract.costing.manage") ||
    hasPermission(user, "manpower.admin.full_access");

  const canReviewCosting =
    isAdminUser(user) ||
    hasPermission(user, "precontract.workflow.approve") ||
    hasPermission(user, "precontract.workflow.review") ||
    hasPermission(user, "manpower.admin.full_access");

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
        const completedSurveys = (data.surveys || []).filter((s: any) => s.lifecycle === "COMPLETED");
        setSurveys(completedSurveys);
      }
    } catch (err) {
      console.error("Failed to load cases/surveys for costing creation", err);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateError(null);
    fetchCasesAndSurveys();
    setShowCreateModal(true);
  };

  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!selectedCaseId || !selectedSurveyId) return;

    const parsedMargin = toSafeNumber(targetMargin, 15.0);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCaseId,
          surveyId: selectedSurveyId,
          pricingBasis,
          targetMarginPercentage: parsedMargin
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create costing estimate.");
      }

      setShowCreateModal(false);
      setSelectedCaseId("");
      setSelectedSurveyId("");
      setFeedbackBanner({ type: "success", text: "Draft costing estimate created successfully." });
      await fetchEstimates();
    } catch (err: any) {
      setCreateError(err.message || "Error creating costing estimate.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetailModal = async (est: CostingEstimate) => {
    setSelectedEstimate(est);
    setShowDetailModal(true);
    try {
      const res = await fetch(`/api/v1/commercial/costing/${est.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.estimate) {
          setSelectedEstimate((prev) => ({
            ...prev,
            ...data.estimate,
            case: data.estimate.case ?? prev?.case ?? est.case,
            survey: data.estimate.survey ?? prev?.survey ?? est.survey
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch full costing estimate detail", err);
    }
  };

  const handleWorkflowAction = async () => {
    if (!selectedEstimate) return;
    setWorkflowError(null);
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute workflow action.");
      }

      if (data.estimate) {
        setSelectedEstimate((prev) =>
          prev
            ? {
                ...prev,
                ...data.estimate,
                case: data.estimate.case ?? prev.case,
                survey: data.estimate.survey ?? prev.survey,
                versions:
                  Array.isArray(data.estimate.versions) && data.estimate.versions.length > 0
                    ? data.estimate.versions
                    : prev.versions
              }
            : data.estimate
        );
      }
      setShowWorkflowModal(false);
      setWorkflowRemarks("");
      setFeedbackBanner({
        type: "success",
        text: `Costing workflow action ${workflowAction} executed successfully.`
      });
      await fetchEstimates();
    } catch (err: any) {
      setWorkflowError(err.message || "Error executing workflow action.");
    } finally {
      setWorkflowExecuting(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!selectedEstimate) return;
    setOverrideError(null);
    setOverrideExecuting(true);
    try {
      const res = await fetch(`/api/v1/commercial/costing/${selectedEstimate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [
            {
              elementCode: overrideElementCode,
              unitRate: toSafeNumber(overrideUnitRate, 3000),
              reason: overrideReason || "Manual rate calibration override"
            }
          ]
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply override.");
      }

      if (data.estimate) {
        setSelectedEstimate((prev) =>
          prev
            ? {
                ...prev,
                ...data.estimate,
                case: data.estimate.case ?? prev.case,
                survey: data.estimate.survey ?? prev.survey,
                versions:
                  Array.isArray(data.estimate.versions) && data.estimate.versions.length > 0
                    ? data.estimate.versions
                    : prev.versions
              }
            : data.estimate
        );
      }
      setShowOverrideModal(false);
      setOverrideReason("");
      setFeedbackBanner({ type: "success", text: "Costing line rate override applied and recalculated." });
      await fetchEstimates();
    } catch (err: any) {
      setOverrideError(err.message || "Error applying line override.");
    } finally {
      setOverrideExecuting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="success">APPROVED</Badge>;
      case "IN_WORKFLOW":
        return <Badge variant="warning">IN WORKFLOW</Badge>;
      case "REJECTED":
        return <Badge variant="error">REJECTED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">payments</span>
            <h1 className="text-xl font-bold text-on-surface">Pre-Contract Costing & Estimation</h1>
            <Badge variant="secondary">Phase CL-3</Badge>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Build commercial manpower estimates, calibrate gross margins, log financial overrides, and execute governance workflow approvals.
          </p>
        </div>

        {canManageCosting && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            New Costing Estimate
          </Button>
        )}
      </div>

      {feedbackBanner && (
        <Card
          className={`p-3 text-xs flex items-center justify-between ${
            feedbackBanner.type === "success"
              ? "bg-status-success/10 border-status-success text-status-success"
              : "bg-status-error/10 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-[16px]">
              {feedbackBanner.type === "success" ? "check_circle" : "error"}
            </span>
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold hover:opacity-80 px-2"
          >
            ×
          </button>
        </Card>
      )}

      {/* Filter Bar */}
      <Card className="p-4 bg-surface-container-low space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Search Estimates</label>
            <Input
              type="text"
              placeholder="Search by title, client, or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Lifecycle Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_WORKFLOW">In Workflow</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Operation Scope</label>
            <select
              value={operationTypeFilter}
              onChange={(e) => setOperationTypeFilter(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
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
        <Card className="p-4 bg-status-error/10 border-status-error text-status-error text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </Card>
      )}

      {/* Costing Register Table */}
      <Card className="p-0 overflow-hidden bg-surface-container-low">
        {loading ? (
          <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-2 text-xs">
            <span className="material-symbols-outlined animate-spin text-2xl text-secondary">sync</span>
            <span>Loading commercial costing estimates...</span>
          </div>
        ) : estimates.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">request_quote</span>
            <span className="font-bold text-on-surface">No commercial costing estimates found.</span>
            <p className="text-xs text-on-surface-variant">Create a new draft estimate from a completed site survey to begin calculation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant font-bold">
                  <th className="py-2.5 px-3">Ref / ID</th>
                  <th className="py-2.5 px-3">Opportunity & Client</th>
                  <th className="py-2.5 px-3">Operational Scope</th>
                  <th className="py-2.5 px-3">Revision</th>
                  <th className="py-2.5 px-3">Total Cost</th>
                  <th className="py-2.5 px-3">Selling Price</th>
                  <th className="py-2.5 px-3">Margin %</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                {estimates.map((est) => {
                  const latestVer = est.versions?.[0];
                  const displayId = est.estimateNumber || `COST-${est.id.slice(0, 8).toUpperCase()}`;
                  const marginPct = toSafeNumber(latestVer?.targetMarginPercentage, 0);

                  return (
                    <tr key={est.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-secondary">
                        {displayId}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-on-surface">{est.case?.title || "Commercial Opportunity"}</div>
                        <div className="text-[10px] text-on-surface-variant">{est.case?.prospectClient?.name || "Prospect Client"}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="secondary">
                          {est.operationType === "SECURITY_GUARDING" ? "Security Guarding" : "Facility Management"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-on-surface">
                        Rev {latestVer?.versionNumber || est.currentVersionNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {formatCostingCurrency(latestVer?.totalCost, latestVer?.currency)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-status-success">
                        {formatCostingCurrency(latestVer?.sellingPrice, latestVer?.currency)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className={marginPct < 15 ? "text-status-warning font-bold" : "text-status-success font-bold"}>
                          {formatMarginPercentage(marginPct)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {getStatusBadge(est.status)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenDetailModal(est)}
                          className="text-xs"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 bg-surface-container-low space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">post_add</span>
                Create New Costing Estimate
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-lg"
              >
                ×
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateEstimate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  1. Select Commercial Opportunity Case *
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
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
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  2. Select Completed Site Survey *
                </label>
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
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
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Pricing Basis
                  </label>
                  <select
                    value={pricingBasis}
                    onChange={(e) => setPricingBasis(e.target.value as any)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface"
                  >
                    <option value="MARGIN">Gross Margin %</option>
                    <option value="MARKUP">Markup %</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Target Gross Margin %
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || !selectedCaseId || !selectedSurveyId}
                >
                  {submitting ? "Calculating..." : "Create Draft Costing"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Costing Detail & Interactive Calculator Modal */}
      {showDetailModal && selectedEstimate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-surface-container-low">
            {/* Modal Header */}
            <div className="p-4 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-secondary font-bold">
                    {selectedEstimate.estimateNumber || `COST-${selectedEstimate.id.slice(0, 8).toUpperCase()}`}
                  </span>
                  <Badge variant="secondary">
                    Rev {selectedEstimate.versions?.[0]?.versionNumber || 1}
                  </Badge>
                  {getStatusBadge(selectedEstimate.status)}
                </div>
                <h2 className="text-base font-bold text-on-surface mt-0.5">{selectedEstimate.case?.title}</h2>
                <p className="text-xs text-on-surface-variant">
                  Client: {selectedEstimate.case?.prospectClient?.name || "N/A"} | Site: {selectedEstimate.survey?.prospectiveSite?.name || "N/A"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.print()}
                  className="text-xs inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">print</span> Print
                </Button>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="text-on-surface-variant hover:text-on-surface text-xl px-2"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-on-surface text-xs">
              {/* Financial Summary Cards */}
              {(() => {
                const ver = selectedEstimate.versions?.[0];
                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="p-4 bg-surface-container-lowest">
                      <div className="text-[10px] text-on-surface-variant uppercase font-bold">Total Direct Cost</div>
                      <div className="text-base font-mono font-extrabold text-on-surface mt-1">
                        {formatCostingCurrency(ver?.totalDirectCost, ver?.currency)}
                      </div>
                    </Card>

                    <Card className="p-4 bg-surface-container-lowest">
                      <div className="text-[10px] text-on-surface-variant uppercase font-bold">Indirect Overhead</div>
                      <div className="text-base font-mono font-extrabold text-on-surface mt-1">
                        {formatCostingCurrency(ver?.totalIndirectCost, ver?.currency)}
                      </div>
                    </Card>

                    <Card className="p-4 bg-surface-container-lowest">
                      <div className="text-[10px] text-on-surface-variant uppercase font-bold">Total Estimate Cost</div>
                      <div className="text-base font-mono font-extrabold text-secondary mt-1">
                        {formatCostingCurrency(ver?.totalCost, ver?.currency)}
                      </div>
                    </Card>

                    <Card className="p-4 bg-status-success/10 border-status-success/30">
                      <div className="text-[10px] text-status-success uppercase font-bold">Selling Price & Margin</div>
                      <div className="text-base font-mono font-extrabold text-status-success mt-1">
                        {formatCostingCurrency(ver?.sellingPrice, ver?.currency)}
                      </div>
                      <div className="text-xs text-status-success mt-0.5 font-semibold">
                        Gross Margin: {formatMarginPercentage(ver?.targetMarginPercentage)}
                      </div>
                    </Card>
                  </div>
                );
              })()}

              {/* Cost Line Items Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-on-surface text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">list_alt</span>
                    Costing Line Items Breakdown
                  </h4>
                  {selectedEstimate.status !== "APPROVED" && canOverrideCosting && (
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => {
                        setOverrideError(null);
                        setShowOverrideModal(true);
                      }}
                      className="text-xs inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span> Override Line Rate
                    </Button>
                  )}
                </div>

                <Card className="p-0 overflow-hidden bg-surface-container-lowest">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-container-high text-on-surface-variant uppercase border-b border-outline-variant font-bold">
                        <th className="py-2.5 px-3">Element Code</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Unit Rate</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-3">Basis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                      {(selectedEstimate.versions?.[0]?.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 px-3 text-center text-on-surface-variant italic">
                            No line items found for this costing version.
                          </td>
                        </tr>
                      ) : (
                        (selectedEstimate.versions?.[0]?.items || []).map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-surface-container-low/50">
                            <td className="py-2 px-3 font-mono font-bold text-secondary">{item.elementCode}</td>
                            <td className="py-2 px-3 font-medium text-on-surface">{item.elementName}</td>
                            <td className="py-2 px-3">
                              <Badge variant="neutral">
                                {item.categoryCode}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 font-mono">{toSafeNumber(item.quantity, 0).toFixed(2)}</td>
                            <td className="py-2 px-3 font-mono">{formatCostingCurrency(item.unitRate, selectedEstimate.versions?.[0]?.currency)}</td>
                            <td className="py-2 px-3 font-mono font-bold text-on-surface">
                              {formatCostingCurrency(item.totalAmount, selectedEstimate.versions?.[0]?.currency)}
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={item.calculationBasis === "OVERRIDE" ? "warning" : "secondary"}>
                                {item.calculationBasis}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </Card>
              </div>

              {/* Override Log History */}
              {selectedEstimate.versions?.[0]?.overrides && selectedEstimate.versions[0].overrides.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-on-surface text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-status-warning text-base">history</span>
                    Override Audit History
                  </h4>
                  <Card className="p-3 bg-surface-container-lowest space-y-2 text-xs">
                    {selectedEstimate.versions[0].overrides.map((ov) => (
                      <div key={ov.id} className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                        <div>
                          <span className="font-mono text-secondary font-bold">{ov.fieldPath}: </span>
                          <span className="text-on-surface">{ov.priorValue} → {ov.newValue} </span>
                          <span className="text-on-surface-variant italic">({ov.reason})</span>
                        </div>
                        <div className="text-on-surface-variant text-xs">
                          By {ov.overriddenBy} at {new Date(ov.overriddenAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              )}
            </div>

            {/* Modal Footer & Governance Actions */}
            <div className="p-4 bg-surface-container-high border-t border-outline-variant flex items-center justify-between">
              <div className="text-xs text-on-surface-variant">
                Created by <span className="text-on-surface font-semibold">{selectedEstimate.createdBy}</span>
              </div>

              <div className="flex items-center gap-2">
                {selectedEstimate.status === "DRAFT" && canSubmitCosting && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setWorkflowAction("SUBMIT");
                      setWorkflowError(null);
                      setShowWorkflowModal(true);
                    }}
                    className="text-xs"
                  >
                    Submit for Approval
                  </Button>
                )}

                {selectedEstimate.status === "IN_WORKFLOW" && canReviewCosting && (
                  <>
                    {(user?.role === "SUPER_ADMIN" ||
                      (selectedEstimate.createdBy !== user?.id && selectedEstimate.createdBy !== user?.name)) && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => {
                          setWorkflowAction("APPROVE");
                          setWorkflowError(null);
                          setShowWorkflowModal(true);
                        }}
                        className="text-xs"
                      >
                        Approve Costing
                      </Button>
                    )}

                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => {
                        setWorkflowAction("RETURN");
                        setWorkflowError(null);
                        setShowWorkflowModal(true);
                      }}
                      className="text-xs"
                    >
                      Return for Edit
                    </Button>

                    <Button
                      variant="error"
                      size="sm"
                      onClick={() => {
                        setWorkflowAction("REJECT");
                        setWorkflowError(null);
                        setShowWorkflowModal(true);
                      }}
                      className="text-xs"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Workflow Action Confirmation Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-surface-container-low space-y-4">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">gavel</span>
              Execute Workflow Action: {workflowAction}
            </h3>

            {workflowError && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-xs font-medium">
                {workflowError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">
                Approval Remarks / Governance Notes
              </label>
              <textarea
                value={workflowRemarks}
                disabled={workflowExecuting}
                onChange={(e) => setWorkflowRemarks(e.target.value)}
                placeholder="Enter audit remarks or return reason..."
                rows={3}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg p-2.5 text-xs focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
              <Button
                variant="ghost"
                size="sm"
                disabled={workflowExecuting}
                onClick={() => {
                  setShowWorkflowModal(false);
                  setWorkflowError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleWorkflowAction}
                disabled={workflowExecuting}
              >
                {workflowExecuting ? "Processing..." : `Confirm ${workflowAction}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-surface-container-low space-y-4">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-status-warning text-lg">edit_note</span>
              Override Cost Line Rate
            </h3>

            {overrideError && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-xs font-medium">
                {overrideError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">
                Element Code
              </label>
              <select
                value={overrideElementCode}
                disabled={overrideExecuting}
                onChange={(e) => setOverrideElementCode(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg p-2 text-xs"
              >
                <option value="BASIC_PAY">BASIC_PAY (Basic Pay / Manpower Wage)</option>
                <option value="ALLOWANCES">ALLOWANCES (Fixed Employment Allowances)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">
                New Unit Rate
              </label>
              <Input
                type="number"
                value={overrideUnitRate}
                disabled={overrideExecuting}
                onChange={(e) => setOverrideUnitRate(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">
                Mandatory Override Reason
              </label>
              <textarea
                value={overrideReason}
                disabled={overrideExecuting}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Specify justification for rate override..."
                rows={2}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg p-2 text-xs focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
              <Button
                variant="ghost"
                size="sm"
                disabled={overrideExecuting}
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={handleApplyOverride}
                disabled={overrideExecuting || !overrideReason.trim()}
              >
                {overrideExecuting ? "Applying..." : "Apply & Recalculate"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
