"use client";
 
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getQueue,
  addQueueItem,
  getQueueItemsForAssignment,
  getPendingCount,
  createIdempotencyKey
} from "../../lib/secfac-offline-queue";

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
  checkpoint?: { id: string; checkpointName: string; scanRequired?: boolean } | null;
  templateId?: string | null;
  template?: {
    id: string;
    templateName: string;
    description?: string | null;
    requiresNfcScan?: boolean;
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
  patrolRouteId?: string | null;
  patrolRoute?: {
    id: string;
    routeName: string;
    routeCode?: string | null;
    description?: string | null;
    siteId: string;
    checkpoints?: Array<{
      id: string;
      checkpointId: string;
      checkpoint?: { id: string; checkpointName: string; nfcTagId?: string | null; qrCode?: string | null; scanRequired?: boolean } | null;
      sequenceNo: number;
      required: boolean;
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
  patrolExecutions?: any[];
}

export default function AssignedTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [assignments, setAssignments] = useState<SecfacAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Modal / Execution form states
  const [activeTaskForModal, setActiveTaskForModal] = useState<SecfacAssignment | null>(null);
  const [execution, setExecution] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, { id?: string; answerValue: string; comment: string; isFlagged: boolean; flagReason?: string; evidenceAttachments?: any[] }>>({});
  const [remarks, setRemarks] = useState("");
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Scan proof states
  const [scanProofs, setScanProofs] = useState<any[]>([]);
  const [loadingProofs, setLoadingProofs] = useState<boolean>(false);
  const [scanningNfc, setScanningNfc] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [openQrInput, setOpenQrInput] = useState(false);
  const [openManualInput, setOpenManualInput] = useState(false);
  const [openIssueReport, setOpenIssueReport] = useState(false);
  const [qrInputValue, setQrInputValue] = useState("");
  const [manualInputValue, setManualInputValue] = useState("");
  const [issueReasonValue, setIssueReasonValue] = useState("");

  // Patrol Execution states
  const [activePatrolForModal, setActivePatrolForModal] = useState<SecfacAssignment | null>(null);
  const [patrolExecution, setPatrolExecution] = useState<any>(null);
  const [selectedPatrolCheckpoint, setSelectedPatrolCheckpoint] = useState<any | null>(null);
  const [loadingPatrol, setLoadingPatrol] = useState(false);
  const [submittingPatrol, setSubmittingPatrol] = useState(false);

  const employeeId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPER_ADMIN";

  const fetchScanProofs = (assignmentId: string) => {
    if (!isOnline) {
      const queuedProofs = getQueue()
        .filter(item => item.assignmentId === assignmentId && item.actionType === "SCAN_PROOF_CREATE" && item.status !== "DISCARDED")
        .map(item => ({
          id: item.payload.id,
          scanMode: item.payload.scanMode,
          scannedValue: item.payload.scannedValue,
          exceptionReason: item.payload.exceptionReason,
          validationStatus: item.payload.scanMode === "MANUAL_EXCEPTION" ? "PENDING_REVIEW" : "VALID",
          scannedAt: item.createdAt,
          isOfflinePlaceholder: true
        }));
      setScanProofs(queuedProofs);
      setLoadingProofs(false);
      return;
    }
    setLoadingProofs(true);
    fetch(`/api/v1/secfac/scan-proofs?assignmentId=${assignmentId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setScanProofs(json.data);
        }
      })
      .catch((err) => console.error("Failed to load scan proofs", err))
      .finally(() => setLoadingProofs(false));
  };

  const triggerNfcScan = async () => {
    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      alert("Web NFC (NDEFReader) is not supported on this browser or device. Please use manual entry or QR fallback.");
      return;
    }

    try {
      setScanningNfc(true);
      setErrorMsg("");
      // @ts-ignore
      const reader = new NDEFReader();
      await reader.scan();
      
      reader.addEventListener("readingerror", () => {
        setScanningNfc(false);
        setErrorMsg("NFC reading error. Please hold the tag close to your device and try again.");
      });

      reader.addEventListener("reading", async ({ serialNumber }: any) => {
        setScanningNfc(false);
        if (serialNumber) {
          await submitProof("NFC", serialNumber);
        } else {
          setErrorMsg("Failed to read NFC serial number.");
        }
      });
    } catch (e: any) {
      setScanningNfc(false);
      setErrorMsg("NFC error: " + e.message);
    }
  };

  const submitProof = async (mode: string, value?: string, reason?: string) => {
    if (!activeTaskForModal) return;
    setSubmittingProof(true);
    setErrorMsg("");
    setSuccessMsg("");
 
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
      console.log("GPS coordinates capture timed out or failed", e);
    }
 
    if (!isOnline) {
      const scanProofId = crypto.randomUUID();
      addQueueItem({
        id: crypto.randomUUID(),
        actionType: "SCAN_PROOF_CREATE",
        endpoint: "/api/v1/secfac/scan-proofs",
        method: "POST",
        payload: {
          id: scanProofId,
          assignmentId: activeTaskForModal.id,
          executionId: execution?.id || null,
          checkpointId: activeTaskForModal.checkpointId,
          scanMode: mode,
          scannedValue: value,
          exceptionReason: reason,
          latitude: lat,
          longitude: lng,
          gpsAccuracyMeters: accuracy,
          deviceInfo: "Mobile App Web Client (AHH WFM Mobile) (Offline)"
        },
        assignmentId: activeTaskForModal.id,
        executionId: execution?.id || undefined,
        operationType: activeTaskForModal.operationType
      });
 
      const mockProof = {
        id: scanProofId,
        scanMode: mode,
        scannedValue: value,
        exceptionReason: reason,
        validationStatus: mode === "MANUAL_EXCEPTION" ? "PENDING_REVIEW" : "VALID",
        scannedAt: new Date().toISOString(),
        isOfflinePlaceholder: true
      };
      setScanProofs([mockProof, ...scanProofs]);
      setSuccessMsg("Checkpoint scan proof queued offline.");
      setOpenQrInput(false);
      setOpenManualInput(false);
      setOpenIssueReport(false);
      setQrInputValue("");
      setManualInputValue("");
      setIssueReasonValue("");
      setSubmittingProof(false);
      return;
    }
 
    try {
      const res = await fetch("/api/v1/secfac/scan-proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: activeTaskForModal.id,
          executionId: execution?.id || null,
          checkpointId: activeTaskForModal.checkpointId,
          scanMode: mode,
          scannedValue: value,
          exceptionReason: reason,
          latitude: lat,
          longitude: lng,
          gpsAccuracyMeters: accuracy,
          deviceInfo: "Mobile App Web Client (AHH WFM Mobile)"
        })
      });
 
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || "Validation failed");
      } else {
        setSuccessMsg(
          mode === "MANUAL_EXCEPTION"
            ? "Tag issue reported successfully. Proof is pending supervisor review."
            : `Proof validation result: ${json.data.validationStatus}!`
        );
        fetchScanProofs(activeTaskForModal.id);
        setOpenQrInput(false);
        setOpenManualInput(false);
        setOpenIssueReport(false);
        setQrInputValue("");
        setManualInputValue("");
        setIssueReasonValue("");
      }
    } catch (e: any) {
      setErrorMsg("Submit error: " + e.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  const submitPatrolProof = async (mode: string, value?: string, reason?: string) => {
    if (!activePatrolForModal || !patrolExecution || !selectedPatrolCheckpoint) return;
    setSubmittingProof(true);
    setErrorMsg("");
    setSuccessMsg("");
 
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
      console.log("GPS coordinates capture timed out or failed", e);
    }
 
    if (!isOnline) {
      const scanProofId = crypto.randomUUID();
      const proofQueueItemId = crypto.randomUUID();
      const proofQueueItem = addQueueItem({
        id: proofQueueItemId,
        actionType: "SCAN_PROOF_CREATE",
        endpoint: "/api/v1/secfac/scan-proofs",
        method: "POST",
        payload: {
          id: scanProofId,
          assignmentId: activePatrolForModal.id,
          executionId: null,
          checkpointId: selectedPatrolCheckpoint.checkpointId,
          scanMode: mode,
          scannedValue: value,
          exceptionReason: reason,
          latitude: lat,
          longitude: lng,
          gpsAccuracyMeters: accuracy,
          deviceInfo: "Mobile App Web Client (AHH WFM Mobile Patrol) (Offline)"
        },
        assignmentId: activePatrolForModal.id,
        operationType: activePatrolForModal.operationType
      });
 
      addQueueItem({
        id: crypto.randomUUID(),
        actionType: "PATROL_CHECKPOINT_VALIDATE",
        endpoint: `/api/v1/secfac/patrol-executions/${patrolExecution.id}/checkpoints/${selectedPatrolCheckpoint.id}/validate`,
        method: "POST",
        payload: {
          scanProofId: scanProofId
        },
        dependsOn: [proofQueueItem.id],
        assignmentId: activePatrolForModal.id,
        patrolExecutionId: patrolExecution.id,
        checkpointExecutionId: selectedPatrolCheckpoint.id,
        operationType: activePatrolForModal.operationType
      });
 
      // Update local state status instantly
      const targetStatus = mode === "MANUAL_EXCEPTION" ? "PENDING_REVIEW" : "VALIDATED";
      const updatedCheckpoints = patrolExecution.checkpoints.map((c: any) => {
        if (c.id === selectedPatrolCheckpoint.id) {
          return {
            ...c,
            status: targetStatus,
            scanProof: {
              id: scanProofId,
              proofType: mode,
              remarks: reason,
              createdAt: new Date().toISOString()
            }
          };
        }
        return c;
      });
 
      setPatrolExecution({ ...patrolExecution, checkpoints: updatedCheckpoints });
      setSelectedPatrolCheckpoint(updatedCheckpoints.find((c: any) => c.id === selectedPatrolCheckpoint.id) || null);
 
      setSuccessMsg("Checkpoint scan proof validation queued offline.");
      setOpenQrInput(false);
      setOpenManualInput(false);
      setOpenIssueReport(false);
      setQrInputValue("");
      setManualInputValue("");
      setIssueReasonValue("");
      setSubmittingProof(false);
      return;
    }
 
    try {
      // 1. Create Scan Proof
      const resProof = await fetch("/api/v1/secfac/scan-proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: activePatrolForModal.id,
          executionId: null,
          checkpointId: selectedPatrolCheckpoint.checkpointId,
          scanMode: mode,
          scannedValue: value,
          exceptionReason: reason,
          latitude: lat,
          longitude: lng,
          gpsAccuracyMeters: accuracy,
          deviceInfo: "Mobile App Web Client (AHH WFM Mobile Patrol)"
        })
      });
 
      const jsonProof = await resProof.json();
      if (!jsonProof.success) {
        setErrorMsg(jsonProof.error || "Validation failed");
        return;
      }
 
      // 2. Validate Checkpoint on Patrol Execution
      const resVal = await fetch(`/api/v1/secfac/patrol-executions/${patrolExecution.id}/checkpoints/${selectedPatrolCheckpoint.id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanProofId: jsonProof.data.id
        })
      });
 
      const jsonVal = await resVal.json();
      if (!jsonVal.success) {
        setErrorMsg(jsonVal.error || "Failed to update checkpoint validation status");
      } else {
        setSuccessMsg(
          mode === "MANUAL_EXCEPTION"
            ? "Issue reported successfully. Pending supervisor review."
            : `Checkpoint validated successfully!`
        );
        // Refresh Patrol execution state
        setPatrolExecution(jsonVal.data);
        setSelectedPatrolCheckpoint(jsonVal.data.checkpoints.find((c: any) => c.id === selectedPatrolCheckpoint.id) || null);
        
        setOpenQrInput(false);
        setOpenManualInput(false);
        setOpenIssueReport(false);
        setQrInputValue("");
        setManualInputValue("");
        setIssueReasonValue("");
 
        // Refresh assignments list
        const url = isAdmin ? "/api/v1/secfac/assignments" : "/api/v1/secfac/assigned-tasks";
        fetch(url)
          .then((res) => res.json())
          .then((json) => {
            if (json.success) setAssignments(json.data || []);
          });
      }
    } catch (e: any) {
      setErrorMsg("Submit error: " + e.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  const triggerPatrolNfcScan = async () => {
    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      alert("Web NFC (NDEFReader) is not supported on this browser or device. Please use manual entry or QR fallback.");
      return;
    }

    try {
      setScanningNfc(true);
      setErrorMsg("");
      // @ts-ignore
      const reader = new NDEFReader();
      await reader.scan();
      
      reader.addEventListener("readingerror", () => {
        setScanningNfc(false);
        setErrorMsg("NFC reading error. Please hold the tag close to your device and try again.");
      });

      reader.addEventListener("reading", async ({ serialNumber }: any) => {
        setScanningNfc(false);
        if (serialNumber) {
          await submitPatrolProof("NFC", serialNumber);
        } else {
          setErrorMsg("Failed to read NFC serial number.");
        }
      });
    } catch (e: any) {
      setScanningNfc(false);
      setErrorMsg("NFC error: " + e.message);
    }
  };

  const handleStartPatrol = async (task: SecfacAssignment) => {
    if (!isOnline) {
      alert("Starting a new patrol tour requires an internet connection. Please connect to start the patrol.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setLoadingPatrol(true);
    try {
      const res = await fetch("/api/v1/secfac/patrol-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: task.patrolRouteId,
          assignmentId: task.id
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPatrolExecution(json.data);
        setActivePatrolForModal(task);
        
        // Refresh assignments list
        const url = isAdmin ? "/api/v1/secfac/assignments" : "/api/v1/secfac/assigned-tasks";
        const listRes = await fetch(url);
        const listJson = await listRes.json();
        if (listJson.success) setAssignments(listJson.data || []);
      } else {
        alert(json.error || "Failed to start patrol execution");
      }
    } catch (e: any) {
      alert("Error starting patrol: " + e.message);
    } finally {
      setLoadingPatrol(false);
    }
  };

  const handleSubmitPatrol = async () => {
    if (!patrolExecution) return;
    setSubmittingPatrol(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!isOnline) {
      const checkpoints = patrolExecution.checkpoints || [];
      const requiredCheckpoints = checkpoints.filter((c: any) => c.required === true);

      // Local completion validation rules
      const hasPending = requiredCheckpoints.some((c: any) => c.status === "PENDING");
      if (hasPending) {
        setErrorMsg("Cannot submit: one or more required checkpoints are still PENDING");
        setSubmittingPatrol(false);
        return;
      }

      const hasInvalid = requiredCheckpoints.some((c: any) => c.status === "INVALID");
      if (hasInvalid) {
        setErrorMsg("Cannot submit: one or more required checkpoints are INVALID");
        setSubmittingPatrol(false);
        return;
      }

      // Queue PATROL_ROUTE_SUBMIT depending on all pending validation queue items for this execution
      const pendingValItems = getQueue().filter(
        item => item.patrolExecutionId === patrolExecution.id && item.actionType === "PATROL_CHECKPOINT_VALIDATE" && item.status === "PENDING"
      );
      const dependsOnIds = pendingValItems.map(item => item.id);

      addQueueItem({
        id: crypto.randomUUID(),
        actionType: "PATROL_ROUTE_SUBMIT",
        endpoint: `/api/v1/secfac/patrol-executions/${patrolExecution.id}`,
        method: "PATCH",
        payload: {
          action: "SUBMIT"
        },
        dependsOn: dependsOnIds,
        assignmentId: activePatrolForModal?.id,
        patrolExecutionId: patrolExecution.id,
        operationType: activePatrolForModal?.operationType
      });

      // Update local state status status
      const hasPendingReview = requiredCheckpoints.some((c: any) => c.status === "PENDING_REVIEW");
      const targetStatus = hasPendingReview ? "PENDING_REVIEW" : "COMPLETED";

      setSuccessMsg("Patrol completion queued offline.");
      setPatrolExecution({
        ...patrolExecution,
        status: targetStatus,
        completedAt: new Date().toISOString()
      });

      // Refresh assignments list so status updates locally
      if (activePatrolForModal) {
        setAssignments(prev => prev.map(a => {
          if (a.id === activePatrolForModal.id) {
            return {
              ...a,
              patrolExecutions: [{
                ...patrolExecution,
                status: targetStatus,
                completedAt: new Date().toISOString()
              }]
            };
          }
          return a;
        }));
      }

      setTimeout(() => {
        setActivePatrolForModal(null);
      }, 1500);

      setSubmittingPatrol(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/secfac/patrol-executions/${patrolExecution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(
          json.data.status === "PENDING_REVIEW"
            ? "Patrol submitted successfully! (Awaiting supervisor review for exception scans)"
            : "Patrol completed successfully!"
        );
        setPatrolExecution(json.data);
        
        // Refresh assignments list
        const url = isAdmin ? "/api/v1/secfac/assignments" : "/api/v1/secfac/assigned-tasks";
        const listRes = await fetch(url);
        const listJson = await listRes.json();
        if (listJson.success) setAssignments(listJson.data || []);

        setTimeout(() => {
          setActivePatrolForModal(null);
        }, 1500);
      } else {
        setErrorMsg(json.error || "Failed to submit patrol execution");
      }
    } catch (e: any) {
      setErrorMsg("Submit error: " + e.message);
    } finally {
      setSubmittingPatrol(false);
    }
  };

  useEffect(() => {
    if (authStatus === "authenticated") {
      const url = isAdmin ? "/api/v1/secfac/assignments" : "/api/v1/secfac/assigned-tasks";
      
      fetch(url)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setAssignments(json.data || []);
            if (typeof window !== "undefined") {
              localStorage.setItem("secfac_cached_assignments", JSON.stringify(json.data || []));
            }
          }
          setLoading(false);
        })
        .catch(() => {
          if (typeof window !== "undefined") {
            const cached = localStorage.getItem("secfac_cached_assignments");
            if (cached) {
              setAssignments(JSON.parse(cached));
            }
          }
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
      setScanProofs([]);
      // Reset patrol state
      setPatrolExecution(null);
      setSelectedPatrolCheckpoint(null);
      setLoadingPatrol(false);
      return;
    }

    fetchScanProofs(activeTaskForModal.id);

    // If offline: check local queue first for unsynced drafts!
    if (!isOnline) {
      const pendingItems = getQueueItemsForAssignment(activeTaskForModal.id);
      const queuedDraft = pendingItems.find(x => x.actionType === "CHECKLIST_DRAFT_SAVE");
      if (queuedDraft) {
        setExecution(queuedDraft.payload);
        setRemarks(queuedDraft.payload.remarks || "");
        const ansMap: Record<string, any> = {};
        if (queuedDraft.payload.responses) {
          for (const r of queuedDraft.payload.responses) {
            ansMap[r.checklistItemId] = {
              id: r.id,
              answerValue: r.answerValue || "",
              comment: r.comment || "",
              isFlagged: !!r.isFlagged,
              flagReason: r.flagReason || "",
              evidenceAttachments: []
            };
          }
        }
        if (activeTaskForModal.template?.items) {
          for (const item of activeTaskForModal.template.items) {
            if (!ansMap[item.id]) {
              ansMap[item.id] = {
                id: crypto.randomUUID(),
                answerValue: "",
                comment: "",
                isFlagged: false,
                flagReason: "",
                evidenceAttachments: []
              };
            }
          }
        }
        setAnswers(ansMap);
        return;
      }
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
                  flagReason: r.flagReason || "",
                  evidenceAttachments: r.evidenceAttachments || []
                };
              }
            }
            // Ensure every template item has a response mapped
            if (activeTaskForModal.template?.items) {
              for (const item of activeTaskForModal.template.items) {
                if (!ansMap[item.id]) {
                  ansMap[item.id] = {
                    id: crypto.randomUUID(),
                    answerValue: "",
                    comment: "",
                    isFlagged: false,
                    flagReason: "",
                    evidenceAttachments: []
                  };
                }
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
      // Initialize new execution draft with local client-side IDs
      const generatedExecId = crypto.randomUUID();
      const ansMap: Record<string, any> = {};
      if (activeTaskForModal.template?.items) {
        for (const item of activeTaskForModal.template.items) {
          ansMap[item.id] = {
            id: crypto.randomUUID(), // unique responseId
            answerValue: "",
            comment: "",
            isFlagged: false,
            flagReason: "",
            evidenceAttachments: []
          };
        }
      }
      setExecution({
        id: generatedExecId,
        status: "DRAFT",
        responses: []
      });
      setAnswers(ansMap);
      setRemarks("");
    }
  }, [activeTaskForModal]);

  // Overlay local queued validations onto patrol execution when offline
  useEffect(() => {
    if (!activePatrolForModal) return;
    if (patrolExecution && !isOnline) {
      const queuedVals = getQueue().filter(
        item => item.patrolExecutionId === patrolExecution.id && item.actionType === "PATROL_CHECKPOINT_VALIDATE" && item.status !== "DISCARDED"
      );
      if (queuedVals.length > 0) {
        const updatedCheckpoints = patrolExecution.checkpoints.map((cp: any) => {
          const match = queuedVals.find(q => q.checkpointExecutionId === cp.id);
          if (match) {
            return {
              ...cp,
              status: match.payload.scanProofId ? "VALIDATED" : "PENDING",
              scanProof: {
                id: match.payload.scanProofId,
                proofType: "OFFLINE",
                createdAt: match.createdAt
              }
            };
          }
          return cp;
        });
        setPatrolExecution((prev: any) => ({
          ...prev,
          checkpoints: updatedCheckpoints
        }));
      }
    }
  }, [activePatrolForModal]);

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
    const isReadOnly = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "");
    if (isReadOnly) return; // read-only
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

  const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const ansObj = answers[itemId] || { id: crypto.randomUUID(), evidenceAttachments: [] };
    const currentAttachments = ansObj.evidenceAttachments || [];
    const activeCount = currentAttachments.filter((x: any) => x.isActive !== false).length;

    if (activeCount >= 3) {
      alert("Maximum of 3 attachments per checklist item allowed.");
      return;
    }

    if (!isOnline) {
      alert("Photo upload requires connection. Save checklist draft and attach photo when online.");
      // Create an in-memory preview (Object URL)
      const previewUrl = URL.createObjectURL(file);
      const tempAttachment = {
        id: "temp-" + Math.random().toString(36).substring(2) + Date.now().toString(36),
        isPreviewOnly: true,
        previewUrl,
        isActive: true
      };

      setAnswers((prev) => {
        const current = prev[itemId] || { id: ansObj.id, evidenceAttachments: [] };
        const attachments = [...(current.evidenceAttachments || []), tempAttachment];
        return {
          ...prev,
          [itemId]: {
            ...current,
            answerValue: "ATTACHED",
            evidenceAttachments: attachments
          }
        };
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("executionId", execution?.id || "");
    formData.append("responseId", ansObj.id || "");

    try {
      const pos: any = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2000 });
      });
      formData.append("latitude", pos.coords.latitude.toString());
      formData.append("longitude", pos.coords.longitude.toString());
      formData.append("gpsAccuracyMeters", pos.coords.accuracy.toString());
    } catch (err) {
      console.log("GPS fetch skipped for upload", err);
    }

    try {
      const res = await fetch("/api/v1/secfac/evidence", {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAnswers((prev) => {
          const current = prev[itemId] || { id: ansObj.id, evidenceAttachments: [] };
          const attachments = [...(current.evidenceAttachments || []), json.data];
          return {
            ...prev,
            [itemId]: {
              ...current,
              answerValue: "ATTACHED",
              evidenceAttachments: attachments
            }
          };
        });
      } else {
        alert(json.error || "Failed to upload photo");
      }
    } catch (err: any) {
      alert("Upload error: " + err.message);
    }
  };

  const handlePhotoRemove = async (itemId: string, evidenceId: string) => {
    const isReadOnly = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "");
    if (isReadOnly) return;

    if (evidenceId.startsWith("temp-")) {
      setAnswers((prev) => {
        const current = prev[itemId] || { evidenceAttachments: [] };
        const attachments = (current.evidenceAttachments || []).filter((e: any) => e.id !== evidenceId);
        const remainingCount = attachments.filter((x: any) => x.isActive !== false).length;
        return {
          ...prev,
          [itemId]: {
            ...current,
            answerValue: remainingCount > 0 ? "ATTACHED" : "",
            evidenceAttachments: attachments
          }
        };
      });
      return;
    }

    try {
      const res = await fetch(`/api/v1/secfac/evidence/${evidenceId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (json.success) {
        setAnswers((prev) => {
          const current = prev[itemId] || { evidenceAttachments: [] };
          const attachments = (current.evidenceAttachments || []).map((e: any) =>
            e.id === evidenceId ? { ...e, isActive: false } : e
          );
          const remainingCount = attachments.filter((x: any) => x.isActive !== false).length;
          return {
            ...prev,
            [itemId]: {
              ...current,
              answerValue: remainingCount > 0 ? "ATTACHED" : "",
              evidenceAttachments: attachments
            }
          };
        });
      } else {
        alert(json.error || "Failed to delete photo");
      }
    } catch (err: any) {
      alert("Delete error: " + err.message);
    }
  };

  const handleSave = async (submitStatus: "DRAFT" | "SUBMITTED") => {
    if (!activeTaskForModal) return;
    setErrorMsg("");
    setSuccessMsg("");

    // Scan proof verification for final submission
    if (submitStatus === "SUBMITTED") {
      const isScanRequired = (activeTaskForModal.checkpoint?.scanRequired === true) || (activeTaskForModal.template?.requiresNfcScan === true);
      if (isScanRequired) {
        // Retrieve offline queued scan proofs as well
        const queuedProofs = getQueue().filter(
          item => item.assignmentId === activeTaskForModal.id && item.actionType === "SCAN_PROOF_CREATE" && item.status !== "DISCARDED"
        );
        const allProofs = [...scanProofs, ...queuedProofs.map(q => ({
          validationStatus: q.payload.scanMode === "MANUAL_EXCEPTION" ? "PENDING_REVIEW" : "VALID"
        }))];

        if (allProofs.length === 0) {
          setErrorMsg("Validation Error: Required checkpoint scan proof is missing");
          return;
        }

        const hasValid = allProofs.some((p: any) => p.validationStatus === "VALID");
        const hasPending = allProofs.some((p: any) => p.validationStatus === "PENDING_REVIEW");

        if (!hasValid && !hasPending) {
          setErrorMsg("Validation Error: Checkpoint scan proof is invalid or rejected");
          return;
        }
      }
    }

    // Photo evidence verification for final submission
    if (submitStatus === "SUBMITTED" && activeTaskForModal.template?.items) {
      for (const item of activeTaskForModal.template.items) {
        const isPhotoReq = item.requiresPhoto || item.itemType === "PHOTO";
        const isItemReq = item.isRequired;

        if (isPhotoReq && isItemReq) {
          const ansObj = answers[item.id] || { evidenceAttachments: [] };
          const attachments = ansObj.evidenceAttachments || [];
          const activeCount = attachments.filter((e: any) => e.isActive !== false).length;

          if (activeCount === 0) {
            setErrorMsg(`Validation Error: Required photo evidence for '${item.itemText}' is missing`);
            return;
          }
        }
      }
    }

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

      // Filter out temporary previews for payload
      const serverEvidence = (ansObj.evidenceAttachments || [])
        .filter((e: any) => e.isActive !== false && !e.isPreviewOnly)
        .map((e: any) => ({ id: e.id }));

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

    if (!isOnline) {
      // Offline queueing
      addQueueItem({
        id: crypto.randomUUID(),
        actionType: submitStatus === "DRAFT" ? "CHECKLIST_DRAFT_SAVE" : "CHECKLIST_SUBMIT",
        endpoint: url,
        method,
        payload,
        assignmentId: activeTaskForModal.id,
        executionId: execution?.id || undefined,
        operationType: activeTaskForModal.operationType
      });

      setSuccessMsg(submitStatus === "SUBMITTED" ? "Checklist submission queued offline." : "Checklist draft save queued offline.");
      setExecution(payload);

      setAssignments(prev => prev.map(a => {
        if (a.id === activeTaskForModal.id) {
          return {
            ...a,
            currentExecution: {
              id: execution?.id || "",
              status: submitStatus,
              startedAt: new Date().toISOString(),
              submittedAt: submitStatus === "SUBMITTED" ? new Date().toISOString() : null
            }
          };
        }
        return a;
      }));

      if (submitStatus === "SUBMITTED") {
        setTimeout(() => {
          setActiveTaskForModal(null);
        }, 1500);
      }

      setSaving(false);
      return;
    }

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

      {!isOnline && (
        <div className="bg-amber-50 border border-amber-250 text-amber-900 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-sm">
          <span className="material-symbols-outlined text-amber-700 text-[20px]">wifi_off</span>
          <div>
            <p className="font-bold">Offline Mode Active</p>
            <p className="text-[10px] text-amber-850 font-normal">Actions will be queued locally and synced when connection is restored.</p>
          </div>
        </div>
      )}

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
            const latestPatrol = task.patrolExecutions?.[0] || null;
            const patrolStatus = latestPatrol?.status || "Not Started";
            
            const pendingItems = getQueue().filter(
              item => item.assignmentId === task.id && (item.status === "PENDING" || item.status === "FAILED" || item.status === "SYNCING")
            );
            const hasPendingSync = pendingItems.length > 0;

            return (
              <div
                key={task.id}
                className="bg-surface border border-outline-variant/40 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider font-mono">
                      {task.operationType === "SECURITY_GUARDING" ? "Security Operations" : "FM Operations"}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-on-surface mt-0.5">{task.assignmentName}</h3>
                      {hasPendingSync && (
                        <span className="inline-flex items-center gap-0.5 bg-amber-50 border border-amber-250 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                          <span className="material-symbols-outlined text-[10px] font-extrabold">sync</span>
                          Pending Sync
                        </span>
                      )}
                    </div>
                    {task.assignmentCode && (
                      <span className="text-[8px] font-mono text-on-surface-variant block">{task.assignmentCode}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {task.template && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        execStatus === "APPROVED" ? "bg-green-100 text-green-700" :
                        execStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                        execStatus === "REOPENED" ? "bg-amber-100 text-amber-700 font-semibold" :
                        execStatus === "SUBMITTED" || execStatus === "PENDING_REVIEW" ? "bg-blue-100 text-blue-700" :
                        execStatus === "DRAFT" ? "bg-slate-100 text-slate-700" :
                        "bg-on-surface/10 text-on-surface-variant"
                      }`}>
                        Checklist: {execStatus}
                      </span>
                    )}
                    {task.patrolRouteId && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        patrolStatus === "COMPLETED" ? "bg-green-100 text-green-700" :
                        patrolStatus === "PENDING_REVIEW" ? "bg-blue-100 text-blue-700" :
                        patrolStatus === "IN_PROGRESS" ? "bg-amber-100 text-amber-800 font-semibold" :
                        "bg-on-surface/10 text-on-surface-variant"
                      }`}>
                        Patrol: {patrolStatus.replace("_", " ")}
                      </span>
                    )}
                  </div>
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
                  {task.patrolRouteId && task.patrolRoute && (
                    <p className="flex items-center gap-1.5 text-amber-800 font-semibold">
                      <span className="material-symbols-outlined text-[12px]">route</span>
                      <span>Patrol Route: {task.patrolRoute.routeName} ({task.patrolRoute.checkpoints?.length || 0} checkpoints)</span>
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
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTaskForModal(task);
                    }}
                    className="bg-primary/5 hover:bg-primary/10 rounded-xl p-2 flex justify-between items-center text-[10px] text-primary font-bold cursor-pointer transition-colors"
                  >
                    <span>{["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execStatus) ? "Review Completed Checklist" : "Execute Checklist"}</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                )}
                {task.patrolRouteId && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (latestPatrol) {
                        setPatrolExecution(latestPatrol);
                        setActivePatrolForModal(task);
                      } else {
                        handleStartPatrol(task);
                      }
                    }}
                    className="bg-amber-50 hover:bg-amber-100/70 rounded-xl p-2 flex justify-between items-center text-[10px] text-amber-800 font-bold cursor-pointer transition-colors"
                  >
                    <span>{patrolStatus === "IN_PROGRESS" ? "Resume Patrol Route Execution" : patrolStatus === "Not Started" ? "Start Patrol Route Tour" : "View Completed Patrol Route"}</span>
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
                <h3 className="text-sm font-bold truncate max-w-[280px]">{activeTaskForModal.template?.templateName || activeTaskForModal.assignmentName}</h3>
                <span className="text-[9px] font-mono opacity-85 block uppercase tracking-wider">
                  {["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "") ? `${execution?.status || "SUBMITTED"} (READ-ONLY)` : `Execution Draft (${execution?.status || "DRAFT"})`}
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
              <span className="material-symbols-outlined text-sm text-amber-600 shrink-0">info</span>
              <p className="font-semibold leading-normal">
                Checkpoint proof validation is active. Please scan NFC, QR code, or enter manual proof.
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

              {activeTaskForModal.template?.description && (
                <p className="text-[10.5px] text-on-surface-variant italic leading-relaxed border-b border-outline-variant/30 pb-2">
                  {activeTaskForModal.template.description}
                </p>
              )}

              {((activeTaskForModal.checkpoint?.scanRequired === true) || (activeTaskForModal.template?.requiresNfcScan === true)) && (
                <div className="inline-flex items-center gap-1 bg-[#002D72]/10 text-[#002D72] px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[10px]">fingerprint</span>
                  Checkpoint Proof Required
                </div>
              )}

              {execution?.status === "REJECTED" && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-[10px] space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-red-700 text-xs">cancel</span>
                    <span>Checklist Rejected</span>
                  </div>
                  {execution.reviewRemarks && (
                    <p className="italic font-medium">"{execution.reviewRemarks}"</p>
                  )}
                </div>
              )}

              {execution?.status === "REOPENED" && (
                <div className="p-3 bg-amber-50 border border-amber-250 text-amber-800 rounded-xl text-[10px] space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-amber-700 text-xs">replay</span>
                    <span>Checklist Reopened</span>
                  </div>
                  {execution.reviewRemarks && (
                    <p className="italic font-medium">"{execution.reviewRemarks}"</p>
                  )}
                </div>
              )}

              {execution?.status === "APPROVED" && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-[10px] space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-green-700 text-xs font-bold">check_circle</span>
                    <span>Checklist Approved & Locked</span>
                  </div>
                  {execution.reviewRemarks && (
                    <p className="italic font-medium">"{execution.reviewRemarks}"</p>
                  )}
                </div>
              )}

              {(execution?.status === "SUBMITTED" || execution?.status === "PENDING_REVIEW") && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-[10px] flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-blue-700 text-xs">info</span>
                  <span>Checklist submitted and awaiting supervisor review.</span>
                </div>
              )}

              {/* Checkpoint Scan Proof Section */}
              {((activeTaskForModal.checkpoint?.scanRequired === true) || (activeTaskForModal.template?.requiresNfcScan === true)) && (
                <div className="p-3.5 bg-surface-variant/40 border border-outline-variant/60 rounded-2xl space-y-2 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-on-surface">Checkpoint Scan Proof</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                      !scanProofs || scanProofs.length === 0 ? "bg-outline-variant text-on-surface-variant" :
                      scanProofs[0].validationStatus === "VALID" ? "bg-green-100 text-green-800" :
                      scanProofs[0].validationStatus === "PENDING_REVIEW" ? "bg-amber-100 text-amber-800" :
                      scanProofs[0].validationStatus === "INVALID" ? "bg-red-100 text-red-800" :
                      "bg-red-200 text-red-900"
                    }`}>
                      {!scanProofs || scanProofs.length === 0 ? "Not Scanned" : scanProofs[0].validationStatus.replace("_", " ")}
                    </span>
                  </div>

                  {scanProofs && scanProofs.length > 0 && (
                    <div className="bg-surface/60 p-2.5 rounded-xl border border-outline-variant/30 space-y-1">
                      <div className="flex justify-between text-[9px] text-on-surface-variant">
                        <span>Mode: <strong className="text-on-surface">{scanProofs[0].scanMode.replace("_", " ")}</strong></span>
                        <span>Time: <strong className="text-on-surface">{new Date(scanProofs[0].scannedAt).toLocaleTimeString()}</strong></span>
                      </div>
                      {scanProofs[0].failureReason && (
                        <p className="text-red-700 font-semibold">Failure: {scanProofs[0].failureReason}</p>
                      )}
                      {scanProofs[0].exceptionReason && (
                        <p className="text-amber-800 font-semibold">Issue Details: {scanProofs[0].exceptionReason}</p>
                      )}
                    </div>
                  )}

                  {!["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "") && (
                    <div className="space-y-2 pt-1.5 border-t border-outline-variant/20">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={triggerNfcScan}
                          disabled={scanningNfc}
                          className="flex-1 py-1.5 px-3 bg-[#002D72] text-white rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-[#002D72]/90 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[13px]">nfc</span>
                          <span>{scanningNfc ? "Scanning..." : "Scan NFC"}</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setOpenQrInput(!openQrInput);
                            setOpenManualInput(false);
                            setOpenIssueReport(false);
                          }}
                          className="flex-1 py-1.5 px-3 bg-surface border border-outline rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-outline-variant/10"
                        >
                          <span className="material-symbols-outlined text-[13px]">qr_code_scanner</span>
                          <span>Enter QR</span>
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenManualInput(!openManualInput);
                            setOpenQrInput(false);
                            setOpenIssueReport(false);
                          }}
                          className="flex-1 py-1.5 px-3 bg-surface border border-outline rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-outline-variant/10 text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[13px]">keyboard</span>
                          <span>Manual Entry</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenIssueReport(!openIssueReport);
                            setOpenQrInput(false);
                            setOpenManualInput(false);
                          }}
                          className="flex-1 py-1.5 px-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-red-100/60"
                        >
                          <span className="material-symbols-outlined text-[13px]">report_problem</span>
                          <span>Report Issue</span>
                        </button>
                      </div>

                      {openQrInput && (
                        <div className="p-2.5 bg-surface border border-outline-variant rounded-xl space-y-1.5">
                          <label className="block text-[9px] font-bold text-on-surface-variant">Enter QR Code Value</label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={qrInputValue}
                              onChange={(e) => setQrInputValue(e.target.value)}
                              placeholder="e.g. QR-12345"
                              className="flex-1 bg-surface-variant/40 border border-outline rounded-lg px-2 py-1 text-[10px] text-on-surface focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitProof("QR", qrInputValue)}
                              disabled={submittingProof}
                              className="px-3 bg-[#002D72] text-white rounded-lg font-bold"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}

                      {openManualInput && (
                        <div className="p-2.5 bg-surface border border-outline-variant rounded-xl space-y-1.5">
                          <label className="block text-[9px] font-bold text-on-surface-variant">Enter NFC Tag ID or Code</label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={manualInputValue}
                              onChange={(e) => setManualInputValue(e.target.value)}
                              placeholder="e.g. NFC-TAG-ID"
                              className="flex-1 bg-surface-variant/40 border border-outline rounded-lg px-2 py-1 text-[10px] text-on-surface focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitProof("MANUAL_ENTRY", manualInputValue)}
                              disabled={submittingProof}
                              className="px-3 bg-[#002D72] text-white rounded-lg font-bold"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}

                      {openIssueReport && (
                        <div className="p-2.5 bg-surface border border-outline-variant rounded-xl space-y-1.5">
                          <label className="block text-[9px] font-bold text-on-surface-variant">Describe Tag/NFC Issue</label>
                          <textarea
                            value={issueReasonValue}
                            onChange={(e) => setIssueReasonValue(e.target.value)}
                            placeholder="Provide reason (e.g. Tag damaged, unreadable, missing)..."
                            rows={2}
                            className="w-full bg-surface-variant/40 border border-outline rounded-lg px-2 py-1 text-[10px] text-on-surface focus:outline-none resize-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => submitProof("MANUAL_EXCEPTION", undefined, issueReasonValue)}
                              disabled={submittingProof}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold"
                            >
                              Report Exception
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {loadingExecution ? (
                <div className="text-center py-12 text-xs font-mono animate-pulse text-[#002D72]">
                  Fetching execution data...
                </div>
              ) : activeTaskForModal.template && activeTaskForModal.template.items.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant/60 text-[10px]">
                  No question items in this checklist template.
                </div>
              ) : activeTaskForModal.template ? (
                activeTaskForModal.template.items.map((item, idx) => {
                  const ansObj = answers[item.id] || { answerValue: "", comment: "", evidenceAttachments: [] };
                  const activeAttachments = (ansObj.evidenceAttachments || []).filter((e: any) => e.isActive !== false);
                  const isSubmitted = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "");

                  return (
                    <div key={item.id} className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl space-y-2.5 text-[10px]">
                      <div className="flex justify-between items-center text-[8px] font-bold text-on-surface-variant">
                        <span className="flex items-center gap-1.5">
                          <span className={item.isRequired ? "text-status-error font-extrabold" : "text-[#747782]"}>
                            {item.isRequired ? "* REQUIRED" : "OPTIONAL"}
                          </span>
                          {(item.requiresPhoto || item.itemType === "PHOTO") && (
                            <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[9px]">photo_camera</span>
                              Photo Required
                            </span>
                          )}
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
                        <div className="text-center py-2 text-on-surface-variant/60 text-[9px] italic">
                          (Use the Photo Evidence section below to attach photos)
                        </div>
                      )}

                      {/* Photo Evidence Attachment Section */}
                      {(item.requiresPhoto || item.itemType === "PHOTO") && (
                        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-[#002D72] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                              Photo Evidence {item.isRequired && <span className="text-red-500 font-bold">*</span>}
                            </span>
                            <span className="text-[8px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                              {activeAttachments.length}/3 photos
                            </span>
                          </div>

                          {/* Thumbnails list */}
                          {activeAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {activeAttachments.map((att: any) => (
                                <div key={att.id} className="relative w-14 h-14 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group">
                                  <img
                                    src={att.isPreviewOnly ? att.previewUrl : `/api/v1/secfac/evidence/${att.id}/file`}
                                    alt="Evidence"
                                    className="w-full h-full object-cover"
                                  />
                                  {!isSubmitted && (
                                    <button
                                      type="button"
                                      onClick={() => handlePhotoRemove(item.id, att.id)}
                                      className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remove Photo"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Upload trigger */}
                          {!isSubmitted && activeAttachments.length < 3 && (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                id={`file-${item.id}`}
                                onChange={(e) => handlePhotoUpload(item.id, e)}
                                className="hidden"
                              />
                              <label
                                htmlFor={`file-${item.id}`}
                                className="flex justify-center items-center gap-1.5 border border-dashed border-[#002D72]/40 p-2 rounded-lg bg-[#002D72]/5 text-[#002D72] font-bold text-[9px] cursor-pointer hover:bg-[#002D72]/10 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[13px]">add_a_photo</span>
                                Attach Photo
                              </label>
                            </div>
                          )}
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
              ) : null}

              {/* Execution level remarks */}
              {!loadingExecution && activeTaskForModal.template && (
                <div className="p-3 bg-surface-container border border-outline-variant/30 rounded-xl space-y-1.5 text-[10px]">
                  <label className="font-bold text-[#002D72] uppercase block tracking-wider text-[8px]">Execution Remarks (Overall Notes)</label>
                  <textarea
                    disabled={["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "")}
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
            {!["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "") && !loadingExecution && (
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

            {["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(execution?.status || "") && (
              <div className={`p-4 border-t border-outline-variant/30 text-xs font-bold text-center ${
                execution?.status === "APPROVED" ? "bg-green-50 text-green-800" :
                execution?.status === "CANCELLED" ? "bg-slate-100 text-slate-500" :
                "bg-blue-50 text-blue-800"
              }`}>
                {execution?.status === "APPROVED" ? "Completed Checklist Approved & Locked" :
                 execution?.status === "CANCELLED" ? "Completed Checklist Cancelled" :
                 "Completed Checklist Submitted & Locked"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patrol Execution Modal */}
      {activePatrolForModal && patrolExecution && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-outline-variant">
            {/* Modal Header */}
            <div className="p-4 bg-[#002D72] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold truncate max-w-[280px]">{activePatrolForModal.patrolRoute?.routeName || "Patrol Route Execution"}</h3>
                <span className="text-[9px] font-mono opacity-85 block uppercase tracking-wider">
                  Patrol status: {patrolExecution.status.replace("_", " ")}
                </span>
              </div>
              <button
                onClick={() => {
                  setActivePatrolForModal(null);
                  setSelectedPatrolCheckpoint(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Overall Progress Tracker */}
            <div className="bg-[#F9F9FF] border-b border-[#C4C6D2]/35 px-4 py-3 text-[10px]">
              {(() => {
                const total = patrolExecution.checkpoints?.length || 0;
                const completed = patrolExecution.checkpoints?.filter((c: any) => c.status === "VALIDATED" || c.status === "PENDING_REVIEW").length || 0;
                const progressPct = total > 0 ? (completed / total) * 100 : 0;
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-bold text-slate-700">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-amber-700">route</span>
                        Route Checkpoints Progress
                      </span>
                      <span className="font-mono">{completed} / {total} Completed</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#002D72] h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Body: Checkpoints List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
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

              <div className="space-y-2">
                {patrolExecution.checkpoints?.map((item: any) => {
                  const isSelected = selectedPatrolCheckpoint?.id === item.id;
                  const isReadOnly = ["COMPLETED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(patrolExecution.status);
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (!isReadOnly) {
                          setSelectedPatrolCheckpoint(isSelected ? null : item);
                          setOpenQrInput(false);
                          setOpenManualInput(false);
                          setOpenIssueReport(false);
                        }
                      }}
                      className={`p-3 rounded-xl border text-[10.5px] transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-50 border-[#002D72]"
                          : "bg-surface-container-low border-outline-variant/30 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            {item.sequenceNo}
                          </span>
                          <span className="font-bold text-on-surface text-slate-800">{item.checkpoint?.checkpointName}</span>
                          {item.required && (
                            <span className="text-[8px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">REQ</span>
                          )}
                        </div>

                        {item.status === "VALIDATED" ? (
                          <span className="text-[8.5px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 uppercase tracking-wider flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px] font-extrabold">check</span>
                            Validated
                          </span>
                        ) : item.status === "PENDING_REVIEW" ? (
                          <span className="text-[8.5px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                            Review
                          </span>
                        ) : item.status === "INVALID" ? (
                          <span className="text-[8.5px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">close</span>
                            Invalid
                          </span>
                        ) : (
                          <span className="text-[8.5px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                      </div>

                      {/* Scan Proof Details if Validated */}
                      {item.scanProof && (
                        <div className="mt-2 bg-white border border-[#C4C6D2]/40 rounded-lg p-2.5 space-y-1.5 text-[9.5px] text-slate-700 font-sans">
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-500">Scan Mode:</span>
                            <span className="font-bold">{item.scanProof.proofType || item.scanProof.scanMode}</span>
                          </div>
                          {item.scanProof.remarks && (
                            <div className="bg-amber-50 border border-amber-250 p-2 rounded text-amber-900 leading-tight">
                              <strong>Exception:</strong> {item.scanProof.remarks}
                            </div>
                          )}
                          <div className="flex justify-between text-[8px] text-[#747782] font-mono pt-1 border-t border-slate-100">
                            <span>Proof ID: {item.scanProof.id.slice(0, 8)}...</span>
                            <span>{new Date(item.scanProof.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      )}

                      {/* Scan Proof Action Controls */}
                      {isSelected && !isReadOnly && (
                        <div className="mt-3 border-t border-[#C4C6D2]/35 pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={triggerPatrolNfcScan}
                              disabled={scanningNfc}
                              className="py-1.5 px-3 bg-[#002D72] text-white rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-[#002D72]/90 disabled:opacity-50 text-[10px]"
                            >
                              <span className="material-symbols-outlined text-[13px]">nfc</span>
                              <span>{scanningNfc ? "Scanning..." : "Scan NFC"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenQrInput(!openQrInput);
                                setOpenManualInput(false);
                                setOpenIssueReport(false);
                              }}
                              className="py-1.5 px-3 bg-white border border-outline rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-slate-50 text-[10px] text-slate-750"
                            >
                              <span className="material-symbols-outlined text-[13px]">qr_code_scanner</span>
                              <span>Enter QR</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenManualInput(!openManualInput);
                                setOpenQrInput(false);
                                setOpenIssueReport(false);
                              }}
                              className="py-1.5 px-3 bg-white border border-outline rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-slate-50 text-[10px] text-slate-750"
                            >
                              <span className="material-symbols-outlined text-[13px]">keyboard</span>
                              <span>Manual Entry</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenIssueReport(!openIssueReport);
                                setOpenQrInput(false);
                                setOpenManualInput(false);
                              }}
                              className="py-1.5 px-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-red-100/60 text-[10px]"
                            >
                              <span className="material-symbols-outlined text-[13px]">report_problem</span>
                              <span>Report Issue</span>
                            </button>
                          </div>

                          {/* QR fallback */}
                          {openQrInput && (
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase">Enter QR Code Value</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={qrInputValue}
                                  onChange={(e) => setQrInputValue(e.target.value)}
                                  placeholder="e.g. QR-12345"
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => submitPatrolProof("QR", qrInputValue)}
                                  disabled={submittingProof}
                                  className="px-3 bg-[#002D72] text-white rounded-lg font-bold text-[10px]"
                                >
                                  Submit
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Manual fallback */}
                          {openManualInput && (
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase">Enter NFC Tag ID or Code</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={manualInputValue}
                                  onChange={(e) => setManualInputValue(e.target.value)}
                                  placeholder="e.g. NFC-TAG-ID"
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => submitPatrolProof("MANUAL_ENTRY", manualInputValue)}
                                  disabled={submittingProof}
                                  className="px-3 bg-[#002D72] text-white rounded-lg font-bold text-[10px]"
                                >
                                  Submit
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Issue / Exception fallback */}
                          {openIssueReport && (
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase">Describe Tag/NFC Issue</label>
                              <textarea
                                value={issueReasonValue}
                                onChange={(e) => setIssueReasonValue(e.target.value)}
                                placeholder="Provide details (e.g. Tag damaged, unreadable)..."
                                rows={2}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none resize-none"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => submitPatrolProof("MANUAL_EXCEPTION", undefined, issueReasonValue)}
                                  disabled={submittingProof}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[10px]"
                                >
                                  Report Exception
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions Footer */}
            {patrolExecution.status === "IN_PROGRESS" && (
              <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActivePatrolForModal(null);
                    setSelectedPatrolCheckpoint(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  Close & Resume Later
                </button>
                <button
                  type="button"
                  disabled={submittingPatrol}
                  onClick={handleSubmitPatrol}
                  className="bg-[#002D72] hover:bg-[#001D48] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  {submittingPatrol && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Complete Tour
                </button>
              </div>
            )}

            {["COMPLETED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(patrolExecution.status) && (
              <div className="p-4 border-t border-outline-variant/30 bg-slate-50 text-slate-500 font-bold text-center text-xs">
                Patrol Tour Completed & Closed
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
