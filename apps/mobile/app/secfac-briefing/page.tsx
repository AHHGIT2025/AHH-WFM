"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function MobileBriefingPage() {
  const { data: session } = useSession();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("SITE01");

  useEffect(() => {
    fetchBriefings();
  }, [siteId]);

  async function fetchBriefings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/secfac/shift-briefings?siteId=${siteId}`);
      const json = await res.json();
      if (json.success) {
        setBriefings(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Shift Briefing Desk</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            Pre-shift Safety & Carried Incidents
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Active Duty Site ID</label>
        <input
          type="text"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
        />
      </div>

      {/* List */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-on-surface uppercase font-mono tracking-wide text-primary">
          Site Shift Briefings ({briefings.length})
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs font-bold text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary mb-1">sync</span>
            <p>Loading shift briefings...</p>
          </div>
        ) : briefings.length === 0 ? (
          <div className="p-6 bg-surface border border-outline-variant/30 rounded-2xl text-center text-xs text-on-surface-variant">
            No shift briefings logged for site '{siteId}'.
          </div>
        ) : (
          briefings.map((b) => (
            <div key={b.id} className="bg-surface border border-[#C4C6D2] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-container text-on-primary-container">
                  {new Date(b.briefingDate).toLocaleDateString()}
                </span>
                <span className="text-[10px] font-bold uppercase text-primary">
                  {b.stage}
                </span>
              </div>

              {b.safetyNotes && (
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase">Safety Notes</div>
                  <p className="text-xs text-on-surface leading-relaxed">{b.safetyNotes}</p>
                </div>
              )}

              {b.knownRisks && (
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase">Known Risks</div>
                  <p className="text-xs text-on-surface leading-relaxed">{b.knownRisks}</p>
                </div>
              )}

              {b.temporaryInstructions && (
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase">Temporary Instructions</div>
                  <p className="text-xs text-on-surface leading-relaxed">{b.temporaryInstructions}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
