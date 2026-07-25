"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LocationService, LocationResult } from "../../lib/location-service";

export default function PunchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowedLocation, setAllowedLocation] = useState<any>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<string>("Ready to verify location");
  const [punching, setPunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [pendingType, setPendingType] = useState<"IN" | "OUT" | null>(null);

  useEffect(() => {
    // 1. Fetch Allowed Punch Location on load (Do NOT trigger GPS automatically on load)
    fetch("/api/v1/allowed-punch-locations")
      .then((res) => res.json())
      .then((data) => {
        setAllowedLocation(data);
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg("Failed to load allowed locations.");
        setLoading(false);
      });
  }, []);

  const initiatePunch = (type: "IN" | "OUT") => {
    setErrorMsg("");
    setPendingType(type);
    // Show rationale/explanation dialog before invoking location acquisition
    setShowExplanationModal(true);
  };

  const confirmAndAcquireLocation = async () => {
    setShowExplanationModal(false);
    if (!pendingType) return;

    const type = pendingType;
    setPunching(true);
    setErrorMsg("");
    setStatus("Acquiring GPS location...");

    const locResult: LocationResult = await LocationService.getCurrentLocation();

    if (!locResult.success || !locResult.coords) {
      setErrorMsg(locResult.errorMessage || "Unable to acquire location.");
      setStatus("Location Acquisition Failed");
      setPunching(false);
      setPendingType(null);
      return;
    }

    const coords = locResult.coords;
    setCurrentCoords({ lat: coords.latitude, lng: coords.longitude });
    setStatus("Location Verified");

    await executePunch(type, coords.latitude, coords.longitude);
  };

  const executePunch = async (type: "IN" | "OUT", lat: number, lng: number) => {
    try {
      const endpoint = type === "IN" ? "/api/v1/attendance/check-in" : "/api/v1/attendance/check-out";
      const payload = {
        latitude: lat,
        longitude: lng,
        device: typeof navigator !== "undefined" ? navigator.userAgent : "MobileApp",
        locationType: allowedLocation?.type,
        locationId:
          allowedLocation?.deploymentId ||
          allowedLocation?.onCallAssignmentId ||
          allowedLocation?.allowedPunchLocationId ||
          allowedLocation?.officeLocationId,
        radiusMeters: allowedLocation?.radiusMeters,
        targetLat: allowedLocation?.lat,
        targetLng: allowedLocation?.lng,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Punch failed");
        setPunching(false);
        setPendingType(null);
        return;
      }

      if (type === "IN" && !data.geofenceValid) {
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
      setPendingType(null);
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
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-xl flex gap-2 text-[11px] font-semibold text-status-error">
          <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Explanation Modal */}
      {showExplanationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-outline-variant/30">
            <div className="flex items-center gap-3 text-primary">
              <span className="material-symbols-outlined text-[28px]">location_on</span>
              <h3 className="font-bold text-base text-on-surface">Location Verification</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {LocationService.PERMISSION_EXPLANATION}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowExplanationModal(false);
                  setPendingType(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant rounded-xl border border-outline-variant/40"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndAcquireLocation}
                className="px-4 py-2 text-xs font-semibold bg-primary text-white rounded-xl shadow"
              >
                Continue
              </button>
            </div>
          </div>
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
                {allowedLocation?.geofenceConfigured === false ? (
                  <>
                    <p className="text-sm font-bold text-on-surface">Not Configured</p>
                    <p className="text-[10px] text-status-error font-semibold mt-1">
                      Reason:{" "}
                      {allowedLocation.reason === "SITE_GEOFENCE_NOT_CONFIGURED"
                        ? "Site geofence coordinates are missing"
                        : allowedLocation.reason === "EMPLOYEE_DEFAULT_LOCATION_GEOFENCE_NOT_CONFIGURED"
                        ? "Default office location geofence is missing"
                        : allowedLocation.reason === "NO_ACTIVE_ASSIGNMENT"
                        ? "No active assignment for today"
                        : "Geofence coordinates are not configured"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-on-surface">
                      {allowedLocation?.locationName || allowedLocation?.name || "Worksite"}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      Type: {allowedLocation?.dutySource?.replace(/_/g, " ") || allowedLocation?.type?.replace(/_/g, " ")}
                    </p>
                    {allowedLocation?.radiusMeters !== undefined && allowedLocation?.radiusMeters > 0 && (
                      <p className="text-[10px] text-on-surface-variant">Radius: {allowedLocation?.radiusMeters}m</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {currentCoords && (
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
          onClick={() => initiatePunch("IN")}
          disabled={loading || punching}
          className="bg-primary text-white font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="material-symbols-outlined">login</span>
          <span className="text-[11px]">{punching && pendingType === "IN" ? "Locating..." : "Punch In"}</span>
        </button>
        <button
          onClick={() => initiatePunch("OUT")}
          disabled={loading || punching}
          className="bg-surface border-2 border-primary text-primary font-bold py-4 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[11px]">{punching && pendingType === "OUT" ? "Locating..." : "Punch Out"}</span>
        </button>
      </div>
    </div>
  );
}
