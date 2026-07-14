"use client";

import React from "react";
import { useSession } from "next-auth/react";

export default function ControlRoomPlaceholder() {
  const { data: session } = useSession();

  return (
    <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
      {/* Header and Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#E7EEFF] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">dashboard</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Control Room Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#DAE2FF] text-[#002D72] border border-[#B1C5FF] uppercase">
              Phase 1A Placeholder
            </span>
          </div>
          <p className="text-sm text-[#444651] max-w-xl">
            Real-time monitoring hub for security patrols, checkpoint verification, active alarms, and personnel dispatch logs.
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

      {/* Core Mock Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-[#C4C6D2] p-6 rounded-lg shadow-sm">
          <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider font-mono">Active Patrol Tours</span>
          <h3 className="text-3xl font-bold text-[#001A48] mt-1 font-mono">0 / 0</h3>
          <p className="text-[11px] text-[#747782] mt-2">Currently executing tours in field</p>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-6 rounded-lg shadow-sm">
          <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider font-mono">NFC Checkpoint Scans</span>
          <h3 className="text-3xl font-bold text-[#001A48] mt-1 font-mono">0</h3>
          <p className="text-[11px] text-[#747782] mt-2">Total scanned tag signals today</p>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-6 rounded-lg shadow-sm border-l-4 border-l-[#BA1A1A]">
          <span className="text-[10px] font-bold text-[#BA1A1A] uppercase tracking-wider font-mono">Active SOS Alerts</span>
          <h3 className="text-3xl font-bold text-[#BA1A1A] mt-1 font-mono">0</h3>
          <p className="text-[11px] text-[#747782] mt-2">Critical emergency responses pending</p>
        </div>
      </div>

      {/* Capabilities and Roadmap */}
      <div className="bg-white border border-[#C4C6D2] rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-[#002D72]">rocket_launch</span>
          Upcoming Capabilities (Phase 1B+)
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#444651] list-inside list-disc">
          <li><strong>Live Tour Timeline:</strong> Visual progression maps for guard rounds and inspection steps.</li>
          <li><strong>Urgent SOS Dispatch Overlay:</strong> High-priority emergency trigger console.</li>
          <li><strong>Real-time NFC Tap Feed:</strong> Streaming updates of verified tag logs.</li>
          <li><strong>Geo-Tracking:</strong> GPS tracking mapping unit distances to incident spots.</li>
        </ul>
      </div>
    </div>
  );
}
