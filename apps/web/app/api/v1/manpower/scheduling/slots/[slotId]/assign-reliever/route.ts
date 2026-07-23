import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { checkEmployeeSchedulingEligibility, syncAssignmentToLegacy, transitionPlanningException } from "../../../../../../../../lib/roster-engine";

export async function POST(
  request: Request,
  { params }: { params: { slotId: string } }
) {
  const { slotId } = params;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.write") &&
      !hasPermission(user, "manpower.schedule.edit")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to assign relievers." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { employeeId, replacesAssignmentId, exceptionId, expectedSlotVersion, overrideReason } = body;

  if (!employeeId || !replacesAssignmentId || !exceptionId) {
    return NextResponse.json({ error: "Missing required fields: employeeId, replacesAssignmentId, exceptionId" }, { status: 400 });
  }

  try {
    const slot = await prisma.rosterRequirementSlot.findUnique({
      where: { id: slotId }
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    // OCC Check
    if (expectedSlotVersion !== undefined && slot.rowVersion !== expectedSlotVersion) {
      return NextResponse.json({ error: "Conflict: Slot has been modified by another user. Please refresh and try again." }, { status: 409 });
    }

    const exception = await prisma.rosterPlanningException.findUnique({
      where: { id: exceptionId }
    });

    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    if (exception.slotId !== slotId || exception.primaryAssignmentId !== replacesAssignmentId) {
      return NextResponse.json({ error: "Bad Request: Exception and primary assignment do not match the specified slot" }, { status: 400 });
    }

    if (exception.status !== "COVERAGE_REQUIRED") {
      return NextResponse.json({ error: `Conflict: Reliever cannot be assigned because exception status is '${exception.status}' (expected 'COVERAGE_REQUIRED')` }, { status: 409 });
    }

    const replacesAssignment = await prisma.rosterSlotAssignment.findUnique({
      where: { id: replacesAssignmentId }
    });

    if (!replacesAssignment) {
      return NextResponse.json({ error: "Primary assignment to replace not found" }, { status: 404 });
    }

    const operationType = slot.operationType;

    // SG/FM Scope isolation:
    if (!hasPermission(user, "manpower.admin.full_access")) {
      const requiredPermission = operationType === "SECURITY_GUARDING" ? "manpower.security.write" : "manpower.fm.write";
      if (!hasPermission(user, requiredPermission)) {
        return NextResponse.json({ error: "Forbidden: Scope isolation mismatch" }, { status: 403 });
      }
    }

    // Check period lock
    const date = slot.businessDate;
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

    // Eligibility check
    const eligibility = await checkEmployeeSchedulingEligibility(employeeId, slotId, prisma);

    if (eligibility.errors.length > 0) {
      return NextResponse.json({ 
        error: "Unprocessable Entity: Employee is not eligible for this slot", 
        details: eligibility.errors 
      }, { status: 422 });
    }

    if (eligibility.warnings.length > 0 && !overrideReason) {
      return NextResponse.json({ 
        error: "Warning: Eligibility warnings exist. An override reason is required to assign.", 
        warnings: eligibility.warnings 
      }, { status: 400 });
    }

    // Transactionally assign reliever
    const newAssignment = await prisma.$transaction(async (tx) => {
      // Increment slot rowVersion
      await tx.rosterRequirementSlot.update({
        where: { id: slotId },
        data: { rowVersion: { increment: 1 } }
      });

      // Create reliever assignment
      const asg = await tx.rosterSlotAssignment.create({
        data: {
          slotId,
          employeeId,
          assignmentType: "RELIEVER",
          historyStatus: "ACTIVE",
          assignedById: user.id,
          activeCoverageKey: exceptionId,
          replacesAssignmentId,
          planningExceptionId: exceptionId,
          validationSnapshot: {
            eligibilityPass: true,
            warnings: eligibility.warnings,
            overrideReason: overrideReason || null,
            checklist: eligibility.checklist
          }
        }
      });

      // Update exception status to RELIEVER_ASSIGNED
      await transitionPlanningException(
        exceptionId,
        "RELIEVER_ASSIGNED",
        { actorId: user.id },
        tx
      );

      // Sync reliever to legacy projections
      await syncAssignmentToLegacy(asg.id, tx);

      // Log activity
      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "ASSIGN_RELIEVER",
          entityType: "RosterSlotAssignment",
          entityId: asg.id,
          afterJson: JSON.stringify({ slotId, employeeId, exceptionId, overrideReason })
        }
      });

      return asg;
    });

    return NextResponse.json({ success: true, assignment: newAssignment });
  } catch (error: any) {
    console.error("ASSIGN RELIEVER ERROR:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Conflict: This exception already has an active reliever assigned." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to assign reliever" }, { status: 500 });
  }
}
