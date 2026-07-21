"use client";

import React, { useState } from "react";

export default function SecFacPatrolAssurancePage() {
  const [selectedException, setSelectedException] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function handleAcknowledge() {
    if (!selectedException) return;

    try {
      setMessage("Submitting acknowledgement...");
      const res = await fetch("/api/v1/secfac/patrol-assurance/acknowledge-exception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointExecutionId: selectedException,
          notes: notes || "Supervisor reviewed and acknowledged exception."
        })
      });

      if (res.ok) {
        setMessage("Patrol exception successfully acknowledged and excused.");
        setSelectedException(null);
        setNotes("");
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.error || "Failed to acknowledge"}`);
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Patrol Assurance & Target-Time Monitoring</h1>
        <p className="text-sm text-slate-500">
          Execution-specific target times (15m late, 30m missed), sequence modes (MANDATORY, ADVISORY, ANY_ORDER), and supervisor exception management
        </p>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Pending Patrol Exceptions</h2>

        <div className="border border-slate-200 rounded divide-y divide-slate-100">
          <div className="p-4 flex justify-between items-center bg-rose-50/50">
            <div>
              <div className="font-semibold text-slate-900 text-sm">North Gate Perimeter — Checkpoint #3</div>
              <div className="text-xs text-slate-500">Target Time: 14:15 | Late Threshold: 14:30 | Status: <span className="font-bold text-rose-600">MISSED (30m+)</span></div>
            </div>
            <button
              onClick={() => setSelectedException("cp-ex-101")}
              className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800"
            >
              Acknowledge Exception
            </button>
          </div>
        </div>

        {selectedException && (
          <div className="bg-slate-50 p-4 rounded border border-slate-300 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Acknowledge Exception (ID: {selectedException})</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter supervisor exception notes and operational justification..."
              className="w-full border border-slate-300 p-2.5 rounded text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleAcknowledge}
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-500"
              >
                CONFIRM & EXCUSE
              </button>
              <button
                onClick={() => setSelectedException(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded text-xs hover:bg-slate-300"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
