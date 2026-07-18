import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

const APPROVED_STATUSES = ["DRAFT", "SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED", "REOPENED", "CANCELLED"];

export async function GET(
  request: Request,
  { params }: { params: { executionId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const executionId = params.executionId;

  try {
    const execution = await mockDb.getSecfacChecklistExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Execution not found" }, { status: 404 });
    }

    // Apply RBAC Operation Restrictions
    if (!isAdmin) {
      if (execution.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to security executions" }, { status: 403 });
      }
      if (execution.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to facility executions" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: execution });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve execution", error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { executionId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const currentUserId = user.id;
  const executionId = params.executionId;

  try {
    const idRegex = /^[a-zA-Z0-9-]+$/i;
    if (executionId && !idRegex.test(executionId)) {
      return NextResponse.json({ success: false, error: "Invalid client-supplied ID format" }, { status: 400 });
    }

    const execution = await mockDb.getSecfacChecklistExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Execution not found" }, { status: 404 });
    }

    // 1. Employee ownership check
    if (!isAdmin && execution.employeeId !== currentUserId) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot update another employee's execution draft" }, { status: 403 });
    }

    // 1b. Scope RBAC check
    if (!isAdmin) {
      if (execution.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (execution.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    const payload = await request.json();
    const {
      responses,
      latitude,
      longitude,
      gpsAccuracyMeters,
      deviceInfo,
      remarks,
      status
    } = payload;

    const targetStatus = status || execution.status;

    // 2. Already submitted/approved read-only block & natural idempotency checks
    const READ_ONLY_STATUSES = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"];
    if (READ_ONLY_STATUSES.includes(execution.status)) {
      if (targetStatus === execution.status || (targetStatus === "SUBMITTED" && execution.status === "PENDING_REVIEW")) {
        return NextResponse.json({ success: true, data: execution });
      }
      if (!isAdmin) {
        const errorMsg = "This task was already submitted or reviewed. Your offline update was not applied.";
        return NextResponse.json({
          success: false,
          error: errorMsg,
          conflict: {
            code: "EXECUTION_ALREADY_FINALIZED",
            conflictType: "EXECUTION_ALREADY_FINALIZED",
            message: errorMsg,
            recommendedAction: "CONTACT_SUPERVISOR",
            canRetry: false,
            canDiscard: true,
            needsSupervisorReview: true
          }
        }, { status: 409 });
      }
    }

    if (["REOPENED", "REJECTED"].includes(execution.status) && targetStatus === "DRAFT") {
      const errorMsg = "This checklist execution was rejected or reopened by a supervisor while your device was offline.";
      return NextResponse.json({
        success: false,
        error: errorMsg,
        conflict: {
          code: "EXECUTION_REOPENED",
          conflictType: "EXECUTION_REOPENED",
          message: errorMsg,
          recommendedAction: "RE_EXECUTE",
          canRetry: false,
          canDiscard: true,
          needsSupervisorReview: true
        }
      }, { status: 409 });
    }

    // Validate Status value
    if (status && !APPROVED_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
    }

    // Load template/items for validation
    let templateItems: any[] = [];
    if (isDbConnected()) {
      templateItems = await prisma.secfacChecklistItem.findMany({
        where: { templateId: execution.checklistTemplateId, isActive: true }
      });
    } else {
      const db = readDb();
      templateItems = (db.secfacChecklistItems || []).filter(
        (item: any) => item.templateId === execution.checklistTemplateId && item.isActive
      );
    }

    // Duplicate check if transitioning to SUBMITTED
    if (targetStatus === "SUBMITTED" && execution.status !== "SUBMITTED") {
      let existingSubmitted: any = null;
      if (isDbConnected()) {
        existingSubmitted = await prisma.secfacChecklistExecution.findFirst({
          where: { assignmentId: execution.assignmentId, status: "SUBMITTED" }
        });
      } else {
        const db = readDb();
        existingSubmitted = (db.secfacChecklistExecutions || []).find(
          (e: any) => e.assignmentId === execution.assignmentId && e.status === "SUBMITTED"
        );
      }

      if (existingSubmitted && existingSubmitted.id !== executionId) {
        return NextResponse.json({ success: false, error: "Duplicate submission: A checklist has already been submitted for this assignment" }, { status: 400 });
      }
    }

    let finalStatus = targetStatus;

    // Validate required answers if status is SUBMITTED
    if (targetStatus === "SUBMITTED") {
      // Load assignment with checkpoint/template for verification
      let assignment: any = null;
      if (isDbConnected()) {
        assignment = await prisma.secfacAssignment.findUnique({
          where: { id: execution.assignmentId },
          include: { template: { include: { items: true } }, checkpoint: true }
        });
      } else {
        const db = readDb();
        const a = (db.secfacAssignments || []).find((x: any) => x.id === execution.assignmentId);
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

      if (!assignment || !assignment.isActive) {
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

      if (!isAdmin && assignment.employeeId !== currentUserId) {
        return NextResponse.json({ success: false, error: "Forbidden: Cannot execute checklist for another employee's assignment" }, { status: 403 });
      }

      // Check scan requirements
      const isScanRequired = (assignment?.checkpoint?.scanRequired === true) || (assignment?.template?.requiresNfcScan === true);
      if (isScanRequired) {
        const scanProofs = await mockDb.getSecfacScanProofs({
          assignmentId: execution.assignmentId,
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

      // Checklist items validation
      const requiredItems = templateItems.filter((x: any) => x.isRequired);
      const responsesList = Array.isArray(responses) ? responses : (execution.responses || []);

      const evidence = await mockDb.getSecfacEvidenceAttachments({
        executionId,
        isActive: true
      });

      for (const reqItem of requiredItems) {
        const matchingResp = responsesList.find((r: any) => r.checklistItemId === reqItem.id);
        if (!matchingResp || matchingResp.answerValue === undefined || matchingResp.answerValue === null || matchingResp.answerValue.toString().trim() === "") {
          const errorMsg = `Required checklist item '${reqItem.itemText}' is not answered.`;
          return NextResponse.json({
            success: false,
            error: errorMsg,
            conflict: {
              code: "SERVER_VALIDATION_FAILED",
              conflictType: "SERVER_VALIDATION_FAILED",
              message: errorMsg,
              recommendedAction: "FILL_ANSWERS",
              canRetry: true,
              canDiscard: true,
              needsSupervisorReview: false
            }
          }, { status: 400 });
        }

        const isPhotoReq = reqItem.requiresPhoto || reqItem.itemType === "PHOTO";
        if (isPhotoReq) {
          const hasPhoto = evidence.some(
            (e: any) => e.responseId === matchingResp?.id || (matchingResp?.id && e.responseId === matchingResp.id)
          );
          if (!hasPhoto) {
            const errorMsg = `Required photo evidence for '${reqItem.itemText}' is missing.`;
            return NextResponse.json({
              success: false,
              error: errorMsg,
              conflict: {
                code: "REQUIRED_EVIDENCE_MISSING",
                conflictType: "REQUIRED_EVIDENCE_MISSING",
                message: errorMsg,
                recommendedAction: "ATTACH_PHOTO",
                canRetry: true,
                canDiscard: true,
                needsSupervisorReview: false
              }
            }, { status: 400 });
          }
        }
      }
    }

    // Update execution
    const result = await mockDb.createOrUpdateSecfacChecklistExecution({
      id: executionId,
      operationType: execution.operationType,
      assignmentId: execution.assignmentId,
      checklistTemplateId: execution.checklistTemplateId,
      employeeId: execution.employeeId,
      siteId: execution.siteId,
      checkpointId: execution.checkpointId,
      status: finalStatus,
      startedAt: execution.startedAt,
      latitude: latitude !== undefined ? latitude : execution.latitude,
      longitude: longitude !== undefined ? longitude : execution.longitude,
      gpsAccuracyMeters: gpsAccuracyMeters !== undefined ? gpsAccuracyMeters : execution.gpsAccuracyMeters,
      deviceInfo: deviceInfo !== undefined ? deviceInfo : execution.deviceInfo,
      remarks: remarks !== undefined ? remarks : execution.remarks,
      responses: responses !== undefined ? responses : execution.responses
    });

    // Write audit record
    const isSupervisorAction = ["APPROVED", "REJECTED"].includes(finalStatus);
    const actionType = isSupervisorAction
      ? (finalStatus === "APPROVED" ? "CHECKLIST_REVIEW_APPROVE" : "CHECKLIST_REVIEW_REJECT")
      : (finalStatus === "DRAFT" ? "CHECKLIST_DRAFT_SAVE" : "CHECKLIST_SUBMIT");

    const auditHeaders = extractAuditHeaders(request);
    const auditPayload: any = {
      operationType: execution.operationType,
      employeeId: execution.employeeId,
      employeeCode: execution.employee?.employeeId || null,
      employeeName: execution.employee?.name || null,
      assignmentId: execution.assignmentId,
      checklistExecutionId: result.id,
      actionType,
      actionSource: isSupervisorAction
        ? "WEB_SUPERVISOR"
        : (auditHeaders.syncMode === "OFFLINE_REPLAY" ? "MOBILE_OFFLINE_SYNC" : "MOBILE_ONLINE"),
      ...auditHeaders,
      latitude: latitude !== undefined ? latitude : execution.latitude,
      longitude: longitude !== undefined ? longitude : execution.longitude,
      accuracy: gpsAccuracyMeters !== undefined ? gpsAccuracyMeters : execution.gpsAccuracyMeters,
      resultStatus: "SUCCESS",
      resultMessage: isSupervisorAction
        ? `Checklist execution reviewed and updated to status: ${finalStatus}`
        : `Checklist execution updated with status: ${finalStatus}`
    };

    if (isSupervisorAction) {
      auditPayload.actorUserId = user.id;
      auditPayload.actorEmployeeId = user.employeeId || user.id;
      auditPayload.actorName = user.name || null;
      auditPayload.actorEmail = user.email || null;
      auditPayload.actorRole = user.role || null;
      auditPayload.syncMode = "SERVER_SIDE";
    }

    await createSecfacFieldExecutionAudit(auditPayload);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update execution", error: error.message }, { status: 500 });
  }
}
