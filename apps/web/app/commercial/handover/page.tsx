"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Building2,
  UserCheck,
  ClipboardList,
  ChevronRight,
  ShieldCheck,
  Plus,
  RefreshCw
} from "lucide-react";

export default function HandoverPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [handoverData, setHandoverData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [taskLoading, setTaskLoading] = useState<boolean>(false);
  const [signoffLoading, setSignoffLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Sign-off modal form state
  const [showSignoffModal, setShowSignoffModal] = useState<boolean>(false);
  const [clientSignoffName, setClientSignoffName] = useState<string>("");
  const [clientRemarks, setClientRemarks] = useState<string>("");

  // New custom task form state
  const [newTaskName, setNewTaskName] = useState<string>("");
  const [newTaskDept, setNewTaskDept] = useState<string>("OPERATIONS");

  useEffect(() => {
    fetchContracts();
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      fetchHandoverDetails(selectedContractId);
    }
  }, [selectedContractId]);

  async function fetchContracts() {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await fetch("/api/v1/manpower/security-guarding/contracts?limit=50");
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data.contracts || [];
        setContracts(items);
        if (items.length > 0) {
          setSelectedContractId(items[0].id);
        }
      } else {
        // Fallback to general contracts fetch if SG route fails
        const res2 = await fetch("/api/v1/commercial/proposals?limit=20");
        if (res2.ok) {
          const d2 = await res2.json();
          // use dummy contract ID or handle gracefully
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHandoverDetails(contractId: string) {
    try {
      setTaskLoading(true);
      setErrorMsg("");
      const res = await fetch(`/api/v1/commercial/handover/${contractId}`);
      if (res.ok) {
        const data = await res.json();
        setHandoverData(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to load handover details");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error loading handover details");
    } finally {
      setTaskLoading(false);
    }
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    if (!selectedContractId) return;
    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";

    try {
      setTaskLoading(true);
      const res = await fetch(`/api/v1/commercial/handover/${selectedContractId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: nextStatus })
      });
      if (res.ok) {
        await fetchHandoverDetails(selectedContractId);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update task");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update task");
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContractId || !newTaskName.trim()) return;

    try {
      setTaskLoading(true);
      const res = await fetch(`/api/v1/commercial/handover/${selectedContractId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: newTaskName.trim(),
          department: newTaskDept
        })
      });
      if (res.ok) {
        setNewTaskName("");
        await fetchHandoverDetails(selectedContractId);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add task");
      }
    } catch (err: any) {
      alert(err.message || "Failed to add task");
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleSignoff(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContractId || !clientSignoffName.trim()) return;

    try {
      setSignoffLoading(true);
      const res = await fetch(`/api/v1/commercial/handover/${selectedContractId}/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSignoffName: clientSignoffName.trim(),
          clientRemarks: clientRemarks.trim()
        })
      });
      if (res.ok) {
        setShowSignoffModal(false);
        setClientSignoffName("");
        setClientRemarks("");
        await fetchHandoverDetails(selectedContractId);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit handover sign-off");
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit sign-off");
    } finally {
      setSignoffLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface p-6 text-on-surface">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ClipboardList className="h-4 w-4" />
            <span>Commercial Lifecycle — CL-6</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Commercial-to-Operations Handover & Mobilization
          </h1>
          <p className="text-sm text-on-surface-variant">
            Transition approved contract requirements into active deployment operations with multi-department sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => selectedContractId && fetchHandoverDetails(selectedContractId)}
            className="flex items-center gap-2 rounded-lg border border-outline px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-variant"
          >
            <RefreshCw className={`h-4 w-4 ${taskLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column: Contract Selector */}
        <div className="rounded-xl border border-outline bg-surface-container p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            Active Contracts ({contracts.length})
          </h2>

          {loading ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">Loading contracts...</div>
          ) : contracts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline p-4 text-center text-xs text-on-surface-variant">
              No contracts found for handover. Convert a proposal in CL-5 to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => {
                const isSelected = c.id === selectedContractId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContractId(c.id)}
                    className={`w-full text-left rounded-lg p-3 text-xs transition-all border ${
                      isSelected
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-outline/50 bg-surface text-on-surface hover:border-outline"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{c.contractNumber || c.id.substring(0, 8)}</span>
                      <span className="rounded bg-surface-variant px-1.5 py-0.5 text-[10px] uppercase font-bold text-on-surface-variant">
                        {c.operationType || "SG"}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-on-surface font-medium">
                      {c.title || "Contract Title"}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>Status: {c.mobilisationStatus || c.status}</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Handover Workspace */}
        <div className="lg:col-span-3 space-y-6">
          {taskLoading && !handoverData ? (
            <div className="rounded-xl border border-outline bg-surface-container p-12 text-center text-sm text-on-surface-variant">
              Loading mobilization readiness...
            </div>
          ) : !handoverData ? (
            <div className="rounded-xl border border-outline bg-surface-container p-12 text-center text-sm text-on-surface-variant">
              Select a contract from the list to view handover progress.
            </div>
          ) : (
            <>
              {/* Readiness Banner */}
              <div className="rounded-xl border border-outline bg-surface-container p-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
                      {handoverData.contract.contractNumber} — {handoverData.contract.operationType}
                    </div>
                    <h2 className="text-xl font-bold text-on-surface">{handoverData.contract.title}</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Client: {handoverData.contract.client?.name || "Client"} | Status:{" "}
                      <span className="font-semibold uppercase text-primary">
                        {handoverData.contract.mobilisationStatus}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {handoverData.readiness.isReadyForHandover && handoverData.contract.mobilisationStatus !== "MOBILISED" ? (
                      <button
                        onClick={() => setShowSignoffModal(true)}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-hover shadow-md transition-all"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Execute Client Handover Sign-off
                      </button>
                    ) : handoverData.contract.mobilisationStatus === "MOBILISED" ? (
                      <div className="flex items-center gap-2 rounded-lg bg-success/20 border border-success/30 px-3 py-2 text-xs font-bold text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        Contract Handed Over & Mobilised
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-xs text-on-surface-variant font-medium">Readiness Progress</span>
                        <div className="text-lg font-bold text-primary">
                          {handoverData.readiness.completionPercentage}% Complete
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 w-full bg-surface-variant rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${handoverData.readiness.completionPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Department Mobilization Checklists */}
              <div className="rounded-xl border border-outline bg-surface-container p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-on-surface">Department Mobilization Checklists</h3>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {handoverData.readiness.completedTasks} of {handoverData.readiness.totalTasks} Tasks Verified
                  </span>
                </div>

                <div className="space-y-3">
                  {handoverData.checklists.map((task: any) => {
                    const isCompleted = task.status === "COMPLETED" || task.status === "EXEMPTED";
                    return (
                      <div
                        key={task.id}
                        onClick={() => toggleTaskStatus(task.id, task.status)}
                        className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
                          isCompleted
                            ? "border-success/30 bg-success/5 text-on-surface"
                            : "border-outline/60 bg-surface hover:border-outline"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => {}} // Handled by container click
                          className="mt-0.5 h-4 w-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${isCompleted ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
                              {task.taskName}
                            </span>
                            <span className="rounded bg-surface-variant px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              {task.department}
                            </span>
                          </div>
                          {task.remarks && (
                            <p className="mt-1 text-xs text-on-surface-variant">{task.remarks}</p>
                          )}
                          {task.completedAt && (
                            <p className="mt-1 text-[11px] text-success font-mono">
                              Completed: {new Date(task.completedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Custom Task Form */}
                <form onSubmit={handleAddTask} className="mt-6 flex flex-col gap-3 pt-4 border-t border-outline/40 md:flex-row">
                  <input
                    type="text"
                    placeholder="Enter custom mobilization task..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="flex-1 rounded-lg border border-outline bg-surface px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
                  />
                  <select
                    value={newTaskDept}
                    onChange={(e) => setNewTaskDept(e.target.value)}
                    className="rounded-lg border border-outline bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="OPERATIONS">OPERATIONS</option>
                    <option value="LOGISTICS">LOGISTICS</option>
                    <option value="HR">HR</option>
                    <option value="FINANCE">FINANCE</option>
                  </select>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-variant px-4 py-2 text-xs font-semibold text-on-surface hover:bg-outline/20 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Add Task
                  </button>
                </form>
              </div>

              {/* Handover Logs */}
              {handoverData.handoverLogs && handoverData.handoverLogs.length > 0 && (
                <div className="rounded-xl border border-outline bg-surface-container p-6">
                  <h3 className="mb-3 text-base font-bold text-on-surface">Client Handover Sign-off History</h3>
                  <div className="space-y-3">
                    {handoverData.handoverLogs.map((log: any) => (
                      <div key={log.id} className="rounded-lg border border-outline/50 bg-surface p-4 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-on-surface">Signed off by Client Representative: {log.clientSignoffName}</span>
                          <span className="text-primary font-mono">{new Date(log.clientSignoffDate).toLocaleDateString()}</span>
                        </div>
                        {log.clientRemarks && (
                          <p className="mt-2 text-on-surface-variant bg-surface-variant/40 p-2.5 rounded text-xs italic">
                            "{log.clientRemarks}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Handover Sign-off Modal */}
      {showSignoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-outline bg-surface-container p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-on-surface">Execute Client Handover Sign-off</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Confirm that all mobilization checklists are complete and client sign-off has been received.
            </p>

            <form onSubmit={handleSignoff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Client Signatory Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Smith (Operations Director)"
                  value={clientSignoffName}
                  onChange={(e) => setClientSignoffName(e.target.value)}
                  className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Client Remarks / Acceptance Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter client comments or handover sign-off details..."
                  value={clientRemarks}
                  onChange={(e) => setClientRemarks(e.target.value)}
                  className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignoffModal(false)}
                  className="rounded-lg border border-outline px-4 py-2 text-xs font-medium text-on-surface hover:bg-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={signoffLoading}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-hover shadow-md transition-all"
                >
                  {signoffLoading ? "Submitting..." : "Confirm & Complete Handover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
