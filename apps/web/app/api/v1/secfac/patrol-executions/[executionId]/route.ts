import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

export async function GET(
  request: Request,
  { params }: { params: { executionId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
  const isStandardEmployee = !isAdmin && !isSupervisor;

  const { executionId } = params;

  try {
    const execution = await mockDb.getSecfacPatrolExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Patrol execution not found" }, { status: 404 });
    }

    // RBAC check
    if (!isAdmin) {
      const routeOp = execution.route?.operationType || execution.assignment?.operationType;
      if (isSupervisor) {
        // Supervisor sees only own scope
        if (routeOp === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
          return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
        }
        if (routeOp === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
          return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
        }
      } else {
        // Standard employee: can only see own execution
        if (execution.employeeId !== user.id) {
          return NextResponse.json({ success: false, error: "Forbidden: You do not own this patrol execution" }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ success: true, data: execution });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to retrieve patrol execution", error: error.message }, { status: 500 });
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
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
  const isStandardEmployee = !isAdmin && !isSupervisor;

  const { executionId } = params;

  try {
    const execution = await mockDb.getSecfacPatrolExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Patrol execution not found" }, { status: 404 });
    }

    // RBAC: standard employee can only update own execution
    if (isStandardEmployee && execution.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: You do not own this patrol execution" }, { status: 403 });
    }

    // Scope check for supervisor
    if (!isAdmin && isSupervisor) {
      const routeOp = execution.route?.operationType || execution.assignment?.operationType;
      if (routeOp === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security operations access allowed" }, { status: 403 });
      }
      if (routeOp === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility operations access allowed" }, { status: 403 });
      }
    }

    const body = await request.json();
    let { action, status, completionRemarks } = body;

    // Map status: "COMPLETED" to action: "SUBMIT" for compatibility
    if (!action && status === "COMPLETED") {
      action = "SUBMIT";
    }

    // Natural idempotency check
    if (action === "SUBMIT" && ["COMPLETED", "PENDING_REVIEW"].includes(execution.status)) {
      return NextResponse.json({ success: true, data: execution });
    }
    if (action === "CANCEL" && execution.status === "CANCELLED") {
      return NextResponse.json({ success: true, data: execution });
    }

    if (!action || !["SUBMIT", "CANCEL"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action. Must be SUBMIT or CANCEL." }, { status: 400 });
    }

    let finalStatus: string;
    let completedAt: string | null = null;

    if (action === "SUBMIT") {
      // Execution status must be IN_PROGRESS to submit
      if (execution.status !== "IN_PROGRESS") {
        if (execution.status === "COMPLETED" || execution.status === "PENDING_REVIEW") {
          return NextResponse.json({ success: true, data: execution });
        }
        const errorMsg = `Cannot submit: patrol execution status is ${execution.status}`;
        return NextResponse.json({
          success: false,
          error: errorMsg,
          conflict: {
            code: "ROUTE_CANCELLED",
            conflictType: "ROUTE_CANCELLED",
            message: errorMsg,
            recommendedAction: "CONTACT_SUPERVISOR",
            canRetry: false,
            canDiscard: true,
            needsSupervisorReview: true
          }
        }, { status: 409 });
      }

      const checkpoints = execution.checkpoints || [];
      const requiredCheckpoints = checkpoints.filter((c: any) => c.required === true);

      // All REQUIRED checkpoints must NOT be PENDING (they must have been attempted)
      const hasPending = requiredCheckpoints.some((c: any) => c.status === "PENDING");
      if (hasPending) {
        const errorMsg = "Cannot submit: one or more required checkpoints are still PENDING";
        return NextResponse.json({
          success: false,
          error: errorMsg,
          conflict: {
            code: "SERVER_VALIDATION_FAILED",
            conflictType: "SERVER_VALIDATION_FAILED",
            message: errorMsg,
            recommendedAction: "VALIDATE_ALL_CHECKPOINTS",
            canRetry: true,
            canDiscard: true,
            needsSupervisorReview: false
          }
        }, { status: 400 });
      }

      // No INVALID required checkpoints allowed
      const hasInvalid = requiredCheckpoints.some((c: any) => c.status === "INVALID");
      if (hasInvalid) {
        const errorMsg = "Cannot submit: one or more required checkpoints are INVALID";
        return NextResponse.json({
          success: false,
          error: errorMsg,
          conflict: {
            code: "SCAN_PROOF_REJECTED",
            conflictType: "SCAN_PROOF_REJECTED",
            message: errorMsg,
            recommendedAction: "RE_SCAN_INVALID_CHECKPOINTS",
            canRetry: true,
            canDiscard: true,
            needsSupervisorReview: false
          }
        }, { status: 400 });
      }

      // Determine final status
      const hasPendingReview = requiredCheckpoints.some((c: any) => c.status === "PENDING_REVIEW");
      if (hasPendingReview) {
        finalStatus = "PENDING_REVIEW";
      } else {
        finalStatus = "COMPLETED";
      }

      completedAt = new Date().toISOString();
    } else {
      // CANCEL: execution status must be NOT_STARTED or IN_PROGRESS
      if (execution.status !== "NOT_STARTED" && execution.status !== "IN_PROGRESS") {
        return NextResponse.json({ success: false, error: "Cannot cancel: execution status must be NOT_STARTED or IN_PROGRESS" }, { status: 400 });
      }

      finalStatus = "CANCELLED";
    }

    const updated = await mockDb.updateSecfacPatrolExecution(executionId, {
      status: finalStatus,
      completedAt
    });

    // Write audit record
    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: execution.route?.operationType || execution.assignment?.operationType || "SECURITY_GUARDING",
      employeeId: execution.employeeId,
      employeeCode: execution.employee?.employeeId || null,
      employeeName: execution.employee?.name || null,
      assignmentId: execution.assignmentId,
      patrolExecutionId: executionId,
      actionType: finalStatus === "CANCELLED" ? "PATROL_ROUTE_CANCEL" : "PATROL_ROUTE_SUBMIT",
      actionSource: auditHeaders.syncMode === "OFFLINE_REPLAY" ? "MOBILE_OFFLINE_SYNC" : "MOBILE_ONLINE",
      ...auditHeaders,
      resultStatus: "SUCCESS",
      resultMessage: `Patrol route execution updated to: ${finalStatus}`
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to update patrol execution", error: error.message }, { status: 500 });
  }
}
