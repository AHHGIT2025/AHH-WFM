import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { syncAssignmentToLegacy, transitionPlanningException } from "../../../../../../../../lib/roster-engine";

export async function POST(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  const { assignmentId } = params;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.write") &&
      !hasPermission(user, "manpower.schedule.edit")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to unassign relievers." }, { status: 403 });
  }

  try {
    const relieverAssignment = await prisma.rosterSlotAssignment.findUnique({
      where: { id: assignmentId },
      include: { slot: true }
    });

    if (!relieverAssignment) {
      return NextResponse.json({ error: "Reliever assignment not found" }, { status: 404 });
    }

    if (relieverAssignment.assignmentType !== "RELIEVER") {
      return NextResponse.json({ error: "Bad Request: Assignment is not a RELIEVER assignment" }, { status: 400 });
    }

    if (relieverAssignment.historyStatus !== "ACTIVE") {
      return NextResponse.json({ error: `Conflict: Reliever assignment is not active (status: ${relieverAssignment.historyStatus})` }, { status: 409 });
    }

    const operationType = relieverAssignment.slot.operationType;

    // SG/FM Scope isolation:
    if (!hasPermission(user, "manpower.admin.full_access")) {
      const requiredPermission = operationType === "SECURITY_GUARDING" ? "manpower.security.write" : "manpower.fm.write";
      if (!hasPermission(user, requiredPermission)) {
        return NextResponse.json({ error: "Forbidden: Scope isolation mismatch" }, { status: 403 });
      }
    }

    // Check period lock
    const date = relieverAssignment.slot.businessDate;
    const year = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, "0");
    const period = `${year}-${monthStr}`;

    const lock = await prisma.manpowerSchedulingPeriodLock.findUnique({
      where: {
        operationType_period: { operationType, period }
      }
    });
    if (lock && lock.locked) {
      return NextResponse.json({ error: "Conflict: Period is locked. Action not allowed." }, { status: 409 });
    }

    const exceptionId = relieverAssignment.planningExceptionId;
    if (!exceptionId) {
      return NextResponse.json({ error: "Bad Request: Reliever assignment is not linked to any planning exception" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Cancel the reliever assignment and clear activeCoverageKey
      await tx.rosterSlotAssignment.update({
        where: { id: assignmentId },
        data: {
          historyStatus: "CANCELLED",
          activeCoverageKey: null,
          unassignedById: user.id,
          unassignedAt: new Date(),
          unassignmentReason: "Reliever unassigned by planner"
        }
      });

      // 2. Update exception status back to COVERAGE_REQUIRED
      await transitionPlanningException(
        exceptionId,
        "COVERAGE_REQUIRED",
        { actorId: user.id },
        tx
      );

      // 3. Deactivate legacy projections for this cancelled reliever
      await syncAssignmentToLegacy(assignmentId, tx);

      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "UNASSIGN_RELIEVER",
          entityType: "RosterSlotAssignment",
          entityId: assignmentId,
          afterJson: JSON.stringify({ exceptionId })
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("UNASSIGN RELIEVER ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to unassign reliever" }, { status: 500 });
  }
}
