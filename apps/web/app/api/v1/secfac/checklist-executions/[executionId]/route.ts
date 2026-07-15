import { NextResponse } from "next/server";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

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

    // 2. Already submitted/approved read-only block
    const READ_ONLY_STATUSES = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "CANCELLED"];
    if (READ_ONLY_STATUSES.includes(execution.status) && !isAdmin) {
      return NextResponse.json({ success: false, error: `Cannot update a checklist with status ${execution.status}` }, { status: 400 });
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

    // Validate required answers if status is SUBMITTED
    if (targetStatus === "SUBMITTED") {
      const requiredItems = templateItems.filter((x: any) => x.isRequired);
      const responsesList = Array.isArray(responses) ? responses : (execution.responses || []);

      const evidence = await mockDb.getSecfacEvidenceAttachments({
        executionId,
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

    // Update execution
    const result = await mockDb.createOrUpdateSecfacChecklistExecution({
      id: executionId,
      operationType: execution.operationType,
      assignmentId: execution.assignmentId,
      checklistTemplateId: execution.checklistTemplateId,
      employeeId: execution.employeeId,
      siteId: execution.siteId,
      checkpointId: execution.checkpointId,
      status: targetStatus,
      startedAt: execution.startedAt,
      latitude: latitude !== undefined ? latitude : execution.latitude,
      longitude: longitude !== undefined ? longitude : execution.longitude,
      gpsAccuracyMeters: gpsAccuracyMeters !== undefined ? gpsAccuracyMeters : execution.gpsAccuracyMeters,
      deviceInfo: deviceInfo !== undefined ? deviceInfo : execution.deviceInfo,
      remarks: remarks !== undefined ? remarks : execution.remarks,
      responses: responses !== undefined ? responses : execution.responses
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update execution", error: error.message }, { status: 500 });
  }
}
