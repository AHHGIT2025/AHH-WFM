"use client";

import React, { useState } from "react";

export default function MobileSecFacPatrolAssurancePage() {
  const [sequenceWarning, setSequenceWarning] = useState<string | null>(null);

  function handleScanCheckpoint(scannedSeq: number, expectedSeq: number, mode: "MANDATORY" | "ADVISORY" | "ANY_ORDER") {
    if (mode === "MANDATORY" && scannedSeq !== expectedSeq) {
      setSequenceWarning(`SEQUENCE DEVIATION BLOCKED: Expected Checkpoint #${expectedSeq}, scanned #${scannedSeq}.`);
      return;
    }
    if (mode === "ADVISORY" && scannedSeq !== expectedSeq) {
      setSequenceWarning(`ADVISORY WARNING: Out of order scan detected (#${scannedSeq} vs expected #${expectedSeq}).`);
      return;
    }
    setSequenceWarning(null);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Patrol Checkpoint Assurance</h1>

      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>Route Mode</span>
          <span className="font-bold text-indigo-400">MANDATORY SEQUENCE</span>
        </div>

        <div className="space-y-2">
          <div className="p-3 bg-slate-900 rounded border border-emerald-500 flex justify-between items-center text-sm">
            <span>#1 Gate 1 Main Entrance</span>
            <span className="text-emerald-400 text-xs font-bold">ON TIME</span>
          </div>

          <div className="p-3 bg-slate-900 rounded border border-amber-500 flex justify-between items-center text-sm">
            <span>#2 North Perimeter Wall</span>
            <span className="text-amber-400 text-xs font-bold">TARGET: 10 mins</span>
          </div>

          <div className="p-3 bg-slate-900 rounded border border-slate-700 flex justify-between items-center text-sm">
            <span>#3 Electrical Substation</span>
            <span className="text-slate-400 text-xs">PENDING</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => handleScanCheckpoint(3, 2, "MANDATORY")}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded"
          >
            SIMULATE OUT-OF-ORDER SCAN (#3 BEFORE #2)
          </button>
        </div>

        {sequenceWarning && (
          <div className="p-3 bg-rose-900/90 text-rose-200 rounded border border-rose-500 text-xs font-bold text-center">
            {sequenceWarning}
          </div>
        )}
      </div>
    </div>
  );
}
