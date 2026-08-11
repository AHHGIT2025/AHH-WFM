"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";

export default function SupervisorInspectionsPage() {
  const { data: session } = useSession();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchInspections();
  }, []);

  async function fetchInspections() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/secfac/supervisor-inspections");
      const json = await res.json();
      if (json.success) {
        setInspections(json.data || []);
      } else {
        setError(json.error || "Failed to load inspections");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch inspections");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveFollowUp(id: string) {
    if (!resolutionNotes) {
      alert("Please provide resolution notes.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/supervisor-inspections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_followup",
          id,
          notes: resolutionNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        setResolutionNotes("");
        fetchInspections();
        setSelectedInspection(null);
      } else {
        alert(json.error || "Failed to resolve follow-up");
      }
    } catch (e: any) {
      alert(e?.message || "Error resolving follow-up");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <SecfacPageGuard>
      <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#E7EEFF] pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[#002D72] text-3xl">fact_check</span>
              <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Supervisor Field Inspections</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#002D72] text-white uppercase">
                Checklist Engine Reused 100%
              </span>
            </div>
            <p className="text-sm text-[#444651] max-w-xl">
              Audit supervisor field evaluations, guard compliance scores, uniform/turnout checks, and corrective actions.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-[#FFDAD6] border border-[#BA1A1A] text-[#410002] p-4 rounded-lg mb-6 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Inspections List */}
          <div className="lg:col-span-2 bg-white border border-[#C4C6D2] rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#002D72]">checklist</span>
              Field Inspections Audit Log ({inspections.length})
            </h2>

            {loading ? (
              <div className="p-8 text-center text-xs font-bold text-[#747782]">
                <span className="material-symbols-outlined animate-spin text-3xl text-[#002D72] mb-2">sync</span>
                <p>Loading field inspections...</p>
              </div>
            ) : inspections.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#747782] bg-[#F9F9FF] border border-dashed border-[#C4C6D2] rounded-lg">
                No supervisor inspections conducted yet. Mobile field supervisors submit audits directly via the Mobile App.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E7EEFF] bg-[#F9F9FF] text-[#002D72] font-bold">
                      <th className="py-3 px-3">Date & Site</th>
                      <th className="py-3 px-3">Supervisor</th>
                      <th className="py-3 px-3">Inspected Guard</th>
                      <th className="py-3 px-3">Result</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.map((insp) => (
                      <tr
                        key={insp.id}
                        className={`border-b border-[#F0F4FF] hover:bg-[#F0F4FF]/50 transition cursor-pointer ${selectedInspection?.id === insp.id ? "bg-[#E7EEFF]" : ""}`}
                        onClick={() => setSelectedInspection(insp)}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-[#001A48]">
                          <div>{new Date(insp.inspectionDate).toLocaleDateString()}</div>
                          <div className="text-[10px] text-[#747782]">Site: {insp.site?.siteName || insp.siteId}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#001A48]">
                          {insp.supervisor ? `${insp.supervisor.firstName} ${insp.supervisor.lastName}` : insp.supervisorId}
                        </td>
                        <td className="py-3 px-3 font-bold text-[#002D72]">
                          {insp.inspectedEmployee ? `${insp.inspectedEmployee.firstName} ${insp.inspectedEmployee.lastName}` : insp.inspectedEmployeeId}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${insp.overallResult === "COMPLIANT" ? "bg-[#006E1C] text-white" : insp.overallResult === "REQUIRES_ACTION" ? "bg-[#FFDBCF] text-[#3A0B00]" : "bg-[#FFDAD6] text-[#410002]"}`}>
                            {insp.overallResult}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold uppercase text-[10px] text-[#444651]">
                          {insp.status}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedInspection(insp); }}
                            className="px-2 py-1 bg-[#002D72] text-white rounded text-[10px] font-bold"
                          >
                            AUDIT
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Details / Follow Up Resolution Panel */}
          <div className="bg-white border border-[#C4C6D2] rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#002D72]">find_in_page</span>
              Inspection Audit & Follow-Up
            </h2>

            {selectedInspection ? (
              <div className="space-y-4 text-xs text-[#444651]">
                <div className="p-3 bg-[#F9F9FF] border border-[#E7EEFF] rounded-lg space-y-1">
                  <div><span className="font-bold text-[#747782]">Result:</span> <span className="font-bold text-[#002D72]">{selectedInspection.overallResult}</span></div>
                  <div><span className="font-bold text-[#747782]">Score:</span> {selectedInspection.checklistExecution?.scorePercentage || 100}%</div>
                  {selectedInspection.notes && <div className="mt-2 text-[#444651]"><strong>Notes:</strong> {selectedInspection.notes}</div>}
                  {selectedInspection.correctiveAction && <div className="text-[#A83800] font-bold"><strong>Corrective Action:</strong> {selectedInspection.correctiveAction}</div>}
                </div>

                {selectedInspection.status === "FOLLOW_UP_PENDING" && (
                  <div className="pt-4 border-t border-[#E7EEFF] space-y-2">
                    <div className="font-bold text-[#001A48]">Resolve Follow-Up</div>
                    <textarea
                      placeholder="Enter resolution notes..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full p-2 border border-[#C4C6D2] rounded text-xs"
                      rows={3}
                    />
                    <button
                      disabled={actionLoading}
                      onClick={() => handleResolveFollowUp(selectedInspection.id)}
                      className="w-full py-2 bg-[#006E1C] text-white rounded font-bold hover:bg-[#005313] transition flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      MARK RESOLVED
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#747782] bg-[#F9F9FF] rounded-lg">
                Select an inspection record to audit underlying checklist execution details and resolve corrective follow-ups.
              </div>
            )}
          </div>
        </div>
      </div>
    </SecfacPageGuard>
  );
}
