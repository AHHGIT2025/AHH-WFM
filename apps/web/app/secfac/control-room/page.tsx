"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface ChecklistItemSnapshot {
  id: string;
  itemText: string;
  itemType: string;
  isRequired: boolean;
}

interface ChecklistResponse {
  id: string;
  itemTextSnapshot: string;
  itemTypeSnapshot: string;
  answerValue: string | null;
  answerText: string | null;
  comment: string | null;
  isFlagged: boolean;
  flagReason: string | null;
  checklistItem?: ChecklistItemSnapshot | null;
}

interface ExecutionHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  remarks: string | null;
  changedById: string | null;
  changedBy?: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
  createdAt: string;
}

interface ChecklistExecution {
  id: string;
  operationType: string;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  deviceInfo: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  assignment?: {
    id: string;
    assignmentName: string;
  } | null;
  checklistTemplate?: {
    id: string;
    templateName: string;
  } | null;
  employee?: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
  site?: {
    id: string;
    siteName: string;
  } | null;
  checkpoint?: {
    id: string;
    checkpointName: string;
  } | null;
  reviewedBy?: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
  responses?: ChecklistResponse[];
  history?: ExecutionHistory[];
}

export default function ControlRoomPage() {
  const { data: session } = useSession();
  const currentUser = session?.user as any;
  const userRole = currentUser?.role || "EMPLOYEE";
  const operationAccess = currentUser?.operationAccess || {};
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer State
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [selectedExec, setSelectedExec] = useState<ChecklistExecution | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  
  // Review Submission State
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Filters State
  const [filterOpType, setFilterOpType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchExecutions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Enforce OperationType scope restrictions for non-admin supervisors
      if (!isAdmin) {
        if (operationAccess.allowedSecurityGuarding && !operationAccess.allowedFacilityManagement) {
          params.append("operationType", "SECURITY_GUARDING");
        } else if (operationAccess.allowedFacilityManagement && !operationAccess.allowedSecurityGuarding) {
          params.append("operationType", "FACILITY_MANAGEMENT");
        }
      }

      const res = await fetch(`/api/v1/secfac/checklist-executions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setExecutions(data.data || []);
      } else {
        setError(data.error || "Failed to fetch executions");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutionDetail = async (id: string) => {
    setDrawerLoading(true);
    setReviewRemarks("");
    setReviewError(null);
    setReviewSuccess(false);
    try {
      const res = await fetch(`/api/v1/secfac/checklist-executions/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedExec(data.data);
      } else {
        alert(data.error || "Failed to load details");
      }
    } catch (err: any) {
      alert(err.message || "Failed to load details");
    } finally {
      setDrawerLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, [session]);

  useEffect(() => {
    if (selectedExecId) {
      fetchExecutionDetail(selectedExecId);
    } else {
      setSelectedExec(null);
    }
  }, [selectedExecId]);

  const handleReviewSubmit = async (targetStatus: "APPROVED" | "REJECTED" | "REOPENED") => {
    if (!selectedExec) return;
    setReviewLoading(true);
    setReviewError(null);
    setReviewSuccess(false);

    if ((targetStatus === "REJECTED" || targetStatus === "REOPENED") && !reviewRemarks.trim()) {
      setReviewError("Supervisor remarks are required when rejecting or reopening a checklist.");
      setReviewLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/secfac/checklist-executions/${selectedExec.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus,
          remarks: reviewRemarks
        })
      });

      const data = await res.json();
      if (data.success) {
        setReviewSuccess(true);
        setReviewRemarks("");
        // Reload detail and execution list
        fetchExecutionDetail(selectedExec.id);
        fetchExecutions();
      } else {
        setReviewError(data.message || data.error || "Review submission failed");
      }
    } catch (err: any) {
      setReviewError(err.message || "An unexpected error occurred");
    } finally {
      setReviewLoading(false);
    }
  };

  // Extract unique filter dropdown values from loaded executions
  const uniqueSites = Array.from(new Set(executions.map(x => x.site?.siteName || "").filter(Boolean)));
  const uniqueEmployees = Array.from(new Set(executions.map(x => x.employee?.name || "").filter(Boolean)));

  // Filter Logic
  const filteredExecutions = executions.filter(x => {
    // Op Type filter
    if (filterOpType !== "ALL" && x.operationType !== filterOpType) return false;
    
    // Status filter
    if (filterStatus !== "ALL") {
      if (filterStatus === "PENDING_REVIEW" && x.status !== "SUBMITTED" && x.status !== "PENDING_REVIEW") return false;
      if (filterStatus !== "PENDING_REVIEW" && x.status !== filterStatus) return false;
    }

    // Employee filter
    if (filterEmployee && x.employee?.name !== filterEmployee) return false;

    // Site filter
    if (filterSite && x.site?.siteName !== filterSite) return false;

    // Date filter
    if (filterDate) {
      const executionDate = x.submittedAt || x.createdAt;
      if (!executionDate.startsWith(filterDate)) return false;
    }

    // Search query free text
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = x.employee?.name?.toLowerCase().includes(q);
      const matchSite = x.site?.siteName?.toLowerCase().includes(q);
      const matchTemplate = x.checklistTemplate?.templateName?.toLowerCase().includes(q);
      const matchAssign = x.assignment?.assignmentName?.toLowerCase().includes(q);
      if (!matchName && !matchSite && !matchTemplate && !matchAssign) return false;
    }

    return true;
  });

  // KPI Calculations
  const stats = {
    total: executions.length,
    pending: executions.filter(x => x.status === "SUBMITTED" || x.status === "PENDING_REVIEW").length,
    approved: executions.filter(x => x.status === "APPROVED").length,
    rejected: executions.filter(x => x.status === "REJECTED").length,
    reopened: executions.filter(x => x.status === "REOPENED").length,
    today: executions.filter(x => {
      const dateStr = x.submittedAt || x.createdAt;
      return dateStr && dateStr.startsWith(new Date().toISOString().split("T")[0]);
    }).length
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-350">DRAFT</span>;
      case "SUBMITTED":
      case "PENDING_REVIEW":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E7EEFF] text-[#002D72] border border-[#B1C5FF]">PENDING REVIEW</span>;
      case "APPROVED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">APPROVED</span>;
      case "REJECTED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">REJECTED</span>;
      case "REOPENED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-250">REOPENED</span>;
      case "CANCELLED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-150 text-gray-500 border border-gray-300 line-through">CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">{status}</span>;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div className="flex-1 bg-[#F9F9FF] p-6 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh] relative overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#E7EEFF] pb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[#002D72] text-3xl">shield_heart</span>
            <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Control Room & Review Queue</h1>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#002D72]/10 text-[#002D72] border border-[#002D72]/20 uppercase">
              Operations
            </span>
          </div>
          <p className="text-xs text-[#444651]">
            Real-time supervisor review queue for Security Guarding patrol logs and Facility Management inspection checklists.
          </p>
        </div>
        <button
          onClick={fetchExecutions}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#C4C6D2] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-all"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Refresh Queue
        </button>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-[#C4C6D2] p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-[#747782] uppercase tracking-wider font-mono">Total Rounds</span>
          <h3 className="text-2xl font-bold text-[#001A48] mt-1 font-mono">{stats.total}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-4 rounded-xl shadow-sm border-l-4 border-l-[#002D72] flex flex-col justify-between">
          <span className="text-[10px] font-bold text-[#002D72] uppercase tracking-wider font-mono">Pending Review</span>
          <h3 className="text-2xl font-bold text-[#002D72] mt-1 font-mono">{stats.pending}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-4 rounded-xl shadow-sm border-l-4 border-l-green-600 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider font-mono">Approved</span>
          <h3 className="text-2xl font-bold text-green-800 mt-1 font-mono">{stats.approved}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-4 rounded-xl shadow-sm border-l-4 border-l-red-600 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider font-mono">Rejected</span>
          <h3 className="text-2xl font-bold text-red-800 mt-1 font-mono">{stats.rejected}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-4 rounded-xl shadow-sm border-l-4 border-l-amber-500 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-mono">Reopened</span>
          <h3 className="text-2xl font-bold text-amber-900 mt-1 font-mono">{stats.reopened}</h3>
        </div>
        <div className="bg-white border border-[#C4C6D2] p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Submitted Today</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1 font-mono">{stats.today}</h3>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white border border-[#C4C6D2] rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-[#001A48]">
          <span className="material-symbols-outlined text-sm">filter_alt</span>
          Filter Review Queue
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {/* Operation Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Op Type</label>
            <select
              value={filterOpType}
              onChange={(e) => setFilterOpType(e.target.value)}
              className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
            >
              <option value="ALL">All Operations</option>
              <option value="SECURITY_GUARDING">Security Guarding</option>
              <option value="FACILITY_MANAGEMENT">Facility Management</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="REOPENED">Reopened</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Employee</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
            >
              <option value="">All Employees</option>
              {uniqueEmployees.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          {/* Site Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Site / Location</label>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
            >
              <option value="">All Sites</option>
              {uniqueSites.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Submission Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
            />
          </div>

          {/* Free Text Search */}
          <div>
            <label className="block text-[10px] font-bold text-[#444651] uppercase mb-1 font-mono">Free Text Search</label>
            <input
              type="text"
              placeholder="Search employee, site..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F9F9FF] border border-[#C4C6D2] rounded-lg px-2.5 py-1.5 text-xs text-[#001A48] focus:outline-none focus:border-[#002D72]"
            />
          </div>
        </div>
      </div>

      {/* Main Review Queue Table */}
      <div className="bg-white border border-[#C4C6D2] rounded-xl shadow-sm overflow-hidden mb-8">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-[#002D72] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-[#747782] font-bold font-mono">Loading review queue...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <span className="material-symbols-outlined text-3xl mb-2">error</span>
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="p-12 text-center text-[#747782]">
            <span className="material-symbols-outlined text-3xl mb-2 text-[#C4C6D2]">inbox</span>
            <p className="text-xs font-bold font-mono">No checklist submissions match the active filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#002D72]/5 text-[#001A48] border-b border-[#C4C6D2] font-bold font-mono text-[10px] uppercase">
                  <th className="p-3">Assignment / Task</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Op Type</th>
                  <th className="p-3">Site / Checkpoint</th>
                  <th className="p-3">Checklist Template</th>
                  <th className="p-3">Submitted At</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reviewer</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C4C6D2]/40">
                {filteredExecutions.map((x) => {
                  const hasFlagged = x.responses?.some(r => r.isFlagged);
                  return (
                    <tr
                      key={x.id}
                      onClick={() => setSelectedExecId(x.id)}
                      className={`hover:bg-slate-50 cursor-pointer transition-all ${
                        x.status === "SUBMITTED" || x.status === "PENDING_REVIEW" ? "font-semibold bg-[#002D72]/[0.01]" : ""
                      }`}
                    >
                      <td className="p-3 text-[#001A48]">
                        {x.assignment?.assignmentName || "Ad-hoc Execution"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{x.employee?.name}</span>
                          <span className="text-[10px] text-[#747782] font-mono">{x.employee?.employeeId}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[10px]">
                        {x.operationType === "SECURITY_GUARDING" ? (
                          <span className="text-blue-800 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">SG</span>
                        ) : (
                          <span className="text-purple-800 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">FM</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-slate-800">{x.site?.siteName || "-"}</span>
                          {x.checkpoint && (
                            <span className="text-[10px] text-teal-800 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">location_on</span>
                              {x.checkpoint.checkpointName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          {x.checklistTemplate?.templateName}
                          {hasFlagged && (
                            <span className="material-symbols-outlined text-red-600 text-sm animate-pulse" title="Flagged (failed) checklist answers present">
                              warning
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-[#747782] font-mono">
                        {formatDateTime(x.submittedAt || x.createdAt)}
                      </td>
                      <td className="p-3">
                        {getStatusBadge(x.status)}
                      </td>
                      <td className="p-3 text-slate-700">
                        {x.reviewedBy ? (
                          <span className="text-[11px] font-medium">{x.reviewedBy.name}</span>
                        ) : (
                          <span className="text-[10px] text-[#747782] font-mono">Unreviewed</span>
                        )}
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedExecId(x.id)}
                          className="px-2.5 py-1 bg-[#002D72] hover:bg-[#001A48] text-white text-[10px] font-bold rounded transition-all"
                        >
                          {x.status === "SUBMITTED" || x.status === "PENDING_REVIEW" ? "Review" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details & Review Sliding Drawer */}
      {selectedExecId && (
        <div className="fixed inset-0 bg-[#001A48]/40 backdrop-blur-sm z-50 flex justify-end transition-opacity duration-300">
          {/* Backdrop Closer */}
          <div className="flex-1" onClick={() => setSelectedExecId(null)}></div>
          
          {/* Drawer Body */}
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col relative transform translate-x-0 transition-transform duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#E7EEFF] bg-[#002D72] text-white flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Checklist Execution Review Details</h2>
                <p className="text-[10px] opacity-80 font-mono mt-0.5">ID: {selectedExecId}</p>
              </div>
              <button
                onClick={() => setSelectedExecId(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {drawerLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-3 border-[#002D72] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] text-[#747782] font-mono">Loading checklist details...</span>
                </div>
              ) : selectedExec ? (
                <>
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-xs">
                      <span className="font-bold text-slate-700">Round Status:</span>
                    </div>
                    {getStatusBadge(selectedExec.status)}
                  </div>

                  {/* General Assignment & Employee Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F9F9FF] border border-[#C4C6D2] p-3 rounded-lg">
                      <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider font-mono">Employee Details</span>
                      <h4 className="text-xs font-bold text-[#001A48] mt-0.5">{selectedExec.employee?.name}</h4>
                      <p className="text-[10px] text-[#747782] font-mono mt-0.5">ID: {selectedExec.employee?.employeeId}</p>
                    </div>
                    <div className="bg-[#F9F9FF] border border-[#C4C6D2] p-3 rounded-lg">
                      <span className="text-[9px] font-bold text-[#747782] uppercase tracking-wider font-mono">Site & Checkpoint</span>
                      <h4 className="text-xs font-bold text-slate-800 mt-0.5">{selectedExec.site?.siteName}</h4>
                      {selectedExec.checkpoint && (
                        <p className="text-[10px] text-teal-800 font-medium flex items-center gap-0.5 mt-0.5">
                          <span className="material-symbols-outlined text-[10px]">location_on</span>
                          {selectedExec.checkpoint.checkpointName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Execution Timing & Metadata */}
                  <div className="bg-white border border-[#C4C6D2] rounded-lg p-3 text-[11px] text-slate-700 space-y-1.5">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-medium text-slate-500">Checklist Template:</span>
                      <span className="font-bold text-slate-800">{selectedExec.checklistTemplate?.templateName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-medium text-slate-500">Start Time:</span>
                      <span className="font-mono">{formatDateTime(selectedExec.startedAt)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-medium text-slate-500">Submitted Time:</span>
                      <span className="font-mono">{formatDateTime(selectedExec.submittedAt)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-medium text-slate-500">Device Logged:</span>
                      <span className="font-mono">{selectedExec.deviceInfo || "Web Session / Unknown"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">GPS Geolocation:</span>
                      {selectedExec.latitude ? (
                        <span className="font-mono text-green-700">
                          {selectedExec.latitude.toFixed(6)}, {selectedExec.longitude?.toFixed(6)}{" "}
                          <span className="text-[10px] text-slate-500">({selectedExec.gpsAccuracyMeters}m acc)</span>
                        </span>
                      ) : (
                        <span className="text-[#747782] italic">GPS not logged</span>
                      )}
                    </div>
                  </div>

                  {/* Checklist Answers Snapshot */}
                  <div>
                    <h3 className="text-xs font-bold text-[#001A48] mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">checklist</span>
                      Submitted Checklist Responses ({selectedExec.responses?.length || 0})
                    </h3>
                    <div className="border border-[#C4C6D2] rounded-xl overflow-hidden divide-y divide-[#C4C6D2]/55">
                      {selectedExec.responses?.map((r, i) => (
                        <div key={r.id} className={`p-3 space-y-1.5 text-xs ${r.isFlagged ? "bg-red-50/50" : ""}`}>
                          <div className="flex items-start justify-between gap-4">
                            <span className="font-medium text-slate-800">
                              {i + 1}. {r.itemTextSnapshot}
                            </span>
                            <div className="flex flex-col items-end gap-1">
                              {r.answerValue === "YES" || r.answerValue === "PASS" ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-150 text-green-800 border border-green-300">
                                  {r.answerValue}
                                </span>
                              ) : r.answerValue === "NO" || r.answerValue === "FAIL" ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-150 text-red-800 border border-red-300">
                                  {r.answerValue}
                                </span>
                              ) : r.answerValue ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300 font-mono">
                                  {r.answerValue}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No Answer</span>
                              )}
                            </div>
                          </div>
                          {r.answerText && (
                            <p className="bg-slate-50 border border-slate-200/50 p-2 rounded text-[11px] text-slate-700">
                              <strong>Text input:</strong> {r.answerText}
                            </p>
                          )}
                          {r.comment && (
                            <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">chat</span>
                              Remarks: {r.comment}
                            </p>
                          )}
                          {r.isFlagged && (
                            <div className="flex items-start gap-1 p-1.5 bg-red-100 text-red-800 text-[10px] rounded border border-red-200 font-medium">
                              <span className="material-symbols-outlined text-xs mt-0.5">warning</span>
                              <span>Flagged Issue: {r.flagReason || "Failed answer limit"}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Remarks logged by field user */}
                  {selectedExec.remarks && (
                    <div className="bg-[#F9F9FF] border border-[#C4C6D2] p-3 rounded-lg text-xs text-[#001A48]">
                      <h4 className="font-bold mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">notes</span>
                        Employee Comments
                      </h4>
                      <p className="text-[#444651]">{selectedExec.remarks}</p>
                    </div>
                  )}

                  {/* Review Remarks logged by supervisor */}
                  {selectedExec.reviewRemarks && (
                    <div className="bg-amber-50 border border-amber-250 p-3 rounded-lg text-xs text-amber-900">
                      <h4 className="font-bold mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">rate_review</span>
                        Reviewer Comments ({selectedExec.reviewedBy?.name})
                      </h4>
                      <p className="italic font-medium">"{selectedExec.reviewRemarks}"</p>
                    </div>
                  )}

                  {/* Review Actions Section (Approve / Reject / Reopen) */}
                  {(selectedExec.status === "SUBMITTED" || selectedExec.status === "PENDING_REVIEW") && (
                    <div className="bg-slate-100 border border-[#C4C6D2] p-4 rounded-xl space-y-3">
                      <h3 className="text-xs font-bold text-[#001A48] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#002D72]">gavel</span>
                        Supervisor Review Actions
                      </h3>

                      {reviewError && (
                        <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200 font-bold">
                          {reviewError}
                        </div>
                      )}

                      {reviewSuccess && (
                        <div className="p-2.5 bg-green-50 text-green-700 text-xs rounded border border-green-200 font-bold">
                          Review submitted successfully!
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-[#747782] uppercase mb-1 font-mono">
                          Review Comments / Corrective Action Remarks
                        </label>
                        <textarea
                          placeholder="Enter review remarks. Required for Rejections and Reopen actions..."
                          value={reviewRemarks}
                          onChange={(e) => setReviewRemarks(e.target.value)}
                          className="w-full bg-white border border-[#C4C6D2] rounded-lg p-2 text-xs focus:outline-none focus:border-[#002D72]"
                          rows={3}
                          disabled={reviewLoading}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => handleReviewSubmit("APPROVED")}
                          disabled={reviewLoading}
                          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewSubmit("REJECTED")}
                          disabled={reviewLoading}
                          className="bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewSubmit("REOPENED")}
                          disabled={reviewLoading}
                          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">replay</span>
                          Reopen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Audit History Timeline */}
                  {selectedExec.history && selectedExec.history.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-bold text-[#001A48] mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">history</span>
                        Audit Status History Log
                      </h3>
                      <div className="relative border-l-2 border-slate-200 pl-4 space-y-4 text-xs font-sans">
                        {selectedExec.history.map((h) => (
                          <div key={h.id} className="relative">
                            <span className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-slate-350 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            </span>
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-[#001A48]">
                                {h.action}{" "}
                                {h.fromStatus ? (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    (from {h.fromStatus} to {h.toStatus})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    (set to {h.toStatus})
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-[#747782] font-mono">{formatDateTime(h.createdAt)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Performed by: {h.changedBy?.name || "System"} (ID: {h.changedBy?.employeeId || "SYS"})
                            </p>
                            {h.remarks && (
                              <p className="bg-slate-50 border border-slate-200/50 p-1.5 rounded text-[10px] mt-1 text-slate-700 italic">
                                "{h.remarks}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
