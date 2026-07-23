"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@ahh-wfm/ui";
import { X, CheckCircle, XCircle, Clock, AlertTriangle, FileText, ArrowRight, ShieldAlert } from "lucide-react";

interface ChangeRequest {
  id: string;
  operationType: string;
  contractId: string;
  basePublicationId: string;
  basePublicationVersion: number;
  publicationSlotId: string;
  slotId: string;
  changeType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "SUPERSEDED" | "CONFLICTED";
  reason: string;
  beforeSnapshot: any;
  proposedSnapshot: any;
  requestedBy?: { firstName: string; lastName: string; employeeId?: string };
  reviewedBy?: { firstName: string; lastName: string; employeeId?: string };
  requestedAt: string;
  reviewNotes?: string | null;
}

interface RosterChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationType: string;
  contractId: string;
  siteId?: string | null;
  currentUserEmployeeId?: string;
  currentUserRole?: string;
  onReviewSuccess?: () => void;
}

export function RosterChangeRequestModal({
  isOpen,
  onClose,
  operationType,
  contractId,
  siteId,
  currentUserEmployeeId,
  currentUserRole,
  onReviewSuccess
}: RosterChangeRequestModalProps) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("PENDING");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [allowSelfOverride, setAllowSelfOverride] = useState(false);
  const [selfOverrideReason, setSelfOverrideReason] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/v1/manpower/scheduling/change-requests?operationType=${operationType}&contractId=${contractId}${siteId ? `&siteId=${siteId}` : ""}${selectedStatus ? `&status=${selectedStatus}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setRequests(json.changeRequests || []);
      } else {
        setError(json.error || "Failed to load change requests");
      }
    } catch (e: any) {
      setError("Network error fetching change requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && contractId) {
      fetchRequests();
    }
  }, [isOpen, contractId, siteId, operationType, selectedStatus]);

  const handleReview = async (requestId: string, decision: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/v1/manpower/scheduling/change-requests/${requestId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reviewNotes,
          allowSelfApprovalOverride: allowSelfOverride,
          selfApprovalReason: selfOverrideReason
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(`Change request ${decision === "APPROVE" ? "approved" : "rejected"} successfully!`);
        setReviewingId(null);
        setReviewNotes("");
        setAllowSelfOverride(false);
        setSelfOverrideReason("");
        fetchRequests();
        onReviewSuccess?.();
      } else {
        alert(json.error || `Failed to ${decision.toLowerCase()} change request.`);
      }
    } catch (e: any) {
      alert("Error reviewing request: " + e.message);
    }
  };

  const handleWithdraw = async (requestId: string) => {
    if (!confirm("Are you sure you want to withdraw this change request?")) return;
    try {
      const res = await fetch(`/api/v1/manpower/scheduling/change-requests/${requestId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Withdrawn by requester" })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert("Change request withdrawn.");
        fetchRequests();
        onReviewSuccess?.();
      } else {
        alert(json.error || "Failed to withdraw change request.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Post-Publication Change Requests (Inbox)
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-2">
          {["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "SUPERSEDED"].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                selectedStatus === st
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Clock className="h-5 w-5 animate-spin mr-2" />
              Loading change requests...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && requests.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No change requests matching status <strong className="font-semibold">{selectedStatus}</strong>.
            </div>
          )}

          {!loading &&
            requests.map((req) => {
              const isRequester = req.requestedBy?.employeeId === currentUserEmployeeId;
              const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        {req.changeType.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        Base Roster v{req.basePublicationVersion}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          req.status === "PENDING"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : req.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <span className="text-xs text-slate-500">
                      Requested: {new Date(req.requestedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Side-by-Side Diff View */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-md">
                    {/* Before Snapshot */}
                    <div className="border-r border-slate-200 dark:border-slate-800 pr-2">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 text-[11px] uppercase tracking-wider">
                        Current Snapshot (Before)
                      </div>
                      <div><strong>Employee:</strong> {req.beforeSnapshot?.employeeName || "Unassigned"} ({req.beforeSnapshot?.employeeCode || "N/A"})</div>
                      <div><strong>Position:</strong> {req.beforeSnapshot?.position}</div>
                      <div><strong>Shift:</strong> {req.beforeSnapshot?.shiftName} ({req.beforeSnapshot?.startTime} - {req.beforeSnapshot?.endTime})</div>
                      <div><strong>Date:</strong> {req.beforeSnapshot?.businessDate ? new Date(req.beforeSnapshot.businessDate).toLocaleDateString() : "N/A"}</div>
                    </div>

                    {/* Proposed Snapshot */}
                    <div>
                      <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> Proposed Snapshot (After)
                      </div>
                      <div><strong>Employee:</strong> {req.proposedSnapshot?.employeeName || "Unassigned"} ({req.proposedSnapshot?.employeeCode || "N/A"})</div>
                      <div><strong>Position:</strong> {req.proposedSnapshot?.position}</div>
                      <div><strong>Shift:</strong> {req.proposedSnapshot?.shiftName} ({req.proposedSnapshot?.startTime} - {req.proposedSnapshot?.endTime})</div>
                      <div><strong>Status:</strong> {req.proposedSnapshot?.assignmentStatus}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Requester:</strong> {req.requestedBy ? `${req.requestedBy.firstName} ${req.requestedBy.lastName}` : "User"}<br />
                    <strong>Reason:</strong> {req.reason}
                  </div>

                  {/* Review / Withdraw Action Controls */}
                  {req.status === "PENDING" && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {reviewingId === req.id ? (
                        <div className="space-y-2 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                          <textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Enter review notes..."
                            className="w-full text-xs p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                            rows={2}
                          />

                          {/* Self-approval override checkbox if applicable */}
                          {isRequester && isSuperAdmin && (
                            <div className="p-2 bg-red-100/50 dark:bg-red-950/40 rounded space-y-2 border border-red-300 dark:border-red-800">
                              <label className="flex items-center gap-2 text-xs font-semibold text-red-800 dark:text-red-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={allowSelfOverride}
                                  onChange={(e) => setAllowSelfOverride(e.target.checked)}
                                  className="rounded text-red-600 focus:ring-red-500"
                                />
                                <ShieldAlert className="h-4 w-4" /> SUPER_ADMIN Break-Glass Self-Approval Override
                              </label>
                              {allowSelfOverride && (
                                <input
                                  type="text"
                                  value={selfOverrideReason}
                                  onChange={(e) => setSelfOverrideReason(e.target.value)}
                                  placeholder="Enter mandatory override reason (min 15 chars)..."
                                  className="w-full text-xs p-2 border rounded dark:bg-slate-800 dark:border-slate-700"
                                />
                              )}
                            </div>
                          )}

                          {isRequester && !isSuperAdmin && (
                            <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1 font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              Self-approval is forbidden. Another manager must review this request.
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <Button variant="secondary" onClick={() => setReviewingId(null)} className="h-8 text-xs">
                              Cancel
                            </Button>
                            <Button
                              variant="error"
                              onClick={() => handleReview(req.id, "REJECT")}
                              className="h-8 text-xs"
                            >
                              Reject
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => handleReview(req.id, "APPROVE")}
                              disabled={isRequester && !isSuperAdmin}
                              className="h-8 text-xs"
                            >
                              Approve Revision
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          {isRequester && (
                            <Button
                              variant="secondary"
                              onClick={() => handleWithdraw(req.id)}
                              className="h-8 text-xs text-slate-600 hover:text-slate-900"
                            >
                              Withdraw Request
                            </Button>
                          )}
                          <div className="flex gap-2 ml-auto">
                            <Button
                              variant="primary"
                              onClick={() => setReviewingId(req.id)}
                              className="h-8 text-xs"
                            >
                              Review & Approve/Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
