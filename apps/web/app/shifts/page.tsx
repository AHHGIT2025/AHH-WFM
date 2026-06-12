"use client";

import React, { useState, useEffect } from "react";
import { Employee, ShiftTemplate, RotationTemplate, ShiftAssignment, LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";

export default function ShiftsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [rotationTemplates, setRotationTemplates] = useState<RotationTemplate[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  // Modals state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);

  // Forms state: Shift Template
  const [tempName, setTempName] = useState("");
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [tempIsSplit, setTempIsSplit] = useState(false);
  const [tempSplitStart, setTempSplitStart] = useState("");
  const [tempSplitEnd, setTempSplitEnd] = useState("");
  const [tempIsFlex, setTempIsFlex] = useState(false);
  const [tempCoreHours, setTempCoreHours] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Forms state: Rotation Template
  const [rotName, setRotName] = useState("");
  const [rotCycleDays, setRotCycleDays] = useState("7");
  const [rotPattern, setRotPattern] = useState<string[]>(["REST", "REST", "REST", "REST", "REST", "REST", "REST"]);
  const [creatingRotation, setCreatingRotation] = useState(false);

  // Forms state: Single Assignment
  const [singleEmpId, setSingleEmpId] = useState("");
  const [singleTempId, setSingleTempId] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [assigningSingle, setAssigningSingle] = useState(false);

  // Forms state: Bulk Assignment
  const [bulkEmpIds, setBulkEmpIds] = useState<string[]>([]);
  const [bulkTempId, setBulkTempId] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [assigningBulk, setAssigningBulk] = useState(false);

  // Forms state: Rotation Apply
  const [applyRotEmpIds, setApplyRotEmpIds] = useState<string[]>([]);
  const [applyRotId, setApplyRotId] = useState("");
  const [applyStartDate, setApplyStartDate] = useState("");
  const [applyOccurrences, setApplyOccurrences] = useState("14");
  const [applyingRotation, setApplyingRotation] = useState(false);

  // Conflict Logs
  const [conflictLogs, setConflictLogs] = useState<string[]>([]);
  const [rotationConflicts, setRotationConflicts] = useState<Array<{ employeeId: string; date: string; reasons: string[] }>>([]);

  const fetchDb = async () => {
    try {
      const [empRes, tempRes, rotRes, assignRes, leavesRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/shifts/templates"),
        fetch("/api/v1/shifts/rotations"),
        fetch("/api/v1/shifts/assignments"),
        fetch("/api/v1/leaves")
      ]);
      if (empRes.ok) {
        const emps = await empRes.json();
        setEmployees(emps);
        if (emps.length > 0) {
          if (!singleEmpId) setSingleEmpId(emps[0].id);
        }
      }
      if (tempRes.ok) {
        const temps = await tempRes.json();
        setShiftTemplates(temps);
        if (temps.length > 0) {
          if (!singleTempId) setSingleTempId(temps[0].id);
          if (!bulkTempId) setBulkTempId(temps[0].id);
        }
      }
      if (rotRes.ok) {
        const rots = await rotRes.json();
        setRotationTemplates(rots);
        if (rots.length > 0) {
          if (!applyRotId) setApplyRotId(rots[0].id);
        }
      }
      if (assignRes.ok) {
        setShiftAssignments(await assignRes.json());
      }
      if (leavesRes.ok) {
        setLeaves(await leavesRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName || !tempStart || !tempEnd) return;
    setCreatingTemplate(true);
    try {
      const res = await fetch("/api/v1/shifts/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tempName,
          startTime: tempStart,
          endTime: tempEnd,
          isSplit: tempIsSplit,
          splitStart: tempSplitStart || undefined,
          splitEnd: tempSplitEnd || undefined,
          isFlexible: tempIsFlex,
          coreHours: tempCoreHours ? parseFloat(tempCoreHours) : undefined
        })
      });
      if (res.ok) {
        setTempName("");
        setTempStart("");
        setTempEnd("");
        setTempIsSplit(false);
        setTempSplitStart("");
        setTempSplitEnd("");
        setTempIsFlex(false);
        setTempCoreHours("");
        setIsTemplateModalOpen(false);
        fetchDb();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleCreateRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotName || !rotCycleDays) return;
    setCreatingRotation(true);
    try {
      const res = await fetch("/api/v1/shifts/rotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rotName,
          cycleDays: parseInt(rotCycleDays),
          pattern: rotPattern.slice(0, parseInt(rotCycleDays))
        })
      });
      if (res.ok) {
        setRotName("");
        setRotCycleDays("7");
        setRotPattern(["REST", "REST", "REST", "REST", "REST", "REST", "REST"]);
        setIsRotationModalOpen(false);
        fetchDb();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingRotation(false);
    }
  };

  const handleSingleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmpId || !singleTempId || !singleDate) return;
    setAssigningSingle(true);
    setConflictLogs([]);
    try {
      const res = await fetch("/api/v1/shifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: singleEmpId,
          shiftTemplateId: singleTempId,
          date: singleDate
        })
      });
      if (res.ok) {
        alert("Shift assigned successfully!");
        fetchDb();
      } else {
        const err = await res.json();
        if (err.conflicts) {
          setConflictLogs(err.conflicts);
        } else {
          alert(`Error: ${err.error}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigningSingle(false);
    }
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkEmpIds.length === 0 || !bulkTempId || !bulkStartDate || !bulkEndDate) {
      alert("Please select employees, template, and start/end dates.");
      return;
    }
    setAssigningBulk(true);
    setConflictLogs([]);
    try {
      // Calculate list of date strings in between start and end date
      const dates: string[] = [];
      const curr = new Date(bulkStartDate);
      const target = new Date(bulkEndDate);
      while (curr <= target) {
        dates.push(curr.toISOString().substring(0, 10));
        curr.setDate(curr.getDate() + 1);
      }

      const res = await fetch("/api/v1/shifts/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: bulkEmpIds,
          shiftTemplateId: bulkTempId,
          dates
        })
      });

      if (res.ok) {
        alert("Bulk shifts assigned successfully!");
        setBulkEmpIds([]);
        setBulkStartDate("");
        setBulkEndDate("");
        fetchDb();
      } else {
        const err = await res.json();
        if (err.conflicts) {
          setConflictLogs(err.conflicts);
        } else {
          alert(`Error: ${err.error}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigningBulk(false);
    }
  };

  const handleApplyRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (applyRotEmpIds.length === 0 || !applyRotId || !applyStartDate || !applyOccurrences) {
      alert("Please select employees, rotation pattern, start date, and cycle duration.");
      return;
    }
    setApplyingRotation(true);
    setRotationConflicts([]);
    setConflictLogs([]);
    try {
      const res = await fetch("/api/v1/shifts/assignments/rotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: applyRotEmpIds,
          rotationTemplateId: applyRotId,
          startDate: applyStartDate,
          occurrences: parseInt(applyOccurrences)
        })
      });

      if (res.ok) {
        alert("Rotation template applied successfully!");
        setApplyRotEmpIds([]);
        setApplyStartDate("");
        fetchDb();
      } else {
        const err = await res.json();
        if (err.conflicts) {
          setRotationConflicts(err.conflicts);
        } else {
          alert(`Error: ${err.error}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingRotation(false);
    }
  };

  const toggleBulkEmpSelection = (id: string) => {
    setBulkEmpIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleApplyRotEmpSelection = (id: string) => {
    setApplyRotEmpIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Generate date headings for the Gantt scheduling grid (next 7 days starting today)
  const getGridDates = () => {
    const list = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(d);
    }
    return list;
  };
  const gridDates = getGridDates();

  const getAssignmentForCell = (empId: string, dateStr: string) => {
    return shiftAssignments.find(a => a.employeeId === empId && a.date === dateStr);
  };

  const getLeaveForCell = (empId: string, dateStr: string) => {
    return leaves.find(l => {
      if (l.employeeId !== empId || l.status !== "Approved") return false;
      if (!l.startDate || !l.endDate) return false;
      const checkDate = new Date(dateStr);
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      checkDate.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  };

  const activeEmployees = employees.filter(e => e.isActive !== false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant mb-2 text-[10px] font-bold">
            <span>MASTER DATA</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-secondary">SHIFT PLANNING</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Shift Planner &amp; Rotations</h1>
          <p className="text-sm text-on-surface-variant">Schedule employees, apply rotational cycle patterns, and monitor schedule conflicts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsRotationModalOpen(true)} className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-[18px]">rule</span> Create Rotation Template
          </Button>
          <Button onClick={() => setIsTemplateModalOpen(true)} className="font-bold flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-[18px]">add</span> Create Shift Template
          </Button>
        </div>
      </div>

      {/* Main planner panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shift Grid Planner Board */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-primary">Grid Planning Board (7-Day View)</h2>
                <p className="text-[11px] text-on-surface-variant">Real-time shift roster with basic leaves conflict detection</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                  <tr>
                    <th className="p-3 border-r border-border-subtle w-44">Employee</th>
                    {gridDates.map((d, idx) => (
                      <th key={idx} className="p-3 text-center border-r border-border-subtle min-w-[100px]">
                        <span className="block font-bold">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                        <span className="block text-[9px] font-normal leading-tight opacity-75">{d.toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="p-3 border-r border-border-subtle font-semibold text-primary">
                        <div className="flex flex-col">
                          <span>{emp.name}</span>
                          <span className="text-[10px] font-mono font-normal text-on-surface-variant flex items-center gap-1">
                            {emp.id}
                            {emp.isActive === false && (
                              <Badge variant="error" className="text-[7px] py-0 px-1">INACTIVE</Badge>
                            )}
                          </span>
                        </div>
                      </td>
                      {gridDates.map((dateObj, idx) => {
                        const dateStr = dateObj.toISOString().substring(0, 10);
                        const assignment = getAssignmentForCell(emp.id, dateStr);
                        const leave = getLeaveForCell(emp.id, dateStr);

                        return (
                          <td key={idx} className="p-2 border-r border-border-subtle text-center align-middle relative min-h-[50px]">
                            {leave ? (
                              <div className="bg-status-warning/10 border border-status-warning/30 text-status-warning rounded p-1.5 text-[9px] font-bold">
                                <span className="block">ON LEAVE</span>
                                <span className="block font-normal text-[8px] opacity-75">({leave.type})</span>
                              </div>
                            ) : assignment ? (
                              <div className="bg-primary/10 border border-primary/30 text-primary rounded p-1.5 text-[10px] font-semibold">
                                <p className="font-bold leading-tight">{assignment.shiftTemplate?.name || "Assigned"}</p>
                                <p className="text-[8px] font-mono mt-0.5 opacity-85">{assignment.shiftTemplate?.startTime} - {assignment.shiftTemplate?.endTime}</p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-on-surface-variant italic opacity-40 font-medium">Rest Day</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Conflict Warnings Section */}
          {(conflictLogs.length > 0 || rotationConflicts.length > 0) && (
            <Card className="border border-status-error bg-status-error/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-status-error">
                <span className="material-symbols-outlined text-lg">warning</span>
                <h3 className="text-xs font-bold uppercase tracking-wider">Schedule Conflict Violations Detected</h3>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-status-error font-medium">
                {conflictLogs.map((log, idx) => (
                  <li key={idx}>{log}</li>
                ))}
                {rotationConflicts.map((c, idx) => (
                  <li key={idx} className="flex flex-col mb-1.5">
                    <span className="font-bold">Date: {c.date} (Emp ID: {c.employeeId})</span>
                    <span className="pl-3 text-[11px] font-normal italic opacity-90">{c.reasons.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Sidebar forms */}
        <div className="space-y-6">
          {/* Quick Single Assignment */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Assign Single Shift</h3>
            <form onSubmit={handleSingleAssign} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Employee</label>
                <select
                  value={singleEmpId}
                  onChange={(e) => setSingleEmpId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Shift Template</label>
                <select
                  value={singleTempId}
                  onChange={(e) => setSingleTempId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  {shiftTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.startTime} - {t.endTime})</option>
                  ))}
                </select>
              </div>
              <Input
                label="Date"
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                required
              />
              <Button type="submit" disabled={assigningSingle} className="w-full py-1.5 font-bold">
                {assigningSingle ? "Assigning..." : "Assign Shift"}
              </Button>
            </form>
          </Card>

          {/* Bulk Shift Assignment Form */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Bulk Shift Assignment</h3>
            <form onSubmit={handleBulkAssign} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Target Employees</label>
                <div className="max-h-[120px] overflow-y-auto border border-outline-variant/50 p-2 rounded-lg bg-surface space-y-1.5">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={bulkEmpIds.includes(emp.id)}
                        onChange={() => toggleBulkEmpSelection(emp.id)}
                      />
                      {emp.name} ({emp.id})
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Shift Template</label>
                <select
                  value={bulkTempId}
                  onChange={(e) => setBulkTempId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  {shiftTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.startTime} - {t.endTime})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={assigningBulk} className="w-full py-1.5 font-bold">
                {assigningBulk ? "Assigning Bulk..." : "Apply Bulk Assignment"}
              </Button>
            </form>
          </Card>

          {/* Apply Rotation Template Form */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Apply Rotation Template</h3>
            <form onSubmit={handleApplyRotation} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Target Employees</label>
                <div className="max-h-[120px] overflow-y-auto border border-outline-variant/50 p-2 rounded-lg bg-surface space-y-1.5">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={applyRotEmpIds.includes(emp.id)}
                        onChange={() => toggleApplyRotEmpSelection(emp.id)}
                      />
                      {emp.name} ({emp.id})
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Rotation Template</label>
                <select
                  value={applyRotId}
                  onChange={(e) => setApplyRotId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                >
                  {rotationTemplates.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.cycleDays} days cycle)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={applyStartDate}
                  onChange={(e) => setApplyStartDate(e.target.value)}
                  required
                />
                <Input
                  label="Total Occurrences (Days)"
                  type="number"
                  min="1"
                  max="90"
                  value={applyOccurrences}
                  onChange={(e) => setApplyOccurrences(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={applyingRotation} className="w-full py-1.5 font-bold">
                {applyingRotation ? "Applying..." : "Apply Rotation Pattern"}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Create Shift Template Modal */}
      <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="Create Shift Template">
        <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs font-semibold">
          <Input
            label="Template Name"
            placeholder="e.g. Early Morning Duty"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              placeholder="e.g. 06:00"
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
              required
            />
            <Input
              label="End Time"
              placeholder="e.g. 14:00"
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="tempIsSplit"
              checked={tempIsSplit}
              onChange={(e) => setTempIsSplit(e.target.checked)}
            />
            <label htmlFor="tempIsSplit" className="cursor-pointer font-bold">Is Split Shift?</label>
          </div>
          {tempIsSplit && (
            <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant/30">
              <Input
                label="Split Block Start"
                placeholder="e.g. 16:00"
                value={tempSplitStart}
                onChange={(e) => setTempSplitStart(e.target.value)}
              />
              <Input
                label="Split Block End"
                placeholder="e.g. 20:00"
                value={tempSplitEnd}
                onChange={(e) => setTempSplitEnd(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="tempIsFlex"
              checked={tempIsFlex}
              onChange={(e) => setTempIsFlex(e.target.checked)}
            />
            <label htmlFor="tempIsFlex" className="cursor-pointer font-bold">Is Flexible Shift?</label>
          </div>
          {tempIsFlex && (
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30">
              <Input
                label="Required Core Hours"
                placeholder="e.g. 8"
                type="number"
                step="0.5"
                value={tempCoreHours}
                onChange={(e) => setTempCoreHours(e.target.value)}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creatingTemplate}>
              {creatingTemplate ? "Creating..." : "Save Template"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Rotation Template Modal */}
      <Modal isOpen={isRotationModalOpen} onClose={() => setIsRotationModalOpen(false)} title="Create Rotation Template">
        <form onSubmit={handleCreateRotation} className="space-y-4 text-xs font-semibold">
          <Input
            label="Template Name"
            placeholder="e.g. 6 Days Work 1 Day Off"
            value={rotName}
            onChange={(e) => setRotName(e.target.value)}
            required
          />
          <Input
            label="Cycle Duration (Days)"
            type="number"
            min="2"
            max="14"
            value={rotCycleDays}
            onChange={(e) => setRotCycleDays(e.target.value)}
            required
          />
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Define Cycle Pattern</label>
            <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-1">
              {Array.from({ length: parseInt(rotCycleDays) || 0 }).map((_, index) => (
                <div key={index} className="space-y-1">
                  <span className="text-[10px] font-bold text-primary">Day {index + 1}</span>
                  <select
                    value={rotPattern[index] || "REST"}
                    onChange={(e) => {
                      const newPattern = [...rotPattern];
                      newPattern[index] = e.target.value;
                      setRotPattern(newPattern);
                    }}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                  >
                    <option value="REST">Rest Day / REST</option>
                    {shiftTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsRotationModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creatingRotation}>
              {creatingRotation ? "Creating..." : "Save Template"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
