"use client";

import React, { useState, useEffect } from "react";
import { Employee, AttendanceRecord, LeaveRequest, Worksite } from "@ahh-wfm/types";
import { Card, Badge, Input, Button, Modal } from "@ahh-wfm/ui/src";

export default function MobileHomePage() {
  const [data, setData] = useState<{
    employees: Employee[];
    attendance: AttendanceRecord[];
    leaves: LeaveRequest[];
  }>({ employees: [], attendance: [], leaves: [] });

  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Simulated GPS Locations selector for manual testing
  const [gpsSim, setGpsSim] = useState("doha_hq");
  const getSimulatedCoords = () => {
    switch (gpsSim) {
      case "doha_hq":
        return { lat: 25.3186, lng: 51.5284, name: "Doha Headquarters" };
      case "lusail":
        return { lat: 25.4208, lng: 51.4904, name: "Lusail Construction Site" };
      case "out_of_zone":
      default:
        return { lat: 25.0, lng: 51.0, name: "Remote Desert Field" };
    }
  };

  // Correction Request state
  const [isCorrOpen, setIsCorrOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [corrCheckIn, setCorrCheckIn] = useState("");
  const [corrCheckOut, setCorrCheckOut] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [submittingCorr, setSubmittingCorr] = useState(false);

  const employeeId = "AA-1001"; // Mock authenticated employee (Ahmed Ali)

  const fetchDb = async () => {
    try {
      const [empRes, attRes, lvRes, wsRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/attendance"),
        fetch("/api/v1/leaves"),
        fetch("/api/v1/worksites")
      ]);
      if (empRes.ok && attRes.ok && lvRes.ok && wsRes.ok) {
        setData({
          employees: await empRes.json(),
          attendance: await attRes.json(),
          leaves: await lvRes.json()
        });
        setWorksites(await wsRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setDate(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const employee = data.employees.find(e => e.id === employeeId);
  const activeRecord = data.attendance.find(a => a.employeeId === employeeId && !a.checkOut);
  const employeeRecords = data.attendance.filter(a => a.employeeId === employeeId);

  const handleAttendanceToggle = async () => {
    setChecking(true);
    setErrorMessage("");
    try {
      if (activeRecord) {
        const res = await fetch("/api/v1/attendance/check-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId })
        });
        if (!res.ok) {
          const err = await res.json();
          setErrorMessage(err.error || "Failed to check out");
        }
      } else {
        const sim = getSimulatedCoords();
        const res = await fetch("/api/v1/attendance/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            lat: sim.lat,
            lng: sim.lng,
            device: "iPhone 15 Pro Max · GPS Active",
            locationName: sim.name
          })
        });
        if (!res.ok) {
          const err = await res.json();
          setErrorMessage(err.error || "Failed to check in");
        }
      }
      fetchDb();
    } catch (e) {
      setErrorMessage("Connection failure");
    } finally {
      setChecking(false);
    }
  };

  const handleOpenCorrection = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setCorrCheckIn(rec.checkIn ? new Date(rec.checkIn).toISOString().slice(0, 16) : "");
    setCorrCheckOut(rec.checkOut ? new Date(rec.checkOut).toISOString().slice(0, 16) : "");
    setCorrReason("");
    setIsCorrOpen(true);
  };

  const handleSendCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmittingCorr(true);
    try {
      const res = await fetch("/api/v1/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceRecordId: selectedRecord.id,
          requestedCheckIn: corrCheckIn ? new Date(corrCheckIn).toISOString() : undefined,
          requestedCheckOut: corrCheckOut ? new Date(corrCheckOut).toISOString() : undefined,
          reason: corrReason
        })
      });
      if (res.ok) {
        setIsCorrOpen(false);
        fetchDb();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit correction");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setSubmittingCorr(false);
    }
  };

  const approvedLeaves = data.leaves.filter(l => l.employeeId === employeeId && l.status === "Approved").length;

  return (
    <div className="space-y-6">
      {/* Time display */}
      <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-on-primary shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">{date || "Loading..."}</p>
          <div className="text-4xl font-extrabold text-glow tracking-tight leading-none mb-6 font-mono">{time || "00:00:00"}</div>
          
          {errorMessage && (
            <div className="w-full mb-3 p-2 bg-status-error/20 border border-status-error/30 text-white rounded text-center text-xs font-bold">
              {errorMessage}
            </div>
          )}

          <div className="w-full bg-white/10 backdrop-blur-md rounded-xl p-3 flex justify-between items-center border border-white/10">
            <div className="flex flex-col">
              <span className="text-[10px] opacity-75 font-semibold uppercase">Current Status</span>
              <span className="text-sm font-bold mt-0.5">
                {activeRecord ? "Clocked In" : "Checked Out"}
              </span>
            </div>
            <Button
              disabled={checking}
              onClick={handleAttendanceToggle}
              className="bg-white text-primary font-bold text-xs py-2 px-5 rounded-lg shadow-md hover:bg-white/95 active:scale-95 transition-transform"
            >
              {checking ? "Processing..." : activeRecord ? "Check Out" : "Check In"}
            </Button>
          </div>
        </div>
      </section>

      {/* GPS Location Simulation */}
      {!activeRecord && (
        <section className="space-y-1.5">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Simulate Current GPS Location</label>
          <select
            className="w-full bg-surface border border-outline-variant text-xs font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20"
            value={gpsSim}
            onChange={(e) => setGpsSim(e.target.value)}
          >
            <option value="doha_hq">📍 Doha Headquarters (Within Geofence Zone)</option>
            <option value="lusail">🏗️ Lusail Construction Site (Within Geofence Zone)</option>
            <option value="out_of_zone">🏜️ Remote Desert Field (Out of Zone)</option>
          </select>
        </section>
      )}

      {/* Active Record Feedback */}
      {activeRecord && (
        <section className="space-y-3">
          <Card className={`p-4 border ${activeRecord.status === "OUT_OF_ZONE" ? "border-status-warning bg-status-warning/5" : "border-status-success bg-status-success/5"} flex items-center gap-3.5`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeRecord.status === "OUT_OF_ZONE" ? "bg-status-warning/10 text-status-warning" : "bg-status-success/10 text-status-success"}`}>
              <span className="material-symbols-outlined text-xl">
                {activeRecord.status === "OUT_OF_ZONE" ? "warning" : "location_on"}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-primary">Geofence Status</h3>
              <p className={`text-[11px] font-bold mt-0.5 ${activeRecord.status === "OUT_OF_ZONE" ? "text-status-warning" : "text-status-success"}`}>
                {activeRecord.status === "OUT_OF_ZONE" ? "Out of Zone Flagged" : "In Zone (Doha HQ)"}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{activeRecord.locationName}</p>
            </div>
          </Card>

          {activeRecord.lateMinutes > 0 && (
            <Card className="p-4 border border-status-error bg-status-error/5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-status-error/10 text-status-error flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">schedule</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-primary">Late Arrival Flagged</h3>
                <p className="text-[11px] text-status-error font-bold mt-0.5">
                  Checked in {activeRecord.lateMinutes} minutes late
                </p>
              </div>
            </Card>
          )}
        </section>
      )}

      {/* Bento Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wider px-1">This Month</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="col-span-2 p-4 border-l-4 border-l-primary flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase">Attendance Rate</span>
              <span className="material-symbols-outlined text-primary/40 text-lg">analytics</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-primary">91%</span>
              <span className="text-[10px] text-on-surface-variant font-medium">(20 / 22 Days)</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: "91%" }}></div>
            </div>
          </Card>

          <Card className="p-4 border border-outline-variant flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-status-error/10 flex items-center justify-center text-status-error">
              <span className="material-symbols-outlined text-base">schedule</span>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Late Arrivals</p>
              <p className="text-lg font-bold text-primary mt-0.5">
                {employeeRecords.filter(r => r.status === "LATE").length} <span className="text-[10px] font-normal text-on-surface-variant">Days</span>
              </p>
            </div>
          </Card>

          <Card className="p-4 border border-outline-variant flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-status-pending/10 flex items-center justify-center text-status-pending">
              <span className="material-symbols-outlined text-base">event_busy</span>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-medium">Leave Approved</p>
              <p className="text-lg font-bold text-primary mt-0.5">{approvedLeaves} <span className="text-[10px] font-normal text-on-surface-variant">Days</span></p>
            </div>
          </Card>
        </div>
      </section>

      {/* Recent Activity Logs & Correction Trigger */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wider px-1">Recent Activity</h2>
        <div className="space-y-2.5">
          {employeeRecords.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic p-4 text-center">No clock-ins recorded yet.</p>
          ) : (
            employeeRecords.slice(0, 5).map((rec) => (
              <div key={rec.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30 flex items-center gap-3.5 hover:bg-surface-container-high transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  rec.status === "ON_TIME" ? "bg-status-success" : 
                  rec.status === "LATE" ? "bg-status-error" : 
                  rec.status === "OUT_OF_ZONE" ? "bg-status-warning" : 
                  "bg-slate-400"
                }`}></div>
                <div className="flex-grow">
                  <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span>{rec.checkOut ? "Checked Out" : "Checked In"}</span>
                    <Badge variant={
                      rec.status === "ON_TIME" ? "success" :
                      rec.status === "LATE" ? "error" :
                      rec.status === "OUT_OF_ZONE" ? "warning" : "neutral"
                    } className="text-[9px] py-0 px-1.5 uppercase font-extrabold">
                      {rec.status}
                    </Badge>
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                    {rec.locationName}
                  </p>
                  {rec.checkOut && rec.status !== "PENDING_CORRECTION" && (
                    <button
                      onClick={() => handleOpenCorrection(rec)}
                      className="text-[9px] font-bold text-primary underline mt-1 block hover:text-primary-container"
                    >
                      Request Time Correction
                    </button>
                  )}
                  {rec.status === "PENDING_CORRECTION" && (
                    <span className="text-[9px] font-bold text-status-warning block mt-1">
                      Correction Review Pending
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant font-mono font-medium">
                  {new Date(rec.checkOut || rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Time Correction Modal */}
      <Modal isOpen={isCorrOpen} onClose={() => setIsCorrOpen(false)} title="Submit Correction Request">
        {selectedRecord && (
          <form onSubmit={handleSendCorrection} className="space-y-4">
            <p className="text-[11px] font-semibold text-on-surface-variant bg-surface-container p-2.5 rounded">
              Original: {new Date(selectedRecord.originalCheckIn).toLocaleString()} 
              {selectedRecord.originalCheckOut ? ` — ${new Date(selectedRecord.originalCheckOut).toLocaleString()}` : ""}
            </p>
            <Input
              label="Requested Check-In"
              type="datetime-local"
              value={corrCheckIn}
              onChange={(e) => setCorrCheckIn(e.target.value)}
              required
            />
            <Input
              label="Requested Check-Out"
              type="datetime-local"
              value={corrCheckOut}
              onChange={(e) => setCorrCheckOut(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Reason for correction</label>
              <textarea
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={3}
                placeholder="Explain why the adjustment is needed..."
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="secondary" type="button" onClick={() => setIsCorrOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submittingCorr}>
                {submittingCorr ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
