"use client";

import React, { useState, useEffect, useCallback } from "react";
import CommercialActivityFeedPanel from "../../../components/commercial/CommercialActivityFeedPanel";

interface ClientInfo {
  id: string;
  name: string;
}

interface ExpiringContract {
  id: string;
  contractNumber: string;
  title: string;
  status: string;
  operationType: string;
  startDate: string;
  endDate: string;
  noticePeriodDays: number | null;
  daysToExpiry: number;
  isInNoticeWindow: boolean;
  client: ClientInfo | null;
  activeRenewalCase: any | null;
}

interface RenewalCase {
  id: string;
  caseNumber: string;
  contractId: string;
  status: string;
  noticePeriodDays: number | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
  decision: string | null;
  decisionDate: string | null;
  decisionReason: string | null;
  decisionNotes: string | null;
  resultingContractId: string | null;
  resultingAddendumId: string | null;
  operationType: string;
  createdByName: string | null;
  createdAt: string;
  contract: {
    id: string;
    contractNumber: string;
    title: string;
    client: ClientInfo | null;
  };
}

export default function ContractRenewalsConsolePage() {
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([]);
  const [renewalCases, setRenewalCases] = useState<RenewalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State for Initiating Renewal Case
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ExpiringContract | null>(null);
  const [targetStartDate, setTargetStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingInit, setSubmittingInit] = useState(false);

  // Modal State for Finalizing Renewal Decision
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<RenewalCase | null>(null);
  const [decisionType, setDecisionType] = useState<string>("RENEW_NEW_TERM");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionNotesInput, setDecisionNotesInput] = useState("");
  const [newTermStartDate, setNewTermStartDate] = useState("");
  const [newTermEndDate, setNewTermEndDate] = useState("");
  const [explicitValue, setExplicitValue] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchRenewalsData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/commercial/renewals");
      if (!res.ok) {
        throw new Error("Failed to load contract renewal data.");
      }
      const data = await res.json();
      setExpiringContracts(data.expiringContracts || []);
      setRenewalCases(data.renewalCases || []);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewalsData();
  }, []);

  const handleOpenInitModal = (contract: ExpiringContract) => {
    setSelectedContract(contract);
    const end = new Date(contract.endDate);
    const suggestStart = new Date(end.valueOf() + 86400000).toISOString().split("T")[0];
    const suggestEnd = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate()).toISOString().split("T")[0];
    setTargetStartDate(suggestStart);
    setTargetEndDate(suggestEnd);
    setReviewNotes("");
    setInitModalOpen(true);
  };

  const handleInitiateRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;
    setSubmittingInit(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/v1/commercial/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: selectedContract.id,
          targetStartDate,
          targetEndDate,
          reviewNotes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate renewal case.");
      }

      setSuccessMsg(`Renewal case ${data.renewalCase.caseNumber} initiated successfully.`);
      setInitModalOpen(false);
      fetchRenewalsData();
    } catch (err: any) {
      setErrorMsg(err.message || "Error initiating renewal case.");
    } finally {
      setSubmittingInit(false);
    }
  };

  const handleOpenDecisionModal = (caseItem: RenewalCase) => {
    setSelectedCase(caseItem);
    setDecisionType("RENEW_NEW_TERM");
    setDecisionReason("");
    setDecisionNotesInput("");
    setNewTermStartDate(caseItem.targetStartDate ? caseItem.targetStartDate.split("T")[0] : "");
    setNewTermEndDate(caseItem.targetEndDate ? caseItem.targetEndDate.split("T")[0] : "");
    setExplicitValue("");
    setDecisionModalOpen(true);
  };

  const handleFinalizeDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSubmittingDecision(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/commercial/renewals/${selectedCase.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionType,
          decisionReason,
          decisionNotes: decisionNotesInput,
          newStartDate: newTermStartDate,
          newEndDate: newTermEndDate,
          explicitTotalContractValue: explicitValue ? Number(explicitValue) : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize renewal decision.");
      }

      setSuccessMsg(`Renewal decision recorded successfully for case ${selectedCase.caseNumber}.`);
      setDecisionModalOpen(false);
      fetchRenewalsData();
    } catch (err: any) {
      setErrorMsg(err.message || "Error finalizing renewal decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <span className="material-icons text-amber-400 text-3xl">autorenew</span>
            <h1 className="text-2xl font-bold tracking-tight">Contract Renewal & Expiry Management</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            CL-8 Commercial Governance: Track expiring contracts, initiate renewal cases, and finalize contract terms.
          </p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-lg text-amber-300 text-xs font-semibold uppercase tracking-wider">
          Milestone CL-8 Active
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center justify-between text-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 font-bold hover:text-white">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg flex items-center justify-between text-sm">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 font-bold hover:text-white">✕</button>
        </div>
      )}

      {/* Section 1: Expiring Contracts Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-icons text-indigo-500">access_time</span>
            Expiring Contracts & Review Windows
          </h2>
          <span className="text-xs text-slate-500">
            {expiringContracts.length} contract(s) tracked
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading expiring contracts data...</div>
        ) : expiringContracts.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No active or expiring contracts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Contract #</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">End Date</th>
                  <th className="p-3">Days to Expiry</th>
                  <th className="p-3">Notice Window</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expiringContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{c.contractNumber}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">{c.title}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{c.client?.name || "N/A"}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{new Date(c.endDate).toLocaleDateString()}</td>
                    <td className="p-3 font-bold">
                      <span className={c.daysToExpiry <= 0 ? "text-red-600" : c.daysToExpiry <= 30 ? "text-amber-500" : "text-emerald-500"}>
                        {c.daysToExpiry <= 0 ? "Expired" : `${c.daysToExpiry} days`}
                      </span>
                    </td>
                    <td className="p-3">
                      {c.isInNoticeWindow ? (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs px-2 py-1 rounded font-semibold">
                          Notice Window ({c.noticePeriodDays || 30}d)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Regular</span>
                      )}
                    </td>
                    <td className="p-3">
                      {c.activeRenewalCase ? (
                        <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded font-medium">
                          Case: {c.activeRenewalCase.caseNumber}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenInitModal(c)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1 rounded text-xs transition"
                        >
                          Initiate Renewal Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Active Renewal Review Cases */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-icons text-amber-500">assignment</span>
            Renewal Review Cases & Decisions
          </h2>
          <span className="text-xs text-slate-500">
            {renewalCases.length} case(s) logged
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading renewal cases...</div>
        ) : renewalCases.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No active renewal review cases found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Case #</th>
                  <th className="p-3">Contract #</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Decision</th>
                  <th className="p-3">Initiated At</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {renewalCases.map((rc) => (
                  <tr key={rc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">{rc.caseNumber}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{rc.contract.contractNumber}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">{rc.contract.title}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                        rc.status === "RENEWED"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                          : rc.status === "NOT_RENEWED" || rc.status === "DECLINED"
                          ? "bg-red-500/10 text-red-500 border border-red-500/30"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                      }`}>
                        {rc.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-600 dark:text-slate-300">{rc.decision || "Pending Decision"}</td>
                    <td className="p-3 text-xs text-slate-500">{new Date(rc.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      {rc.status === "UNDER_REVIEW" ? (
                        <button
                          onClick={() => handleOpenDecisionModal(rc)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition"
                        >
                          Finalize Decision
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commercial Activity Feed */}
      <CommercialActivityFeedPanel title="Contract Renewal Activity & Follow-Up Feed" />

      {/* Modal 1: Initiate Renewal Case */}
      {initModalOpen && selectedContract && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-icons text-indigo-500">add_task</span>
              Initiate Renewal Review Case
            </h3>
            <p className="text-xs text-slate-500">
              Contract: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedContract.contractNumber} — {selectedContract.title}</span>
            </p>

            <form onSubmit={handleInitiateRenewal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Renewal Start Date</label>
                <input
                  type="date"
                  required
                  value={targetStartDate}
                  onChange={(e) => setTargetStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Renewal End Date</label>
                <input
                  type="date"
                  required
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Review Notes</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Notes on client renewal intent, rate negotiations, or performance history..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInitModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded disabled:opacity-50"
                >
                  {submittingInit ? "Submitting..." : "Confirm & Open Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Finalize Renewal Decision */}
      {decisionModalOpen && selectedCase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-icons text-emerald-500">task_alt</span>
              Finalize Renewal Decision for Case {selectedCase.caseNumber}
            </h3>

            <form onSubmit={handleFinalizeDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Decision Outcome</label>
                <select
                  value={decisionType}
                  onChange={(e) => setDecisionType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="RENEW_NEW_TERM">Renew as NEW Contract Term (New Contract Created)</option>
                  <option value="RENEW_ADDENDUM_EXTENSION">Extend via CL-7 Addendum (End Date Extension)</option>
                  <option value="NOT_RENEWED">Not Renewed (Natural Expiry at End Date)</option>
                  <option value="DECLINED">Declined by Client</option>
                </select>
              </div>

              {(decisionType === "RENEW_NEW_TERM" || decisionType === "RENEW_ADDENDUM_EXTENSION") && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Term Start Date</label>
                      <input
                        type="date"
                        required
                        value={newTermStartDate}
                        onChange={(e) => setNewTermStartDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Term End Date</label>
                      <input
                        type="date"
                        required
                        value={newTermEndDate}
                        onChange={(e) => setNewTermEndDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {decisionType === "RENEW_NEW_TERM" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Explicit Full-Term Value (Optional)</label>
                      <input
                        type="number"
                        value={explicitValue}
                        onChange={(e) => setExplicitValue(e.target.value)}
                        placeholder="Leave blank for NULL total contract value"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Decision Reason / Remarks</label>
                <textarea
                  rows={2}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Reason for renewal decision or decline..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded disabled:opacity-50"
                >
                  {submittingDecision ? "Processing..." : "Finalize & Apply Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
