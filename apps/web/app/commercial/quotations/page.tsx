"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface ProposalItem {
  id: string;
  proposalCode: string | null;
  caseId: string;
  companyId: string | null;
  operationType: string | null;
  status: string;
  versionNumber: number;
  title: string;
  sellingPrice: number;
  currency: string;
  validityDays: number | null;
  validUntil: string | null;
  isExpired: boolean;
  issuedAt: string | null;
  issuedBy: string | null;
  createdAt: string;
  client?: { name: string; companyId: string } | null;
  opportunity?: { title: string; companyId: string; operationType: string } | null;
}

export default function ProposalRegisterPage() {
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [showNewModal, setShowNewModal] = useState(false);

  // New Proposal Form State
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [costings, setCostings] = useState<any[]>([]);
  const [selectedCostingVersionId, setSelectedCostingVersionId] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalCodeInput, setProposalCodeInput] = useState("");
  const [validityDaysInput, setValidityDaysInput] = useState("30");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchProposals();
    fetchEligibleCases();
  }, []);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/commercial/proposals");
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch (err) {
      console.error("Failed to fetch proposals", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleCases = async () => {
    try {
      const res = await fetch("/api/v1/commercial/crm/cases");
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || data || []);
      }
    } catch (err) {
      console.error("Failed to fetch cases", err);
    }
  };

  const handleCaseSelect = async (cId: string) => {
    setSelectedCaseId(cId);
    setSelectedCostingVersionId("");
    setCostings([]);
    if (!cId) return;

    try {
      const res = await fetch(`/api/v1/commercial/costing?caseId=${cId}`);
      if (res.ok) {
        const data = await res.json();
        const ests = data.estimates || [];
        const approvedVersions: any[] = [];
        ests.forEach((e: any) => {
          if (e.versions) {
            e.versions.forEach((v: any) => {
              if (v.status === "APPROVED") {
                approvedVersions.push({ ...v, estimate: e });
              }
            });
          }
        });
        setCostings(approvedVersions);
      }
    } catch (err) {
      console.error("Failed to fetch costings for case", err);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedCaseId || !selectedCostingVersionId) {
      setFormError("Please select an opportunity case and an approved costing baseline.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/v1/commercial/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCaseId,
          costEstimateVersionId: selectedCostingVersionId,
          proposalCode: proposalCodeInput || undefined,
          title: proposalTitle || undefined,
          validityDays: validityDaysInput ? Number(validityDaysInput) : undefined
        })
      });

      if (res.ok) {
        setShowNewModal(false);
        setSelectedCaseId("");
        setSelectedCostingVersionId("");
        setProposalTitle("");
        setProposalCodeInput("");
        fetchProposals();
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to create proposal.");
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setCreating(false);
    }
  };

  const filteredProposals = proposals.filter((p) => {
    const matchesSearch =
      !search ||
      (p.proposalCode && p.proposalCode.toLowerCase().includes(search.toLowerCase())) ||
      (p.title && p.title.toLowerCase().includes(search.toLowerCase())) ||
      (p.client?.name && p.client.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.opportunity?.title && p.opportunity.title.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchesScope = scopeFilter === "ALL" || p.operationType === scopeFilter;

    return matchesSearch && matchesStatus && matchesScope;
  });

  const getStatusBadge = (status: string, isExpired: boolean) => {
    if (isExpired) {
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">EXPIRED</span>;
    }
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">DRAFT</span>;
      case "IN_WORKFLOW":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">IN WORKFLOW</span>;
      case "APPROVED_INTERNAL":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">APPROVED</span>;
      case "ISSUED_TO_CLIENT":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300">ISSUED</span>;
      case "REJECTED":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-300">REJECTED</span>;
      case "SUPERSEDED":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-300">SUPERSEDED</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proposal Register</h1>
          <p className="text-sm text-slate-500 mt-1">
            Build, review, issue, and manage commercial proposals underpinned by approved CL-3 costing baselines.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <span className="material-icons-outlined text-lg mr-2">add</span>
          New Proposal
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Proposals</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{proposals.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Approved Internal</div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {proposals.filter((p) => p.status === "APPROVED_INTERNAL").length}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Issued to Client</div>
          <div className="text-2xl font-bold text-blue-700 mt-2">
            {proposals.filter((p) => p.status === "ISSUED_TO_CLIENT").length}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">In Workflow / Draft</div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            {proposals.filter((p) => p.status === "DRAFT" || p.status === "IN_WORKFLOW").length}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search proposal code, title, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
          <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Operational Scopes</option>
            <option value="SECURITY_GUARDING">Security Guarding</option>
            <option value="FACILITY_MANAGEMENT">Facility Management</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_WORKFLOW">In Workflow</option>
            <option value="APPROVED_INTERNAL">Approved Internal</option>
            <option value="ISSUED_TO_CLIENT">Issued to Client</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUPERSEDED">Superseded</option>
          </select>
        </div>
      </div>

      {/* Proposals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading proposals...</div>
        ) : filteredProposals.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No proposals found matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Ref / Title</th>
                  <th className="py-3.5 px-4">Client & Opportunity</th>
                  <th className="py-3.5 px-4">Scope</th>
                  <th className="py-3.5 px-4">Version</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Valid Until</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredProposals.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{p.title}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {p.proposalCode || `ID: ${p.id.slice(0, 8)}`}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{p.client?.name || "N/A"}</div>
                      <div className="text-xs text-slate-500">{p.opportunity?.title || "N/A"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center text-xs font-medium text-slate-700">
                        {p.operationType === "FACILITY_MANAGEMENT" ? "Facility Management" : "Security Guarding"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">v{p.versionNumber}.0</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                      {p.currency} {p.sellingPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(p.status, p.isExpired)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {p.validUntil ? new Date(p.validUntil).toLocaleDateString() : "Not set"}
                    </td>
                    <td className="py-3.5 px-4 text-right flex items-center justify-end gap-2">
                      <Link
                        href={`/commercial/proposals/${p.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                      >
                        View / Edit
                      </Link>
                      {p.status === "ISSUED_TO_CLIENT" && (
                        <Link
                          href={`/commercial/contract-conversion/${p.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
                        >
                          Convert
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Proposal Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Create New Proposal</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProposal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  1. Select Opportunity Case *
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="">-- Choose Opportunity --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.operationType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  2. Select Approved Costing Baseline *
                </label>
                <select
                  value={selectedCostingVersionId}
                  onChange={(e) => setSelectedCostingVersionId(e.target.value)}
                  required
                  disabled={!selectedCaseId}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50"
                >
                  <option value="">-- Choose Approved Costing Version --</option>
                  {costings.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      Version {cv.versionNumber} — {cv.currency} {Number(cv.sellingPrice).toLocaleString()} (Approved)
                    </option>
                  ))}
                </select>
                {selectedCaseId && costings.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No APPROVED costing baseline found for this opportunity. Please approve a costing estimate first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Proposal Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Proposal for Security Operations"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Reference Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REF-2026-001"
                    value={proposalCodeInput}
                    onChange={(e) => setProposalCodeInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    value={validityDaysInput}
                    onChange={(e) => setValidityDaysInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !selectedCostingVersionId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Draft Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
