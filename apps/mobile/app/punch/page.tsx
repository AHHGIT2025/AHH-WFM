"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PunchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowedLocation, setAllowedLocation] = useState<any>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [status, setStatus] = useState<string>("Locating GPS...");
  const [punching, setPunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // 1. Fetch Allowed Punch Location
    fetch("/api/v1/allowed-punch-locations")
      .then(res => res.json())
      .then(data => {
        setAllowedLocation(data);
        // 2. Fetch current GPS
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
            setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setStatus("Ready to Punch");
            setLoading(false);
          }, (err) => {
            setErrorMsg("GPS access denied or unavailable.");
            setStatus("GPS Error");
            setLoading(false);
          }, { enableHighAccuracy: true });
        } else {
          setErrorMsg("Geolocation not supported on this device.");
          setLoading(false);
        }
      })
      .catch(() => {
        setErrorMsg("Failed to load allowed locations.");
        setLoading(false);
      });
  }, []);

  const handlePunch = async (type: "IN" | "OUT") => {
    if (!currentCoords || !allowedLocation) return;
    setPunching(true);
    setErrorMsg("");

    try {
      const endpoint = type === "IN" ? "/api/v1/attendance/check-in" : "/api/v1/attendance/check-out";
      const payload = {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        device: navigator.userAgent,
        locationType: allowedLocation.type,
        locationId: allowedLocation.deploymentId || allowedLocation.onCallAssignmentId || allowedLocation.allowedPunchLocationId || allowedLocation.officeLocationId,
        radiusMeters: allowedLocation.radiusMeters,
        targetLat: allowedLocation.lat,
        targetLng: allowedLocation.lng
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setErrorMsg(data.error || "Punch failed");
        setPunching(false);
        return;
      }

      if (type === "IN" && !data.geofenceValid) {
        // Punched in, but out of zone
        alert(`Punched In successfully, but flagged as OUT OF ZONE. Distance: ${data.distanceMeters}m`);
      } else if (type === "IN") {
        alert(`Checked in successfully! Distance: ${data.distanceMeters}m`);
      } else {
        alert(`Checked out successfully!`);
      }

      router.push("/");
      router.refresh();
      
    } catch (err) {
      setErrorMsg("Network error during punch.");
      setPunching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-primary">Live Attendance Tracker</h2>
        <p className="text-[11px] text-on-surface-variant">Your location is captured for geofence validation.</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-xl flex gap-2 text-[10px] font-semibold text-status-error">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Allowed Location Info */}
      <div className="bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full"></div>
        <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Target Geofence Location</h3>
        
        {loading ? (
          <div className="h-10 flex items-center gap-2 text-[11px] text-primary">
            <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading parameters...
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-2 mb-1">
              <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">location_on</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{allowedLocation?.name || "Not Configured"}</p>
                <p className="text-[10px] text-on-surface-variant">Type: {allowedLocation?.type?.replace("_", " ")}</p>
                <p className="text-[10px] text-on-surface-variant">Radius: {allowedLocation?.radiusMeters}m</p>
              </div>
            </div>
            
            {currentCoords && allowedLocation?.lat && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20">
                <p className="text-[10px] text-status-success font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">my_location</span>
                  GPS Acquired: {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Biometric Placeholder */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
          <span className="material-symbols-outlined text-[20px]">face</span>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700">Selfie Verification Coming Soon</p>
          <p className="text-[9px] text-slate-500">AI facial recognition is currently disabled. No biometric data is stored.</p>
        </div>
      </div>

      {/* Offline Mode Placeholder */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
          <span className="material-symbols-outlined text-[16px]">wifi_off</span>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-700">Offline Queue Coming Soon</p>
          <p className="text-[9px] text-slate-500">Punch syncing when offline is in development.</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 grid grid-cols-2 gap-3">
        <button 
          onClick={() => handlePunch("IN")}
          disabled={loading || punching || !currentCoords}
          className="bg-primary text-white font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="material-symbols-outlined">login</span>
          <span className="text-[11px]">Punch In</span>
        </button>
        <button 
          onClick={() => handlePunch("OUT")}
          disabled={loading || punching}
          className="bg-surface border-2 border-primary text-primary font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[11px]">Punch Out</span>
        </button>
      </div>

    </div>
  );
}
