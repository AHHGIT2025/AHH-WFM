import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const escalationId = params.id;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "commercial.commandCenter.exceptions") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view escalation details." },
      { status: 403 }
    );
  }

  try {
    const parts = escalationId.split(":");
    const sourceType = parts[0];
    const sourceId = parts[1];

    let sourceRecord: any = null;
    let workflowInstance: any = null;

    if (sourceType === "ROSTER_PLANNING_EXCEPTION") {
      sourceRecord = await prisma.rosterPlanningException.findUnique({
        where: { id: sourceId },
        include: { contract: true, site: true, employee: true }
      });
    } else if (sourceType === "UNEXCUSED_RECONCILIATION") {
      sourceRecord = await prisma.attendanceRosterReconciliation.findUnique({
        where: { id: sourceId },
        include: { contract: true, site: true, expectedEmployee: true }
      });
    } else if (sourceType === "ATTENDANCE_CORRECTION_PENDING") {
      sourceRecord = await prisma.attendanceCorrection.findUnique({
        where: { id: sourceId },
        include: { attendanceRecord: { include: { employee: true, worksite: true } } }
      });
    } else if (sourceType === "UNCOVERED_ROSTER_SLOT") {
      sourceRecord = await prisma.rosterRequirementSlot.findUnique({
        where: { id: sourceId },
        include: { contract: true, site: true, assignments: true }
      });
    } else if (sourceType === "CONTRACT_SLA_RISK") {
      sourceRecord = await prisma.manpowerContract.findUnique({
        where: { id: sourceId },
        include: { client: true }
      });
    }

    // Company boundary check
    // Note: ManpowerClient and ManpowerContract have no companyId field.
    // Company isolation is derived from: slot.companyId or attendanceRecord.companyId only.
    const recordCompanyId =
      sourceRecord?.companyId ||
      sourceRecord?.attendanceRecord?.companyId ||
      sourceRecord?.attendanceRecord?.employee?.companyId ||
      null;
    if (user?.companyId && !isAdminUser(user) && recordCompanyId && recordCompanyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation." }, { status: 403 });
    }

    // Fetch central workflow instance if attached
    workflowInstance = await prisma.workflowInstance.findFirst({
      where: { referenceId: sourceId },
      include: { history: { orderBy: { createdAt: "asc" } } }
    });

    // Fetch activity log entries for audit trail
    const activityLogs = await prisma.userActivityLog.findMany({
      where: { entityType: "COMMAND_CENTER_ESCALATION", entityId: escalationId },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({
      escalationId,
      sourceType,
      sourceId,
      sourceRecord,
      workflowInstance,
      auditHistory: activityLogs
    });
  } catch (error: any) {
    console.error("COMMERCIAL ESCALATION GET BY ID ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch escalation details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const escalationId = params.id;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.exceptions") ||
    hasPermission(user, "manpower.admin.full_access");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to manage escalation items." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, ownerId, remarks, workflowAction } = body;

    if (!action || !["ACKNOWLEDGE", "ASSIGN", "COMMENT", "RESOLVE", "CANCEL", "WORKFLOW_ACTION"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Allowed actions: ACKNOWLEDGE, ASSIGN, COMMENT, RESOLVE, CANCEL, WORKFLOW_ACTION." },
        { status: 400 }
      );
    }

    const parts = escalationId.split(":");
    const sourceType = parts[0];
    const sourceId = parts[1];

    // AUTHORITATIVE SOURCE PROTECTION RULE:
    // Resolving a CCC-3 escalation DOES NOT approve an AttendanceCorrection record!
    if (action === "RESOLVE" && sourceType === "ATTENDANCE_CORRECTION_PENDING") {
      if (body.approveAttendanceCorrection === true) {
        return NextResponse.json(
          { error: "Authoritative Source Protection Violation: AttendanceCorrection approval belongs exclusively to the Attendance module. Use drill-down link /attendance/corrections to approve." },
          { status: 400 }
        );
      }
    }

    // 1. Update underlying models if native status exists
    let updatedStatus = "IN_PROGRESS";
    if (action === "ACKNOWLEDGE") updatedStatus = "ACKNOWLEDGED";
    if (action === "ASSIGN") updatedStatus = "ASSIGNED";
    if (action === "RESOLVE") updatedStatus = "RESOLVED";
    if (action === "CANCEL") updatedStatus = "CANCELLED";

    // Terminal-state guard: prevent re-opening RESOLVED or CANCELLED escalations.
    // COMMENT is the only action permitted on closed items (post-closure notes).
    // This check is performed BEFORE the actingEmployeeId lookup to short-circuit cheaply.
    if (["RESOLVE", "ACKNOWLEDGE", "ASSIGN"].includes(action)) {
      if (sourceType === "ROSTER_PLANNING_EXCEPTION") {
        const currentExc = await prisma.rosterPlanningException.findUnique({
          where: { id: sourceId },
          select: { status: true }
        });
        if (currentExc?.status === "RESOLVED" || currentExc?.status === "CANCELLED") {
          return NextResponse.json(
            {
              error: `Invalid transition: escalation is already ${currentExc.status}. Closed escalations cannot be re-opened via Command Center.`
            },
            { status: 400 }
          );
        }
      } else if (sourceType === "UNEXCUSED_RECONCILIATION") {
        const currentRecon = await prisma.attendanceRosterReconciliation.findUnique({
          where: { id: sourceId },
          select: { workflowStatus: true }
        });
        if (currentRecon?.workflowStatus === "RESOLVED" || currentRecon?.workflowStatus === "CANCELLED") {
          return NextResponse.json(
            {
              error: `Invalid transition: reconciliation is already ${currentRecon.workflowStatus}. Closed items cannot be re-opened via Command Center.`
            },
            { status: 400 }
          );
        }
      }
    }

    // Safe Employee FK guard: look up whether the acting user exists as an Employee row.
    // Prevents FK constraint violations in contexts where the session user is not a seeded Employee
    // (e.g. API-key callers, test mock users). The immutable UserActivityLog always captures the actor.
    const actingEmployeeId = user?.id
      ? ((await prisma.employee.findUnique({ where: { id: user.id }, select: { id: true } }))?.id ?? null)
      : null;

    if (sourceType === "ROSTER_PLANNING_EXCEPTION") {
      const excStatus = action === "RESOLVE" ? "RESOLVED" : action === "CANCEL" ? "CANCELLED" : "COVERAGE_REQUIRED";
      await prisma.rosterPlanningException.update({
        where: { id: sourceId },
        data: {
          status: excStatus,
          resolved: action === "RESOLVE",
          ...(action === "RESOLVE" && { resolvedAt: new Date() }),
          ...(action === "RESOLVE" && actingEmployeeId && { resolvedById: actingEmployeeId }),
          ...(action === "CANCEL" && { cancelledAt: new Date(), cancellationReason: remarks || "Dismissed from Command Center" }),
          ...(action === "CANCEL" && actingEmployeeId && { cancelledById: actingEmployeeId })
        }
      });
    } else if (sourceType === "UNEXCUSED_RECONCILIATION") {
      const reconStatus = action === "RESOLVE" ? "RESOLVED" : action === "CANCEL" ? "CANCELLED" : "UNDER_REVIEW";
      await prisma.attendanceRosterReconciliation.update({
        where: { id: sourceId },
        data: {
          workflowStatus: reconStatus,
          ...(ownerId && { reviewedById: ownerId }),
          // Fix: schema field is reviewNotes, not notes
          ...(remarks && { reviewNotes: remarks }),
          ...(action === "RESOLVE" && actingEmployeeId && { reviewedById: actingEmployeeId })
        }
      });
    }


    // 2. Handle Centralized Workflow Action if requested
    if (action === "WORKFLOW_ACTION" && workflowAction) {
      const wfInstance = await prisma.workflowInstance.findFirst({
        where: { referenceId: sourceId }
      });

      if (!wfInstance) {
        return NextResponse.json(
          { error: "No active workflow instance bound to this escalation item." },
          { status: 400 }
        );
      }

      await prisma.workflowActionHistory.create({
        data: {
          instanceId: wfInstance.id,
          levelNumber: wfInstance.currentLevelNumber,
          action: workflowAction,
          actedBy: user?.name || user?.email || user?.id || "USER",
          remarks: remarks || `Command Center escalation workflow action ${workflowAction}`
        }
      });
    }

    // 3. Record Immutable UserActivityLog for Audit Trail
    await prisma.userActivityLog.create({
      data: {
        userId: user?.id || "SYSTEM",
        action: `ESCALATION_${action}`,
        entityType: "COMMAND_CENTER_ESCALATION",
        entityId: escalationId,
        afterJson: JSON.stringify({
          action,
          ownerId: ownerId || null,
          remarks: remarks || null,
          actedBy: user?.name || user?.email,
          timestamp: new Date().toISOString()
        })
      }
    });

    return NextResponse.json({
      success: true,
      escalationId,
      action,
      updatedStatus,
      actedBy: user?.name || user?.email,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("COMMERCIAL ESCALATION PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update escalation item." },
      { status: 500 }
    );
  }
}
