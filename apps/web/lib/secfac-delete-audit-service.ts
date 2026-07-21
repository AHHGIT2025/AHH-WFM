import { createSecfacFieldExecutionAudit } from "./secfac-audit-helpers";

export interface AuditDeleteParams {
  entityType: "CHECKPOINT" | "CHECKLIST_TEMPLATE" | "PATROL_ROUTE" | "PATROL_ASSIGNMENT";
  entityId: string;
  actionType: "HARD_DELETE" | "DEACTIVATE" | "ARCHIVE" | "CANCEL" | "PERMISSION_DENIED" | "DEPENDENCY_BLOCKED" | "FAILED";
  userId: string;
  userRole?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  permission: string;
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";
  companyId?: string | null;
  projectId?: string | null;
  siteId?: string | null;
  reason?: string | null;
  resultStatus: "SUCCESS" | "DENIED" | "BLOCKED" | "FAILED";
  resultMessage?: string | null;
  previousValues?: Record<string, any> | null;
}

export async function auditSecfacDeleteAction(params: AuditDeleteParams): Promise<void> {
  try {
    const actionSource = `SECFAC_DELETE_CONTROL_${params.entityType}`;
    const resultMsg = params.reason
      ? `${params.resultMessage || params.actionType} | Reason: ${params.reason}`
      : params.resultMessage || params.actionType;

    await createSecfacFieldExecutionAudit({
      operationType: params.operationType,
      employeeId: params.userId,
      actorUserId: params.userId,
      actorEmail: params.userEmail || null,
      actorName: params.userName || null,
      actorRole: params.userRole || null,
      actionType: `${params.entityType}_${params.actionType}`,
      actionSource,
      resultStatus: params.resultStatus,
      resultMessage: resultMsg,
      syncMode: "ONLINE",
      appSource: "WEB_CONTROL_ROOM",
      clientActionAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[SecfacDeleteAudit] Failed to log audit event for ${params.entityType} ${params.entityId}:`, err);
  }
}
