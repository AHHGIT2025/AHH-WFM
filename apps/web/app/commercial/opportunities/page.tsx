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
  companyId: string | null;
  operationType: string | null;
  businessOutcome: string | null;
  lifecycle: "DRAFT" | "IN_WORKFLOW" | "COMPLETED" | "CANCELLED";
  prospectClientId: string | null;
  prospectClient: ProspectClient | null;
  createdBy: string;
  createdAt: string;
  surveys: Array<{ id: string; lifecycle: string }>;
}

export default function OpportunitiesPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [cases, setCases] = useState<OpportunityCase[]>([]);
  const [prospects, setProspects] = useState<ProspectClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & View State
  const [search, setSearch] = useState<string>("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"KANBAN" | "TABLE">("KANBAN");

  // Create Opportunity Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [operationType, setOperationType] = useState<string>("SECURITY_GUARDING");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Workflow Action Modal State
  const [selectedCase, setSelectedCase] = useState<OpportunityCase | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState<boolean>(false);
  const [workflowAction, setWorkflowAction] = useState<"SUBMIT" | "APPROVE" | "REJECT" | "RETURN">("SUBMIT");
  const [workflowRemarks, setWorkflowRemarks] = useState<string>("");
  const [workflowExecuting, setWorkflowExecuting] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch cases
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (lifecycleFilter && lifecycleFilter !== "ALL") params.set("lifecycle", lifecycleFilter);

      const [resCases, resProspects] = await Promise.all([
        fetch(`/api/v1/commercial/opportunities?${params.toString()}`),
        fetch(`/api/v1/commercial/crm`)
      ]);

      if (!resCases.ok) throw new Error("Failed to fetch commercial deal opportunities");

      const dataCases = await resCases.json();
      setCases(dataCases.cases || []);

      if (resProspects.ok) {
        const dataProspects = await resProspects.json();
        setProspects(dataProspects.prospects || []);
      }
    } catch (err: any) {
      setError(err.message || "Error loading commercial deal opportunities");
    } finally {
      setLoading(false);
    }
  }, [search, lifecycleFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/commercial/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          prospectClientId: selectedProspectId || null,
          operationType
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create opportunity");
      }

      setNewTitle("");
      setSelectedProspectId("");
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    setWorkflowExecuting(true);
    try {
      const res = await fetch(`/api/v1/commercial/opportunities/${selectedCase.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: workflowAction,
          remarks: workflowRemarks
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to execute workflow action");
      }

      setShowWorkflowModal(false);
      setSelectedCase(null);
      setWorkflowRemarks("");
      fetchData();
    } catch (err: any) {
      alert(`Workflow Error: ${err.message}`);
    } finally {
      setWorkflowExecuting(false);
    }
  };

  const openWorkflowModal = (c: OpportunityCase, action: "SUBMIT" | "APPROVE" | "REJECT" | "RETURN") => {
    setSelectedCase(c);
    setWorkflowAction(action);
    setWorkflowRemarks("");
    setShowWorkflowModal(true);
  };

  const getLifecycleBadge = (lifecycle: string) => {
    switch (lifecycle) {
      case "DRAFT":
        return <Badge variant="neutral" className="bg-surface-container-high text-on-surface-variant">DRAFT</Badge>;
      case "IN_WORKFLOW":
        return <Badge variant="warning" className="bg-status-warning/10 text-status-warning border-status-warning/30 font-bold">IN WORKFLOW</Badge>;
      case "COMPLETED":
        return <Badge variant="success" className="bg-status-success/10 text-status-success border-status-success/30 font-bold">COMPLETED (WON)</Badge>;
      case "CANCELLED":
        return <Badge variant="error" className="bg-status-error/10 text-status-error border-status-error/30">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{lifecycle}</Badge>;
    }
  };

  const pipelineStages: Array<{ key: "DRAFT" | "IN_WORKFLOW" | "COMPLETED" | "CANCELLED"; label: string; color: string }> = [
    { key: "DRAFT", label: "Intake & Draft Deals", color: "border-on-surface-variant/30 text-on-surface-variant" },
    { key: "IN_WORKFLOW", label: "Workflow Approval", color: "border-status-warning text-status-warning" },
    { key: "COMPLETED", label: "Won / Approved", color: "border-status-success text-status-success" },
    { key: "CANCELLED", label: "Closed / Lost", color: "border-status-error text-status-error" }
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/commercial/dashboard" className="hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">space_dashboard</span>
              Commercial Workspace
            </Link>
            <span>/</span>
            <span className="text-on-surface font-semibold">Opportunities</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">lightbulb</span>
              Commercial Deal Opportunities & Pipeline
            </h1>
            <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/30">
              Milestone CL-1
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface-container-high rounded-lg p-0.5 border border-outline-variant">
            <button
              onClick={() => setViewMode("KANBAN")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "KANBAN" ? "bg-surface-container-lowest text-secondary shadow-sm" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              Kanban
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "TABLE" ? "bg-surface-container-lowest text-secondary shadow-sm" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">table_chart</span>
              Table
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            New Commercial Deal
          </Button>

          <Link href="/commercial/surveys">
            <Button variant="ghost" size="sm" className="inline-flex items-center gap-1 text-xs">
              <span>Site Surveys</span>
              <span className="material-symbols-outlined text-[16px]">assignment</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-secondary bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total Pipeline Deals</span>
          <div className="text-2xl font-extrabold text-on-surface">{cases.length}</div>
          <p className="text-[11px] text-on-surface-variant">Active commercial opportunities</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-status-warning bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">In Workflow</span>
          <div className="text-2xl font-extrabold text-status-warning">
            {cases.filter((c) => c.lifecycle === "IN_WORKFLOW").length}
          </div>
          <p className="text-[11px] text-on-surface-variant">Under governance approval</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-status-success bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Approved / Won</span>
          <div className="text-2xl font-extrabold text-status-success">
            {cases.filter((c) => c.lifecycle === "COMPLETED").length}
          </div>
          <p className="text-[11px] text-on-surface-variant">Ready for Site Survey & Costing</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-status-error bg-surface-container-low space-y-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Closed / Lost</span>
          <div className="text-2xl font-extrabold text-status-error">
            {cases.filter((c) => c.lifecycle === "CANCELLED").length}
          </div>
          <p className="text-[11px] text-on-surface-variant">Cancelled deal opportunities</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-surface-container-low p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Search Deals</label>
            <Input
              type="text"
              placeholder="Search by deal title or client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Lifecycle Stage</label>
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
            >
              <option value="ALL">All Pipeline Stages</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_WORKFLOW">In Workflow</option>
              <option value="COMPLETED">Completed (Won)</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="bg-status-error/10 border border-status-error/30 p-3 text-xs text-status-error">
          {error}
        </Card>
      )}

      {/* Mode 1: Interactive Kanban Board */}
      {viewMode === "KANBAN" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {pipelineStages.map((stage) => {
            const stageCases = cases.filter((c) => c.lifecycle === stage.key);

            return (
              <div key={stage.key} className="space-y-3">
                <div className={`p-3 rounded-lg border-l-4 bg-surface-container-low flex items-center justify-between ${stage.color}`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{stage.label}</span>
                  <Badge variant="secondary" className="bg-surface-container-high text-on-surface font-extrabold">
                    {stageCases.length}
                  </Badge>
                </div>

                <div className="space-y-3 min-h-[400px]">
                  {stageCases.length === 0 ? (
                    <Card className="p-4 text-center bg-surface-container-low text-on-surface-variant text-xs italic">
                      No deals in this stage.
                    </Card>
                  ) : (
                    stageCases.map((c) => (
                      <Card key={c.id} className="p-4 bg-surface-container-low hover:border-secondary transition-colors space-y-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-on-surface">{c.title}</h4>
                          {getLifecycleBadge(c.lifecycle)}
                        </div>

                        <div className="text-[11px] text-on-surface-variant space-y-1">
                          <div><span className="font-semibold text-on-surface">Client:</span> {c.prospectClient?.name || "Existing Client"}</div>
                          <div><span className="font-semibold text-on-surface">Scope:</span> {c.operationType || "SECURITY_GUARDING"}</div>
                          <div><span className="font-semibold text-on-surface">Created By:</span> {c.createdBy}</div>
                        </div>

                        {/* Stage Actions */}
                        <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between gap-1 text-xs">
                          {c.lifecycle === "DRAFT" && (
                            <Button variant="secondary" size="sm" onClick={() => openWorkflowModal(c, "SUBMIT")} className="w-full text-xs bg-secondary text-white">
                              Submit to Workflow
                            </Button>
                          )}

                          {c.lifecycle === "IN_WORKFLOW" && (
                            <div className="grid grid-cols-2 gap-1 w-full">
                              <Button variant="secondary" size="sm" onClick={() => openWorkflowModal(c, "APPROVE")} className="text-[11px] bg-status-success text-white">
                                Approve
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => openWorkflowModal(c, "REJECT")} className="text-[11px] bg-status-error text-white">
                                Reject
                              </Button>
                            </div>
                          )}

                          {c.lifecycle === "COMPLETED" && (
                            <Link href="/settings/commercial-contract/cost-configuration" className="w-full">
                              <Button variant="ghost" size="sm" className="w-full text-secondary hover:underline text-xs inline-flex items-center justify-center gap-1">
                                <span>Proceed to Costing</span>
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                              </Button>
                            </Link>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 2: Table View */}
      {viewMode === "TABLE" && (
        <Card className="p-0 overflow-hidden bg-surface-container-low">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant border-b border-outline-variant font-bold">
                  <th className="py-2.5 px-3">Opportunity Title</th>
                  <th className="py-2.5 px-3">Prospect Client</th>
                  <th className="py-2.5 px-3">Operation Scope</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Created By</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-on-surface-variant">No commercial deal opportunities found.</td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-on-surface">{c.title}</td>
                      <td className="py-2.5 px-3 font-medium">{c.prospectClient?.name || "Existing Client"}</td>
                      <td className="py-2.5 px-3">{c.operationType || "SECURITY_GUARDING"}</td>
                      <td className="py-2.5 px-3">{getLifecycleBadge(c.lifecycle)}</td>
                      <td className="py-2.5 px-3">{c.createdBy}</td>
                      <td className="py-2.5 px-3 text-right">
                        {c.lifecycle === "DRAFT" && (
                          <Button variant="secondary" size="sm" onClick={() => openWorkflowModal(c, "SUBMIT")} className="text-xs bg-secondary text-white">
                            Submit Workflow
                          </Button>
                        )}
                        {c.lifecycle === "IN_WORKFLOW" && (
                          <Button variant="secondary" size="sm" onClick={() => openWorkflowModal(c, "APPROVE")} className="text-xs bg-status-success text-white">
                            Review & Approve
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
      )}

      {/* New Opportunity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-surface-container-lowest p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">add_circle</span>
                New Commercial Opportunity Deal
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Deal Title *</label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Lusail Marina Soft Services & Security 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Select Prospective Client</label>
                <select
                  value={selectedProspectId}
                  onChange={(e) => setSelectedProspectId(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
                >
                  <option value="">-- Direct Intake (No Prospect Linked) --</option>
                  {prospects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.crNumber ? `(${p.crNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Operation Scope</label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
                >
                  <option value="SECURITY_GUARDING">Security Guarding</option>
                  <option value="FACILITY_MANAGEMENT">Facility Management</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Deal Opportunity"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Workflow Action Modal */}
      {showWorkflowModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-surface-container-lowest p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">flowsheet</span>
                Execute Workflow Action: {workflowAction}
              </h3>
              <button onClick={() => setShowWorkflowModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div><span className="font-semibold">Deal Title:</span> {selectedCase.title}</div>
              <div><span className="font-semibold">Current Stage:</span> {selectedCase.lifecycle}</div>
            </div>

            <form onSubmit={handleExecuteWorkflow} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1">Approval / Escalate Remarks</label>
                <Input
                  type="text"
                  placeholder="Enter evaluation remarks or justification..."
                  value={workflowRemarks}
                  onChange={(e) => setWorkflowRemarks(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowWorkflowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={workflowExecuting}>
                  {workflowExecuting ? "Processing..." : `Confirm ${workflowAction}`}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
