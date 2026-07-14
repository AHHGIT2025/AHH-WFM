import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: { executionId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const userRole = user.role?.toUpperCase() || "";
  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN" && userRole !== "SUPERVISOR") {
    return NextResponse.json({ success: false, error: "Forbidden: Supervisor or Admin access required", message: "Forbidden: Supervisor or Admin access required" }, { status: 403 });
  }

  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const operationAccess = user.operationAccess || {};
  const executionId = params.executionId;

  try {
    const execution = await mockDb.getSecfacChecklistExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Execution not found", message: "Execution not found" }, { status: 404 });
    }

    // Scoped Security reviewers can only review SECURITY_GUARDING executions.
    // Scoped FM reviewers can only review FACILITY_MANAGEMENT executions.
    // ADMIN/SUPER_ADMIN can review all.
    if (!isAdmin) {
      if (execution.operationType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to security executions", message: "Forbidden: No access to security executions" }, { status: 403 });
      }
      if (execution.operationType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: No access to facility executions", message: "Forbidden: No access to facility executions" }, { status: 403 });
      }
    }

    // Parse payload
    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: "Invalid JSON body", message: "Invalid JSON body" }, { status: 400 });
    }

    const { targetStatus, remarks } = payload;

    // Payload validation
    if (!targetStatus) {
      return NextResponse.json({ success: false, error: "targetStatus is required", message: "targetStatus is required" }, { status: 400 });
    }

    const ALLOWED_TARGET_STATUSES = ["APPROVED", "REJECTED", "REOPENED"];
    if (!ALLOWED_TARGET_STATUSES.includes(targetStatus)) {
      return NextResponse.json({ success: false, error: "Invalid targetStatus", message: "targetStatus must be APPROVED, REJECTED, or REOPENED" }, { status: 400 });
    }

    if ((targetStatus === "REJECTED" || targetStatus === "REOPENED") && (!remarks || !remarks.trim())) {
      return NextResponse.json({ success: false, error: "remarks is required for REJECTED and REOPENED", message: "Remarks are required when rejecting or reopening a checklist" }, { status: 400 });
    }

    // Review rules validation:
    // 1. Cannot review APPROVED or CANCELLED executions
    if (execution.status === "APPROVED" || execution.status === "CANCELLED") {
      return NextResponse.json({ success: false, error: "Cannot review already approved or cancelled executions", message: "This execution is already in a final state and cannot be changed" }, { status: 400 });
    }

    // 2. Can review SUBMITTED or PENDING_REVIEW executions
    if (execution.status !== "SUBMITTED" && execution.status !== "PENDING_REVIEW") {
      return NextResponse.json({ success: false, error: "Only submitted or pending review checklists can be reviewed", message: "Only submitted or pending review checklists can be reviewed" }, { status: 400 });
    }

    // Save review
    const updated = await mockDb.reviewSecfacChecklistExecution(executionId, targetStatus, remarks || null, user.id);

    return NextResponse.json({
      success: true,
      data: updated
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      message: "Failed to submit review"
    }, { status: 500 });
  }
}
