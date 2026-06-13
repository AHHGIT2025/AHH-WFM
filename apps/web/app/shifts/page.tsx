"use client";

import React, { useState, useEffect } from "react";
import { Employee, ShiftTemplate, RotationTemplate, ShiftAssignment, LeaveRequest, ShiftSwapRequest, OvertimeRate, AttendanceRecord } from "@ahh-wfm/types";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";
import { isEmployeeActive } from "@/lib/permissions";

export default function ShiftsPage() {
  const [activeTab, setActiveTab] = useState<"grid" | "deployments" | "coverage" | "swaps" | "overtime" | "rates">("grid");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [rotationTemplates, setRotationTemplates] = useState<RotationTemplate[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [overtimeRecords, setOvertimeRecords] = useState<AttendanceRecord[]>([]);
  const [overtimeRates, setOvertimeRates] = useState<OvertimeRate[]>([]);
  const [coverageData, setCoverageData] = useState<any[]>([]);

  // Project, site and category states
  const [projects, setProjects] = useState<any[]>([]);
  const [projectSites, setProjectSites] = useState<any[]>([]);
  const [positionCategories, setPositionCategories] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [deploymentsCoverage, setDeploymentsCoverage] = useState<any[]>([]);

  // Forms: Blue Collar Deployment
  const [deployEmpId, setDeployEmpId] = useState("");
  const [deployProjId, setDeployProjId] = useState("");
  const [deploySiteId, setDeploySiteId] = useState("");
  const [deployCatId, setDeployCatId] = useState("");
  const [deployDate, setDeployDate] = useState("");
  const [deployStart, setDeployStart] = useState("08:00");
  const [deployEnd, setDeployEnd] = useState("17:00");
  const [deploying, setDeploying] = useState(false);
  const [deploySitesList, setDeploySitesList] = useState<any[]>([]);
  const [deployError, setDeployError] = useState("");

  const fetchDeploymentsCoverage = async (dateStr?: string) => {
    try {
      const d = dateStr || new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/v1/deployments/coverage?date=${d}`);
      if (res.ok) {
        setDeploymentsCoverage(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  // Cell action modal state
  const [activeCell, setActiveCell] = useState<{ employeeId: string; date: string; assignment?: any; leave?: any } | null>(null);
  const [cellActionType, setCellActionType] = useState<string>(""); // ASSIGN_SHIFT, MARK_LEAVE, SPLIT_SHIFT, ASSIGN_PROJECT_SITE, LINK_RELIEVER, etc.
  
  // Form states for cell actions
  const [cellShiftId, setCellShiftId] = useState("");
  const [cellLeaveType, setCellLeaveType] = useState("Sick Leave");
  const [cellLeaveReason, setCellLeaveReason] = useState("");
  const [cellLeaveRelieverRequired, setCellLeaveRelieverRequired] = useState(false);
  const [cellProjectId, setCellProjectId] = useState("");
  const [cellSiteId, setCellSiteId] = useState("");
  const [cellStartTime, setCellStartTime] = useState("08:00");
  const [cellEndTime, setCellEndTime] = useState("17:00");
  const [cellPositionCategoryId, setCellPositionCategoryId] = useState("");
  
  // Reliever suggestion states
  const [relieversList, setRelieversList] = useState<any[]>([]);
  const [fetchingRelievers, setFetchingRelievers] = useState(false);
  const [selectedRelieverId, setSelectedRelieverId] = useState("");

  // Drag-and-drop confirmation modal state
  const [dropConfirmation, setDropConfirmation] = useState<{
    saId: string;
    targetEmpId: string;
    targetDate: string;
    targetEmpName: string;
    warningMessage?: string;
  } | null>(null);

  // Heatmap toggle
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Forms: Shift Template
  const [tempName, setTempName] = useState("");
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [tempIsSplit, setTempIsSplit] = useState(false);
  const [tempSplitStart, setTempSplitStart] = useState("");
  const [tempSplitEnd, setTempSplitEnd] = useState("");
  const [tempIsFlex, setTempIsFlex] = useState(false);
  const [tempCoreHours, setTempCoreHours] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Forms: Rotation Template
  const [rotName, setRotName] = useState("");
  const [rotCycleDays, setRotCycleDays] = useState("7");
  const [rotPattern, setRotPattern] = useState<string[]>(["REST", "REST", "REST", "REST", "REST", "REST", "REST"]);
  const [creatingRotation, setCreatingRotation] = useState(false);

  // Forms: Single Assignment
  const [singleEmpId, setSingleEmpId] = useState("");
  const [singleTempId, setSingleTempId] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [assigningSingle, setAssigningSingle] = useState(false);

  // Forms: Bulk Assignment
  const [bulkEmpIds, setBulkEmpIds] = useState<string[]>([]);
  const [bulkTempId, setBulkTempId] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [assigningBulk, setAssigningBulk] = useState(false);

  // Forms: Rotation Apply
  const [applyRotEmpIds, setApplyRotEmpIds] = useState<string[]>([]);
  const [applyRotId, setApplyRotId] = useState("");
  const [applyStartDate, setApplyStartDate] = useState("");
  const [applyOccurrences, setApplyOccurrences] = useState("14");
  const [applyingRotation, setApplyingRotation] = useState(false);

  // Forms: Overtime Rate
  const [rateName, setRateName] = useState("");
  const [rateType, setRateType] = useState("SPECIAL_EVENT_OT");
  const [rateMultiplier, setRateMultiplier] = useState("1.5");
  const [rateFixed, setRateFixed] = useState("");
  const [rateWeekend, setRateWeekend] = useState(false);
  const [rateHoliday, setRateHoliday] = useState(false);
  const [rateAfterMins, setRateAfterMins] = useState("0");
  const [savingRate, setSavingRate] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);

  // Conflicts state
  const [conflictLogs, setConflictLogs] = useState<string[]>([]);
  const [rotationConflicts, setRotationConflicts] = useState<any[]>([]);

  const fetchDb = async () => {
    try {
      const [empRes, tempRes, rotRes, assignRes, leavesRes, swapsRes, otRes, ratesRes, covRes, projRes, catRes, deployRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/shifts/templates"),
        fetch("/api/v1/shifts/rotations"),
        fetch("/api/v1/shifts/assignments"),
        fetch("/api/v1/leaves"),
        fetch("/api/v1/shifts/swaps"),
        fetch("/api/v1/shifts/overtime"),
        fetch("/api/v1/overtime-rates"),
        fetch("/api/v1/shifts/coverage"),
        fetch("/api/v1/projects"),
        fetch("/api/v1/blue-collar/position-categories"),
        fetch("/api/v1/deployments")
      ]);

      if (empRes.ok) {
        const emps = await empRes.json();
        setEmployees(emps);
        const activeEmps = emps.filter(isEmployeeActive);
        if (activeEmps.length > 0 && !singleEmpId) setSingleEmpId(activeEmps[0].id);
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
        if (rots.length > 0 && !applyRotId) setApplyRotId(rots[0].id);
      }
      if (assignRes.ok) setShiftAssignments(await assignRes.json());
      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (swapsRes.ok) setSwaps(await swapsRes.json());
      if (otRes.ok) setOvertimeRecords(await otRes.json());
      if (ratesRes.ok) setOvertimeRates(await ratesRes.json());
      if (covRes.ok) setCoverageData(await covRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (catRes.ok) setPositionCategories(await catRes.json());
      if (deployRes.ok) setDeployments(await deployRes.json());
      await fetchDeploymentsCoverage();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  useEffect(() => {
    if (activeCell && cellActionType === "LINK_RELIEVER") {
      fetchAvailableRelieversForCell(activeCell.date, activeCell.employeeId);
    }
  }, [activeCell, cellActionType]);

  useEffect(() => {
    if (projects.length > 0) {
      Promise.all(
        projects.map(p =>
          fetch(`/api/v1/projects/${p.id}/sites`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        )
      ).then(results => {
        const merged = results.flat();
        setProjectSites(merged);
      });
    }
  }, [projects]);

  useEffect(() => {
    if (deployProjId) {
      fetch(`/api/v1/projects/${deployProjId}/sites`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setDeploySitesList(data))
        .catch(() => setDeploySitesList([]));
    } else {
      setDeploySitesList([]);
    }
  }, [deployProjId]);

  useEffect(() => {
    if (deployEmpId) {
      const emp = employees.find(e => e.id === deployEmpId);
      if (emp && (emp as any).positionCategoryId) {
        setDeployCatId((emp as any).positionCategoryId);
      }
    }
  }, [deployEmpId, employees]);

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployEmpId || !deployProjId || !deploySiteId || !deployCatId || !deployDate || !deployStart || !deployEnd) {
      setDeployError("Please fill out all fields.");
      return;
    }
    setDeploying(true);
    setDeployError("");
    try {
      const res = await fetch("/api/v1/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: deployEmpId,
          projectId: deployProjId,
          siteId: deploySiteId,
          positionCategoryId: deployCatId,
          deploymentDate: deployDate,
          startTime: deployStart,
          endTime: deployEnd
        })
      });
      if (res.ok) {
        setDeployEmpId("");
        setDeployProjId("");
        setDeploySiteId("");
        setDeployCatId("");
        setDeployDate("");
        setDeployStart("08:00");
        setDeployEnd("17:00");
        fetchDb();
        fetchDeploymentsCoverage();
        alert("Employee deployed successfully!");
      } else {
        const err = await res.json();
        setDeployError(err.error || "Failed to deploy worker.");
      }
    } catch (err) {
      setDeployError("Network connection failure.");
    } finally {
      setDeploying(false);
    }
  };

  const handleDeleteDeployment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this deployment?")) return;
    try {
      const res = await fetch(`/api/v1/deployments/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDb();
        fetchDeploymentsCoverage();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel deployment");
      }
    } catch (e) {
      alert("Network error.");
    }
  };

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

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRate(true);
    try {
      const payload = {
        name: rateName,
        overtimeType: rateType,
        multiplier: parseFloat(rateMultiplier),
        fixedRateAmount: rateFixed ? parseFloat(rateFixed) : undefined,
        currency: "QAR",
        appliesOnWeekend: rateWeekend,
        appliesOnHoliday: rateHoliday,
        appliesAfterMinutes: parseInt(rateAfterMins) || 0,
        isActive: true
      };

      const url = editingRateId ? `/api/v1/overtime-rates/${editingRateId}` : "/api/v1/overtime-rates";
      const method = editingRateId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setRateName("");
        setRateMultiplier("1.5");
        setRateFixed("");
        setRateWeekend(false);
        setRateHoliday(false);
        setRateAfterMins("0");
        setEditingRateId(null);
        setIsRateModalOpen(false);
        fetchDb();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRate(false);
    }
  };

  const handleActionSwap = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} this swap request?`)) return;
    try {
      const res = await fetch(`/api/v1/shifts/swaps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        alert(`Swap request ${status.toLowerCase()}!`);
        fetchDb();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionOvertime = async (recordId: string, status: "APPROVED" | "REJECTED") => {
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} this overtime calculation?`)) return;
    try {
      const res = await fetch("/api/v1/shifts/overtime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, status })
      });
      if (res.ok) {
        alert(`Overtime status updated to ${status.toLowerCase()}!`);
        fetchDb();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailableRelieversForCell = async (date: string, empId: string) => {
    setFetchingRelievers(true);
    try {
      const emp = employees.find(e => e.id === empId);
      const designationId = emp?.designationId || "";
      const tradeClassificationId = emp?.tradeClassificationId || "";
      
      const res = await fetch(`/api/v1/scheduler/available-relievers?date=${date}&designationId=${designationId}&tradeClassificationId=${tradeClassificationId}`);
      if (res.ok) {
        setRelieversList(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingRelievers(false);
    }
  };

  const handleCellActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCell) return;

    let payload: any = {
      employeeId: activeCell.employeeId,
      date: activeCell.date,
      action: cellActionType
    };

    if (cellActionType === "ASSIGN_SHIFT" || cellActionType === "SPLIT_SHIFT") {
      payload.shiftTemplateId = cellShiftId;
    } else if (["MARK_LEAVE", "MARK_VACATION", "MARK_OFF"].includes(cellActionType)) {
      payload.leaveType = cellLeaveType;
      payload.reason = cellLeaveReason;
    } else if (cellActionType === "ASSIGN_PROJECT_SITE") {
      payload.projectId = cellProjectId;
      payload.siteId = cellSiteId;
      payload.startTime = cellStartTime;
      payload.endTime = cellEndTime;
      payload.positionCategoryId = cellPositionCategoryId;
    } else if (cellActionType === "LINK_RELIEVER") {
      payload.relieverEmployeeId = selectedRelieverId;
      payload.startTime = cellStartTime;
      payload.endTime = cellEndTime;
      payload.projectId = cellProjectId || undefined;
      payload.siteId = cellSiteId || undefined;
      payload.reason = cellLeaveReason || "Reliever linked via cell-action";
    } else if (cellActionType === "ASSIGN_ON_CALL") {
      payload.projectId = cellProjectId || undefined;
      payload.siteId = cellSiteId || undefined;
      payload.startTime = cellStartTime;
      payload.endTime = cellEndTime;
      payload.status = "ASSIGNED";
    }

    try {
      const res = await fetch("/api/v1/scheduler/cell-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (["MARK_LEAVE", "MARK_VACATION", "MARK_OFF"].includes(cellActionType) && cellLeaveRelieverRequired) {
          setCellActionType("LINK_RELIEVER");
          await fetchAvailableRelieversForCell(activeCell.date, activeCell.employeeId);
        } else {
          setActiveCell(null);
          setCellActionType("");
          fetchDb();
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to perform cell action");
      }
    } catch (err) {
      console.error(err);
      alert("Network error occurred.");
    }
  };

  // Drag and drop HTML5 handlers
  const handleDragStart = (e: React.DragEvent, saId: string) => {
    e.dataTransfer.setData("text/plain", saId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetEmpId: string, targetDate: string) => {
    e.preventDefault();
    const targetEmp = employees.find(emp => emp.id === targetEmpId);
    if (targetEmp && !isEmployeeActive(targetEmp)) {
      alert(`Error: Cannot assign shifts to inactive employee ${targetEmp.name}.`);
      return;
    }
    const saId = e.dataTransfer.getData("text/plain");
    const draggedAsg = shiftAssignments.find(a => a.id === saId);
    if (!draggedAsg) return;

    if (draggedAsg.employeeId === targetEmpId && draggedAsg.date === targetDate) return;

    const targetLeave = getLeaveForCell(targetEmpId, targetDate);
    let warning = "";
    if (targetLeave) {
      warning = `Warning: ${targetEmp?.name} is ON LEAVE (${targetLeave.type}) on ${targetDate}. Assigning this shift may cause scheduling conflict.`;
    }

    setDropConfirmation({
      saId,
      targetEmpId,
      targetDate,
      targetEmpName: targetEmp?.name || targetEmpId,
      warningMessage: warning
    });
  };

  const executeDropReassignment = async () => {
    if (!dropConfirmation) return;
    const { saId, targetEmpId, targetDate } = dropConfirmation;
    const draggedAsg = shiftAssignments.find(a => a.id === saId);
    if (!draggedAsg) return;

    setConflictLogs([]);
    try {
      const res = await fetch("/api/v1/shifts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: targetEmpId,
          shiftTemplateId: draggedAsg.shiftTemplateId,
          date: targetDate
        })
      });
      if (res.ok) {
        // Remove old assignment
        await fetch(`/api/v1/shifts/assignments?id=${saId}`, { method: "DELETE" });
        alert("Shift reassigned successfully!");
        setDropConfirmation(null);
        fetchDb();
      } else {
        const err = await res.json();
        if (err.conflicts) {
          setConflictLogs(err.conflicts);
        } else {
          alert(`Conflict Error: ${err.error}`);
        }
        setDropConfirmation(null);
      }
    } catch (err) {
      console.error(err);
      setDropConfirmation(null);
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

  const getHeatmapColor = (dateStr: string, templateId: string) => {
    const cov = coverageData.find(c => c.date === dateStr && c.shiftTemplateId === templateId);
    if (!cov) return "bg-surface";
    if (cov.status === "UNDERSTAFFED") return "bg-status-error/15 text-status-error";
    if (cov.status === "OVERSTAFFED") return "bg-status-warning/15 text-status-warning";
    return "bg-status-success/15 text-status-success";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant mb-2 text-[10px] font-bold">
            <span>MASTER DATA</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-secondary">SHIFT PLANNING</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Shift Planner &amp; Resource Hub</h1>
          <p className="text-sm text-on-surface-variant">Configure shifts, manage overtime rules, review peer swap offers, and monitor coverage heatmaps</p>
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

      {/* Tabs Menu */}
      <div className="flex border-b border-border-subtle gap-6 text-sm font-bold text-on-surface-variant overflow-x-auto">
        <button
          onClick={() => setActiveTab("grid")}
          className={`pb-2.5 outline-none transition-colors border-b-2 whitespace-nowrap ${activeTab === "grid" ? "border-primary text-primary" : "border-transparent hover:text-primary"}`}
        >
          Roster Planner Grid
        </button>
        <button
          onClick={() => setActiveTab("deployments")}
          className={`pb-2.5 outline-none transition-colors border-b-2 whitespace-nowrap ${activeTab === "deployments" ? "border-primary text-primary" : "border-transparent hover:text-primary"}`}
        >
          Project Deployment View
        </button>
        <button
          onClick={() => setActiveTab("coverage")}
          className={`pb-2.5 outline-none transition-colors border-b-2 whitespace-nowrap ${activeTab === "coverage" ? "border-primary text-primary" : "border-transparent hover:text-primary"}`}
        >
          Site Coverage View
        </button>
        <button
          onClick={() => setActiveTab("swaps")}
          className={`pb-2.5 outline-none transition-colors border-b-2 whitespace-nowrap ${activeTab === "swaps" ? "border-primary text-primary" : "border-transparent hover:text-primary"}`}
        >
          Shift Swaps
          {swaps.filter(s => s.status === "PENDING").length > 0 && (
            <Badge variant="error" className="ml-1.5 py-0 px-1 text-[9px]">
              {swaps.filter(s => s.status === "PENDING").length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("overtime")}
          className={`pb-2.5 outline-none transition-colors border-b-2 whitespace-nowrap ${activeTab === "overtime" ? "border-primary text-primary" : "border-transparent hover:text-primary"}`}
        >
          Overtime Approvals
          {overtimeRecords.filter(r => r.otStatus === "PENDING").length > 0 && (
            <Badge variant="warning" className="ml-1.5 py-0 px-1 text-[9px]">
              {overtimeRecords.filter(r => r.otStatus === "PENDING").length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("rates")}
          className={`pb-2.5 outline-none transition-colors border-b-2 whitespace-nowrap ${activeTab === "rates" ? "border-primary text-primary" : "border-transparent hover:text-primary"}`}
        >
          Overtime Rates
        </button>
      </div>

      {activeTab === "grid" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-primary">Grid Planning Board (7-Day View)</h2>
                  <p className="text-[11px] text-on-surface-variant">Real-time scheduling timeline. Drag assignment blocks to move shifts.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant">Coverage Heatmap:</span>
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ${showHeatmap ? "bg-primary" : "bg-outline-variant"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showHeatmap ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                    <tr>
                      <th className="p-3 border-r border-border-subtle w-44">Employee</th>
                      {gridDates.map((d, idx) => (
                        <th key={idx} className="p-3 text-center border-r border-border-subtle min-w-[110px]">
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
                              {!isEmployeeActive(emp) && (
                                <Badge variant="error" className="text-[7px] py-0 px-1">INACTIVE</Badge>
                              )}
                            </span>
                          </div>
                        </td>
                        {gridDates.map((dateObj, idx) => {
                          const dateStr = dateObj.toISOString().substring(0, 10);
                          const assignment = getAssignmentForCell(emp.id, dateStr);
                          const leave = getLeaveForCell(emp.id, dateStr);

                          // Overlay heatmap color if enabled
                          const heatmapClass = showHeatmap && assignment
                            ? getHeatmapColor(dateStr, assignment.shiftTemplateId)
                            : "";

                          return (
                            <td
                              key={idx}
                              className={`p-2 border-r border-border-subtle text-center align-middle relative min-h-[55px] cursor-pointer hover:bg-primary/5 transition-colors ${heatmapClass}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, emp.id, dateStr)}
                              onClick={() => {
                                const assignment = getAssignmentForCell(emp.id, dateStr);
                                const leave = getLeaveForCell(emp.id, dateStr);
                                setActiveCell({ employeeId: emp.id, date: dateStr, assignment, leave });
                                setCellActionType(assignment ? "MARK_LEAVE" : "ASSIGN_SHIFT");
                                setCellShiftId(assignment?.shiftTemplateId || (shiftTemplates[0]?.id || ""));
                                setCellLeaveType("Sick Leave");
                                setCellLeaveReason("");
                                setCellLeaveRelieverRequired(false);
                                setCellProjectId((emp as any).defaultProjectId || "");
                                setCellSiteId((emp as any).defaultSiteId || "");
                                setCellStartTime("08:00");
                                setCellEndTime("17:00");
                                setCellPositionCategoryId((emp as any).positionCategoryId || "");
                                setSelectedRelieverId("");
                              }}
                            >
                              {leave ? (
                                <div className="bg-status-warning/10 border border-status-warning/30 text-status-warning rounded p-1.5 text-[9px] font-bold">
                                  <span className="block">ON LEAVE</span>
                                  <span className="block font-normal text-[8px] opacity-75">({leave.type})</span>
                                </div>
                              ) : assignment ? (
                                <div
                                  draggable="true"
                                  onDragStart={(e) => handleDragStart(e, assignment.id)}
                                  className="bg-primary/10 border border-primary/30 text-primary rounded p-1.5 text-[10px] font-semibold cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                                >
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
                    {employees.filter(isEmployeeActive).map(emp => (
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
                    {employees.filter(isEmployeeActive).map(emp => (
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
                    {employees.filter(isEmployeeActive).map(emp => (
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
      )}

      {activeTab === "deployments" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* List of Deployments */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-primary">Blue Collar Project Deployments</h2>
                  <p className="text-[11px] text-on-surface-variant">View and manage daily project/site assignments for Blue Collar staff.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-container-low text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Trade</th>
                      <th className="p-3">Project / Cost Center</th>
                      <th className="p-3">Site Location</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Hours</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-medium text-primary">
                    {deployments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center italic text-on-surface-variant">
                          No active deployments found. Use the quick deployment form on the right to assign staff.
                        </td>
                      </tr>
                    ) : (
                      deployments.map((d) => {
                        const emp = employees.find(e => e.id === d.employeeId);
                        const proj = projects.find(p => p.id === d.projectId);
                        const site = projectSites.find(s => s.id === d.siteId);
                        const cat = positionCategories.find(c => c.id === d.positionCategoryId);
                        return (
                          <tr key={d.id} className="hover:bg-surface-container-low/45 transition-colors">
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-primary">{emp?.name || "Unknown"}</span>
                                <span className="text-[9px] font-mono text-on-surface-variant">{d.employeeId}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary/10 text-secondary uppercase">
                                {cat?.name || "Laborer"}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-semibold">{proj?.projectName || "N/A"}</span>
                                <span className="text-[9px] text-on-surface-variant">CC: {proj?.costCenter || "N/A"}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold">{site?.siteName || "N/A"}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-mono">{d.deploymentDate}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-mono bg-surface-container border border-outline-variant/30 px-1.5 py-0.5 rounded text-xs">
                                {d.startTime} - {d.endTime}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteDeployment(d.id)}
                                className="text-status-error hover:bg-status-error/10 font-bold px-2 py-1 rounded text-[11px] transition-colors border border-status-error/20"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Quick Deployment Form */}
          <div className="space-y-6">
            <Card className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Quick Deploy Staff</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Assign Blue Collar staff to daily site locations.</p>
              </div>

              {deployError && (
                <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error text-xs font-semibold rounded-lg">
                  {deployError}
                </div>
              )}

              <form onSubmit={handleDeploySubmit} className="space-y-3.5 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase">Select Employee</label>
                  <select
                    value={deployEmpId}
                    onChange={(e) => setDeployEmpId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="">Choose worker...</option>
                    {employees
                      .filter(e => e.workerCategory === "BLUE_COLLAR" && (e.employmentStatus ? e.employmentStatus === "ACTIVE" : e.isActive !== false))
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase">Trade Classification</label>
                  <select
                    value={deployCatId}
                    onChange={(e) => setDeployCatId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="">Choose trade...</option>
                    {positionCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase">Project Master</label>
                  <select
                    value={deployProjId}
                    onChange={(e) => setDeployProjId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="">Select project...</option>
                    {projects.filter(p => p.status === "ACTIVE").map(p => (
                      <option key={p.id} value={p.id}>{p.projectName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase">Site Location</label>
                  <select
                    value={deploySiteId}
                    onChange={(e) => setDeploySiteId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={!deployProjId}
                    required
                  >
                    <option value="">Select site...</option>
                    {deploySitesList.map(s => (
                      <option key={s.id} value={s.id}>{s.siteName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase">Deployment Date</label>
                  <Input
                    type="date"
                    value={deployDate}
                    onChange={(e) => setDeployDate(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase">Start Time</label>
                    <Input
                      type="text"
                      placeholder="e.g. 08:00"
                      value={deployStart}
                      onChange={(e) => setDeployStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase">End Time</label>
                    <Input
                      type="text"
                      placeholder="e.g. 17:00"
                      value={deployEnd}
                      onChange={(e) => setDeployEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={deploying} className="w-full py-2 font-bold text-xs">
                  {deploying ? "Deploying..." : "Commit Deployment"}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "coverage" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-primary">Project Site Coverage Overview</h2>
              <p className="text-[11px] text-on-surface-variant">Live headcount distribution and daily coverage across project site nodes.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">Date:</span>
              <input
                type="date"
                defaultValue={new Date().toISOString().substring(0, 10)}
                onChange={(e) => fetchDeploymentsCoverage(e.target.value)}
                className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary font-bold text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {deploymentsCoverage.length === 0 ? (
              <div className="col-span-full text-center py-8 italic text-on-surface-variant text-xs">
                No active project sites configured or coverage records available.
              </div>
            ) : (
              deploymentsCoverage.map((c) => (
                <Card key={c.siteId} className="bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-primary text-sm">{c.siteName}</h4>
                        <span className="text-[9px] font-mono text-outline-variant uppercase">Site ID: {c.siteId.substring(0, 8)}...</span>
                      </div>
                      <Badge variant={c.headcount > 0 ? "success" : "neutral"} className="text-xs px-2.5 py-1 shrink-0 font-black">
                        {c.headcount} Assigned
                      </Badge>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-[9px] opacity-75 font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-1">
                        Active Headcount Details
                      </p>
                      {c.details.length === 0 ? (
                        <p className="text-[10px] italic text-on-surface-variant opacity-60">No personnel deployed today.</p>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {c.details.map((d: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-surface border border-outline-variant/20 rounded p-2 text-[10px] font-bold">
                              <div>
                                <p className="text-primary">{d.employeeName}</p>
                                <p className="text-[8px] font-mono text-on-surface-variant mt-0.5">{d.employeeId} • {d.positionCategory}</p>
                              </div>
                              <span className="font-mono bg-secondary-container/10 border border-secondary-container/20 text-secondary px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">
                                {d.timeBlock}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === "swaps" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container">
            <h2 className="text-sm font-bold text-primary">Peer-to-Peer Shift Swaps</h2>
            <p className="text-[11px] text-on-surface-variant">Review and action requested peer roster swap changes</p>
          </div>
          <div className="divide-y divide-border-subtle">
            {swaps.length === 0 ? (
              <p className="p-6 text-center text-xs italic text-on-surface-variant">No shift swap requests found</p>
            ) : (
              swaps.map((s) => (
                <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-primary">{s.requestorName}</span>
                      <span className="text-on-surface-variant">wants to swap with</span>
                      <span className="font-bold text-secondary">{s.targetEmployeeName}</span>
                    </div>
                    <div className="space-y-0.5 text-on-surface-variant text-[11px]">
                      <p>
                        Requestor Shift: <span className="font-bold text-primary">{s.requestorShiftId}</span>
                      </p>
                      <p>
                        Target Shift: <span className="font-bold text-secondary">{s.targetShiftId}</span>
                      </p>
                      {s.reason && <p className="italic mt-1">"Reason: {s.reason}"</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === "PENDING" ? (
                      <>
                        <Button variant="secondary" onClick={() => handleActionSwap(s.id, "REJECTED")} className="py-1 px-3 border-status-error text-status-error font-bold">
                          Reject
                        </Button>
                        <Button onClick={() => handleActionSwap(s.id, "APPROVED")} className="py-1 px-3 bg-status-success hover:bg-status-success/80 text-white font-bold">
                          Approve Swap
                        </Button>
                      </>
                    ) : (
                      <Badge variant={s.status === "APPROVED" ? "success" : "error"} className="font-bold">
                        {s.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === "overtime" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container">
            <h2 className="text-sm font-bold text-primary">Overtime Claims &amp; Approvals</h2>
            <p className="text-[11px] text-on-surface-variant">Approve or reject auto-calculated overtime hours before payroll processing</p>
          </div>
          <div className="divide-y divide-border-subtle">
            {overtimeRecords.length === 0 ? (
              <p className="p-6 text-center text-xs italic text-on-surface-variant">No overtime claims records found</p>
            ) : (
              overtimeRecords.map((rec) => {
                const totalMinutes = (rec.standardOtMinutes || 0) + (rec.weekendOtMinutes || 0) + (rec.holidayOtMinutes || 0) + (rec.nightOtMinutes || 0);
                if (totalMinutes === 0) return null;
                return (
                  <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-primary">{rec.employeeName}</span>
                        <span className="text-[10px] font-mono text-on-surface-variant">({rec.employeeId})</span>
                        <Badge variant="neutral" className="font-bold text-[9px]">{rec.checkIn.substring(0,10)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-on-surface-variant text-[11px] font-medium">
                        <p>Standard OT: <span className="font-bold text-primary">{rec.standardOtMinutes} mins</span></p>
                        <p>Weekend OT: <span className="font-bold text-primary">{rec.weekendOtMinutes} mins</span></p>
                        <p>Holiday OT: <span className="font-bold text-primary">{rec.holidayOtMinutes} mins</span></p>
                        <p>Night OT: <span className="font-bold text-primary">{rec.nightOtMinutes} mins</span></p>
                        <p className="col-span-2 mt-1">Est. Pay Amount: <span className="font-bold text-status-success">{rec.overtimePayAmount?.toFixed(2)} QAR</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.otStatus === "PENDING" ? (
                        <>
                          <Button variant="secondary" onClick={() => handleActionOvertime(rec.id, "REJECTED")} className="py-1 px-3 border-status-error text-status-error font-bold">
                            Reject
                          </Button>
                          <Button onClick={() => handleActionOvertime(rec.id, "APPROVED")} className="py-1 px-3 bg-status-success hover:bg-status-success/80 text-white font-bold">
                            Approve OT
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={rec.otStatus === "APPROVED" ? "success" : "error"} className="font-bold">
                            {rec.otStatus}
                          </Badge>
                          {rec.otStatus === "APPROVED" && (
                            <span className="text-[10px] text-on-surface-variant">Approved Minutes: {rec.otApprovedMinutes} mins</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {activeTab === "rates" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-primary">Configurable Overtime Rates</h2>
              <p className="text-[11px] text-on-surface-variant">Define rate multiplier rules for Standard, Weekend, and Holiday work brackets</p>
            </div>
            <Button onClick={() => { setEditingRateId(null); setIsRateModalOpen(true); }} className="font-bold text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">add</span> Add Custom Rate
            </Button>
          </div>
          <div className="divide-y divide-border-subtle text-xs">
            {overtimeRates.map((rate) => (
              <div key={rate.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-primary">{rate.name}</span>
                    <Badge variant="neutral" className="font-mono text-[9px]">{rate.overtimeType}</Badge>
                  </div>
                  <div className="space-y-0.5 text-on-surface-variant text-[11px] font-semibold">
                    <p>Multiplier: {rate.multiplier}x</p>
                    {rate.fixedRateAmount && <p>Fixed Rate Amount: {rate.fixedRateAmount} {rate.currency}</p>}
                    <p>Applies On: {rate.appliesOnWeekend ? "Weekends" : ""} {rate.appliesOnHoliday ? "Holidays" : ""} {(!rate.appliesOnWeekend && !rate.appliesOnHoliday) ? "Normal Days" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingRateId(rate.id);
                      setRateName(rate.name);
                      setRateType(rate.overtimeType);
                      setRateMultiplier(rate.multiplier.toString());
                      setRateFixed(rate.fixedRateAmount?.toString() || "");
                      setRateWeekend(rate.appliesOnWeekend);
                      setRateHoliday(rate.appliesOnHoliday);
                      setRateAfterMins(rate.appliesAfterMinutes.toString());
                      setIsRateModalOpen(true);
                    }}
                    className="py-1 px-3 text-xs"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Create/Edit Overtime Rate Modal */}
      <Modal isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} title={editingRateId ? "Edit Overtime Rate" : "Create Overtime Rate"}>
        <form onSubmit={handleSaveRate} className="space-y-4 text-xs font-semibold">
          <Input
            label="Rate Name"
            placeholder="e.g. Special Ops Rate"
            value={rateName}
            onChange={(e) => setRateName(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Overtime Type</label>
            <select
              value={rateType}
              onChange={(e) => setRateType(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
            >
              <option value="STANDARD_OT">Standard OT</option>
              <option value="WEEKEND_OT">Weekend OT</option>
              <option value="HOLIDAY_OT">Holiday OT</option>
              <option value="NIGHT_OT">Night OT</option>
              <option value="SPECIAL_EVENT_OT">Special Event OT</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Multiplier"
              placeholder="e.g. 1.75"
              type="number"
              step="0.05"
              value={rateMultiplier}
              onChange={(e) => setRateMultiplier(e.target.value)}
              required
            />
            <Input
              label="Fixed Rate Amount (Optional)"
              placeholder="e.g. 75"
              type="number"
              value={rateFixed}
              onChange={(e) => setRateFixed(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="rateWeekend"
                checked={rateWeekend}
                onChange={(e) => setRateWeekend(e.target.checked)}
              />
              <label htmlFor="rateWeekend" className="cursor-pointer font-bold">Applies on Weekends</label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="rateHoliday"
                checked={rateHoliday}
                onChange={(e) => setRateHoliday(e.target.checked)}
              />
              <label htmlFor="rateHoliday" className="cursor-pointer font-bold">Applies on Holidays</label>
            </div>
          </div>
          <Input
            label="Applies After (Minutes)"
            type="number"
            value={rateAfterMins}
            onChange={(e) => setRateAfterMins(e.target.value)}
          />
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsRateModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingRate}>
              {savingRate ? "Saving..." : "Save Rate"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Drag and Drop Confirmation Modal */}
      <Modal isOpen={!!dropConfirmation} onClose={() => setDropConfirmation(null)} title="Confirm Shift Reassignment">
        {dropConfirmation && (
          <div className="space-y-4 text-xs font-semibold">
            {dropConfirmation.warningMessage && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg flex gap-2">
                <span className="material-symbols-outlined text-sm font-bold">warning</span>
                <span>{dropConfirmation.warningMessage}</span>
              </div>
            )}
            <p className="text-on-surface">
              Are you sure you want to move this shift assignment to <strong className="text-primary">{dropConfirmation.targetEmpName}</strong> on <strong>{dropConfirmation.targetDate}</strong>?
            </p>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
              <Button variant="secondary" onClick={() => setDropConfirmation(null)}>Cancel</Button>
              <Button onClick={executeDropReassignment}>Confirm Reassignment</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cell Action Modal */}
      <Modal isOpen={!!activeCell} onClose={() => { setActiveCell(null); setCellActionType(""); }} title={`Scheduler Actions - ${employees.find(e => e.id === activeCell?.employeeId)?.name || ""} on ${activeCell?.date || ""}`}>
        {activeCell && (
          <form onSubmit={handleCellActionSubmit} className="space-y-4 text-xs font-semibold">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Action Type</label>
              <select
                value={cellActionType}
                onChange={(e) => {
                  setCellActionType(e.target.value);
                  setSelectedRelieverId("");
                  setRelieversList([]);
                }}
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
              >
                {!activeCell.assignment && <option value="ASSIGN_SHIFT">Assign Shift</option>}
                {!activeCell.assignment && <option value="SPLIT_SHIFT">Assign Split Shift</option>}
                <option value="MARK_LEAVE">Mark Sick/Casual Leave</option>
                <option value="MARK_VACATION">Mark Annual Vacation</option>
                <option value="MARK_OFF">Mark Day Off</option>
                <option value="ASSIGN_PROJECT_SITE">Assign Project / Site Deployment</option>
                <option value="ASSIGN_ON_CALL">Assign On-Call Duty</option>
                <option value="LINK_RELIEVER">Link Reliever / Cover</option>
              </select>
            </div>

            {/* ASSIGN_SHIFT or SPLIT_SHIFT fields */}
            {(cellActionType === "ASSIGN_SHIFT" || cellActionType === "SPLIT_SHIFT") && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Select Shift Template</label>
                  <select
                    value={cellShiftId}
                    onChange={(e) => setCellShiftId(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                  >
                    <option value="">Select Template</option>
                    {shiftTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.startTime} - {t.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* MARK_LEAVE, MARK_VACATION, MARK_OFF fields */}
            {["MARK_LEAVE", "MARK_VACATION", "MARK_OFF"].includes(cellActionType) && (
              <div className="space-y-3">
                <Input
                  label="Leave/Off Type"
                  value={cellLeaveType}
                  onChange={(e) => setCellLeaveType(e.target.value)}
                  placeholder="e.g. Sick Leave, Casual Leave, Off-duty"
                  required
                />
                <Input
                  label="Reason / Notes"
                  value={cellLeaveReason}
                  onChange={(e) => setCellLeaveReason(e.target.value)}
                  placeholder="e.g. Family medical emergency"
                />
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="cellLeaveRelieverRequired"
                    checked={cellLeaveRelieverRequired}
                    onChange={(e) => setCellLeaveRelieverRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-outline-variant focus:ring-0"
                  />
                  <label htmlFor="cellLeaveRelieverRequired" className="cursor-pointer font-bold text-on-surface flex items-center gap-1">
                    Reliever Required? <span className="text-[10px] font-normal text-on-surface-variant">(Select cover employee next)</span>
                  </label>
                </div>
              </div>
            )}

            {/* ASSIGN_PROJECT_SITE fields */}
            {cellActionType === "ASSIGN_PROJECT_SITE" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Project</label>
                    <select
                      value={cellProjectId}
                      onChange={(e) => setCellProjectId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                      required
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.projectName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Site</label>
                    <select
                      value={cellSiteId}
                      onChange={(e) => setCellSiteId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                      required
                      disabled={!cellProjectId}
                    >
                      <option value="">Select Site</option>
                      {projectSites.filter(s => s.projectId === cellProjectId).map(s => (
                        <option key={s.id} value={s.id}>{s.siteName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start Time"
                    value={cellStartTime}
                    onChange={(e) => setCellStartTime(e.target.value)}
                    placeholder="e.g. 08:00"
                    required
                  />
                  <Input
                    label="End Time"
                    value={cellEndTime}
                    onChange={(e) => setCellEndTime(e.target.value)}
                    placeholder="e.g. 17:00"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Deployment Role / Trade</label>
                  <select
                    value={cellPositionCategoryId}
                    onChange={(e) => setCellPositionCategoryId(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                    required
                  >
                    <option value="">Select Trade Category</option>
                    {positionCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ASSIGN_ON_CALL fields */}
            {cellActionType === "ASSIGN_ON_CALL" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Target Project (Optional)</label>
                  <select
                    value={cellProjectId}
                    onChange={(e) => setCellProjectId(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                  >
                    <option value="">None / Standby Pool</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.projectName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start Time"
                    value={cellStartTime}
                    onChange={(e) => setCellStartTime(e.target.value)}
                    placeholder="e.g. 08:00"
                    required
                  />
                  <Input
                    label="End Time"
                    value={cellEndTime}
                    onChange={(e) => setCellEndTime(e.target.value)}
                    placeholder="e.g. 17:00"
                    required
                  />
                </div>
              </div>
            )}

            {/* LINK_RELIEVER fields */}
            {cellActionType === "LINK_RELIEVER" && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Recommended Covers (Standby Pool / Compatible Trades)</p>
                {fetchingRelievers ? (
                  <p className="text-xs text-on-surface-variant italic">Finding available matching relievers...</p>
                ) : relieversList.length === 0 ? (
                  <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg">
                    No matching standby or off-duty relievers found for this date.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 border border-outline-variant/30 rounded-lg p-2 bg-surface-container-low">
                    {relieversList.map((rel: any) => (
                      <label key={rel.employeeId} className={`flex items-start gap-3 p-2 rounded border cursor-pointer hover:bg-surface transition-colors ${selectedRelieverId === rel.employeeId ? 'border-primary bg-primary/5' : 'border-outline-variant/30'}`}>
                        <input
                          type="radio"
                          name="selectedReliever"
                          checked={selectedRelieverId === rel.employeeId}
                          onChange={() => setSelectedRelieverId(rel.employeeId)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-primary">{rel.name} ({rel.employeeId})</span>
                            <Badge variant={rel.isStandbyPool ? "success" : "info"}>
                              {rel.isStandbyPool ? `Standby (Score: ${rel.matchScore})` : `Off-Duty (Score: ${rel.matchScore})`}
                            </Badge>
                          </div>
                          <p className="text-[9px] text-on-surface-variant opacity-85 mt-0.5 leading-normal">
                            Reason: {rel.matchReasons?.join(", ") || "Compatible trade match"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Optional Project</label>
                    <select
                      value={cellProjectId}
                      onChange={(e) => setCellProjectId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                    >
                      <option value="">Select Project (Optional)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.projectName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Optional Site</label>
                    <select
                      value={cellSiteId}
                      onChange={(e) => setCellSiteId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-bold outline-none"
                      disabled={!cellProjectId}
                    >
                      <option value="">Select Site (Optional)</option>
                      {projectSites.filter(s => s.projectId === cellProjectId).map(s => (
                        <option key={s.id} value={s.id}>{s.siteName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Cover Start Time"
                    value={cellStartTime}
                    onChange={(e) => setCellStartTime(e.target.value)}
                    placeholder="e.g. 08:00"
                    required
                  />
                  <Input
                    label="Cover End Time"
                    value={cellEndTime}
                    onChange={(e) => setCellEndTime(e.target.value)}
                    placeholder="e.g. 17:00"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
              <Button variant="secondary" type="button" onClick={() => { setActiveCell(null); setCellActionType(""); }}>Cancel</Button>
              <Button type="submit" disabled={cellActionType === "LINK_RELIEVER" && !selectedRelieverId}>
                Apply Action
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
