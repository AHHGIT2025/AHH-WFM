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
}

export default function AssignedTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [assignments, setAssignments] = useState<SecfacAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskForModal, setActiveTaskForModal] = useState<SecfacAssignment | null>(null);

  const employeeId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (authStatus === "authenticated") {
      let url = "/api/v1/secfac/assignments";
      if (!isAdmin && employeeId) {
        url += `?employeeId=${employeeId}`;
      }
      
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
          {activeTasks.map((task) => (
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
                  task.status === "COMPLETED" ? "bg-status-success/15 text-status-success" :
                  task.status === "IN_PROGRESS" ? "bg-primary/15 text-primary" :
                  task.status === "OVERDUE" ? "bg-status-error/15 text-status-error" :
                  task.status === "SKIPPED" ? "bg-status-warning/15 text-status-warning" :
                  "bg-on-surface/10 text-on-surface-variant"
                }`}>
                  {task.status}
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
                  <span>View Checklist Template Details</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Read-Only Checklist Template Preview Modal */}
      {activeTaskForModal && activeTaskForModal.template && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface max-w-sm w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border border-outline-variant">
            <div className="p-4 bg-primary text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold truncate max-w-[240px]">{activeTaskForModal.template.templateName}</h3>
                <span className="text-[9px] font-mono opacity-85 block uppercase tracking-wider">Read-Only Preview</span>
              </div>
              <button
                onClick={() => setActiveTaskForModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {activeTaskForModal.template.description && (
                <p className="text-[10px] text-on-surface-variant italic leading-relaxed border-b border-outline-variant/30 pb-2">
                  {activeTaskForModal.template.description}
                </p>
              )}

              {activeTaskForModal.template.items.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant/60 text-[10px]">
                  No question items in this checklist template.
                </div>
              ) : (
                activeTaskForModal.template.items.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl space-y-2 text-[10px]">
                    <div className="flex justify-between items-center text-[8px] font-bold text-on-surface-variant">
                      <span className={item.isRequired ? "text-status-error font-extrabold" : ""}>
                        {item.isRequired ? "* REQUIRED" : "OPTIONAL"}
                      </span>
                      <span className="font-mono">Q{idx + 1}/{activeTaskForModal.template?.items.length}</span>
                    </div>
                    <p className="font-bold text-on-surface leading-tight">{item.itemText}</p>
                    {item.helpText && <p className="text-[8px] text-on-surface-variant/70 italic">{item.helpText}</p>}

                    {/* Rendering the mock controls in read-only mode */}
                    {item.itemType === "YES_NO" && (
                      <div className="flex gap-2">
                        <button disabled className="flex-1 py-1.5 bg-surface border border-outline text-on-surface rounded text-[9px] font-bold cursor-not-allowed opacity-50">YES</button>
                        <button disabled className="flex-1 py-1.5 bg-surface border border-outline text-on-surface rounded text-[9px] font-bold cursor-not-allowed opacity-50">NO</button>
                      </div>
                    )}
                    {item.itemType === "PASS_FAIL" && (
                      <div className="flex gap-2">
                        <button disabled className="flex-1 py-1.5 bg-surface border border-outline text-on-surface rounded text-[9px] font-bold cursor-not-allowed opacity-50">PASS</button>
                        <button disabled className="flex-1 py-1.5 bg-surface border border-outline text-on-surface rounded text-[9px] font-bold cursor-not-allowed opacity-50">FAIL</button>
                      </div>
                    )}
                    {item.itemType === "TEXT" && (
                      <input type="text" disabled placeholder="Read-only text field..." className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-[9px] cursor-not-allowed opacity-50" />
                    )}
                    {item.itemType === "NUMBER" && (
                      <input type="number" disabled placeholder="Read-only numeric reading..." className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-[9px] cursor-not-allowed opacity-50 font-mono" />
                    )}
                    {item.itemType === "PHOTO" && (
                      <div className="flex justify-center border border-dashed border-primary/40 p-2 rounded bg-surface text-primary/70 font-bold text-[9px] cursor-not-allowed opacity-60">
                        <span className="material-symbols-outlined text-[12px] mr-1">photo_camera</span>
                        Photo Upload Disabled
                      </div>
                    )}

                    {/* Indicators */}
                    <div className="flex gap-2 pt-1 text-[8px] font-mono text-primary">
                      {item.requiresPhoto && (
                        <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[10px]">photo_camera</span>Photo Req.</span>
                      )}
                      {item.requiresComment && (
                        <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[10px]">chat_bubble</span>Remarks Req.</span>
                      )}
                      {item.expectedValue && (
                        <span className="flex items-center gap-0.5 text-status-success font-bold"><span className="material-symbols-outlined text-[10px]">check_circle</span>Expects: {item.expectedValue}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low text-[10px] text-on-surface-variant font-bold text-center">
              Task Checklist Execution is Disabled
            </div>
          </div>
        </div>
      )}

      {/* Info Notice Box */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 text-xs">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
        <div>
          <p className="font-bold text-primary">Checklist templates foundation is ready</p>
          <p className="text-on-surface-variant text-[11px] mt-0.5">
            Mobile checklist execution will be enabled in a later phase.
          </p>
        </div>
      </div>
    </div>
  );
}
