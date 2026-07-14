"use client";

import React from "react";
import { useSession } from "next-auth/react";

export default function CheckpointsPlaceholder() {
  const { data: session } = useSession();

  return (
    <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
      {/* Header and Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#E7EEFF] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">location_on</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Checkpoint / NFC Tag Master</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#DAE2FF] text-[#002D72] border border-[#B1C5FF] uppercase">
              Phase 1A Placeholder
            </span>
          </div>
          <p className="text-sm text-[#444651] max-w-xl">
            Register and manage physical NFC tags, QR codes, and hardware checkpoints mapped to sites and gates.
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
        <span className="material-[#002D72] material-symbols-outlined text-4xl mb-4">qr_code_2</span>
        <h3 className="text-base font-bold text-[#001A48] mb-1">No Checkpoints Configured</h3>
        <p className="text-xs text-[#747782] max-w-sm mx-auto mb-6">
          Registered tag assets mapping physical coordinates and client site locations will appear here.
        </p>
        <button disabled className="px-4 py-2 bg-[#002D72]/50 text-white text-xs font-bold rounded cursor-not-allowed">
          Register New Tag (Phase 1B)
        </button>
      </div>

      {/* Capabilities */}
      <div className="bg-white border border-[#C4C6D2] rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-[#002D72]">rocket_launch</span>
          Upcoming Capabilities (Phase 1B+)
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#444651] list-inside list-disc">
          <li><strong>NFC Hardware Binding:</strong> Direct validation of scanned hardware IDs.</li>
          <li><strong>Client & Project Mapping:</strong> Clean hierarchy binding coordinates to Client &rarr; Project &rarr; Site.</li>
          <li><strong>Geo-Fencing radius validation:</strong> Visual radius validation boundaries.</li>
        </ul>
      </div>
    </div>
  );
}
