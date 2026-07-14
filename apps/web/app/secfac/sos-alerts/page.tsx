"use client";

import React from "react";
import { useSession } from "next-auth/react";

export default function SOSAlertsPlaceholder() {
  const { data: session } = useSession();

  return (
    <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
      {/* Header and Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#E7EEFF] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#BA1A1A] text-3xl">emergency</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">SOS Panic Alert Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#FFDAD6] text-[#BA1A1A] border border-[#BA1A1A]/30 uppercase animate-pulse">
              Phase 1A Placeholder
            </span>
          </div>
          <p className="text-sm text-[#444651] max-w-xl">
            Critical response console to manage emergency calls, panic triggers, and dispatcher escalation records.
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
        <span className="material-[#BA1A1A] material-symbols-outlined text-4xl mb-4 text-[#BA1A1A]">ring_volume</span>
        <h3 className="text-base font-bold text-[#001A48] mb-1">No Active Emergencies</h3>
        <p className="text-xs text-[#747782] max-w-sm mx-auto mb-6">
          Critical alert status signals sent from the mobile companion app will ring inside this center.
        </p>
        <button disabled className="px-4 py-2 bg-[#BA1A1A]/50 text-white text-xs font-bold rounded cursor-not-allowed">
          Emergency Dispatch Console (Phase 1B)
        </button>
      </div>

      {/* Capabilities */}
      <div className="bg-white border border-[#C4C6D2] rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-[#002D72]">rocket_launch</span>
          Upcoming Capabilities (Phase 1B+)
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#444651] list-inside list-disc">
          <li><strong>Audio Panic Alarm:</strong> Persistent alert tone for dispatchers on incoming SOS.</li>
          <li><strong>GPS Coordinate Lock:</strong> Maps precise officer positions on receipt of panic trigger.</li>
          <li><strong>Escalation Logs:</strong> Tracks response teams dispatched to target locations.</li>
        </ul>
      </div>
    </div>
  );
}
