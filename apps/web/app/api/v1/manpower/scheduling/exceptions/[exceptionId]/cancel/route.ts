import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { transitionPlanningException, checkEmployeeSchedulingEligibility, syncAssignmentToLegacy } from "../../../../../../../../lib/roster-engine";

export async function POST(
  request: Request,
  { params }: { params: { exceptionId: string } }
) {
  const { exceptionId } = params;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  const user = auth.session?.user;

  // Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.write") &&
      !hasPermission(user, "manpower.schedule.edit")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to cancel exceptions." }, { status: 403 });
  }

  let body = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch (e) {
    // Ignore empty/invalid body
  }
  const { reason } = body as any;

  try {
    const exception = await prisma.rosterPlanningException.findUnique({
      where: { id: exceptionId },
      include: {
        primaryAssignment: {
          include: { slot: true }
        }
      }
    });

    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    const operationType = exception.operationType;

    // SG/FM Scope isolation:
    if (!hasPermission(user, "manpower.admin.full_access")) {
      const requiredPermission = operationType === "SECURITY_GUARDING" ? "manpower.security.write" : "manpower.fm.write";
      if (!hasPermission(user, requiredPermission)) {
        return NextResponse.json({ error: "Forbidden: Scope isolation mismatch" }, { status: 403 });
      }
    }

    // Check period lock
    const date = exception.businessDate || exception.createdAt;
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

    const result = await prisma.$transaction(async (tx) => {
      const eligibility = await checkEmployeeSchedulingEligibility(
        exception.employeeId!,
        exception.slotId!,
        tx
      );

      if (!eligibility.canDeploy) {
        return { success: false, errors: eligibility.errors };
      }

      await transitionPlanningException(
        exceptionId,
        "CANCELLED",
        { actorId: user.id, reason: reason || "Exception cancelled" },
        tx
      );

      if (exception.primaryAssignment) {
        await syncAssignmentToLegacy(exception.primaryAssignmentId!, tx);
      }

      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "CANCEL_EXCEPTION",
          entityType: "RosterPlanningException",
          entityId: exceptionId,
          afterJson: JSON.stringify({ reason })
        }
      });

      return { success: true };
    });

    if (!result.success) {
      return NextResponse.json({ error: "Unprocessable: Primary employee is no longer eligible", details: result.errors }, { status: 422 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("CANCEL EXCEPTION ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel exception" }, { status: 500 });
  }
}
