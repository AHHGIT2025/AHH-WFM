import { NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { hasPermission } from "../../../../../../../../lib/permissions";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.reconciliation.review" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const reconciliationId = params.id;

  try {
    const body = await request.json();
    const { resolution, reviewNotes, rowVersion } = body;

    if (!resolution) {
      return NextResponse.json({ error: "Resolution string is required." }, { status: 400 });
    }

    const validResolutions = ["EXCUSED", "UNEXCUSED_ABSENCE", "ATTENDANCE_SYNC_DELAY", "ROSTER_ERROR", "NOT_APPLICABLE"];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json({ error: `Invalid resolution: ${resolution}` }, { status: 400 });
    }

    // Granular permission enforcement
    if (resolution === "EXCUSED" && !hasPermission(user, "manpower.reconciliation.excuse") && !hasPermission(user, "manpower.admin.full_access")) {
      return NextResponse.json({ error: "Access Forbidden: Missing manpower.reconciliation.excuse permission." }, { status: 403 });
    }

    if (resolution === "UNEXCUSED_ABSENCE" && !hasPermission(user, "manpower.reconciliation.classifyUnexcused") && !hasPermission(user, "manpower.admin.full_access")) {
      return NextResponse.json({ error: "Access Forbidden: Missing manpower.reconciliation.classifyUnexcused permission." }, { status: 403 });
    }

    if (resolution === "ATTENDANCE_SYNC_DELAY" && !hasPermission(user, "manpower.reconciliation.markSyncDelay") && !hasPermission(user, "manpower.admin.full_access")) {
      return NextResponse.json({ error: "Access Forbidden: Missing manpower.reconciliation.markSyncDelay permission." }, { status: 403 });
    }

    const record = await prisma.attendanceRosterReconciliation.findUnique({
      where: { id: reconciliationId }
    });

    if (!record) {
      return NextResponse.json({ error: "Reconciliation record not found." }, { status: 404 });
    }

    // SG/FM Scope Isolation Check
    if (record.operationType === "SECURITY_GUARDING" && !user?.operationAccess?.allowedSecurityGuarding) {
      return NextResponse.json({ error: "Access Forbidden: User cannot review Security Guarding data." }, { status: 403 });
    }
    if (record.operationType === "FACILITY_MANAGEMENT" && !user?.operationAccess?.allowedFacilityManagement) {
      return NextResponse.json({ error: "Access Forbidden: User cannot review Facility Management data." }, { status: 403 });
    }

    // Optimistic Concurrency Check using rowVersion
    if (typeof rowVersion === "number" && record.rowVersion !== rowVersion) {
      return NextResponse.json({
        error: "Conflict: This record has been updated by another process. Please refresh and try again.",
        currentRecord: record
      }, { status: 409 });
    }

    const updated = await prisma.attendanceRosterReconciliation.update({
      where: { id: reconciliationId },
      data: {
        workflowStatus: "RESOLVED",
        resolution,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        rowVersion: { increment: 1 }
      },
      include: {
        contract: true,
        site: true,
        expectedEmployee: true,
        reviewedBy: true
      }
    });

    // Centralized Audit Log Record
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "RECONCILIATION_REVIEW",
        entityType: "AttendanceRosterReconciliation",
        entityId: updated.id,
        beforeJson: JSON.stringify({ workflowStatus: record.workflowStatus, resolution: record.resolution, rowVersion: record.rowVersion }),
        afterJson: JSON.stringify({ workflowStatus: updated.workflowStatus, resolution: updated.resolution, rowVersion: updated.rowVersion, reviewNotes })
      }
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      reconciliation: updated
    });

  } catch (error: any) {
    console.error(`PUT /api/v1/manpower/scheduling/reconciliation/${reconciliationId}/review Error:`, error);
    return NextResponse.json({ error: "Failed to review reconciliation record." }, { status: 500 });
  }
}
