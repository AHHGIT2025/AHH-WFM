"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";

export default function SOSPanicCenterPage() {
  const { data: session } = useSession();
  const [operationType, setOperationType] = useState<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT">("SECURITY_GUARDING");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCursor, setLastCursor] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [assignResponderModal, setAssignResponderModal] = useState<any | null>(null);
  const [responderIdInput, setResponderIdInput] = useState("");
  const [cancelModal, setCancelModal] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [falseAlarmModal, setFalseAlarmModal] = useState<any | null>(null);
  const [falseAlarmReason, setFalseAlarmReason] = useState("");
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Tab visibility monitoring to stop polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // 5-second controlled polling loop
  useEffect(() => {
    fetchIncrementalFeed();
    const interval = setInterval(() => {
      if (isTabVisible) {
        fetchIncrementalFeed();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [operationType, isTabVisible]);

  const fetchIncrementalFeed = async () => {
    try {
      let url = `/api/v1/secfac/control-room/events?operationType=${operationType}&limit=50`;
      if (lastCursor) {
        url += `&updatedAfter=${encodeURIComponent(lastCursor)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.alerts && data.alerts.length > 0) {
          setAlerts((prev) => {
            const map = new Map<string, any>();
            data.alerts.forEach((a: any) => map.set(a.id, a));
            prev.forEach((a: any) => {
              if (!map.has(a.id)) map.set(a.id, a);
            });
            return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
        }
        if (data.dispatches && data.dispatches.length > 0) {
          setDispatches((prev) => {
            const map = new Map<string, any>();
            data.dispatches.forEach((d: any) => map.set(d.id, d));
            prev.forEach((d: any) => {
              if (!map.has(d.id)) map.set(d.id, d);
            });
            return Array.from(map.values());
          });
        }
        if (data.nextCursor) {
          setLastCursor(data.nextCursor);
        }
      }
    } catch (e) {
      console.error("Incremental feed fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const res = await fetch(`/api/v1/secfac/sos/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType })
      });
      if (res.ok) {
        fetchIncrementalFeed();
      } else {
        const err = await res.json();
        alert(`Failed to acknowledge: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error acknowledging: ${e.message}`);
    }
  };

  const handleCreateDispatch = async () => {
    if (!assignResponderModal || !responderIdInput.trim()) return;
    try {
      const res = await fetch("/api/v1/secfac/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType,
          alertId: assignResponderModal.id,
          responderId: responderIdInput.trim(),
          siteId: assignResponderModal.siteId
        })
      });
      if (res.ok) {
        setAssignResponderModal(null);
        setResponderIdInput("");
        fetchIncrementalFeed();
      } else {
        const err = await res.json();
        alert(`Dispatch failed: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error dispatching: ${e.message}`);
    }
  };

  const handleFalseAlarm = async () => {
    if (!falseAlarmModal || !falseAlarmReason.trim()) return;
    try {
      const res = await fetch(`/api/v1/secfac/sos/${falseAlarmModal.id}/false-alarm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType, reason: falseAlarmReason })
      });
      if (res.ok) {
        setFalseAlarmModal(null);
        setFalseAlarmReason("");
        fetchIncrementalFeed();
      } else {
        const err = await res.json();
        alert(`Action failed: ${err.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    try {
      const res = await fetch(`/api/v1/secfac/sos/${cancelModal.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType, reason: cancelReason })
      });
      if (res.ok) {
        setCancelModal(null);
        setCancelReason("");
        fetchIncrementalFeed();
      } else {
        const err = await res.json();
        alert(`Action failed: ${err.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  // Filter SOS Panic alerts
  const sosAlerts = alerts.filter((a) => a.alertCode === "SOS_PANIC");

  return (
    <SecfacPageGuard>
      <div className="flex-1 bg-[#F9F9FF] p-6 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
        {/* Header & Operation Scope Switch */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#E7EEFF] pb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[#BA1A1A] text-3xl">emergency</span>
              <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">SOS Emergency & Control Room Dispatch Center</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#FFDAD6] text-[#BA1A1A] border border-[#BA1A1A]/30 uppercase">
                SECFAC Phase 6A.1 Live Engine
              </span>
            </div>
            <p className="text-xs text-[#444651]">
              Real-time emergency monitoring, dispatcher acknowledgement, SLA tracking, and responder assignment console.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOperationType("SECURITY_GUARDING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                operationType === "SECURITY_GUARDING" ? "bg-[#002D72] text-white shadow" : "bg-white text-[#444651] border border-[#C4C6D2]"
              }`}
            >
              SECURITY GUARDING
            </button>
            <button
              onClick={() => setOperationType("FACILITY_MANAGEMENT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                operationType === "FACILITY_MANAGEMENT" ? "bg-[#002D72] text-white shadow" : "bg-white text-[#444651] border border-[#C4C6D2]"
              }`}
            >
              FACILITY MANAGEMENT
            </button>
          </div>
        </div>

        {/* System Polling Status */}
        <div className="bg-[#E7EEFF] border border-[#B1C5FF] text-[#002D72] px-4 py-2 rounded-lg mb-6 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold">CONTROL ROOM LIVE FEED:</span>
            <span>5-Second Controlled Polling Active {isTabVisible ? "" : "(Paused: Tab Hidden)"}</span>
          </div>
          <button onClick={fetchIncrementalFeed} className="px-2.5 py-1 bg-white border border-[#B1C5FF] rounded font-bold hover:bg-gray-50">
            Refresh Now
          </button>
        </div>

        {/* SOS Panic Alerts Grid */}
        <div className="space-y-4 mb-8">
          <h2 className="text-base font-bold text-[#001A48] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#BA1A1A]">notifications_active</span>
            Active SOS Emergency Alerts ({sosAlerts.length})
          </h2>

          {sosAlerts.length === 0 ? (
            <div className="bg-white border border-[#C4C6D2] rounded-lg p-10 text-center shadow-sm">
              <span className="material-symbols-outlined text-emerald-600 text-4xl mb-2">verified_user</span>
              <h3 className="text-sm font-bold text-[#001A48]">No Active Emergencies</h3>
              <p className="text-xs text-[#747782]">All sites clear. Incoming emergency SOS panic triggers will sound immediately in this console.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sosAlerts.map((alert) => {
                const meta = alert.metadata || {};
                const dispatch = alert.dispatchAssignments && alert.dispatchAssignments[0];
                const isUnack = alert.status === "OPEN";

                return (
                  <div key={alert.id} className={`bg-white rounded-xl border p-5 shadow-sm space-y-3 ${isUnack ? "border-[#BA1A1A] ring-2 ring-[#BA1A1A]/20" : "border-[#C4C6D2]"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                          {alert.severity}
                        </span>
                        <span className="text-xs font-mono font-bold text-gray-500">#{alert.id.slice(-6)}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        alert.status === "OPEN" ? "bg-red-500 text-white animate-pulse" :
                        alert.status === "ACKNOWLEDGED" ? "bg-amber-100 text-amber-800" :
                        alert.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
                      }`}>
                        {alert.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-[#001A48] text-sm">{alert.title}</h4>
                      <p className="text-xs text-[#444651] mt-0.5">{alert.message}</p>
                    </div>

                    <div className="bg-[#F4F5FB] p-3 rounded-lg text-xs space-y-1 font-mono">
                      <p><span className="text-gray-500">GPS:</span> {meta.latitude ? `${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)}` : "Unavailable"}</p>
                      <p><span className="text-gray-500">Hold Duration:</span> {meta.holdDurationMs ? `${meta.holdDurationMs}ms` : "2000ms"}</p>
                      <p><span className="text-gray-500">Triggered At:</span> {new Date(alert.firstDetectedAt).toLocaleTimeString()}</p>
                    </div>

                    {dispatch && (
                      <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs space-y-0.5 text-blue-900">
                        <p className="font-bold">Responder Dispatch (Attempt #{dispatch.attemptNumber}):</p>
                        <p>Status: <span className="font-semibold">{dispatch.status}</span></p>
                        {dispatch.responder && <p>Responder: {dispatch.responder.firstName} {dispatch.responder.lastName}</p>}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {alert.status === "OPEN" && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="flex-1 py-1.5 bg-[#002D72] text-white text-xs font-bold rounded-lg hover:bg-blue-900"
                        >
                          ACKNOWLEDGE
                        </button>
                      )}

                      {(alert.status === "ACKNOWLEDGED" || alert.status === "IN_PROGRESS") && (
                        <button
                          onClick={() => setAssignResponderModal(alert)}
                          className="flex-1 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800"
                        >
                          {dispatch ? "REASSIGN RESPONDER" : "DISPATCH RESPONDER"}
                        </button>
                      )}

                      <button
                        onClick={() => setFalseAlarmModal(alert)}
                        className="px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
                      >
                        FALSE ALARM
                      </button>

                      <button
                        onClick={() => setCancelModal(alert)}
                        className="px-2.5 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Dispatch Responder */}
        {assignResponderModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-[#001A48]">Dispatch Responder Officer</h3>
              <p className="text-xs text-gray-600">Assign a security officer or supervisor to respond to SOS #{assignResponderModal.id.slice(-6)}.</p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Responder Employee ID:</label>
                <input
                  type="text"
                  value={responderIdInput}
                  onChange={(e) => setResponderIdInput(e.target.value)}
                  placeholder="Enter responder employee UUID"
                  className="w-full text-xs p-2.5 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setAssignResponderModal(null)} className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600">
                  Cancel
                </button>
                <button onClick={handleCreateDispatch} className="px-4 py-2 bg-[#002D72] text-white text-xs font-bold rounded-lg">
                  Confirm Dispatch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: False Alarm */}
        {falseAlarmModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-[#001A48]">Mark SOS as False Alarm</h3>
              <textarea
                value={falseAlarmReason}
                onChange={(e) => setFalseAlarmReason(e.target.value)}
                placeholder="Enter mandatory false alarm reason..."
                className="w-full text-xs p-2.5 border rounded-lg h-24"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setFalseAlarmModal(null)} className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600">Cancel</button>
                <button onClick={handleFalseAlarm} className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg">Mark False Alarm</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cancel */}
        {cancelModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-[#001A48]">Cancel SOS Alert</h3>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter mandatory cancellation reason..."
                className="w-full text-xs p-2.5 border rounded-lg h-24"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setCancelModal(null)} className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600">Close</button>
                <button onClick={handleCancel} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg">Confirm Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecfacPageGuard>
  );
}
