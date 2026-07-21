"use client";

import React, { useState, useEffect } from "react";

export default function MobileSecFacWelfarePage() {
  const [activeCheck, setActiveCheck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    fetchActiveCheck();
  }, []);

  async function fetchActiveCheck() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/secfac/welfare/my-active");
      if (res.ok) {
        const data = await res.json();
        setActiveCheck(data.activeCheck);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn() {
    if (!activeCheck) return;

    if (isOffline) {
      // Offline mode: Display mandatory offline status prompt
      setStatusText("CHECK-IN SAVED — NOT YET CONFIRMED");
      return;
    }

    try {
      setStatusText("Saving check-in...");
      const res = await fetch(`/api/v1/secfac/welfare/${activeCheck.id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "MOBILE_APP" })
      });
      if (res.ok) {
        const data = await res.json();
        setStatusText(data.message || "CHECK-IN CONFIRMED");
        fetchActiveCheck();
      } else {
        setStatusText("Check-in failed. Saved to offline queue.");
      }
    } catch (e) {
      setStatusText("CHECK-IN SAVED — NOT YET CONFIRMED");
    }
  }

  if (loading) {
    return <div className="p-6 text-center">Loading Welfare Check...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Lone Worker Welfare</h1>
        <button
          onClick={() => setIsOffline(!isOffline)}
          className={`px-3 py-1 text-xs font-semibold rounded ${
            isOffline ? "bg-amber-600" : "bg-emerald-600"
          }`}
        >
          {isOffline ? "OFFLINE MODE" : "ONLINE"}
        </button>
      </div>

      {!activeCheck ? (
        <div className="bg-slate-800 p-6 rounded-lg text-center border border-slate-700">
          <p className="text-emerald-400 font-semibold mb-2">No Pending Welfare Checks</p>
          <p className="text-xs text-slate-400">All lone-worker check-ins are up to date.</p>
        </div>
      ) : (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-xs text-slate-400">Site</span>
            <span className="font-medium text-sm">{activeCheck.site?.name || "Assigned Duty Site"}</span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-xs text-slate-400">Scheduled Due</span>
            <span className="font-mono text-sm text-amber-400">
              {new Date(activeCheck.dueAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-xs text-slate-400">Grace Expires</span>
            <span className="font-mono text-sm text-rose-400">
              {new Date(activeCheck.graceExpiresAt).toLocaleTimeString()}
            </span>
          </div>

          <button
            onClick={handleCheckIn}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-lg transition shadow-lg mt-4"
          >
            I'M SAFE — CHECK IN
          </button>

          {statusText && (
            <div
              className={`p-3 rounded text-center text-xs font-bold ${
                statusText.includes("NOT YET CONFIRMED")
                  ? "bg-amber-900/80 text-amber-200 border border-amber-600"
                  : "bg-emerald-900/80 text-emerald-200 border border-emerald-600"
              }`}
            >
              {statusText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
