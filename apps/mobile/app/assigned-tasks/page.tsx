"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface SecfacAssignment {
  id: string;
  operationType: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  siteId: string;
  site?: { id: string; name: string } | null;
  locationUnitId?: string | null;
  locationUnit?: { id: string; name: string } | null;
  checkpointId?: string | null;
  checkpoint?: { id: string; checkpointName: string } | null;
  templateId?: string | null;
  template?: {
    id: string;
    templateName: string;
    description?: string | null;
    items: Array<{
      id: string;
      itemText: string;
      itemType: string;
      isRequired: boolean;
      requiresPhoto: boolean;
      requiresComment: boolean;
      expectedValue?: string | null;
      helpText?: string | null;
    }>;
  } | null;
  employeeId: string;
  employee?: { id: string; name: string } | null;
  supervisorId?: string | null;
  supervisor?: { id: string; name: string } | null;
  assignmentName: string;
  assignmentCode?: string | null;
  description?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  currentExecution?: {
    id: string;
    status: string;
    startedAt?: string | null;
    submittedAt?: string | null;
  } | null;
}

export default function AssignedTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [assignments, setAssignments] = useState<SecfacAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Execution form states
  const [activeTaskForModal, setActiveTaskForModal] = useState<SecfacAssignment | null>(null);
  const [execution, setExecution] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, { id?: string; answerValue: string; comment: string; isFlagged: boolean; flagReason?: string }>>({});
  const [remarks, setRemarks] = useState("");
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const employeeId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (authStatus === "authenticated") {
      const url = isAdmin ? "/api/v1/secfac/assignments" : "/api/v1/secfac/assigned-tasks";
      
      fetch(url)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setAssignments(json.data || []);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else if (authStatus === "unauthenticated") {
      setLoading(false);
    }
  }, [authStatus, employeeId, isAdmin]);

  // Load execution details if activeTaskForModal has an existing execution
  useEffect(() => {
    if (!activeTaskForModal) {
      setExecution(null);
      setAnswers({});
      setRemarks("");
      setErrorMsg("");
      setSuccessMsg("");
      return;
    }

    const curExec = activeTaskForModal.currentExecution;
    if (curExec) {
      setLoadingExecution(true);
      fetch(`/api/v1/secfac/checklist-executions/${curExec.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setExecution(json.data);
            setRemarks(json.data.remarks || "");
            const ansMap: Record<string, any> = {};
            if (json.data.responses) {
              for (const r of json.data.responses) {
                ansMap[r.checklistItemId] = {
                  id: r.id,
                  answerValue: r.answerValue || "",
                  comment: r.comment || "",
                  isFlagged: !!r.isFlagged,
                  flagReason: r.flagReason || ""
                };
              }
            }
            setAnswers(ansMap);
          }
        })
        .catch((err) => {
          console.error("Failed to load execution details", err);
        })
        .finally(() => setLoadingExecution(false));
    } else {
      // Initialize new execution draft
      setExecution({
        status: "DRAFT",
        responses: []
      });
      setAnswers({});
      setRemarks("");
    }
  }, [activeTaskForModal]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeTasks = assignments.filter((a) => a.isActive);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleAnswerChange = (itemId: string, field: string, value: any) => {
    if (execution?.status === "SUBMITTED") return; // read-only
    setAnswers((prev) => {
      const existing = prev[itemId] || { answerValue: "", comment: "", isFlagged: false };
      return {
        ...prev,
        [itemId]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  const handleSave = async (submitStatus: "DRAFT" | "SUBMITTED") => {
    if (!activeTaskForModal) return;
    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    // Get current GPS coordinates if possible (non-blocking)
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;

    try {
      const pos: any = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      accuracy = pos.coords.accuracy;
    } catch (e) {
      console.log("GPS fetch timed out or denied", e);
    }

    const responsesList = (activeTaskForModal.template?.items || []).map((item) => {
      const ansObj = answers[item.id] || { answerValue: "", comment: "", isFlagged: false };
      
      // Auto-flagging if answer mismatches expected value
      let isFlagged = ansObj.isFlagged;
      let flagReason = ansObj.flagReason || "";
      if (item.expectedValue && ansObj.answerValue) {
        if (ansObj.answerValue !== item.expectedValue) {
          isFlagged = true;
          flagReason = `Value mismatch. Expected ${item.expectedValue}, answered ${ansObj.answerValue}`;
        }
      }

      return {
        id: ansObj.id || undefined,
        checklistItemId: item.id,
        itemTextSnapshot: item.itemText,
        itemTypeSnapshot: item.itemType,
        answerValue: ansObj.answerValue || null,
        comment: ansObj.comment || null,
        isFlagged,
        flagReason: flagReason || null
      };
    });

    const isEdit = !!execution?.id;
    const url = isEdit
      ? `/api/v1/secfac/checklist-executions/${execution.id}`
      : `/api/v1/secfac/checklist-executions`;
    const method = isEdit ? "PATCH" : "POST";

    const payload = {
      id: execution?.id || undefined,
      assignmentId: activeTaskForModal.id,
      checklistTemplateId: activeTaskForModal.templateId,
      responses: responsesList,
      latitude: lat,
      longitude: lng,
      gpsAccuracyMeters: accuracy,
      deviceInfo: "Mobile App Web Client (AHH WFM Mobile)",
      remarks,
      status: submitStatus
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();

      if (!json.success) {
        setErrorMsg(json.error || json.message || "Failed to save execution");
      } else {
        setSuccessMsg(submitStatus === "SUBMITTED" ? "Checklist submitted successfully!" : "Draft saved successfully!");
        setExecution(json.data);

        // Refresh list
        const listUrl = isAdmin ? "/api/v1/secfac/assignments" : "/api/v1/secfac/assigned-tasks";
        const listRes = await fetch(listUrl);
        const listJson = await listRes.json();
        if (listJson.success) {
          setAssignments(listJson.data || []);
        }

        // Close on success submission
        if (submitStatus === "SUBMITTED") {
          setTimeout(() => {
            setActiveTaskForModal(null);
          }, 1500);
        }
      }
    } catch (e: any) {
      setErrorMsg("Network error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-on-surface">My Assigned Tasks</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            {isAdmin ? "Admin Preview Mode" : "Duty Schedule"}
          </p>
        </div>
      </div>

      {isAdmin && activeTasks.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-semibold">
          No active assignment today (Admin Preview Mode). Please schedule assignments in the Web Command Center first.
        </div>
      )}

      {/* Roster Tasks List */}
      {activeTasks.length === 0 ? (
        <div className="bg-surface border border-outline-variant/30 p-6 rounded-2xl text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">assignment_turned_in</span>
          <p className="text-sm font-bold text-on-surface">No assigned tasks</p>
          <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
            You do not have any planned tasks, patrols, or checklists assigned for today.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTasks.map((task) => {
            const execStatus = task.currentExecution?.status || "Not Started";
            return (
              <div
                key={task.id}
                onClick={() => {
                  if (task.template) {
                    setActiveTaskForModal(task);
                  }
                }}
                className="bg-surface border border-outline-variant/40 rounded-2xl p-4 shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider font-mono">
                      {task.operationType === "SECURITY_GUARDING" ? "Security Patrol" : "FM Inspection"}
                    </span>
                    <h3 className="text-sm font-bold text-on-surface mt-0.5">{task.assignmentName}</h3>
                    {task.assignmentCode && (
                      <span className="text-[8px] font-mono text-on-surface-variant block">{task.assignmentCode}</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                    execStatus === "SUBMITTED" ? "bg-status-success/15 text-status-success" :
                    execStatus === "DRAFT" ? "bg-amber-100 text-amber-700" :
                    "bg-on-surface/10 text-on-surface-variant"
                  }`}>
                    {execStatus}
                  </span>
                </div>

                <div className="space-y-1.5 text-[10px] text-on-surface-variant border-t border-outline-variant/20 pt-2.5">
                  <p className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                    <span>Site: {task.site?.name || "Not Specified"} {task.locationUnit?.name ? `(${task.locationUnit.name})` : ""}</span>
                  </p>
                  {task.checkpoint?.checkpointName && (
                    <p className="flex items-center gap-1.5 text-primary font-semibold">
                      <span className="material-symbols-outlined text-[12px]">nfc</span>
                      <span>Checkpoint: {task.checkpoint.checkpointName}</span>
                    </p>
                  )}
                  {task.template?.templateName && (
                    <p className="flex items-center gap-1.5 text-[#002D72] font-semibold">
                      <span className="material-symbols-outlined text-[12px]">rule</span>
                      <span>Checklist: {task.template.templateName}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    <span>Start: {formatDate(task.scheduledStart)}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-[9.5px]">
                    <span className="material-symbols-outlined text-[12px]">alarm</span>
                    <span>End: {formatDate(task.scheduledEnd)}</span>
                  </p>
                </div>

                {task.template && (
                  <div className="bg-primary/5 rounded-xl p-2 flex justify-between items-center text-[10px] text-primary font-bold">
                    <span>{execStatus === "SUBMITTED" ? "Review Completed Checklist" : "Execute Checklist Tour"}</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Checklist Execution / Review Modal */}
      {activeTaskForModal && activeTaskForModal.template && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-outline-variant">
            {/* Modal Header */}
            <div className="p-4 bg-[#002D72] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold truncate max-w-[280px]">{activeTaskForModal.template.templateName}</h3>
                <span className="text-[9px] font-mono opacity-85 block uppercase tracking-wider">
                  {execution?.status === "SUBMITTED" ? "SUBMITTED (READ-ONLY)" : `Execution Draft (${execution?.status || "DRAFT"})`}
                </span>
              </div>
              <button
                onClick={() => setActiveTaskForModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 text-amber-800 text-[10px]">
              <span className="material-symbols-outlined text-sm text-amber-600 shrink-0">warning</span>
              <p className="font-semibold leading-normal">
                NFC proof and evidence upload will be enabled in a later phase. Draft save and answers submit are functional.
              </p>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[10px] font-semibold">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-[10px] font-semibold">
                  {successMsg}
                </div>
              )}

              {activeTaskForModal.template.description && (
                <p className="text-[10.5px] text-on-surface-variant italic leading-relaxed border-b border-outline-variant/30 pb-2">
                  {activeTaskForModal.template.description}
                </p>
              )}

              {loadingExecution ? (
                <div className="text-center py-12 text-xs font-mono animate-pulse text-[#002D72]">
                  Fetching execution data...
                </div>
              ) : activeTaskForModal.template.items.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant/60 text-[10px]">
                  No question items in this checklist template.
                </div>
              ) : (
                activeTaskForModal.template.items.map((item, idx) => {
                  const ansObj = answers[item.id] || { answerValue: "", comment: "" };
                  const isSubmitted = execution?.status === "SUBMITTED";

                  return (
                    <div key={item.id} className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl space-y-2.5 text-[10px]">
                      <div className="flex justify-between items-center text-[8px] font-bold text-on-surface-variant">
                        <span className={item.isRequired ? "text-status-error font-extrabold" : "text-[#747782]"}>
                          {item.isRequired ? "* REQUIRED" : "OPTIONAL"}
                        </span>
                        <span className="font-mono">Q{idx + 1}/{activeTaskForModal.template?.items.length}</span>
                      </div>
                      <p className="font-bold text-on-surface leading-tight text-[11px]">{item.itemText}</p>
                      {item.helpText && <p className="text-[9px] text-on-surface-variant/70 italic">{item.helpText}</p>}

                      {/* Question Inputs */}
                      {item.itemType === "YES_NO" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleAnswerChange(item.id, "answerValue", "YES")}
                            className={`flex-1 py-1.5 border rounded text-[9px] font-bold transition-all ${
                              ansObj.answerValue === "YES"
                                ? "bg-[#002D72] border-[#002D72] text-white"
                                : "bg-white border-outline text-on-surface hover:bg-slate-50"
                            } ${isSubmitted ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            YES
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleAnswerChange(item.id, "answerValue", "NO")}
                            className={`flex-1 py-1.5 border rounded text-[9px] font-bold transition-all ${
                              ansObj.answerValue === "NO"
                                ? "bg-[#002D72] border-[#002D72] text-white"
                                : "bg-white border-outline text-on-surface hover:bg-slate-50"
                            } ${isSubmitted ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            NO
                          </button>
                        </div>
                      )}

                      {item.itemType === "PASS_FAIL" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleAnswerChange(item.id, "answerValue", "PASS")}
                            className={`flex-1 py-1.5 border rounded text-[9px] font-bold transition-all ${
                              ansObj.answerValue === "PASS"
                                ? "bg-green-700 border-green-700 text-white"
                                : "bg-white border-outline text-on-surface hover:bg-slate-50"
                            } ${isSubmitted ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            PASS
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleAnswerChange(item.id, "answerValue", "FAIL")}
                            className={`flex-1 py-1.5 border rounded text-[9px] font-bold transition-all ${
                              ansObj.answerValue === "FAIL"
                                ? "bg-red-700 border-red-700 text-white"
                                : "bg-white border-outline text-on-surface hover:bg-slate-50"
                            } ${isSubmitted ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            FAIL
                          </button>
                        </div>
                      )}

                      {item.itemType === "TEXT" && (
                        <input
                          type="text"
                          disabled={isSubmitted}
                          placeholder="Type answer here..."
                          value={ansObj.answerValue || ""}
                          onChange={(e) => handleAnswerChange(item.id, "answerValue", e.target.value)}
                          className="w-full bg-white border border-[#C4C6D2] rounded p-1.5 text-[10px] focus:ring-1 focus:ring-[#002D72] focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      )}

                      {item.itemType === "NUMBER" && (
                        <input
                          type="number"
                          disabled={isSubmitted}
                          placeholder="Numeric reading value..."
                          value={ansObj.answerValue || ""}
                          onChange={(e) => handleAnswerChange(item.id, "answerValue", e.target.value)}
                          className="w-full bg-white border border-[#C4C6D2] rounded p-1.5 text-[10px] focus:ring-1 focus:ring-[#002D72] focus:outline-none font-mono disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      )}

                      {item.itemType === "PHOTO" && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-center border border-dashed border-primary/40 p-2.5 rounded-lg bg-primary/5 text-primary/70 font-bold text-[9px] cursor-not-allowed opacity-75">
                            <span className="material-symbols-outlined text-[13px] mr-1">photo_camera</span>
                            Photo Attachment (Phase 2B Capture)
                          </div>
                          <input
                            type="text"
                            disabled={isSubmitted}
                            placeholder="Optional reference note / photo placeholder..."
                            value={ansObj.answerValue || ""}
                            onChange={(e) => handleAnswerChange(item.id, "answerValue", e.target.value)}
                            className="w-full bg-white border border-[#C4C6D2] rounded p-1 text-[9px] disabled:bg-slate-50"
                          />
                        </div>
                      )}

                      {/* Comment Area */}
                      {(item.requiresComment || item.itemType === "COMMENT") && (
                        <div className="flex flex-col gap-1 mt-1">
                          <label className="text-[8px] font-mono text-slate-500 uppercase">Remarks/Comments</label>
                          <textarea
                            disabled={isSubmitted}
                            rows={1}
                            placeholder="Provide details..."
                            value={ansObj.comment || ""}
                            onChange={(e) => handleAnswerChange(item.id, "comment", e.target.value)}
                            className="w-full bg-white border border-[#C4C6D2] rounded p-1.5 text-[9px] focus:ring-1 focus:ring-[#002D72] focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Execution level remarks */}
              {!loadingExecution && (
                <div className="p-3 bg-surface-container border border-outline-variant/30 rounded-xl space-y-1.5 text-[10px]">
                  <label className="font-bold text-[#002D72] uppercase block tracking-wider text-[8px]">Execution Remarks (Overall Notes)</label>
                  <textarea
                    disabled={execution?.status === "SUBMITTED"}
                    rows={2}
                    placeholder="Enter tour summary remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-white border border-[#C4C6D2] rounded-lg p-2 text-[10px] focus:ring-1 focus:ring-[#002D72] focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            {execution?.status !== "SUBMITTED" && !loadingExecution && (
              <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("DRAFT")}
                  className="bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("SUBMITTED")}
                  className="bg-[#002D72] hover:bg-[#001D48] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Submit Checklist
                </button>
              </div>
            )}

            {execution?.status === "SUBMITTED" && (
              <div className="p-4 border-t border-outline-variant/30 bg-green-50 text-green-800 font-bold text-xs text-center">
                Completed Checklist Submitted & Locked
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Notice Box */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 text-xs">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
        <div>
          <p className="font-bold text-primary">Controlled Execution Draft Mode</p>
          <p className="text-on-surface-variant text-[11px] mt-0.5">
            Fill required fields, save drafts, and submit checklist tours. Submitted runs are read-only.
          </p>
        </div>
      </div>
    </div>
  );
}
