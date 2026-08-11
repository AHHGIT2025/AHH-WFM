"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";

export default function ShiftBriefingsPage() {
  const { data: session } = useSession();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [knownRisks, setKnownRisks] = useState("");
  const [temporaryInstructions, setTemporaryInstructions] = useState("");
  const [briefingNotes, setBriefingNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBriefings();
  }, []);

  async function fetchBriefings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/secfac/shift-briefings");
      const json = await res.json();
      if (json.success) {
        setBriefings(json.data || []);
      } else {
        setError(json.error || "Failed to load briefings");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch briefings");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBriefing(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/shift-briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          safetyNotes,
          knownRisks,
          temporaryInstructions,
          briefingNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setSiteId("");
        setSafetyNotes("");
        setKnownRisks("");
        setTemporaryInstructions("");
        setBriefingNotes("");
        fetchBriefings();
      } else {
        alert(json.error || "Failed to create briefing");
      }
    } catch (e: any) {
      alert(e?.message || "Error creating briefing");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteStage(briefingId: string, targetStage: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/shift-briefings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_stage",
          briefingId,
          targetStage
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchBriefings();
      } else {
        alert(json.error || "Failed to complete stage");
      }
    } catch (e: any) {
      alert(e?.message || "Error completing stage");
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
              <span className="material-symbols-outlined text-[#002D72] text-3xl">groups</span>
              <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Shift Briefing & Debriefing</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#002D72] text-white uppercase">
                Normalized Attendance & Carried Incidents
              </span>
            </div>
            <p className="text-sm text-[#444651] max-w-xl">
              Conduct pre-shift briefing alignment, record participant attendance, and carry forward open operational incidents.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#002D72] hover:bg-[#001A48] text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">assignment_ind</span>
            START PRE-SHIFT BRIEFING
          </button>
        </div>

        {error && (
          <div className="bg-[#FFDAD6] border border-[#BA1A1A] text-[#410002] p-4 rounded-lg mb-6 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* Briefings List */}
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#002D72]">view_timeline</span>
            Shift Briefing Logs ({briefings.length})
          </h2>

          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-[#747782]">
              <span className="material-symbols-outlined animate-spin text-3xl text-[#002D72] mb-2">sync</span>
              <p>Loading shift briefings...</p>
            </div>
          ) : briefings.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#747782] bg-[#F9F9FF] border border-dashed border-[#C4C6D2] rounded-lg">
              No shift briefings conducted yet. Click "START PRE-SHIFT BRIEFING" to initialize a briefing session.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E7EEFF] bg-[#F9F9FF] text-[#002D72] font-bold">
                    <th className="py-3 px-3">Date & Site</th>
                    <th className="py-3 px-3">Supervisor</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-3">Participants</th>
                    <th className="py-3 px-3">Carried Incidents</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {briefings.map((b) => (
                    <tr key={b.id} className="border-b border-[#F0F4FF] hover:bg-[#F0F4FF]/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[#001A48]">
                        <div>{new Date(b.briefingDate).toLocaleDateString()}</div>
                        <div className="text-[10px] text-[#747782]">Site: {b.site?.siteName || b.siteId}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#001A48]">
                        {b.supervisor ? `${b.supervisor.firstName} ${b.supervisor.lastName}` : b.supervisorId}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${b.stage === "DEBRIEFING_COMPLETED" ? "bg-[#006E1C] text-white" : b.stage === "BRIEFING_COMPLETED" ? "bg-[#DAE2FF] text-[#002D72]" : "bg-[#FFF8F6] text-[#A83800] border border-[#FFDBCF]"}`}>
                          {b.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-[#002D72]">
                        {b.participants?.length || 0} Employee(s)
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-[#A83800]">
                        {b.carriedIncidents?.length || 0} Incident(s)
                      </td>
                      <td className="py-3 px-3 flex items-center gap-2">
                        {b.stage === "BRIEFING_DRAFT" && (
                          <button
                            disabled={actionLoading}
                            onClick={() => handleCompleteStage(b.id, "BRIEFING_COMPLETED")}
                            className="px-2.5 py-1 bg-[#002D72] text-white rounded text-[10px] font-bold hover:bg-[#001A48]"
                          >
                            COMPLETE BRIEFING
                          </button>
                        )}
                        {b.stage === "BRIEFING_COMPLETED" && (
                          <button
                            disabled={actionLoading}
                            onClick={() => handleCompleteStage(b.id, "DEBRIEFING_COMPLETED")}
                            className="px-2.5 py-1 bg-[#006E1C] text-white rounded text-[10px] font-bold hover:bg-[#005313]"
                          >
                            COMPLETE DEBRIEFING
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

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
              <h2 className="text-lg font-bold text-[#001A48] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#002D72]">assignment_ind</span>
                Initialize Pre-shift Briefing
              </h2>
              <form onSubmit={handleCreateBriefing} className="space-y-4 text-xs">
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
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Safety Notes</label>
                  <input
                    type="text"
                    placeholder="PPE requirements, site hazards..."
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Known Site Risks</label>
                  <input
                    type="text"
                    placeholder="Active construction, VIP visit..."
                    value={knownRisks}
                    onChange={(e) => setKnownRisks(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Temporary Post Instructions</label>
                  <textarea
                    placeholder="Special shift directives..."
                    value={temporaryInstructions}
                    onChange={(e) => setTemporaryInstructions(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                    rows={2}
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
                    START BRIEFING
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
