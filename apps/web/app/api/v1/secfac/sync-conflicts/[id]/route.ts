import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

async function verifyConflictAccess(user: any, conflictId: string) {
  const isAdmin = isAdminUser(user);
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  if (!isAdmin && !isSupervisor) {
    return { error: NextResponse.json({ success: false, error: "Forbidden: Access denied" }, { status: 403 }) };
  }

  // Load conflict
  let conflict: any = null;
  const dbConnected = require("@ahh-wfm/mock-data").isDbConnected();
  if (dbConnected) {
    const { prisma } = require("@ahh-wfm/database");
    conflict = await prisma.secfacSyncConflict.findUnique({ where: { id: conflictId } });
  } else {
    const db = require("@ahh-wfm/mock-data").readDb();
    conflict = (db.secfacSyncConflicts || []).find((c: any) => c.id === conflictId);
  }

  if (!conflict) {
    return { error: NextResponse.json({ success: false, error: "Conflict report not found" }, { status: 404 }) };
  }

  // Enforce operationType scope boundary checks for supervisors
  if (!isAdmin) {
    const operationAccess = user.operationAccess || {};
    if (conflict.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
      return { error: NextResponse.json({ success: false, error: "Forbidden: No security guarding operation access" }, { status: 403 }) };
    }
    if (conflict.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
      return { error: NextResponse.json({ success: false, error: "Forbidden: No facility management operation access" }, { status: 403 }) };
    }
  }

  return { conflict };
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const conflictId = params.id;

  try {
    const { error, conflict } = await verifyConflictAccess(user, conflictId);
    if (error) return error;

    await mockDb.deleteSecfacSyncConflict(conflictId);

    // Write audit record
    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: conflict.operationType,
      employeeId: conflict.employeeId,
      employeeCode: conflict.employeeCode || null,
      employeeName: conflict.employeeName || null,
      assignmentId: conflict.assignmentId,
      checklistExecutionId: conflict.checklistExecutionId,
      patrolExecutionId: conflict.patrolExecutionId,
      checkpointExecutionId: conflict.checkpointExecutionId,
      syncConflictId: conflict.id,
      actionType: "SYNC_CONFLICT_DISMISSED",
      actionSource: "WEB_SUPERVISOR",
      ...auditHeaders,
      syncMode: "SERVER_SIDE",
      actorUserId: user.id,
      actorEmployeeId: user.employeeId || user.id,
      actorName: user.name || null,
      actorEmail: user.email || null,
      actorRole: user.role || null,
      resultStatus: "SUCCESS",
      resultMessage: `Sync conflict report ID ${conflictId} dismissed/deleted by supervisor.`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to delete conflict report", error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const conflictId = params.id;

  try {
    const { error, conflict } = await verifyConflictAccess(user, conflictId);
    if (error) return error;

    const body = await request.json();
    const { status } = body;

    if (!status || !["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
    }

    const updated = await mockDb.updateSecfacSyncConflict(conflictId, {
      status,
      acknowledgedAt: status === "ACKNOWLEDGED" ? new Date().toISOString() : conflict.acknowledgedAt,
      acknowledgedById: status === "ACKNOWLEDGED" ? user.id : conflict.acknowledgedById
    });

    // Write audit record
    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: conflict.operationType,
      employeeId: conflict.employeeId,
      employeeCode: conflict.employeeCode || null,
      employeeName: conflict.employeeName || null,
      assignmentId: conflict.assignmentId,
      checklistExecutionId: conflict.checklistExecutionId,
      patrolExecutionId: conflict.patrolExecutionId,
      checkpointExecutionId: conflict.checkpointExecutionId,
      syncConflictId: conflict.id,
      actionType: status === "RESOLVED" ? "SYNC_CONFLICT_RESOLVED" : "SYNC_CONFLICT_ACKNOWLEDGED",
      actionSource: "WEB_SUPERVISOR",
      ...auditHeaders,
      syncMode: "SERVER_SIDE",
      actorUserId: user.id,
      actorEmployeeId: user.employeeId || user.id,
      actorName: user.name || null,
      actorEmail: user.email || null,
      actorRole: user.role || null,
      resultStatus: "SUCCESS",
      resultMessage: `Sync conflict report status updated to: ${status} by supervisor.`
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update conflict report", error: error.message }, { status: 500 });
  }
}
