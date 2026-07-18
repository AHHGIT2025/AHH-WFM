import { mockDb } from "@ahh-wfm/mock-data";

export interface SecfacFieldExecutionAuditPayload {
  operationType: string;
  employeeId: string;
  employeeCode?: string | null;
  employeeName?: string | null;
  
  actorUserId?: string | null;
  actorEmployeeId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;

  assignmentId?: string | null;
  checklistExecutionId?: string | null;
  patrolExecutionId?: string | null;
  checkpointExecutionId?: string | null;
  scanProofId?: string | null;
  evidenceAttachmentId?: string | null;
  syncConflictId?: string | null;

  actionType: string;
  actionSource: string;

  queueItemId?: string | null;
  idempotencyKey?: string | null;

  deviceSessionId?: string | null;
  deviceLabel?: string | null;
  devicePlatform?: string | null;
  userAgent?: string | null;
  appSource?: string | null;

  clientActionAt?: string | null;
  syncMode?: string;
  networkStatus?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;

  resultStatus?: string;
  resultMessage?: string | null;
}

export async function createSecfacFieldExecutionAudit(data: SecfacFieldExecutionAuditPayload): Promise<any> {
  // Validate operationType
  if (data.operationType !== "SECURITY_GUARDING" && data.operationType !== "FACILITY_MANAGEMENT") {
    console.error(`Invalid operationType for SECFAC field audit log: ${data.operationType}`);
    return null;
  }

  const payload = {
    operationType: data.operationType,
    employeeId: data.employeeId,
    employeeCode: data.employeeCode || null,
    employeeName: data.employeeName || null,
    actorUserId: data.actorUserId || null,
    actorEmployeeId: data.actorEmployeeId || null,
    actorName: data.actorName || null,
    actorEmail: data.actorEmail || null,
    actorRole: data.actorRole || null,
    assignmentId: data.assignmentId || null,
    checklistExecutionId: data.checklistExecutionId || null,
    patrolExecutionId: data.patrolExecutionId || null,
    checkpointExecutionId: data.checkpointExecutionId || null,
    scanProofId: data.scanProofId || null,
    evidenceAttachmentId: data.evidenceAttachmentId || null,
    syncConflictId: data.syncConflictId || null,
    actionType: data.actionType,
    actionSource: data.actionSource,
    queueItemId: data.queueItemId || null,
    idempotencyKey: data.idempotencyKey || null,
    deviceSessionId: data.deviceSessionId || null,
    deviceLabel: data.deviceLabel || null,
    devicePlatform: data.devicePlatform || null,
    userAgent: data.userAgent || null,
    appSource: data.appSource || null,
    clientActionAt: data.clientActionAt ? new Date(data.clientActionAt) : null,
    syncMode: data.syncMode || "ONLINE",
    networkStatus: data.networkStatus || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    accuracy: data.accuracy || null,
    resultStatus: data.resultStatus || "SUCCESS",
    resultMessage: data.resultMessage || null
  };

  try {
    const dbConnected = require("@ahh-wfm/mock-data").isDbConnected();
    if (dbConnected) {
      const { prisma } = require("@ahh-wfm/database");
      // Double check if record with same idempotencyKey and actionType already exists for IDEMPOTENT_REPLAY checks
      if (payload.idempotencyKey && payload.actionType) {
        const existing = await prisma.secfacFieldExecutionAudit.findFirst({
          where: {
            idempotencyKey: payload.idempotencyKey,
            actionType: payload.actionType
          }
        });
        if (existing) {
          payload.syncMode = "IDEMPOTENT_REPLAY";
        }
      }

      return await prisma.secfacFieldExecutionAudit.create({
        data: payload
      });
    } else {
      // Memory mockdb fallback
      return await mockDb.createSecfacFieldExecutionAudit(payload);
    }
  } catch (err) {
    console.error("Non-critical SECFAC audit log insertion failure:", err);
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      throw err;
    }
    return null;
  }
}

export function extractAuditHeaders(req: Request) {
  const headers = req.headers;
  const userAgent = headers.get("user-agent") || null;
  const isMobileUA = userAgent ? userAgent.toLowerCase().includes("mobi") || userAgent.toLowerCase().includes("android") : false;
  const rawAppSource = isMobileUA ? "MOBILE" : "WEB";

  // Check custom audit headers
  const deviceSessionId = headers.get("x-secfac-device-session-id") || null;
  const deviceLabel = headers.get("x-secfac-device-label") || null;
  const devicePlatform = headers.get("x-secfac-device-platform") || null;
  const clientActionAt = headers.get("x-secfac-client-action-at") || null;
  const networkStatus = headers.get("x-secfac-network-status") || null;
  const queueItemId = headers.get("x-secfac-queue-item-id") || null;
  const syncMode = headers.get("x-secfac-sync-mode") || "ONLINE";

  return {
    deviceSessionId,
    deviceLabel,
    devicePlatform,
    clientActionAt,
    networkStatus,
    queueItemId,
    syncMode,
    userAgent,
    appSource: rawAppSource
  };
}
