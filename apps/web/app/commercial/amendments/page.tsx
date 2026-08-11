"use client";

import React, { useState } from "react";
import { LayoutShell } from "../../../components/layout-shell";

export default function ContractAmendmentsPage() {
  const [selectedContractId, setSelectedContractId] = useState("CONT-2026-001");
  const [contractStatus, setContractStatus] = useState("ACTIVE");
  const [addendums, setAddendums] = useState([
    {
      id: "add-1",
      addendumNumber: "CONT-2026-001-ADD-01",
      title: "Headcount Expansion & Guard Post Addition",
      addendumType: "SCOPE_CHANGE",
      addendumDate: "2026-08-11",
      effectiveFrom: "2026-09-01",
      status: "APPROVED",
      calculatedCommercialImpact: 45000,
      description: "Added 4 Senior Security Guards for West Wing Perimeter."
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("SCOPE_CHANGE");
  const [newImpact, setNewImpact] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleCreateAddendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const newAdd = {
      id: `add-${Date.now()}`,
      addendumNumber: `CONT-2026-001-ADD-0${addendums.length + 1}`,
      title: newTitle,
      addendumType: newType,
      addendumDate: new Date().toISOString().split("T")[0],
      effectiveFrom: new Date().toISOString().split("T")[0],
      status: "DRAFT",
      calculatedCommercialImpact: Number(newImpact) || 0,
      description: newDescription
    };

    setAddendums([newAdd, ...addendums]);
    setNewTitle("");
    setNewImpact("");
    setNewDescription("");
    setShowAddModal(false);
  };

  const handleApproveAddendum = (id: string) => {
    setAddendums(addendums.map(a => a.id === id ? { ...a, status: "APPROVED" } : a));
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
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
              Contract Status: {contractStatus}
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition"
            >
              + Create Scope Addendum
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 text-sm text-blue-900 rounded-r-md">
          <p className="font-semibold">Compliance Rule Notice:</p>
          <p className="mt-0.5 text-blue-800">
            Direct editing of terms for ACTIVE contracts is strictly prohibited to preserve audit compliance. All headcount, rate card, site, or duration changes must be executed as an approved <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">ManpowerContractAddendum</code>.
          </p>
        </div>

        {/* Addendums List Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-base font-semibold text-slate-800">Executed Addendums & Amendments</h2>
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
              {addendums.map((addendum) => (
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
                      addendum.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {addendum.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {addendum.status === "DRAFT" ? (
                      <button
                        onClick={() => handleApproveAddendum(addendum.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow-sm transition"
                      >
                        Approve Addendum
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
