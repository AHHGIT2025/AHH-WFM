import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../../lib/permissions";
import { transitionPlanningException } from "../../../../../../../../lib/roster-engine";

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
    return NextResponse.json({ error: "Forbidden: You do not have permission to resolve exceptions." }, { status: 403 });
  }

  try {
    const exception = await prisma.rosterPlanningException.findUnique({
      where: { id: exceptionId }
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

    await prisma.$transaction(async (tx) => {
      await transitionPlanningException(
        exceptionId,
        "RESOLVED",
        { actorId: user.id },
        tx
      );

      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: "RESOLVE_EXCEPTION",
          entityType: "RosterPlanningException",
          entityId: exceptionId
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("RESOLVE EXCEPTION ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve exception" }, { status: 500 });
  }
}
