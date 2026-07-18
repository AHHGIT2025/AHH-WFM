import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);

  try {
    const body = await request.json();
    const {
      operationType,
      employeeId,
      employeeCode,
      employeeName,
      assignmentId,
      checklistExecutionId,
      patrolExecutionId,
      checkpointExecutionId,
      actionType,
      queueItemId,
      idempotencyKey,
      conflictType,
      serverMessage,
      recommendedAction,
      canRetry,
      canDiscard,
      needsSupervisorReview
    } = body;

    // 1. Validations
    if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
      return NextResponse.json({ success: false, error: "Invalid operationType" }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ success: false, error: "employeeId is required" }, { status: 400 });
    }
    if (!actionType || !queueItemId || !idempotencyKey || !conflictType || !serverMessage) {
      return NextResponse.json({ success: false, error: "Missing required conflict fields" }, { status: 400 });
    }

    // 2. Ownership & RBAC checks
    // Field employee can only report their own conflicts
    if (!isAdmin && employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot report conflicts for another employee" }, { status: 403 });
    }

    // Enforce supervisor/admin operation access boundaries on POST
    const operationAccess = user.operationAccess || {};
    if (!isAdmin) {
      if (operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No security guarding operation access" }, { status: 403 });
      }
      if (operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No facility management operation access" }, { status: 403 });
      }
    }

    // 3. Create conflict report (deduplicated internally by mockDb/prisma model unique constraint)
    const result = await mockDb.createSecfacSyncConflict({
      operationType,
      employeeId,
      employeeCode: employeeCode || user.employeeId || null,
      employeeName: employeeName || user.name || null,
      assignmentId: assignmentId || null,
      checklistExecutionId: checklistExecutionId || null,
      patrolExecutionId: patrolExecutionId || null,
      checkpointExecutionId: checkpointExecutionId || null,
      actionType,
      queueItemId,
      idempotencyKey,
      status: "ACTIVE",
      conflictType,
      serverMessage,
      recommendedAction: recommendedAction || null,
      canRetry: canRetry === true,
      canDiscard: canDiscard !== false,
      needsSupervisorReview: needsSupervisorReview !== false
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to create conflict report", error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  // Enforce access boundaries: only Admins and Supervisors are allowed to view conflict reports
  if (!isAdmin && !isSupervisor) {
    return NextResponse.json({ success: false, error: "Forbidden: Only supervisors and administrators can view conflicts" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters: any = {};
    const statusParam = searchParams.get("status") || "ACTIVE";
    if (statusParam !== "ALL") {
      filters.status = statusParam;
    }

    const operationAccess = user.operationAccess || {};
    let operationTypeFilter = searchParams.get("operationType") || "ALL";

    // Enforce supervisor operationType boundary filters
    if (!isAdmin) {
      const allowedSecurity = operationAccess.allowedSecurityGuarding === true;
      const allowedFM = operationAccess.allowedFacilityManagement === true;

      if (allowedSecurity && !allowedFM) {
        operationTypeFilter = "SECURITY_GUARDING";
      } else if (allowedFM && !allowedSecurity) {
        operationTypeFilter = "FACILITY_MANAGEMENT";
      } else if (!allowedSecurity && !allowedFM) {
        return NextResponse.json({ success: true, data: [] }); // No operations allowed
      }
    }

    if (operationTypeFilter !== "ALL") {
      filters.operationType = operationTypeFilter;
    }

    const conflicts = await mockDb.getSecfacSyncConflicts(filters);
    return NextResponse.json({ success: true, data: conflicts });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to fetch conflict reports", error: error.message }, { status: 500 });
  }
}
