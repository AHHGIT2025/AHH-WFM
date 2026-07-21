"use client";

import React, { useState, useEffect } from "react";

export default function MobileSecFacDispatchPage() {
  const [dispatch, setDispatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    fetchActiveDispatch();
  }, []);

  async function fetchActiveDispatch() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/secfac/dispatch/my-active");
      if (res.ok) {
        const data = await res.json();
        setDispatch(data.activeDispatch);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "accept" | "reject" | "arrive" | "complete") {
    if (!dispatch) return;

    try {
      setStatusMessage(`Processing ${action}...`);
      const body: any = {};
      if (action === "reject") {
        body.rejectionCategory = "UNAVAILABLE";
        body.rejectionReason = "Field responder unavailable";
      }
      if (action === "arrive") {
        body.latitude = 25.2854;
        body.longitude = 51.5310;
        body.gpsAccuracyMeters = 5;
      }
      if (action === "complete") {
        body.completionNotes = notes || "Dispatch completed on site.";
      }

      const res = await fetch(`/api/v1/secfac/dispatch/${dispatch.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setStatusMessage(`Successfully ${action}ed dispatch.`);
        fetchActiveDispatch();
      } else {
        const err = await res.json();
        setStatusMessage(`Action failed: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    }
  }

  if (loading) return <div className="p-6 text-white text-center">Loading Dispatch...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Responder Emergency Dispatch</h1>

      {!dispatch ? (
        <div className="bg-slate-800 p-6 rounded-lg text-center border border-slate-700">
          <p className="text-slate-400">No active dispatch assignments.</p>
        </div>
      ) : (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-700 pb-2">
            <span className="text-xs text-slate-400">Alert Title</span>
            <span className="font-semibold text-sm text-amber-400">{dispatch.alert?.title}</span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-700 pb-2">
            <span className="text-xs text-slate-400">Current Status</span>
            <span className="px-2 py-0.5 text-xs font-bold bg-indigo-900 text-indigo-200 rounded">
              {dispatch.status}
            </span>
          </div>

          {dispatch.status === "PENDING_ACCEPTANCE" && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => handleAction("accept")}
                className="py-3 bg-emerald-600 font-bold rounded hover:bg-emerald-500"
              >
                ACCEPT
              </button>
              <button
                onClick={() => handleAction("reject")}
                className="py-3 bg-rose-600 font-bold rounded hover:bg-rose-500"
              >
                REJECT
              </button>
            </div>
          )}

          {dispatch.status === "ACCEPTED" && (
            <button
              onClick={() => handleAction("arrive")}
              className="w-full py-3 bg-blue-600 font-bold rounded hover:bg-blue-500 mt-4"
            >
              MARK ARRIVED AT SCENE (GPS)
            </button>
          )}

          {dispatch.status === "ARRIVED" && (
            <div className="space-y-3 mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter completion notes & resolution findings..."
                className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleAction("complete")}
                className="w-full py-3 bg-purple-600 font-bold rounded hover:bg-purple-500"
              >
                COMPLETE DISPATCH
              </button>
            </div>
          )}

          {statusMessage && (
            <div className="p-2 bg-slate-900 rounded text-center text-xs text-slate-300">
              {statusMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
