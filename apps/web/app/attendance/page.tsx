"use client";

import React, { useState, useEffect } from "react";
import { AttendanceRecord, AttendanceCorrection } from "@ahh-wfm/types";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [search, setSearch] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedCorr, setSelectedCorr] = useState<AttendanceCorrection | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [actionType, setActionType] = useState<"Approved" | "Rejected">("Approved");

  const fetchData = async () => {
    try {
      const [attRes, corrRes] = await Promise.all([
        fetch("/api/v1/attendance"),
        fetch("/api/v1/attendance/corrections")
      ]);
      if (attRes.ok) setAttendance(await attRes.json());
      if (corrRes.ok) setCorrections(await corrRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorr) return;
    try {
      const res = await fetch(`/api/v1/attendance/corrections/${selectedCorr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionType,
          reviewNotes
        })
      });
      if (res.ok) {
        setIsReviewOpen(false);
        setReviewNotes("");
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to process review");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const filtered = attendance.filter((rec) => {
    return rec.employeeName.toLowerCase().includes(search.toLowerCase()) || rec.employeeId.toLowerCase().includes(search.toLowerCase()) || rec.locationName.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ON_TIME":
        return <Badge variant="success">On Time</Badge>;
      case "LATE":
        return <Badge variant="error">Late</Badge>;
      case "OUT_OF_ZONE":
        return <Badge variant="warning">Out of Zone</Badge>;
      case "PENDING_CORRECTION":
        return <Badge variant="pending">Correction Pending</Badge>;
      case "CORRECTED":
        return <Badge variant="info">Corrected</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Attendance Monitor</h1>
          <p className="text-sm text-on-surface-variant">Daily log ledger of employee check-ins and check-outs with GPS verification</p>
        </div>
        <Button className="font-bold flex items-center gap-1.5 self-start sm:self-auto">
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span>Export logs</span>
        </Button>
      </div>

      <Card className="p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Filter by employee name, ID or location..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* Attendance Logs Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Check In</th>
                <th className="p-4">Check Out</th>
                <th className="p-4">Location &amp; Geofence</th>
                <th className="p-4">Device Info</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant">
                    No attendance logs found.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-primary">{rec.employeeName}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant">{rec.employeeId}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-mono font-medium text-primary">{new Date(rec.checkIn).toLocaleString()}</p>
                        {rec.lateMinutes > 0 && (
                          <p className="text-[10px] text-status-error font-bold mt-0.5">⚠️ {rec.lateMinutes} mins late</p>
                        )}
                        {rec.shiftStartSnapshot && (
                          <p className="text-[9px] text-on-surface-variant font-semibold mt-0.5">Shift Scheduled: {rec.shiftStartSnapshot}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono font-medium text-primary">
                        {rec.checkOut ? (
                          <p>{new Date(rec.checkOut).toLocaleString()}</p>
                        ) : (
                          <span className="text-status-success font-bold animate-pulse">On Duty</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-primary">{rec.locationName}</p>
                        <p className="text-[10px] text-on-surface-variant">GPS: {rec.lat.toFixed(4)}, {rec.lng.toFixed(4)}</p>
                        {rec.status === "OUT_OF_ZONE" && (
                          <p className="text-[10px] text-status-warning font-extrabold mt-0.5">⚠️ Outside Allowed Geofence Radius</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-on-surface-variant font-medium">{rec.device}</td>
                    <td className="p-4">
                      {getStatusBadge(rec.status)}
                    </td>
                    <td className="p-4 text-right">
                      {rec.originalCheckIn && (
                        <div className="text-[9px] font-semibold text-on-surface-variant mr-1">
                          <p>Orig In: {new Date(rec.originalCheckIn).toLocaleTimeString()}</p>
                          {rec.originalCheckOut && <p>Orig Out: {new Date(rec.originalCheckOut).toLocaleTimeString()}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Correction Requests Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-primary uppercase tracking-wider px-1">Correction Approvals Dashboard</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Record ID</th>
                  <th className="p-4">Requested Times</th>
                  <th className="p-4">Correction Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-on-surface-variant">
                      No correction requests submitted.
                    </td>
                  </tr>
                ) : (
                  corrections.map((corr) => {
                    const parent = attendance.find(a => a.id === corr.attendanceRecordId);
                    return (
                      <tr key={corr.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-4 font-bold text-primary">
                          {parent ? parent.employeeName : "Unknown Employee"}
                        </td>
                        <td className="p-4 font-mono font-medium text-primary">
                          {corr.attendanceRecordId.substring(0, 8)}...
                        </td>
                        <td className="p-4 font-mono">
                          <div>
                            {corr.requestedCheckIn && (
                              <p><span className="font-semibold text-status-success">In:</span> {new Date(corr.requestedCheckIn).toLocaleString()}</p>
                            )}
                            {corr.requestedCheckOut && (
                              <p><span className="font-semibold text-status-error">Out:</span> {new Date(corr.requestedCheckOut).toLocaleString()}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-on-surface-variant font-medium">
                          "{corr.reason}"
                        </td>
                        <td className="p-4">
                          <Badge variant={
                            corr.status === "Approved" ? "success" : 
                            corr.status === "Rejected" ? "error" : "pending"
                          }>
                            {corr.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          {corr.status === "Pending" ? (
                            <div className="flex gap-1.5 justify-end">
                              <Button
                                variant="success"
                                size="sm"
                                className="font-bold text-[10px] py-1 px-3"
                                onClick={() => {
                                  setSelectedCorr(corr);
                                  setActionType("Approved");
                                  setIsReviewOpen(true);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="error"
                                size="sm"
                                className="font-bold text-[10px] py-1 px-3"
                                onClick={() => {
                                  setSelectedCorr(corr);
                                  setActionType("Rejected");
                                  setIsReviewOpen(true);
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-on-surface-variant italic font-medium">
                              Reviewed by {corr.reviewedById || "Supervisor"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Review Dialog Modal */}
      <Modal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} title={`${actionType} Correction Request`}>
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Review Notes / Comments</label>
            <textarea
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Provide comments regarding this approval/rejection decision..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="secondary" type="button" onClick={() => setIsReviewOpen(false)}>Cancel</Button>
            <Button variant={actionType === "Approved" ? "success" : "error"} type="submit">
              Confirm {actionType}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
