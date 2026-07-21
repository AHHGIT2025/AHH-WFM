import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { saveEvidenceFile } from "@/lib/secfac-evidence-storage";
import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);

  try {
    const formData = await request.formData();
    const executionId = formData.get("executionId") as string;
    const responseId = formData.get("responseId") as string | null;
    const assignmentId = formData.get("assignmentId") as string | null;
    const file = formData.get("file") as File | null;
    const caption = formData.get("caption") as string | null;
    const latStr = formData.get("latitude") as string | null;
    const lngStr = formData.get("longitude") as string | null;
    const accuracyStr = formData.get("gpsAccuracyMeters") as string | null;

    if (!executionId) {
      return NextResponse.json({ success: false, error: "executionId is required" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    // 1. Fetch execution to verify exists & check status
    const execution = await mockDb.getSecfacChecklistExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Execution not found" }, { status: 400 });
    }

    const isSupervisorOrAdmin = isAdmin || 
      ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_")) ||
      (user.permissions || []).some((p: string) => 
        p === "manpower.security.manage" || 
        p === "manpower.fm.manage" || 
        p.startsWith("manpower.admin.")
      );

    // 2. Validate Ownership & Scope
    if (!isSupervisorOrAdmin) {
      // Standard employee can only upload to their own execution
      if (execution.employeeId !== user.id) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot upload evidence to another employee's execution" }, { status: 403 });
      }
    } else {
      // Supervisors cannot upload evidence in the normal flow
      // (Unless they are the assigned employee, which falls under standard employee checks, but if they access as supervisor role they should be blocked from normal uploads)
      const isAssignedToSelf = execution.employeeId === user.id;
      if (!isAssignedToSelf && !isAdmin) {
        return NextResponse.json({ success: false, error: "Forbidden: Supervisors cannot upload evidence to other employees' tasks" }, { status: 403 });
      }
    }

    // Validate operation access scope
    const operationAccess = user.operationAccess || {};
    let hasOpAccess = false;
    if (isAdmin) hasOpAccess = true;
    if (execution.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding === true) hasOpAccess = true;
    if (execution.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement === true) hasOpAccess = true;

    if (!hasOpAccess) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${execution.operationType}` }, { status: 403 });
    }

    // 3. Verify execution status is editable
    const EDITABLE_STATUSES = ["DRAFT", "REJECTED", "REOPENED"];
    if (!EDITABLE_STATUSES.includes(execution.status.toUpperCase())) {
      return NextResponse.json({ success: false, error: `Cannot upload evidence to checklist with status ${execution.status}` }, { status: 400 });
    }

    // 4. Validate max attachments limit per response item
    if (responseId) {
      const activeAttachments = await mockDb.getSecfacEvidenceAttachments({
        responseId,
        isActive: true
      });
      if (activeAttachments.length >= 3) {
        return NextResponse.json({ success: false, error: "Maximum of 3 attachments per checklist item exceeded" }, { status: 400 });
      }
    }

    const clientFileHash = formData.get("clientFileHash") as string | null;
    const idempotencyKey = formData.get("idempotencyKey") as string | null;
    const deviceSessionId = formData.get("deviceSessionId") as string | null;

    const originalName = file.name;
    const mimeType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    let uploadResult;
    try {
      uploadResult = await saveEvidenceFile(buffer, originalName, mimeType);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }

    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lngStr ? parseFloat(lngStr) : null;
    const gpsAccuracyMeters = accuracyStr ? parseFloat(accuracyStr) : null;

    const { verifyAndStoreEvidence } = await import("@/lib/secfac-evidence-service");
    const result = await verifyAndStoreEvidence({
      operationType: execution.operationType,
      executionId,
      responseId: responseId || undefined,
      assignmentId: assignmentId || execution.assignmentId || undefined,
      employeeId: execution.employeeId,
      siteId: execution.siteId || undefined,
      checkpointId: execution.checkpointId || undefined,
      fileName: uploadResult.fileName,
      originalName: uploadResult.originalName,
      mimeType: uploadResult.mimeType,
      fileBuffer: buffer,
      clientFileHash: clientFileHash || undefined,
      caption: caption || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      gpsAccuracyMeters: gpsAccuracyMeters || undefined,
      deviceSessionId: deviceSessionId || undefined,
      idempotencyKey: idempotencyKey || undefined
    });

    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: execution.operationType,
      employeeId: execution.employeeId,
      employeeCode: execution.employee?.employeeId || null,
      employeeName: execution.employee?.name || null,
      assignmentId: assignmentId || execution.assignmentId || null,
      checklistExecutionId: executionId,
      evidenceAttachmentId: result.attachment?.id || "unknown",
      actionType: "EVIDENCE_UPLOAD",
      actionSource: auditHeaders.syncMode === "OFFLINE_REPLAY" ? "MOBILE_OFFLINE_SYNC" : "MOBILE_ONLINE",
      ...auditHeaders,
      latitude,
      longitude,
      accuracy: gpsAccuracyMeters,
      resultStatus: result.integrityStatus === "MISMATCH" ? "FAILED" : "SUCCESS",
      resultMessage: `Evidence photo uploaded with integrity status: ${result.integrityStatus}`
    });

    return NextResponse.json({ success: true, data: result.attachment, integrityStatus: result.integrityStatus }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  const { searchParams } = new URL(request.url);
  const operationTypeFilter = searchParams.get("operationType");
  const executionId = searchParams.get("executionId");
  const responseId = searchParams.get("responseId");
  const assignmentId = searchParams.get("assignmentId");
  const employeeId = searchParams.get("employeeId");
  const siteId = searchParams.get("siteId");
  const checkpointId = searchParams.get("checkpointId");
  const evidenceType = searchParams.get("evidenceType");
  const isActive = searchParams.get("isActive") ?? "true";

  // Apply RBAC Operation Restrictions
  let allowedOps: string[] = [];
  if (isAdmin) {
    allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
  } else {
    if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
    if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
  }

  if (allowedOps.length === 0) {
    return NextResponse.json({ success: false, error: "Forbidden: No operations access allowed" }, { status: 403 });
  }

  let targetOp = operationTypeFilter;
  if (targetOp) {
    if (!allowedOps.includes(targetOp)) {
      return NextResponse.json({ success: false, error: `Forbidden: No access to operation type ${targetOp}` }, { status: 403 });
    }
  }

  const isSupervisorOrAdmin = isAdmin || 
    ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_")) ||
    (user.permissions || []).some((p: string) => 
      p === "manpower.security.manage" || 
      p === "manpower.fm.manage" || 
      p.startsWith("manpower.admin.")
    );

  // Standard employee is forced to only see their own uploads
  const queryEmployeeId = isSupervisorOrAdmin ? (employeeId || undefined) : user.id;

  try {
    const list = await mockDb.getSecfacEvidenceAttachments({
      operationType: targetOp || undefined,
      executionId: executionId || undefined,
      responseId: responseId || undefined,
      assignmentId: assignmentId || undefined,
      employeeId: queryEmployeeId || undefined,
      siteId: siteId || undefined,
      checkpointId: checkpointId || undefined,
      evidenceType: evidenceType || undefined,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined
    });

    // Supervisors must only see within their permitted scopes
    const filteredList = list.filter((x: any) => allowedOps.includes(x.operationType));

    return NextResponse.json({ success: true, data: filteredList });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
