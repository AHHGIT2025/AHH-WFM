"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { LayoutShell } from "../../../components/layout-shell";
import CommercialActivityFeedPanel from "../../../components/commercial/CommercialActivityFeedPanel";
import { hasPermission, isAdminUser } from "@/lib/permissions";

interface AddendumRow {
  id: string;
  addendumNumber: string;
  title: string;
  addendumType: string;
  addendumDate: string;
  effectiveFrom: string;
  status: string;
  calculatedCommercialImpact: number;
  description: string;
  createdBy?: string;
}

export default function ContractAmendmentsPage() {
  const searchParams = useSearchParams();
  const urlContractId = searchParams.get("contractId") || "";

  const { data: session } = useSession();
  const user = session?.user as any;
  const currentUserId = user?.id || "current-user";

  const canCreateAddendum = isAdminUser(user) || hasPermission(user, "commercial.addendum.create");
  const canSubmitAddendum = isAdminUser(user) || hasPermission(user, "commercial.addendum.submit");
  const canApproveAddendum = isAdminUser(user) || hasPermission(user, "commercial.addendum.approve");
  const canRejectAddendum = isAdminUser(user) || hasPermission(user, "commercial.addendum.reject");

  const [contractsList, setContractsList] = useState<any[]>([]);
  const [selectedContractId, setSelectedContractId] = useState(urlContractId);
  const [contractStatus, setContractStatus] = useState("ACTIVE");
  const [addendums, setAddendums] = useState<AddendumRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("SCOPE_CHANGE");
  const [newImpact, setNewImpact] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Load contracts
  useEffect(() => {
    async function loadContracts() {
      try {
        const res = await fetch("/api/v1/manpower/security-guarding/contracts?limit=50");
        if (res.ok) {
          const data = await res.json();
          const items: any[] = Array.isArray(data) ? data : (data.items || data.contracts || []);
          const eligible = items.filter((c: any) => c.status === "ACTIVE" || c.status === "APPROVED");
          setContractsList(eligible.length > 0 ? eligible : items);
          if (!selectedContractId && eligible.length > 0) {
            setSelectedContractId(eligible[0].id);
            setContractStatus(eligible[0].status);
          }
        }
      } catch (e) {
        console.error("Failed to load contracts:", e);
      }
    }
    loadContracts();
  }, [selectedContractId]);

  // Load addendums for selected contract
  useEffect(() => {
    if (!selectedContractId) return;
    async function loadAddendums() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/commercial/contracts/${selectedContractId}/addendums`);
        if (res.ok) {
          const json = await res.json();
          if (json.contract) {
            setContractStatus(json.contract.status);
          }
          if (json.addendums) {
            setAddendums(json.addendums.map((a: any) => ({
              id: a.id,
              addendumNumber: a.addendumNumber,
              title: a.title,
              addendumType: a.addendumType,
              addendumDate: a.addendumDate ? a.addendumDate.split("T")[0] : "",
              effectiveFrom: a.effectiveFrom ? a.effectiveFrom.split("T")[0] : "",
              status: a.status,
              calculatedCommercialImpact: a.calculatedCommercialImpact || 0,
              description: a.description || "",
              createdBy: a.createdBy
            })));
          }
        }
      } catch (e) {
        console.error("Failed to load addendums:", e);
      } finally {
        setLoading(false);
      }
    }
    loadAddendums();
  }, [selectedContractId]);

  const handleCreateAddendum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !canCreateAddendum || !selectedContractId) return;

    try {
      const res = await fetch(`/api/v1/commercial/contracts/${selectedContractId}/addendums`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          addendumType: newType,
          effectiveFrom: new Date().toISOString().split("T")[0],
          calculatedCommercialImpact: Number(newImpact) || 0,
          description: newDescription,
          submit: false
        })
      });
      if (res.ok) {
        const json = await res.json();
        const created = json.addendum;
        if (created) {
          setAddendums([{
            id: created.id,
            addendumNumber: created.addendumNumber,
            title: created.title,
            addendumType: created.addendumType,
            addendumDate: created.addendumDate ? created.addendumDate.split("T")[0] : "",
            effectiveFrom: created.effectiveFrom ? created.effectiveFrom.split("T")[0] : "",
            status: created.status,
            calculatedCommercialImpact: created.calculatedCommercialImpact || 0,
            description: created.description || "",
            createdBy: currentUserId
          }, ...addendums]);
        }
        setNewTitle("");
        setNewImpact("");
        setNewDescription("");
        setShowAddModal(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create addendum");
      }
    } catch (e) {
      alert("Network error creating addendum");
    }
  };

  const handleSubmitAddendum = async (id: string) => {
    if (!canSubmitAddendum || !selectedContractId) return;
    try {
      const res = await fetch(`/api/v1/commercial/contracts/${selectedContractId}/addendums`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addendumId: id, action: "SUBMIT" })
      });
      if (res.ok) {
        setAddendums(addendums.map(a => a.id === id ? { ...a, status: "PENDING_APPROVAL" } : a));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit addendum");
      }
    } catch (e) {
      alert("Network error submitting addendum");
    }
  };

  const handleApproveAddendum = async (id: string) => {
    if (!canApproveAddendum || !selectedContractId) return;
    try {
      const res = await fetch(`/api/v1/commercial/contracts/${selectedContractId}/addendums/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved by checker" })
      });
      if (res.ok) {
        setAddendums(addendums.map(a => a.id === id ? { ...a, status: "APPROVED" } : a));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to approve addendum");
      }
    } catch (e) {
      alert("Network error approving addendum");
    }
  };

  const handleRejectAddendum = async (id: string) => {
    if (!canRejectAddendum || !selectedContractId) return;
    try {
      const res = await fetch(`/api/v1/commercial/contracts/${selectedContractId}/addendums/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", remarks: "Rejected by checker" })
      });
      if (res.ok) {
        setAddendums(addendums.map(a => a.id === id ? { ...a, status: "REJECTED" } : a));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reject addendum");
      }
    } catch (e) {
      alert("Network error rejecting addendum");
    }
  };

  return (
    <LayoutShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contract Scope Amendments & Addendums</h1>
            <p className="text-sm text-slate-500 mt-1">
              Authoritative Post-Award Contract Modification Console (Active Contract Rule Compliance)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {contractsList.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Contract:</label>
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="text-xs font-medium border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {contractsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractNumber} - {c.title} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
              Contract Status: {contractStatus}
            </span>
            {canCreateAddendum && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition"
              >
                + Create Scope Addendum
              </button>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 text-sm text-blue-900 rounded-r-md">
          <p className="font-semibold">Compliance Rule Notice:</p>
          <p className="mt-0.5 text-blue-800">
            Direct editing of terms for ACTIVE contracts is strictly prohibited to preserve audit compliance. All headcount, rate card, site, or duration changes must be executed as an approved <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">ManpowerContractAddendum</code> under Maker/Checker Segregation of Duties (<code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">CONTRACT_ADDENDUM</code> workflow).
          </p>
        </div>

        {/* Addendums List Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-base font-semibold text-slate-800">Executed Addendums & Amendments ({selectedContractId})</h2>
            <span className="text-xs text-slate-500 font-medium">{addendums.length} Total Addendums</span>
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Addendum No.</th>
                <th className="py-3 px-4">Title & Description</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Effective Date</th>
                <th className="py-3 px-4">Financial Impact (QAR)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {addendums.map((addendum) => {
                const isOwnAddendum = Boolean(addendum.createdBy && addendum.createdBy === currentUserId);
                const isPendingOrDraft = addendum.status === "DRAFT" || addendum.status === "PENDING_APPROVAL";
                const canCheckerAct = isPendingOrDraft && !isOwnAddendum && (canApproveAddendum || canRejectAddendum);

                return (
                  <tr key={addendum.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">{addendum.addendumNumber}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{addendum.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{addendum.description}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-100 rounded">{addendum.addendumType}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{addendum.effectiveFrom}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      +{addendum.calculatedCommercialImpact.toLocaleString()} QAR
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        addendum.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : addendum.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {addendum.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {addendum.status === "APPROVED" ? (
                        <span className="text-xs text-slate-400 font-medium">Locked</span>
                      ) : addendum.status === "REJECTED" ? (
                        <span className="text-xs text-rose-500 font-medium">Rejected</span>
                      ) : isOwnAddendum ? (
                        <div className="inline-flex items-center gap-2 justify-end">
                          {addendum.status === "DRAFT" && canSubmitAddendum && (
                            <button
                              onClick={() => handleSubmitAddendum(addendum.id)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition"
                            >
                              Submit for Approval
                            </button>
                          )}
                          <span className="text-xs text-amber-700 font-medium">
                            Awaiting Checker Approval (SoD)
                          </span>
                        </div>
                      ) : canCheckerAct ? (
                        <div className="inline-flex items-center gap-2 justify-end">
                          {canApproveAddendum && (
                            <button
                              onClick={() => handleApproveAddendum(addendum.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow-sm transition"
                            >
                              Approve Addendum
                            </button>
                          )}
                          {canRejectAddendum && (
                            <button
                              onClick={() => handleRejectAddendum(addendum.id)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded shadow-sm transition"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Pending Checker Review</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Contract Addendums Activity Feed */}
        <div className="mt-6">
          <CommercialActivityFeedPanel title="Contract Scope Addendum & Variation Activity Feed" />
        </div>

        {/* Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Create Contract Scope Addendum</h3>
              <form onSubmit={handleCreateAddendum} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Addendum Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Guard Post Addition & Shift Revision"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amendment Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SCOPE_CHANGE">Scope Change (Headcount / Positions)</option>
                    <option value="RATE_ADJUSTMENT">Rate Adjustment / Price Revision</option>
                    <option value="SITE_ADDITION">New Site / Location Expansion</option>
                    <option value="PERIOD_EXTENSION">Contract Period Extension</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Calculated Commercial Impact (QAR)</label>
                  <input
                    type="number"
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value)}
                    placeholder="45000"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Justification</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Provide detailed justification for the amendment..."
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow transition"
                  >
                    Submit Addendum
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
