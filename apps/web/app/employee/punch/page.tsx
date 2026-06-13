"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Badge } from "@ahh-wfm/ui/src";

export default function MobilePunchPage() {
  const [loading, setLoading] = useState(true);
  const [employeeInfo, setEmployeeInfo] = useState<any>(null);
  const [punchStatus, setPunchStatus] = useState<string>("WAITING");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [matchedGeofence, setMatchedGeofence] = useState<any>(null);

  // Fetch employee context
  useEffect(() => {
    const fetchContext = async () => {
      // Typically, the session tells us the employee ID. 
      // For this demo, let's just query a known employee or the logged-in user.
      try {
        const res = await fetch("/api/v1/employees/EMP002/context"); // Mock endpoint or new endpoint
        // Wait, I don't have an EMP002 context endpoint. Let's just fetch EMP002 details.
        const empRes = await fetch("/api/v1/employees/EMP002/allowed-locations");
        if (empRes.ok) {
            const allowed = await empRes.json();
            setEmployeeInfo({
                id: "EMP002",
                name: "Jane Smith",
                companyName: "AHH WFM",
                allowedLocations: allowed
            });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, []);

  // Mock GPS
  const handleGetLocation = () => {
      setCurrentLocation({ lat: 25.2048, lng: 55.2708 }); // Dubai mock
      setMatchedGeofence("Dubai Mall Project Site");
  };

  const handlePunch = async (type: "IN" | "OUT") => {
      setPunchStatus(`Punching ${type}...`);
      try {
          const endpoint = type === "IN" ? "/api/v1/attendance/check-in" : "/api/v1/attendance/check-out";
          const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  employeeId: "EMP002",
                  lat: currentLocation?.lat || 25.2048,
                  lng: currentLocation?.lng || 55.2708,
                  device: "Mobile Browser",
                  locationName: matchedGeofence || "Unknown"
              })
          });
          const data = await res.json();
          if (res.ok) {
              setPunchStatus(`Success: ${data.message}`);
              // Provide feedback on matched validation
              setMatchedGeofence(`Validation: ${data.validationMethod} (${data.locationSource || 'N/A'})`);
          } else {
              setPunchStatus(`Failed: ${data.error}`);
          }
      } catch (e) {
          setPunchStatus("Network Error");
      }
  };

  if (loading) {
      return <div className="p-6 text-center">Loading Context...</div>;
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="bg-primary text-white p-6 shadow-md rounded-b-3xl mb-4">
          <div className="flex justify-between items-start">
             <div>
                <h1 className="text-2xl font-bold">{employeeInfo?.name || "Employee"}</h1>
                <p className="text-sm opacity-80">{employeeInfo?.companyName || "Holding Company"}</p>
             </div>
             <Badge variant="success">Active</Badge>
          </div>
      </div>

      <div className="px-4 space-y-4 flex-1">
          {/* Current Assignment / Geofence Info */}
          <Card className="p-4 border-l-4 border-l-secondary shadow-sm">
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Today's Assignment</h3>
             <div className="space-y-1">
                <p className="font-semibold text-gray-800">No active project deployment.</p>
                <p className="text-sm text-gray-600">You are configured for Office / Client Site punches.</p>
             </div>
          </Card>

          <Card className="p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location Status</h3>
              {currentLocation ? (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                      <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">location_on</span>
                          GPS Locked
                      </p>
                      <p className="text-xs text-green-700 mt-1">{currentLocation.lat}, {currentLocation.lng}</p>
                      <p className="text-xs font-bold mt-2 pt-2 border-t border-green-200">Matched: {matchedGeofence}</p>
                  </div>
              ) : (
                  <Button variant="secondary" className="w-full" onClick={handleGetLocation}>
                      Get Current GPS Location
                  </Button>
              )}
          </Card>

          {/* Allowed Punch Locations Info */}
          <Card className="p-4 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Allowed Geofences</h3>
              {employeeInfo?.allowedLocations?.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                      {employeeInfo.allowedLocations.map((loc: any) => (
                          <li key={loc.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                              <span className="font-medium text-gray-700">{loc.allowedPunchLocation?.name}</span>
                              <span className="text-xs text-gray-500">{loc.allowedPunchLocation?.radiusMeters}m radius</span>
                          </li>
                      ))}
                  </ul>
              ) : (
                  <p className="text-xs text-gray-500 italic">No static allowed locations defined. Fallback to Project/Shift site or Office.</p>
              )}
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4">
              <Button onClick={() => handlePunch("IN")} disabled={!currentLocation} className="py-4 font-bold text-lg">
                  PUNCH IN
              </Button>
              <Button onClick={() => handlePunch("OUT")} disabled={!currentLocation} variant="secondary" className="py-4 font-bold text-lg bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200 border">
                  PUNCH OUT
              </Button>
          </div>

          {punchStatus !== "WAITING" && (
              <div className="text-center text-sm font-bold mt-4 p-3 rounded bg-gray-100 border border-gray-200">
                  {punchStatus}
              </div>
          )}
      </div>
    </div>
  );
}
