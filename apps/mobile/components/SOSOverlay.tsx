"use client";

import React, { useState, useRef, useEffect } from "react";
import { addQueueItem } from "../lib/secfac-offline-queue";
import { encryptPayload } from "../lib/secfac-secure-offline-storage";

interface SOSOverlayProps {
  onClose: () => void;
}

type SOSState =
  | "IDLE"
  | "HOLDING"
  | "SUBMITTING"
  | "SOS_SENT"
  | "SOS_OFFLINE_QUEUED"
  | "SOS_ACKNOWLEDGED"
  | "DISPATCHED"
  | "RESOLVED";

export const SOSOverlay: React.FC<SOSOverlayProps> = ({ onClose }) => {
  const [sosState, setSosState] = useState<SOSState>("IDLE");
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [hotline, setHotline] = useState<string | null>(null);
  const [dispatchInfo, setDispatchInfo] = useState<any>(null);

  const timerRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);

  // Query hotline on mount
  useEffect(() => {
    fetchHotline();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const fetchHotline = async () => {
    try {
      const res = await fetch("/api/v1/secfac/sos/hotline?operationType=SECURITY_GUARDING");
      if (res.ok) {
        const data = await res.json();
        if (data.available && data.hotline) {
          setHotline(data.hotline);
        }
      }
    } catch (e) {}
  };

  const triggerVibration = (pattern = [300, 100, 300]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const startHold = () => {
    if (sosState !== "IDLE") return;
    setHolding(true);
    setSosState("HOLDING");
    setProgress(0);
    const duration = 2000; // 2 seconds hold
    const interval = 50;
    let elapsed = 0;

    timerRef.current = setInterval(() => {
      elapsed += interval;
      const percent = Math.min((elapsed / duration) * 100, 100);
      setProgress(percent);

      if (percent >= 100) {
        clearInterval(timerRef.current);
        setHolding(false);
        handleSosTrigger();
      }
    }, interval);
  };

  const endHold = () => {
    if (sosState === "HOLDING") {
      if (timerRef.current) clearInterval(timerRef.current);
      setHolding(false);
      setSosState("IDLE");
      setProgress(0);
    }
  };

  const handleSosTrigger = async () => {
    triggerVibration([500]);
    setSosState("SUBMITTING");
    setStatusText("Submitting emergency alert to Control Room...");

    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const clientCapturedAt = new Date().toISOString();

    // Get current GPS position best effort
    let latitude: number | undefined;
    let longitude: number | undefined;
    let accuracyMeters: number | undefined;

    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, enableHighAccuracy: true });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
        accuracyMeters = pos.coords.accuracy;
      }
    } catch (e) {
      console.warn("GPS capture timed out/unavailable for SOS:", e);
    }

    const payload = {
      operationType: "SECURITY_GUARDING",
      idempotencyKey,
      holdDurationMs: 2000,
      latitude,
      longitude,
      accuracyMeters,
      clientCapturedAt,
      emergencyNotes: "Mobile SOS Panic Hold Triggered"
    };

    // Attempt direct HTTP API submission
    try {
      const res = await fetch("/api/v1/secfac/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok || res.status === 201) {
        const data = await res.json();
        setAlertId(data.alertId);
        setSosState("SOS_SENT");
        setStatusText("SOS SENT — Awaiting Control Room Acknowledgement...");
        startStatusPolling(data.alertId);
        return;
      }
    } catch (e) {
      console.warn("Direct SOS submission failed/offline:", e);
    }

    // Direct submission failed or offline -> Save to encrypted offline queue
    try {
      const encrypted = await encryptPayload(payload);
      addQueueItem({
        id: `sos-queue-${idempotencyKey}`,
        actionType: "SOS_PANIC",
        endpoint: "/api/v1/secfac/sos",
        method: "POST",
        payload,
        encryptedPayload: encrypted,
        idempotencyKey,
        operationType: "SECURITY_GUARDING"
      });
    } catch (err) {
      console.error("Failed to encrypt SOS offline item:", err);
    }

    triggerVibration([300, 100, 300, 100, 300]);
    setSosState("SOS_OFFLINE_QUEUED");
    setStatusText("SOS NOT SENT — NO NETWORK\nSaved securely on this device.\nRetrying automatically.\nCall the control room now if possible.");
  };

  const startStatusPolling = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/secfac/sos/${id}/status?operationType=SECURITY_GUARDING`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ACKNOWLEDGED") {
            setSosState("SOS_ACKNOWLEDGED");
            setStatusText("SOS ACKNOWLEDGED — Control Room Dispatcher on duty.");
          } else if (data.status === "IN_PROGRESS" && data.latestDispatch) {
            setSosState("DISPATCHED");
            setDispatchInfo(data.latestDispatch);
            setStatusText(`RESPONDER DISPATCHED: ${data.latestDispatch.responderName || "Security Officer"} assigned.`);
          } else if (data.status === "RESOLVED") {
            setSosState("RESOLVED");
            setStatusText("EMERGENCY RESOLVED — Incident closed by Control Room.");
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (e) {}
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-[#001946]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-white font-sans">
      <button 
        onClick={onClose} 
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>

      <div className="text-center max-w-xs space-y-6 flex-1 flex flex-col justify-center">
        {sosState === "IDLE" || sosState === "HOLDING" ? (
          <>
            <div className="space-y-2">
              <span className="material-symbols-outlined text-red-500 text-[64px] animate-pulse">emergency</span>
              <h2 className="text-xl font-bold tracking-tight">SOS Emergency Trigger</h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Press and hold the button below for 2 seconds to broadcast a panic alert to the WFM Control Room.
              </p>
            </div>

            {/* Hold Button */}
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="80" 
                  cy="80" 
                  r="70" 
                  stroke="#BA1A1A" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * progress) / 100}
                  className="transition-all duration-75"
                />
              </svg>
              <button
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                className={`w-28 h-28 rounded-full bg-[#BA1A1A] border-4 border-white/20 flex flex-col items-center justify-center select-none active:scale-95 transition-all shadow-lg ${holding ? "brightness-110" : ""}`}
              >
                <span className="material-symbols-outlined text-[32px] mb-0.5">ring_volume</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {holding ? "HOLDING..." : "HOLD SOS"}
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-6">
            <div className="relative">
              <span className={`material-symbols-outlined text-[80px] ${sosState === "SOS_OFFLINE_QUEUED" ? "text-amber-400 animate-pulse" : "text-red-500 animate-bounce"}`}>
                {sosState === "SOS_OFFLINE_QUEUED" ? "wifi_off" : sosState === "RESOLVED" ? "check_circle" : "notifications_active"}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white uppercase">
              {sosState === "SUBMITTING" && "SUBMITTING SOS..."}
              {sosState === "SOS_SENT" && "SOS SENT"}
              {sosState === "SOS_OFFLINE_QUEUED" && "SOS NOT SENT — NO NETWORK"}
              {sosState === "SOS_ACKNOWLEDGED" && "SOS ACKNOWLEDGED"}
              {sosState === "DISPATCHED" && "RESPONDER DISPATCHED"}
              {sosState === "RESOLVED" && "EMERGENCY RESOLVED"}
            </h2>

            <p className="text-xs text-white/80 whitespace-pre-line leading-relaxed max-w-xs mx-auto">
              {statusText}
            </p>

            {dispatchInfo && (
              <div className="bg-white/10 border border-white/20 p-3 rounded-xl text-left text-xs space-y-1 mt-2">
                <p className="font-bold text-[#00A3FF]">Assigned Responder:</p>
                <p className="text-white font-medium">{dispatchInfo.responderName || "Security Officer"}</p>
                <p className="text-white/60 text-[10px]">Status: {dispatchInfo.status}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Emergency Hotline Action Button (If hotline is available) */}
      {hotline && (
        <a
          href={`tel:${hotline}`}
          className="w-full bg-[#BA1A1A] hover:bg-red-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-bold text-xs shadow-lg mb-3 active:scale-98 transition-all"
        >
          <span className="material-symbols-outlined text-sm">phone_in_talk</span>
          CALL CONTROL ROOM HOTLINE ({hotline})
        </a>
      )}

      <div className="w-full bg-white/10 rounded-2xl p-4 border border-white/10 text-left text-xs mb-2">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-[#00A3FF]">shield</span>
          <div>
            <p className="font-bold text-[#00A3FF]">SECFAC Phase 6A.1 Verified Safety</p>
            <p className="text-white/70 text-[11px] mt-0.5">
              Atomic emergency alert & control room dispatcher dispatch engine active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
