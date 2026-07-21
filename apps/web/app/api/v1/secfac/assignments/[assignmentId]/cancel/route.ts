import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { auditSecfacDeleteAction } from "@/lib/secfac-delete-audit-service";

export async function POST(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "secfac.patrolAssignments.edit" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const assignmentId = params.assignmentId;

  try {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Cancelled via Control Room UI";

    const assignment = await mockDb.getSecfacAssignmentById(assignmentId);
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Patrol assignment not found" }, { status: 404 });
    }

    const opType = assignment.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";

    if (!isAdmin) {
      if (opType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Security Guarding" }, { status: 403 });
      }
      if (opType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Facility Management" }, { status: 403 });
      }
    }

    let result;
    if (isDbConnected()) {
      result = await prisma.secfacAssignment.update({
        where: { id: assignmentId },
        data: { status: "SKIPPED", isActive: false }
      });
    } else {
      result = await mockDb.updateSecfacAssignment(assignmentId, { status: "SKIPPED", isActive: false });
    }

    await auditSecfacDeleteAction({
      entityType: "PATROL_ASSIGNMENT",
      entityId: assignmentId,
      actionType: "CANCEL",
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      permission: "secfac.patrolAssignments.edit",
      operationType: opType,
      siteId: assignment.siteId,
      reason,
      resultStatus: "SUCCESS",
      resultMessage: "Patrol assignment cancelled (status = SKIPPED, isActive = false)"
    });

    return NextResponse.json({ success: true, data: result, message: "Patrol assignment cancelled successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to cancel patrol assignment", error: error.message }, { status: 500 });
  }
}
