"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

interface ProspectClient {
  id: string;
  name: string;
  crNumber: string | null;
}

interface OpportunityCase {
  id: string;
  title: string;
  lifecycle: string;
  operationType: string | null;
  prospectClient: ProspectClient | null;
}

interface ProspectiveSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  approximateArea: number | null;
}

interface SurveyResponse {
  id?: string;
  elementCode: string;
  textValue?: string | null;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  jsonValue?: any;
  notes?: string | null;
}

interface SiteCondition {
  id?: string;
  definitionCode: string;
  definitionVersion?: number;
  valueJson?: any;
  assessedSeverity: "HIGH" | "MEDIUM" | "LOW";
  notes?: string | null;
  clientResponsibility: boolean;
  ahhResponsibility: boolean;
  operationalImpactClass?: string | null;
  costImpactClass?: string | null;
}

interface WorkflowHistoryItem {
  id: string;
  levelNumber: number;
  action: string;
  actedBy: string;
  remarks: string | null;
  createdAt: string;
}

interface WorkflowInstance {
  id: string;
  status: string;
  currentLevelNumber: number;
  history: WorkflowHistoryItem[];
}

interface PreContractSurvey {
  id: string;
  companyId: string | null;
  operationType: string | null;
  caseId: string;
  case: OpportunityCase;
  prospectiveSiteId: string | null;
  prospectiveSite: ProspectiveSite | null;
  lifecycle: "DRAFT" | "IN_WORKFLOW" | "COMPLETED" | "CANCELLED";
  workflowInstanceId: string | null;
  conductedBy: string | null;
  conductedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responses?: SurveyResponse[];
  siteConditions?: SiteCondition[];
}

