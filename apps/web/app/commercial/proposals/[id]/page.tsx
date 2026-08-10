"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<any>(null);
  const [dto, setDto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"commercial" | "scope" | "assumptions" | "terms" | "workflow">("commercial");

  // Form Editing State
  const [proposalCode, setProposalCode] = useState("");
  const [title, setTitle] = useState("");
  const [validityDays, setValidityDays] = useState<string>("");
  const [scopeSummary, setScopeSummary] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Workflow Action State
  const [workflowAction, setWorkflowAction] = useState("");
  const [workflowRemarks, setWorkflowRemarks] = useState("");
  const [executingWorkflow, setExecutingWorkflow] = useState(false);

  // Issuance Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("MANUAL");
  const [issuing, setIssuing] = useState(false);

  // Preview / Print Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Client Response Modal State
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseType, setResponseType] = useState<"ACCEPTED" | "REJECTED" | "CHANGE_REQUESTED">("ACCEPTED");
  const [clientContactName, setClientContactName] = useState("");
  const [clientReference, setClientReference] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [recordingResponse, setRecordingResponse] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  const fetchProposal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}`);
      if (res.ok) {
        const data = await res.json();
        setProposal(data.proposal);
        setDto(data.dto);

        const ver = data.proposal.versions[0] || {};
        setProposalCode(data.proposal.proposalCode || "");
        setTitle(ver.title || "");
        setValidityDays(ver.validityDays !== null && ver.validityDays !== undefined ? String(ver.validityDays) : "");
        setScopeSummary(ver.scopeSummary || "");
        setAssumptions(ver.assumptions || "");
        setExclusions(ver.exclusions || "");
        setTermsAndConditions(ver.termsAndConditions || "");
      }
    } catch (err) {
      console.error("Failed to fetch proposal details", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalCode: proposalCode || undefined,
          title: title || undefined,
          validityDays: validityDays ? Number(validityDays) : null,
          scopeSummary,
          assumptions,
          exclusions,
          termsAndConditions
        })
      });

      if (res.ok) {
        setMsg({ type: "success", text: "Proposal draft saved successfully." });
        fetchProposal();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to save proposal draft." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteWorkflow = async (action: string) => {
    setExecutingWorkflow(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          remarks: workflowRemarks
        })
      });

      if (res.ok) {
        setMsg({ type: "success", text: `Workflow action ${action} executed successfully.` });
        setWorkflowRemarks("");
        fetchProposal();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || `Failed to execute ${action}.` });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Workflow error." });
    } finally {
      setExecutingWorkflow(false);
    }
  };

  const handleCreateRevision = async () => {
    if (!confirm("Create a new proposal revision? The current approved version will remain intact.")) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (res.ok) {
        setMsg({ type: "success", text: "New proposal revision created successfully." });
        fetchProposal();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to create revision." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Revision creation error." });
    } finally {
      setSaving(false);
    }
  };

  const handleIssueToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          recipientEmail,
          deliveryMethod
        })
      });

      if (res.ok) {
        setShowIssueModal(false);
        setMsg({ type: "success", text: "Proposal successfully issued to client!" });
        fetchProposal();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to issue proposal." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Issuance error." });
    } finally {
      setIssuing(false);
    }
  };

  const handleRecordResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordingResponse(true);
    setMsg(null);
    try {
      const ver = proposal?.versions[0];
      const res = await fetch(`/api/v1/commercial/proposals/${proposalId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalVersionId: ver?.id,
          responseType,
          clientContactName,
          clientReference,
          notes: responseNotes,
          snapshotChecksum: ver?.snapshotChecksum
        })
      });

      if (res.ok) {
        setShowResponseModal(false);
        setMsg({ type: "success", text: `Client response (${responseType}) recorded successfully!` });
        fetchProposal();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to record client response." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "An error occurred while recording client response." });
    } finally {
      setRecordingResponse(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading proposal editor...</div>;
  }

  if (!proposal) {
    return <div className="p-12 text-center text-slate-500">Proposal not found.</div>;
  }

  const ver = proposal.versions[0] || {};
  const isEditable = ver.status === "DRAFT";
  const isApproved = ver.status === "APPROVED_INTERNAL";
  const isIssued = ver.status === "ISSUED_TO_CLIENT";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Link href="/commercial/quotations" className="hover:text-blue-600">
          Proposals
        </Link>
        <span>/</span>
        <span className="text-slate-900">{proposal.proposalCode || proposal.id.slice(0, 8)}</span>
      </div>

      {/* Header Summary */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{ver.title}</h1>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-semibold rounded-full border border-slate-300">
                v{ver.versionNumber}.0
              </span>
              {dto?.isExpired && (
                <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full border border-red-200">
                  EXPIRED
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Client: <span className="font-semibold text-slate-700">{proposal.case?.prospectClient?.name || "N/A"}</span> | Opportunity:{" "}
              <span className="font-semibold text-slate-700">{proposal.case?.title || "N/A"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              <span className="material-icons-outlined text-lg mr-1.5">visibility</span>
              Client Preview & Print
            </button>

            {isApproved && (
              <button
                onClick={() => setShowIssueModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <span className="material-icons-outlined text-lg mr-1.5">send</span>
                Issue to Client
              </button>
            )}

            {isIssued && (
              <>
                <button
                  onClick={() => setShowResponseModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <span className="material-icons-outlined text-lg mr-1.5">rate_review</span>
                  Record Client Response
                </button>

                <Link
                  href={`/commercial/contract-conversion/${proposalId}`}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  <span className="material-icons-outlined text-lg mr-1.5">gavel</span>
                  Convert to Contract
                </Link>
              </>
            )}

            {(isApproved || isIssued) && (
              <button
                onClick={handleCreateRevision}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <span className="material-icons-outlined text-lg mr-1.5">content_copy</span>
                Create Revision
              </button>
            )}
          </div>
        </div>

        {/* Commercial Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Selling Price</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {ver.currency} {Number(ver.sellingPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Costing Baseline</div>
            <div className="text-xs font-mono text-slate-700 mt-1">
              v{ver.costEstimateVersion?.versionNumber || 1} ({ver.costEstimateChecksum ? ver.costEstimateChecksum.slice(0, 8) : "Verified"})
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Proposal Status</div>
            <div className="text-sm font-semibold text-blue-700 mt-0.5">{ver.status}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Valid Until</div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">
              {ver.validUntil ? new Date(ver.validUntil).toLocaleDateString() : "Not specified"}
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium ${
            msg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Main Tabs Header */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("commercial")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "commercial" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          1. Commercial Offer
        </button>
        <button
          onClick={() => setActiveTab("scope")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "scope" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          2. Scope of Work
        </button>
        <button
          onClick={() => setActiveTab("assumptions")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "assumptions" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          3. Assumptions & Exclusions
        </button>
        <button
          onClick={() => setActiveTab("terms")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "terms" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          4. Terms & Conditions
        </button>
        <button
          onClick={() => setActiveTab("workflow")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "workflow" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          5. Internal Workflow
        </button>
      </div>

      {/* Tab Contents */}
      <form onSubmit={handleSaveDraft} className="space-y-6">
        {activeTab === "commercial" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Commercial Offer Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Proposal Code / Display Reference
                </label>
                <input
                  type="text"
                  value={proposalCode}
                  onChange={(e) => setProposalCode(e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. PROP-2026-001"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Proposal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Validity Period (Days)
                </label>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. 30"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Approved Selling Price (Read-Only CL-3 Authority)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${ver.currency} ${Number(ver.sellingPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "scope" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Scope of Work Narrative</h2>
            <div>
              <textarea
                rows={8}
                value={scopeSummary}
                onChange={(e) => setScopeSummary(e.target.value)}
                disabled={!isEditable}
                placeholder="Enter client-facing service scope, post coverage details, shift schedules, and operational conditions..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {activeTab === "assumptions" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Client-Facing Assumptions & Exclusions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Client-Facing Assumptions
                </label>
                <textarea
                  rows={8}
                  value={assumptions}
                  onChange={(e) => setAssumptions(e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Client will provide secure site access, duty room, and power facilities..."
                  className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Explicit Exclusions
                </label>
                <textarea
                  rows={8}
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Third-party utility bills, specialized heavy machinery not listed..."
                  className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Commercial Terms & Conditions</h2>
            <div>
              <textarea
                rows={8}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                disabled={!isEditable}
                placeholder="Enter payment terms, mobilization period, commencement conditions, force majeure, and termination notice..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {activeTab === "workflow" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Internal Approval Workflow Console</h2>

            {/* Action Bar */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Workflow Action Remarks</label>
              <input
                type="text"
                value={workflowRemarks}
                onChange={(e) => setWorkflowRemarks(e.target.value)}
                placeholder="Optional comments or notes..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {ver.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={() => handleExecuteWorkflow("SUBMIT")}
                    disabled={executingWorkflow}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Submit for Approval
                  </button>
                )}

                {ver.status === "IN_WORKFLOW" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExecuteWorkflow("APPROVE")}
                      disabled={executingWorkflow}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      Approve Proposal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteWorkflow("RETURN")}
                      disabled={executingWorkflow}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      Return for Correction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteWorkflow("REJECT")}
                      disabled={executingWorkflow}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      Reject Proposal
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Issuance Audit Log */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Client Issuance History</h3>
              {ver.issuanceLogs && ver.issuanceLogs.length > 0 ? (
                <div className="space-y-2">
                  {ver.issuanceLogs.map((log: any) => (
                    <div key={log.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-blue-900">Issued by {log.issuedBy}</span>
                        {log.recipientName && <span className="text-blue-700 ml-2">to {log.recipientName} ({log.recipientEmail || "No Email"})</span>}
                      </div>
                      <div className="text-blue-600 font-mono">{new Date(log.issuedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">No issuance events recorded yet.</div>
              )}
            </div>
          </div>
        )}

        {isEditable && activeTab !== "workflow" && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
            >
              {saving ? "Saving Draft..." : "Save Draft Changes"}
            </button>
          </div>
        )}
      </form>

      {/* Issuance Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Record Proposal Issuance</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleIssueToClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Recipient Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Recipient Email</label>
                <input
                  type="email"
                  placeholder="e.g. jdoe@clientcompany.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Delivery Method</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="MANUAL">Manual Delivery</option>
                  <option value="EMAIL_EXPORT">Email Export</option>
                  <option value="PRINT">Hand Delivered Printout</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {issuing ? "Recording..." : "Confirm & Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client-Safe Preview & Print Modal */}
      {showPreviewModal && dto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 space-y-6 my-8 print:p-0 print:shadow-none">
            {/* Modal Controls Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <span className="text-sm font-bold text-slate-700">Client-Safe Document Preview</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg inline-flex items-center"
                >
                  <span className="material-icons-outlined text-lg mr-1.5">print</span>
                  Print / Save as PDF
                </button>
                <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Client-Facing Document Body */}
            <div className="space-y-6 text-slate-900 print:space-y-4">
              <div className="border-b border-slate-300 pb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">AL HATTAB HOLDING WFM</h1>
                  <p className="text-xs text-slate-500 mt-1">Doha, State of Qatar | Commercial Operations Division</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-900">{dto.proposalCode || "COMMERCIAL PROPOSAL"}</div>
                  <div className="text-xs text-slate-500 font-mono">Revision v{dto.versionNumber}.0</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="font-semibold text-slate-500 uppercase">Prepared For:</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{dto.client?.name || "Client Representative"}</div>
                  <div className="text-slate-600">{dto.opportunity?.title}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-500 uppercase">Date & Validity:</div>
                  <div className="font-medium text-slate-800 mt-0.5">Date: {new Date(dto.createdAt).toLocaleDateString()}</div>
                  <div className="font-medium text-slate-800">Valid Until: {dto.validUntil ? new Date(dto.validUntil).toLocaleDateString() : "30 Days"}</div>
                </div>
              </div>

              {/* Commercial Offer */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Commercial Offer</h3>
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="text-xs font-semibold text-blue-900">TOTAL APPROVED SELLING PRICE</div>
                    <div className="text-xs text-blue-700 mt-0.5">Underpinned by Approved Baseline Version</div>
                  </div>
                  <div className="text-2xl font-extrabold text-blue-900">
                    {dto.currency} {dto.sellingPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Scope Summary */}
              {dto.scopeSummary && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Scope of Services</h3>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm whitespace-pre-wrap text-slate-800">
                    {dto.scopeSummary}
                  </div>
                </div>
              )}

              {/* Assumptions & Exclusions */}
              {(dto.assumptions || dto.exclusions) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {dto.assumptions && (
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-wider text-slate-500">Assumptions</div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap text-slate-700">
                        {dto.assumptions}
                      </div>
                    </div>
                  )}
                  {dto.exclusions && (
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-wider text-slate-500">Exclusions</div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap text-slate-700">
                        {dto.exclusions}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Terms & Conditions */}
              {dto.termsAndConditions && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Terms & Conditions</h3>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs whitespace-pre-wrap text-slate-700">
                    {dto.termsAndConditions}
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-12 text-xs border-t border-slate-200">
                <div>
                  <div className="border-b border-slate-400 pb-12"></div>
                  <div className="font-bold text-slate-900 mt-2">Authorized Signatory</div>
                  <div className="text-slate-500">Al Hattab Holding Commercial Management</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-12"></div>
                  <div className="font-bold text-slate-900 mt-2">Client Acceptance</div>
                  <div className="text-slate-500">Name, Title & Company Stamp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Client Response Modal */}
      {showResponseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Record Client Response</h3>
              <button
                onClick={() => setShowResponseModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleRecordResponse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Client Response Outcome *
                </label>
                <select
                  value={responseType}
                  onChange={(e: any) => setResponseType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="ACCEPTED">ACCEPTED (Ready for Contract Conversion)</option>
                  <option value="REJECTED">REJECTED (Declined by Client)</option>
                  <option value="CHANGE_REQUESTED">CHANGE REQUESTED (Requires New Revision)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Client Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Ahmed Al-Mansoori"
                  value={clientContactName}
                  onChange={(e) => setClientContactName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Client Reference / Award Document No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. LOA-2026-0891"
                  value={clientReference}
                  onChange={(e) => setClientReference(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Response Notes & Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter details regarding client acceptance, conditions, or requested changes..."
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResponseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingResponse}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
                >
                  {recordingResponse ? "Saving..." : "Record Response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
