"use client";

import React from "react";
import { useSession } from "next-auth/react";

export default function ChecklistBuilderPlaceholder() {
  const { data: session } = useSession();

  return (
    <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
      {/* Header and Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#E7EEFF] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">rule</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Checklist Builder</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#DAE2FF] text-[#002D72] border border-[#B1C5FF] uppercase">
              Phase 1A Placeholder
            </span>
          </div>
          <p className="text-sm text-[#444651] max-w-xl">
            Design dynamic check questions, compliance rules, and input forms mapped to checkpoints or FM locations.
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[#E7EEFF] border border-[#B1C5FF] text-[#002D72] p-4 rounded-lg mb-8 flex items-center gap-3">
        <span className="material-symbols-outlined text-[#002D72]">info</span>
        <span className="text-xs font-bold font-mono">
          Foundation placeholder — no operational records created yet
        </span>
      </div>

      {/* Empty State / Outlined Surface */}
      <div className="bg-white border border-[#C4C6D2] rounded-lg p-12 text-center mb-8 shadow-sm">
        <span className="material-[#002D72] material-symbols-outlined text-4xl mb-4">playlist_add_check</span>
        <h3 className="text-base font-bold text-[#001A48] mb-1">No Checklists Created</h3>
        <p className="text-xs text-[#747782] max-w-sm mx-auto mb-6">
          Dynamic inspection and patrol checklists for security guards and FM staff will be managed here.
        </p>
        <button disabled className="px-4 py-2 bg-[#002D72]/50 text-white text-xs font-bold rounded cursor-not-allowed">
          Create Template (Phase 1B)
        </button>
      </div>

      {/* Capabilities */}
      <div className="bg-white border border-[#C4C6D2] rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-[#002D72]">rocket_launch</span>
          Upcoming Capabilities (Phase 1B+)
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#444651] list-inside list-disc">
          <li><strong>Dynamic Question Types:</strong> Multiple choice, photos, meter readings, text notes.</li>
          <li><strong>Operation Scope Rules:</strong> Differentiated security logs and facility maintenance check sheets.</li>
          <li><strong>Condition Logic:</strong> Trigger sub-questions or incident reports based on failures.</li>
        </ul>
      </div>
    </div>
  );
}
