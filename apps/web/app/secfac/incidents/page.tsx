"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";

export default function IncidentsPage() {
  const { data: session } = useSession();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState<"OCCURRENCE" | "INCIDENT">("INCIDENT");
  const [severity, setSeverity] = useState<"MINOR" | "MODERATE" | "MAJOR" | "CRITICAL">("MINOR");
  const [category, setCategory] = useState("SAFETY_HAZARD");
  const [immediateAction, setImmediateAction] = useState("");

  // Action states
  const [closureReason, setClosureReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, []);

  async function fetchIncidents() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/secfac/incidents");
      const json = await res.json();
      if (json.success) {
        setIncidents(json.data || []);
      } else {
        setError(json.error || "Failed to load incidents");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch incidents");
    } finally {
      setLoading(false);
    }
  }

  async function handleReportIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !description || !siteId) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          siteId,
          type,
          severity,
          category,
          immediateAction
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setTitle("");
        setDescription("");
        setSiteId("");
        fetchIncidents();
      } else {
        alert(json.error || "Failed to report incident");
      }
    } catch (e: any) {
      alert(e?.message || "Error reporting incident");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePromote(incidentId: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/incidents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote",
          incidentId,
          remarks: "Promoted to formal Incident via Web Console",
          severity: "MODERATE"
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchIncidents();
        if (selectedIncident?.id === incidentId) setSelectedIncident(json.data);
      } else {
        alert(json.error || "Failed to promote occurrence");
      }
    } catch (e: any) {
      alert(e?.message || "Error promoting occurrence");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransition(incidentId: string, targetStatus: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/incidents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition",
          incidentId,
          targetStatus
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchIncidents();
        if (selectedIncident?.id === incidentId) setSelectedIncident(json.data);
      } else {
        alert(json.error || "Failed to update status");
      }
    } catch (e: any) {
      alert(e?.message || "Error updating status");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClosureRequest(incidentId: string) {
    if (!closureReason) {
      alert("Please provide a closure reason.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/incidents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_closure",
          incidentId,
          closureReason
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.data.requiresWorkflow ? "Submitted for workflow approval!" : "Incident closed cleanly.");
        setClosureReason("");
        fetchIncidents();
        setSelectedIncident(null);
      } else {
        alert(`Error: ${json.error}`);
      }
    } catch (e: any) {
      alert(e?.message || "Error requesting closure");
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
              <span className="material-symbols-outlined text-[#002D72] text-3xl">warning</span>
              <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Incident & Occurrence Center</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#002D72] text-white uppercase">
                Phase 6B Live
              </span>
            </div>
            <p className="text-sm text-[#444651] max-w-xl">
              Log security breaches, safety hazards, promote occurrences, and track workflow closure governance.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#002D72] hover:bg-[#001A48] text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_alert</span>
            REPORT INCIDENT / OCCURRENCE
          </button>
        </div>

        {error && (
          <div className="bg-[#FFDAD6] border border-[#BA1A1A] text-[#410002] p-4 rounded-lg mb-6 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Incidents Table / List */}
          <div className="lg:col-span-2 bg-white border border-[#C4C6D2] rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#002D72]">list_alt</span>
              Incident & Occurrence Log ({incidents.length})
            </h2>

            {loading ? (
              <div className="p-8 text-center text-xs font-bold text-[#747782]">
                <span className="material-symbols-outlined animate-spin text-3xl text-[#002D72] mb-2">sync</span>
                <p>Loading operational incidents...</p>
              </div>
            ) : incidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#747782] bg-[#F9F9FF] border border-dashed border-[#C4C6D2] rounded-lg">
                No incidents or occurrences reported yet. Click "REPORT INCIDENT" to create a record.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E7EEFF] bg-[#F9F9FF] text-[#002D72] font-bold">
                      <th className="py-3 px-3">Reference</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Title & Category</th>
                      <th className="py-3 px-3">Severity</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr
                        key={inc.id}
                        className={`border-b border-[#F0F4FF] hover:bg-[#F0F4FF]/50 transition cursor-pointer ${selectedIncident?.id === inc.id ? "bg-[#E7EEFF]" : ""}`}
                        onClick={() => setSelectedIncident(inc)}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-[#001A48]">{inc.incidentNumber}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${inc.type === "OCCURRENCE" ? "bg-[#E7EEFF] text-[#002D72]" : "bg-[#FFDAD6] text-[#410002]"}`}>
                            {inc.type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#001A48]">{inc.title}</div>
                          <div className="text-[10px] text-[#747782]">{inc.category}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${inc.severity === "CRITICAL" ? "bg-[#FFDAD6] text-[#410002]" : inc.severity === "MAJOR" ? "bg-[#FFDBCF] text-[#3A0B00]" : "bg-[#E2E2E9] text-[#444651]"}`}>
                            {inc.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[10px] uppercase text-[#002D72]">{inc.status}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedIncident(inc); }}
                            className="px-2 py-1 bg-[#002D72] text-white rounded text-[10px] font-bold"
                          >
                            VIEW
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Details / Action Panel */}
          <div className="bg-white border border-[#C4C6D2] rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#002D72]">article</span>
              Incident Details
            </h2>

            {selectedIncident ? (
              <div className="space-y-4 text-xs text-[#444651]">
                <div className="p-3 bg-[#F9F9FF] border border-[#E7EEFF] rounded-lg">
                  <div className="font-mono font-bold text-sm text-[#002D72]">{selectedIncident.incidentNumber}</div>
                  <div className="text-sm font-bold text-[#001A48] mt-1">{selectedIncident.title}</div>
                  <p className="mt-2 text-[#747782] leading-relaxed">{selectedIncident.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="font-bold text-[#747782]">Type:</span> {selectedIncident.type}</div>
                  <div><span className="font-bold text-[#747782]">Severity:</span> {selectedIncident.severity}</div>
                  <div><span className="font-bold text-[#747782]">Status:</span> {selectedIncident.status}</div>
                  <div><span className="font-bold text-[#747782]">Workflow:</span> {selectedIncident.workflowStatus}</div>
                </div>

                {/* Operations */}
                <div className="pt-4 border-t border-[#E7EEFF] space-y-2">
                  <div className="font-bold text-[#001A48] mb-2">Actions</div>
                  {selectedIncident.type === "OCCURRENCE" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handlePromote(selectedIncident.id)}
                      className="w-full py-2 bg-[#002D72] text-white rounded font-bold hover:bg-[#001A48] transition flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">trending_up</span>
                      PROMOTE TO INCIDENT
                    </button>
                  )}

                  {selectedIncident.status === "REPORTED" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleTransition(selectedIncident.id, "INVESTIGATING")}
                      className="w-full py-2 bg-[#444651] text-white rounded font-bold hover:bg-[#1B1B1F] transition flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">search</span>
                      BEGIN INVESTIGATION
                    </button>
                  )}

                  {["REPORTED", "ACKNOWLEDGED", "INVESTIGATING", "ACTION_IN_PROGRESS"].includes(selectedIncident.status) && (
                    <div className="space-y-2 pt-2">
                      <textarea
                        placeholder="Enter closure reason..."
                        value={closureReason}
                        onChange={(e) => setClosureReason(e.target.value)}
                        className="w-full p-2 border border-[#C4C6D2] rounded text-xs"
                        rows={2}
                      />
                      <button
                        disabled={actionLoading}
                        onClick={() => handleClosureRequest(selectedIncident.id)}
                        className="w-full py-2 bg-[#006E1C] text-white rounded font-bold hover:bg-[#005313] transition flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">task_alt</span>
                        REQUEST CLOSURE / CLOSE
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#747782] bg-[#F9F9FF] rounded-lg">
                Select an incident from the log to view details and execute operational actions.
              </div>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
              <h2 className="text-lg font-bold text-[#001A48] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#002D72]">report_problem</span>
                Report Security Incident / Occurrence
              </h2>
              <form onSubmit={handleReportIncident} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Site ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Site ID (e.g. SITE01)"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-[#001A48] block mb-1">Record Type</label>
                    <select
                      value={type}
                      onChange={(e: any) => setType(e.target.value)}
                      className="w-full p-2 border border-[#C4C6D2] rounded"
                    >
                      <option value="INCIDENT">INCIDENT</option>
                      <option value="OCCURRENCE">OCCURRENCE</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-[#001A48] block mb-1">Severity</label>
                    <select
                      value={severity}
                      onChange={(e: any) => setSeverity(e.target.value)}
                      className="w-full p-2 border border-[#C4C6D2] rounded"
                    >
                      <option value="MINOR">MINOR</option>
                      <option value="MODERATE">MODERATE</option>
                      <option value="MAJOR">MAJOR</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Short summary title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Description</label>
                  <textarea
                    required
                    placeholder="Full incident description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[#E2E2E9] text-[#444651] font-bold rounded"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#002D72] text-white font-bold rounded"
                  >
                    SUBMIT
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SecfacPageGuard>
  );
}
