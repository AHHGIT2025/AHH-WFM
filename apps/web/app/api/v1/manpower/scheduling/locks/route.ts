import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  // 1. Permission check
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.lock")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to lock periods." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { operationType, period, locked } = body;

  if (!operationType || !period) {
    return NextResponse.json({ error: "Missing operationType or period YYYY-MM in request body" }, { status: 400 });
  }

  // Validate period format (YYYY-MM)
  const periodRegex = /^\d{4}-\d{2}$/;
  if (!periodRegex.test(period)) {
    return NextResponse.json({ error: "Invalid period format. Use YYYY-MM." }, { status: 400 });
  }

  try {
    const isLocked = locked === undefined ? true : !!locked;

    if (!isLocked && !body.unlockReason) {
      return NextResponse.json({ error: "Missing unlockReason in request body when unlocking a period" }, { status: 400 });
    }

    const lock = await prisma.manpowerSchedulingPeriodLock.upsert({
      where: {
        operationType_period: { operationType, period }
      },
      update: {
        locked: isLocked,
        lockedById: user.id,
        lockedAt: new Date()
      },
      create: {
        operationType,
        period,
        locked: isLocked,
        lockedById: user.id,
        lockedAt: new Date()
      }
    });

    // 2. Cascade lock state to slots in this period
    const [year, month] = period.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    if (isLocked) {
      // Transition published slots to LOCKED
      await prisma.rosterRequirementSlot.updateMany({
        where: {
          operationType,
          businessDate: { gte: startDate, lte: endDate },
          scheduleStatus: "PUBLISHED"
        },
        data: { scheduleStatus: "LOCKED" }
      });
    } else {
      // Transition locked slots back to PUBLISHED
      await prisma.rosterRequirementSlot.updateMany({
        where: {
          operationType,
          businessDate: { gte: startDate, lte: endDate },
          scheduleStatus: "LOCKED"
        },
        data: { scheduleStatus: "PUBLISHED" }
      });
    }

    // Write activity log
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: isLocked ? "ROSTER_PERIOD_LOCK" : "ROSTER_PERIOD_UNLOCK",
        entityType: "ManpowerSchedulingPeriodLock",
        entityId: lock.id,
        afterJson: JSON.stringify({ operationType, period, isLocked, unlockReason: body.unlockReason })
      }
    });

    return NextResponse.json({ success: true, lock });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to set lock state" }, { status: 500 });
  }
}
