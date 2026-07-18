import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

const APPROVED_STATUSES = ["DRAFT", "SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED", "CANCELLED"];

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};

  const { searchParams } = new URL(request.url);
  const operationTypeFilter = searchParams.get("operationType");
  const assignmentId = searchParams.get("assignmentId");
  const employeeId = searchParams.get("employeeId");
  const siteId = searchParams.get("siteId");
  const checkpointId = searchParams.get("checkpointId");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

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

  const queryEmployeeId = isSupervisorOrAdmin ? (employeeId || undefined) : user.id;

  try {
    const executions = await mockDb.getSecfacChecklistExecutions({
      operationType: targetOp || undefined,
      assignmentId: assignmentId || undefined,
      employeeId: queryEmployeeId,
      siteId: siteId || undefined,
      checkpointId: checkpointId || undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    });

    let filtered = executions;
    if (!isAdmin) {
      filtered = executions.filter(x => allowedOps.includes(x.operationType));
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve executions", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const currentUserId = user.id;

  try {
    const payload = await request.json();
    const {
      id,
      assignmentId,
      checklistTemplateId,
      responses,
      latitude,
      longitude,
      gpsAccuracyMeters,
      deviceInfo,
      remarks,
      status
    } = payload;

    // 1. Validate client-supplied ID format and perform natural idempotency check
    const idRegex = /^[a-zA-Z0-9-]+$/i;
    if (id) {
      if (!idRegex.test(id)) {
        return NextResponse.json({ success: false, error: "Invalid client-supplied ID format" }, { status: 400 });
      }
      let existingExecution: any = null;
      if (isDbConnected()) {
        existingExecution = await prisma.secfacChecklistExecution.findUnique({
          where: { id }
        });
      } else {
        const db = readDb();
        existingExecution = (db.secfacChecklistExecutions || []).find((x: any) => x.id === id);
      }

      if (existingExecution) {
        // Ownership/scope validation:
        if (existingExecution.employeeId !== currentUserId && !isAdmin) {
          return NextResponse.json({ success: false, error: "Forbidden: Execution belongs to another user" }, { status: 403 });
        }
        const checkStatus = status || "DRAFT";
        const isFinalized = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"].includes(existingExecution.status);
        if (isFinalized || checkStatus === existingExecution.status) {
          return NextResponse.json({ success: true, data: existingExecution });
        }
      }
    }

    // 2. Mandatory Fields Validation
    if (!assignmentId) {
      return NextResponse.json({ success: false, error: "assignmentId is required" }, { status: 400 });
    }
    if (!checklistTemplateId) {
      return NextResponse.json({ success: false, error: "checklistTemplateId is required" }, { status: 400 });
    }

    // 3. Validate Status
    const targetStatus = status || "DRAFT";
    if (!APPROVED_STATUSES.includes(targetStatus)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
    }

    // 3. Load Assignment and verify
    let assignment: any = null;
    if (isDbConnected()) {
      assignment = await prisma.secfacAssignment.findUnique({
        where: { id: assignmentId },
        include: { template: { include: { items: true } }, checkpoint: true }
      });
    } else {
      const db = readDb();
      const a = (db.secfacAssignments || []).find((x: any) => x.id === assignmentId);
      if (a) {
        const t = (db.secfacChecklistTemplates || []).find((x: any) => x.id === a.templateId);
        let items: any[] = [];
        if (t) {
          items = (db.secfacChecklistItems || []).filter((item: any) => item.templateId === t.id && item.isActive);
        }
        const c = (db.secfacCheckpoints || []).find((x: any) => x.id === a.checkpointId) || null;
        assignment = {
          ...a,
          template: t ? { ...t, items } : null,
          checkpoint: c
        };
      }
    }

    // Verify employee status
    let employeeRecord: any = null;
    if (isDbConnected()) {
      employeeRecord = await prisma.employee.findUnique({ where: { id: currentUserId } });
    } else {
      const db = readDb();
      employeeRecord = (db.employees || []).find((e: any) => e.id === currentUserId);
    }
    if (!employeeRecord || !employeeRecord.isActive || employeeRecord.employmentStatus !== "ACTIVE") {
      const errorMsg = "Your employee account is inactive or removed from operational scope.";
      return NextResponse.json({
        success: false,
        error: errorMsg,
        conflict: {
          code: "EMPLOYEE_INACTIVE",
          conflictType: "EMPLOYEE_INACTIVE",
          message: errorMsg,
          recommendedAction: "CONTACT_SUPERVISOR",
          canRetry: false,
          canDiscard: true,
          needsSupervisorReview: true
        }
      }, { status: 409 });
    }

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Active assignment not found" }, { status: 400 });
    }
    if (!assignment.isActive) {
      const errorMsg = "This assignment was cancelled while your device was offline.";
      return NextResponse.json({
        success: false,
        error: errorMsg,
        conflict: {
          code: "ASSIGNMENT_CANCELLED",
          conflictType: "ASSIGNMENT_CANCELLED",
          message: errorMsg,
          recommendedAction: "CONTACT_SUPERVISOR",
          canRetry: false,
          canDiscard: true,
          needsSupervisorReview: true
        }
      }, { status: 409 });
    }

    // 4. Employee ownership restriction
    if (!isAdmin && assignment.employeeId !== currentUserId) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot execute checklist for another employee's assignment" }, { status: 403 });
    }

    // 5. Scope RBAC check
    if (!isAdmin) {
      if (assignment.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access" }, { status: 403 });
      }
      if (assignment.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access" }, { status: 403 });
      }
    }

    // 6. Template matching validation
    if (assignment.templateId !== checklistTemplateId) {
      return NextResponse.json({ success: false, error: "Checklist template mismatch with assignment" }, { status: 400 });
    }

    // 7. Duplicate check for submitted executions
    if (targetStatus === "SUBMITTED") {
      let existingSubmitted: any = null;
      if (isDbConnected()) {
        existingSubmitted = await prisma.secfacChecklistExecution.findFirst({
          where: { assignmentId, status: "SUBMITTED" }
        });
      } else {
        const db = readDb();
        existingSubmitted = (db.secfacChecklistExecutions || []).find(
          (e: any) => e.assignmentId === assignmentId && e.status === "SUBMITTED"
        );
      }

      // If we are updating an existing draft to submitted, allow it if it's the same execution ID
      if (existingSubmitted && existingSubmitted.id !== id) {
        return NextResponse.json({ success: false, error: "Duplicate submission: A checklist has already been submitted for this assignment" }, { status: 400 });
      }
    }

    let finalStatus = targetStatus;

    // 8. Required items validation for SUBMITTED state
    if (targetStatus === "SUBMITTED") {
      // 8a. Scan Proof validation
      const isScanRequired = (assignment.checkpoint?.scanRequired === true) || (assignment.template?.requiresNfcScan === true);
      if (isScanRequired) {
        const scanProofs = await mockDb.getSecfacScanProofs({
          assignmentId,
          isActive: true
        });

        if (scanProofs.length === 0) {
          return NextResponse.json({
            success: false,
            error: "Validation Error: Required checkpoint scan proof is missing"
          }, { status: 400 });
        }

        const hasValid = scanProofs.some((p: any) => p.validationStatus === "VALID");
        const hasPendingReview = scanProofs.some((p: any) => p.validationStatus === "PENDING_REVIEW");

        if (hasValid) {
          // satisfied
        } else if (hasPendingReview) {
          finalStatus = "PENDING_REVIEW";
        } else {
          return NextResponse.json({
            success: false,
            error: "Validation Error: Checkpoint scan proof is invalid or rejected"
          }, { status: 400 });
        }
      }

      // 8b. Checklist items validation
      if (assignment.template?.items) {
        const requiredItems = assignment.template.items.filter((x: any) => x.isRequired && x.isActive);
        const responsesList = Array.isArray(responses) ? responses : [];

        const evidence = await mockDb.getSecfacEvidenceAttachments({
          executionId: id || undefined,
          isActive: true
        });

        for (const reqItem of requiredItems) {
          const matchingResp = responsesList.find((r: any) => r.checklistItemId === reqItem.id);
          if (!matchingResp || matchingResp.answerValue === undefined || matchingResp.answerValue === null || matchingResp.answerValue.toString().trim() === "") {
            return NextResponse.json({
              success: false,
              error: `Validation Error: Required checklist item '${reqItem.itemText}' is not answered`
            }, { status: 400 });
          }

          const isPhotoReq = reqItem.requiresPhoto || reqItem.itemType === "PHOTO";
          if (isPhotoReq) {
            const hasPhoto = evidence.some(
              (e: any) => e.responseId === matchingResp?.id || (matchingResp?.id && e.responseId === matchingResp.id)
            );
            if (!hasPhoto) {
              return NextResponse.json({
                success: false,
                error: `Validation Error: Required photo evidence for '${reqItem.itemText}' is missing`
              }, { status: 400 });
            }
          }
        }
      }
    }

    // Save/upsert execution
    const result = await mockDb.createOrUpdateSecfacChecklistExecution({
      id: id || undefined,
      operationType: assignment.operationType,
      assignmentId,
      checklistTemplateId,
      employeeId: assignment.employeeId,
      siteId: assignment.siteId,
      checkpointId: assignment.checkpointId || null,
      status: finalStatus,
      latitude: latitude !== undefined ? latitude : undefined,
      longitude: longitude !== undefined ? longitude : undefined,
      gpsAccuracyMeters: gpsAccuracyMeters !== undefined ? gpsAccuracyMeters : undefined,
      deviceInfo: deviceInfo || null,
      remarks: remarks || null,
      responses: responses || []
    });

    // Write audit record
    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: assignment.operationType,
      employeeId: assignment.employeeId,
      employeeCode: assignment.employee?.employeeId || null,
      employeeName: assignment.employee?.name || null,
      assignmentId,
      checklistExecutionId: result.id,
      actionType: finalStatus === "DRAFT" ? "CHECKLIST_DRAFT_SAVE" : "CHECKLIST_SUBMIT",
      actionSource: auditHeaders.syncMode === "OFFLINE_REPLAY" ? "MOBILE_OFFLINE_SYNC" : "MOBILE_ONLINE",
      ...auditHeaders,
      latitude: latitude !== undefined ? latitude : null,
      longitude: longitude !== undefined ? longitude : null,
      accuracy: gpsAccuracyMeters !== undefined ? gpsAccuracyMeters : null,
      resultStatus: "SUCCESS",
      resultMessage: `Checklist execution created with status: ${finalStatus}`
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to save checklist execution", error: error.message }, { status: 500 });
  }
}
