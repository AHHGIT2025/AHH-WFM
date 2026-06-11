"use client";

import React, { useState, useEffect } from "react";
import { Shift, SyncLog } from "@ahh-wfm/types";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [auditLogs, setAuditLogs] = useState<SyncLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New shift form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [breakDuration, setBreakDuration] = useState("");

  const fetchDb = async () => {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const json = await res.json();
        setShifts(json.shifts);
        setAuditLogs(json.syncLogs.filter((l: SyncLog) => l.operation === "Schema Update" || l.subject.startsWith("Shift_")));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !timeRange || !breakDuration) return;

    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addShift",
          payload: {
            name,
            code: code.toUpperCase(),
            timeRange,
            breakDuration,
            status: "Active"
          }
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        // Reset form
        setName("");
        setCode("");
        setTimeRange("");
        setBreakDuration("");
        fetchDb();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant mb-2 text-[10px] font-bold">
            <span>MASTER DATA</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-secondary">SHIFT MASTER</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Shift Management</h1>
          <p className="text-sm text-on-surface-variant">Configure standard working hours, breaks, and active shift rotations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-[18px]">sync</span> Shift Rotation
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="font-bold flex items-center gap-1.5 text-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Add New Shift
          </Button>
        </div>
      </div>

      {/* Bento summary widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-secondary/10 text-secondary rounded-lg">
                <span className="material-symbols-outlined">schedule</span>
              </span>
              <Badge variant="success">+1 this month</Badge>
            </div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Active Shifts</p>
            <h2 className="text-3xl font-extrabold text-primary mt-1">{shifts.length}</h2>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 font-semibold">
            {shifts.filter(s => s.status === "Active").length} active, {shifts.filter(s => s.status === "Inactive").length} inactive
          </p>
        </Card>

        <Card className="md:col-span-2 overflow-hidden relative">
          <h3 className="text-sm font-bold text-primary mb-3">Recent Rotation Audits</h3>
          <div className="space-y-3.5 max-h-[120px] overflow-y-auto pr-2">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No rotation updates recorded recently.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">history</span>
                    <p className="font-medium text-primary">{log.details}</p>
                  </div>
                  <span className="text-on-surface-variant opacity-75 font-medium">{log.timestamp.substring(11, 19)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Shifts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shifts.map((shift) => (
          <Card key={shift.id} className="hover:shadow-md transition-shadow relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Visual Accent bar */}
                <div className={`w-1.5 h-8 rounded-full ${
                  shift.code.startsWith("GEN") ? "bg-blue-500" :
                  shift.code.startsWith("MOR") ? "bg-orange-400" :
                  shift.code.startsWith("AFT") ? "bg-teal-500" : "bg-indigo-700"
                }`} />
                <div>
                  <h3 className="font-bold text-primary text-sm">{shift.name}</h3>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase">{shift.code}</p>
                </div>
              </div>
              <Badge variant={shift.status === "Active" ? "success" : "neutral"}>
                {shift.status}
              </Badge>
            </div>

            <div className="mt-4 pt-4 border-t border-border-subtle space-y-2 text-xs font-semibold text-primary">
              <div className="flex justify-between">
                <span className="text-on-surface-variant opacity-60 font-medium">Working Hours</span>
                <span>{shift.timeRange}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant opacity-60 font-medium">Break Duration</span>
                <span>{shift.breakDuration}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2 border-t border-border-subtle pt-4">
              <Button variant="secondary" className="flex-1 font-bold text-xs py-1.5">Edit Shift</Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Shift Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Shift Rule">
        <form onSubmit={handleAddShift} className="space-y-4">
          <Input
            label="Shift Name"
            placeholder="e.g. Weekend Duty Shift"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Shift Code"
            placeholder="e.g. WKD-004"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Input
            label="Working Hours (Time Range)"
            placeholder="e.g. 08:00 AM — 05:00 PM"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            required
          />
          <Input
            label="Break Duration"
            placeholder="e.g. 60 mins"
            value={breakDuration}
            onChange={(e) => setBreakDuration(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Shift</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