export default function SiteSurveysPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [surveys, setSurveys] = useState<PreContractSurvey[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("ALL");
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>("ALL");

  // Create Survey Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  const [siteAddress, setSiteAddress] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [approximateArea, setApproximateArea] = useState<string>("");
  const [conductedBy, setConductedBy] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Workspace Modal State
  const [selectedSurvey, setSelectedSurvey] = useState<PreContractSurvey | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"CONTEXT" | "FORM" | "CONDITIONS" | "EVIDENCE" | "WORKFLOW">("CONTEXT");
  const [surveyDetail, setSurveyDetail] = useState<any>(null);
  const [workflowDetail, setWorkflowDetail] = useState<WorkflowInstance | null>(null);
  const [editingResponses, setEditingResponses] = useState<Record<string, any>>({});
  const [editingConditions, setEditingConditions] = useState<SiteCondition[]>([]);
  const [savingWorkspace, setSavingWorkspace] = useState<boolean>(false);

  // Workflow Action Modal State
  const [showWorkflowModal, setShowWorkflowModal] = useState<boolean>(false);
  const [workflowAction, setWorkflowAction] = useState<"SUBMIT" | "APPROVE" | "REJECT" | "RETURN">("SUBMIT");
  const [workflowRemarks, setWorkflowRemarks] = useState<string>("");
  const [workflowExecuting, setWorkflowExecuting] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (lifecycleFilter && lifecycleFilter !== "ALL") params.set("lifecycle", lifecycleFilter);
      if (operationTypeFilter && operationTypeFilter !== "ALL") params.set("operationType", operationTypeFilter);

      const [resSurveys, resOpps] = await Promise.all([
        fetch(`/api/v1/commercial/surveys?${params.toString()}`),
        fetch(`/api/v1/commercial/opportunities`)
      ]);

      if (!resSurveys.ok) throw new Error("Failed to fetch commercial site surveys");
      const dataSurveys = await resSurveys.json();
      setSurveys(dataSurveys.surveys || []);

      if (resOpps.ok) {
        const dataOpps = await resOpps.json();
        // Filter eligible opportunities (active: DRAFT, IN_WORKFLOW, COMPLETED)
        const eligible = (dataOpps.cases || []).filter(
          (c: OpportunityCase) => c.lifecycle !== "CANCELLED" && c.lifecycle !== "SUPERSEDED"
        );
        setOpportunities(eligible);
      }
    } catch (err: any) {
      setError(err.message || "Error loading commercial site surveys");
    } finally {
      setLoading(false);
    }
  }, [search, lifecycleFilter, operationTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Workspace Drawer
  const openWorkspace = async (srv: PreContractSurvey) => {
    setSelectedSurvey(srv);
    setWorkspaceTab("CONTEXT");
    try {
      const res = await fetch(`/api/v1/commercial/surveys/${srv.id}`);
      if (res.ok) {
        const data = await res.json();
        setSurveyDetail(data.survey);
        setWorkflowDetail(data.workflowInstance);

        // Pre-fill response states
        const respMap: Record<string, any> = {};
        if (data.survey?.responses) {
          data.survey.responses.forEach((r: SurveyResponse) => {
            respMap[r.elementCode] = r.textValue || r.numericValue || r.booleanValue || r.jsonValue || "";
          });
        }
        setEditingResponses(respMap);
        setEditingConditions(data.survey?.siteConditions || []);
      }
    } catch (e) {
      console.error("Error loading survey workspace:", e);
    }
  };

  // Handle Create Survey Submission
  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) {
      alert("Please select an eligible opportunity case.");
      return;
    }
    setSubmitting(true);
    try {
      const selectedOpp = opportunities.find((o) => o.id === selectedCaseId);
      const res = await fetch(`/api/v1/commercial/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCaseId,
          siteName: siteName.trim() || undefined,
          siteAddress: siteAddress.trim() || undefined,
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          approximateArea: approximateArea || undefined,
          operationType: selectedOpp?.operationType || "SECURITY_GUARDING",
          conductedBy: conductedBy.trim() || user?.name || "SURVEYOR"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create site survey");

      setShowCreateModal(false);
      setSelectedCaseId("");
      setSiteName("");
      setSiteAddress("");
      setLatitude("");
      setLongitude("");
      setApproximateArea("");
      setConductedBy("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Save Workspace Changes
  const handleSaveWorkspace = async () => {
    if (!selectedSurvey) return;
    setSavingWorkspace(true);
    try {
      const formattedResponses = Object.entries(editingResponses).map(([elementCode, val]) => {
        const isNum = typeof val === "number" || (!isNaN(val) && val !== "" && typeof val === "string" && !isNaN(Number(val)));
        return {
          elementCode,
          ...(typeof val === "boolean" ? { booleanValue: val } : isNum ? { numericValue: Number(val) } : { textValue: String(val) })
        };
      });

      const res = await fetch(`/api/v1/commercial/surveys/${selectedSurvey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: formattedResponses,
          siteConditions: editingConditions
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save survey changes");

      alert("Site survey updated successfully.");
      openWorkspace(selectedSurvey);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingWorkspace(false);
    }
  };

  // Add Site Condition row
  const addConditionRow = () => {
    setEditingConditions([
      ...editingConditions,
      {
        definitionCode: `COND_DEF_${editingConditions.length + 1}`,
        assessedSeverity: "MEDIUM",
        notes: "",
        clientResponsibility: false,
        ahhResponsibility: true,
        operationalImpactClass: "MODERATE",
        costImpactClass: "STANDARD"
      }
    ]);
  };

  // Execute Workflow Action
  const handleExecuteWorkflow = async () => {
    if (!selectedSurvey) return;
    setWorkflowExecuting(true);
    try {
      const res = await fetch(`/api/v1/commercial/surveys/${selectedSurvey.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: workflowAction,
          remarks: workflowRemarks.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Workflow action failed");

      alert(`Workflow action ${workflowAction} completed successfully.`);
      setShowWorkflowModal(false);
      setWorkflowRemarks("");
      openWorkspace(selectedSurvey);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setWorkflowExecuting(false);
    }
  };

  // Badges Helper
  const getLifecycleBadge = (lifecycle: string) => {
    switch (lifecycle) {
      case "DRAFT":
        return <Badge variant="neutral">DRAFT</Badge>;
      case "IN_WORKFLOW":
        return <Badge variant="warning">IN WORKFLOW</Badge>;
      case "COMPLETED":
      case "APPROVED":
        return <Badge variant="success">APPROVED</Badge>;
      case "CANCELLED":
        return <Badge variant="error">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{lifecycle}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">explore</span>
            <h1 className="text-xl font-bold text-on-surface">Pre-Contract Site Surveys & Audits</h1>
            <Badge variant="secondary">Milestone CL-2</Badge>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Conduct physical site assessments, record risk conditions, and capture operational requirements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            New Site Survey
          </Button>

          <Link href="/settings/workflow-setup">
            <Button variant="ghost" size="sm" className="inline-flex items-center gap-1 text-xs">
              <span className="material-symbols-outlined text-[16px]">settings_suggest</span>
              Workflow Setup
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-status-error/10 border-status-error text-status-error text-xs">
          {error}
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border-l-4 border-l-secondary bg-surface-container-low">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Total Surveys</span>
          <div className="text-xl font-extrabold text-on-surface">{surveys.length}</div>
        </Card>

        <Card className="p-3 border-l-4 border-l-outline bg-surface-container-low">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Drafts</span>
          <div className="text-xl font-extrabold text-on-surface">
            {surveys.filter((s) => s.lifecycle === "DRAFT").length}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-status-warning bg-surface-container-low">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">In Workflow</span>
          <div className="text-xl font-extrabold text-status-warning">
            {surveys.filter((s) => s.lifecycle === "IN_WORKFLOW").length}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-status-success bg-surface-container-low">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Approved</span>
          <div className="text-xl font-extrabold text-status-success">
            {surveys.filter((s) => s.lifecycle === "COMPLETED").length}
          </div>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card className="p-4 bg-surface-container-low space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Search Surveys</label>
            <Input
              type="text"
              placeholder="Search by deal title, client, or site..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Operation Scope</label>
            <select
              value={operationTypeFilter}
              onChange={(e) => setOperationTypeFilter(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
            >
              <option value="ALL">All Operation Scopes</option>
              <option value="SECURITY_GUARDING">Security Guarding</option>
              <option value="FACILITY_MANAGEMENT">Facility Management</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Lifecycle Status</label>
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_WORKFLOW">In Workflow</option>
              <option value="COMPLETED">Approved</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Survey Register Table */}
      <Card className="p-0 overflow-hidden bg-surface-container-low">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant font-bold">
                <th className="py-2.5 px-3">Survey Ref / Site</th>
                <th className="py-2.5 px-3">Opportunity & Client</th>
                <th className="py-2.5 px-3">Scope</th>
                <th className="py-2.5 px-3">Surveyor</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Conducted Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-on-surface-variant">Loading site surveys...</td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-on-surface-variant">No commercial site surveys found.</td>
                </tr>
              ) : (
                surveys.map((srv) => (
                  <tr key={srv.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-on-surface">{srv.prospectiveSite?.name || `Survey ${srv.id.substring(0, 8)}`}</div>
                      <div className="text-[10px] text-on-surface-variant">{srv.prospectiveSite?.address || "Address pending"}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-on-surface">{srv.case?.title}</div>
                      <div className="text-[10px] text-on-surface-variant">{srv.case?.prospectClient?.name || "Existing Client"}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary">{srv.operationType || "SECURITY_GUARDING"}</Badge>
                    </td>
                    <td className="py-2.5 px-3 font-medium">{srv.conductedBy || "SURVEYOR"}</td>
                    <td className="py-2.5 px-3">{getLifecycleBadge(srv.lifecycle)}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant">
                      {srv.conductedAt ? new Date(srv.conductedAt).toLocaleDateString() : new Date(srv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <Button variant="secondary" size="sm" onClick={() => openWorkspace(srv)} className="text-xs">
                        Workspace
                      </Button>

                      {srv.lifecycle === "DRAFT" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedSurvey(srv);
                            setWorkflowAction("SUBMIT");
                            setShowWorkflowModal(true);
                          }}
                          className="text-xs bg-secondary text-white"
                        >
                          Submit
                        </Button>
                      )}

                      {srv.lifecycle === "IN_WORKFLOW" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedSurvey(srv);
                            setWorkflowAction("APPROVE");
                            setShowWorkflowModal(true);
                          }}
                          className="text-xs bg-status-success text-white"
                        >
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Survey Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 bg-surface-container-low space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <h3 className="text-base font-bold text-on-surface">Initiate Pre-Contract Site Survey</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-on-surface-variant hover:text-on-surface text-lg">×</button>
            </div>

            <form onSubmit={handleCreateSurvey} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Eligible Commercial Opportunity *</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
                  required
                >
                  <option value="">Select Opportunity Deal Case...</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.title} ({opp.prospectClient?.name || "Client"}) - [{opp.lifecycle}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Prospective Site Name *</label>
                <Input
                  type="text"
                  placeholder="e.g. Katara Towers West Wing Post 1"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Site Address</label>
                <Input
                  type="text"
                  placeholder="Building/Street address in Lusail/Doha..."
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-1">Latitude</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="25.3548"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-1">Longitude</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="51.5310"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-1">Area (sqm)</label>
                  <Input
                    type="number"
                    placeholder="12500"
                    value={approximateArea}
                    onChange={(e) => setApproximateArea(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Assigned Surveyor</label>
                <Input
                  type="text"
                  placeholder="Surveyor name..."
                  value={conductedBy}
                  onChange={(e) => setConductedBy(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Survey"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Survey Workspace Drawer */}
      {selectedSurvey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end p-2 sm:p-4">
          <Card className="w-full max-w-4xl h-[92vh] overflow-hidden bg-surface-container-low flex flex-col p-0">
            {/* Drawer Header */}
            <div className="p-4 border-b border-outline-variant/40 flex items-center justify-between bg-surface-container-high">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-on-surface">
                    {selectedSurvey.prospectiveSite?.name || `Survey ${selectedSurvey.id.substring(0, 8)}`}
                  </h3>
                  {getLifecycleBadge(selectedSurvey.lifecycle)}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Deal: <span className="font-semibold text-on-surface">{selectedSurvey.case?.title}</span> ({selectedSurvey.operationType})
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedSurvey.lifecycle === "DRAFT" && (
                  <Button variant="primary" size="sm" onClick={handleSaveWorkspace} disabled={savingWorkspace} className="text-xs">
                    {savingWorkspace ? "Saving..." : "Save Workspace"}
                  </Button>
                )}
                <button onClick={() => setSelectedSurvey(null)} className="text-on-surface-variant hover:text-on-surface text-xl px-2">×</button>
              </div>
            </div>

            {/* Workspace Tabs Navigation */}
            <div className="flex border-b border-outline-variant/40 bg-surface-container px-4 text-xs font-bold gap-4">
              <button
                onClick={() => setWorkspaceTab("CONTEXT")}
                className={`py-2.5 border-b-2 transition-colors ${workspaceTab === "CONTEXT" ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant"}`}
              >
                1. Site Context
              </button>
              <button
                onClick={() => setWorkspaceTab("FORM")}
                className={`py-2.5 border-b-2 transition-colors ${workspaceTab === "FORM" ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant"}`}
              >
                2. Configured Survey Form
              </button>
              <button
                onClick={() => setWorkspaceTab("CONDITIONS")}
                className={`py-2.5 border-b-2 transition-colors ${workspaceTab === "CONDITIONS" ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant"}`}
              >
                3. Site Conditions ({editingConditions.length})
              </button>
              <button
                onClick={() => setWorkspaceTab("WORKFLOW")}
                className={`py-2.5 border-b-2 transition-colors ${workspaceTab === "WORKFLOW" ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant"}`}
              >
                4. Governance & Audit Log
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {workspaceTab === "CONTEXT" && (
                <div className="space-y-4 text-xs">
                  <Card className="p-4 bg-surface-container-lowest space-y-2">
                    <h4 className="font-bold text-on-surface text-sm border-b border-outline-variant pb-1">Prospective Site Details</h4>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div><span className="font-semibold text-on-surface-variant">Site Name:</span> {selectedSurvey.prospectiveSite?.name}</div>
                      <div><span className="font-semibold text-on-surface-variant">Address:</span> {selectedSurvey.prospectiveSite?.address || "N/A"}</div>
                      <div><span className="font-semibold text-on-surface-variant">GPS Latitude:</span> {selectedSurvey.prospectiveSite?.latitude ?? "N/A"}</div>
                      <div><span className="font-semibold text-on-surface-variant">GPS Longitude:</span> {selectedSurvey.prospectiveSite?.longitude ?? "N/A"}</div>
                      <div><span className="font-semibold text-on-surface-variant">Approximate Area:</span> {selectedSurvey.prospectiveSite?.approximateArea ? `${selectedSurvey.prospectiveSite.approximateArea} sqm` : "N/A"}</div>
                      <div><span className="font-semibold text-on-surface-variant">Operation Scope:</span> {selectedSurvey.operationType}</div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-surface-container-lowest space-y-2">
                    <h4 className="font-bold text-on-surface text-sm border-b border-outline-variant pb-1">Opportunity & Client Identity</h4>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div><span className="font-semibold text-on-surface-variant">Opportunity Title:</span> {selectedSurvey.case?.title}</div>
                      <div><span className="font-semibold text-on-surface-variant">Prospect Client:</span> {selectedSurvey.case?.prospectClient?.name || "Existing Client"}</div>
                      <div><span className="font-semibold text-on-surface-variant">Client CR Number:</span> {selectedSurvey.case?.prospectClient?.crNumber || "N/A"}</div>
                      <div><span className="font-semibold text-on-surface-variant">Assigned Surveyor:</span> {selectedSurvey.conductedBy || "SURVEYOR"}</div>
                    </div>
                  </Card>
                </div>
              )}

              {workspaceTab === "FORM" && (
                <div className="space-y-4 text-xs">
                  <Card className="p-4 bg-surface-container-lowest space-y-4">
                    <h4 className="font-bold text-on-surface text-sm border-b border-outline-variant pb-1">
                      Structured Survey Observations ({selectedSurvey.operationType})
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="block font-bold text-on-surface-variant mb-1">Required Guard / Operator Posts</label>
                        <Input
                          type="number"
                          value={editingResponses["ELEM_POST_COUNT"] || ""}
                          onChange={(e) => setEditingResponses({ ...editingResponses, ELEM_POST_COUNT: e.target.value })}
                          disabled={selectedSurvey.lifecycle === "COMPLETED"}
                          className="text-xs"
                          placeholder="e.g., 6 continuous 24/7 posts"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-on-surface-variant mb-1">Shift Coverage Pattern</label>
                        <Input
                          type="text"
                          value={editingResponses["ELEM_SHIFT_PATTERN"] || ""}
                          onChange={(e) => setEditingResponses({ ...editingResponses, ELEM_SHIFT_PATTERN: e.target.value })}
                          disabled={selectedSurvey.lifecycle === "COMPLETED"}
                          className="text-xs"
                          placeholder="e.g., 2 shifts x 12 hours"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-on-surface-variant mb-1">Welfare & PPE Requirements</label>
                        <Input
                          type="text"
                          value={editingResponses["ELEM_UNIFORM_PPE"] || ""}
                          onChange={(e) => setEditingResponses({ ...editingResponses, ELEM_UNIFORM_PPE: e.target.value })}
                          disabled={selectedSurvey.lifecycle === "COMPLETED"}
                          className="text-xs"
                          placeholder="Steel toe boots, high-vis vest, client safety badge"
                        />
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {workspaceTab === "CONDITIONS" && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-on-surface text-sm">Site Risk & Condition Register</h4>
                    {selectedSurvey.lifecycle === "DRAFT" && (
                      <Button variant="secondary" size="sm" onClick={addConditionRow} className="text-xs">
                        + Add Risk Condition
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {editingConditions.length === 0 ? (
                      <Card className="p-4 text-center text-on-surface-variant">No site risk conditions logged yet.</Card>
                    ) : (
                      editingConditions.map((cond, idx) => (
                        <Card key={idx} className="p-3 bg-surface-container-lowest space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant">Definition Code</label>
                              <Input
                                type="text"
                                value={cond.definitionCode}
                                onChange={(e) => {
                                  const copy = [...editingConditions];
                                  copy[idx].definitionCode = e.target.value;
                                  setEditingConditions(copy);
                                }}
                                disabled={selectedSurvey.lifecycle === "COMPLETED"}
                                className="text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant">Severity</label>
                              <select
                                value={cond.assessedSeverity}
                                onChange={(e) => {
                                  const copy = [...editingConditions];
                                  copy[idx].assessedSeverity = e.target.value as any;
                                  setEditingConditions(copy);
                                }}
                                disabled={selectedSurvey.lifecycle === "COMPLETED"}
                                className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-xs"
                              >
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HIGH">HIGH</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-2 pt-3">
                              <input
                                type="checkbox"
                                checked={cond.clientResponsibility}
                                onChange={(e) => {
                                  const copy = [...editingConditions];
                                  copy[idx].clientResponsibility = e.target.checked;
                                  setEditingConditions(copy);
                                }}
                                disabled={selectedSurvey.lifecycle === "COMPLETED"}
                              />
                              <span className="text-[11px]">Client Responsible</span>
                            </div>

                            <div className="flex items-center gap-2 pt-3">
                              <input
                                type="checkbox"
                                checked={cond.ahhResponsibility}
                                onChange={(e) => {
                                  const copy = [...editingConditions];
                                  copy[idx].ahhResponsibility = e.target.checked;
                                  setEditingConditions(copy);
                                }}
                                disabled={selectedSurvey.lifecycle === "COMPLETED"}
                              />
                              <span className="text-[11px]">AHH Responsible</span>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}

              {workspaceTab === "WORKFLOW" && (
                <div className="space-y-4 text-xs">
                  <Card className="p-4 bg-surface-container-lowest space-y-2">
                    <h4 className="font-bold text-on-surface text-sm border-b border-outline-variant pb-1">Governance Approval Status</h4>
                    <div className="flex items-center justify-between pt-1">
                      <div>Current Workflow Stage: <span className="font-bold text-on-surface">{workflowDetail?.status || "NOT_STARTED"}</span></div>
                      <div>Active Level: <span className="font-bold text-on-surface">{workflowDetail?.currentLevelNumber || 1}</span></div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-surface-container-lowest space-y-2">
                    <h4 className="font-bold text-on-surface text-sm border-b border-outline-variant pb-1">Immutable Audit Trail Log</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-outline-variant font-bold">
                            <th className="py-1.5 px-2">Level</th>
                            <th className="py-1.5 px-2">Action</th>
                            <th className="py-1.5 px-2">Acted By</th>
                            <th className="py-1.5 px-2">Remarks</th>
                            <th className="py-1.5 px-2">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/30">
                          {workflowDetail?.history?.length === 0 ? (
                            <tr><td colSpan={5} className="py-4 text-center text-on-surface-variant">No workflow actions recorded yet.</td></tr>
                          ) : (
                            workflowDetail?.history?.map((h) => (
                              <tr key={h.id}>
                                <td className="py-1.5 px-2 font-bold">Level {h.levelNumber}</td>
                                <td className="py-1.5 px-2 font-semibold">{h.action}</td>
                                <td className="py-1.5 px-2">{h.actedBy}</td>
                                <td className="py-1.5 px-2">{h.remarks || "—"}</td>
                                <td className="py-1.5 px-2 text-on-surface-variant">{new Date(h.createdAt).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Workflow Action Modal */}
      {showWorkflowModal && selectedSurvey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-surface-container-low space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <h3 className="text-base font-bold text-on-surface">Survey Governance Workflow</h3>
              <button onClick={() => setShowWorkflowModal(false)} className="text-on-surface-variant hover:text-on-surface text-lg">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Action</label>
                <select
                  value={workflowAction}
                  onChange={(e) => setWorkflowAction(e.target.value as any)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface"
                >
                  <option value="SUBMIT">Submit for Approval</option>
                  <option value="APPROVE">Approve</option>
                  <option value="RETURN">Return for Clarification</option>
                  <option value="REJECT">Reject Survey</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Remarks / Audit Notes</label>
                <textarea
                  rows={3}
                  value={workflowRemarks}
                  onChange={(e) => setWorkflowRemarks(e.target.value)}
                  placeholder="Enter approval audit comments..."
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-xs text-on-surface focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/40">
                <Button variant="ghost" size="sm" onClick={() => setShowWorkflowModal(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleExecuteWorkflow} disabled={workflowExecuting}>
                  {workflowExecuting ? "Executing..." : "Confirm Action"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
