import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType");
  const period = searchParams.get("period");

  if (!operationType || !period) {
    return NextResponse.json({ error: "Missing operationType or period YYYY-MM in query parameters" }, { status: 400 });
  }

  // Validate period format (YYYY-MM)
  const periodRegex = /^\d{4}-\d{2}$/;
  if (!periodRegex.test(period)) {
    return NextResponse.json({ error: "Invalid period format. Use YYYY-MM." }, { status: 400 });
  }

  // Permission checks
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    const scopePermission = operationType === "SECURITY_GUARDING" ? "manpower.security.view" : "manpower.fm.view";
    if (!hasPermission(user, scopePermission)) {
      return NextResponse.json({ error: `Forbidden: You do not have permission to view lock status for ${operationType}.` }, { status: 403 });
    }
  }

  // Scope isolation check
  if (!hasPermission(user, "manpower.admin.full_access")) {
    const accessPermission = operationType === "SECURITY_GUARDING" ? "manpower.security.view" : "manpower.fm.view";
    if (!hasPermission(user, accessPermission)) {
      return NextResponse.json({ error: `Forbidden: Scope isolation mismatch.` }, { status: 403 });
    }
  }

  try {
    const lock = await prisma.manpowerSchedulingPeriodLock.findUnique({
      where: {
        operationType_period: { operationType, period }
      }
    });

    const isLocked = lock ? lock.locked : false;

    return NextResponse.json(
      { success: true, locked: isLocked, lock },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" } }
    );
  } catch (error: any) {
    console.error("GET LOCKS ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch lock status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { operationType, period, locked, unlockReason, companyId } = body;

  if (!operationType || !period) {
    return NextResponse.json({ error: "Missing operationType or period YYYY-MM in request body" }, { status: 400 });
  }

  // Validate period format (YYYY-MM)
  const periodRegex = /^\d{4}-\d{2}$/;
  if (!periodRegex.test(period)) {
    return NextResponse.json({ error: "Invalid period format. Use YYYY-MM." }, { status: 400 });
  }

  const isLocked = locked === undefined ? true : !!locked;
  const permissionToCheck = isLocked ? "manpower.schedule.lock" : "manpower.schedule.unlock";

  // Permission & Scope checks
  if (!hasPermission(user, "manpower.admin.full_access")) {
    if (!hasPermission(user, permissionToCheck)) {
      return NextResponse.json({ error: `Forbidden: You do not have permission to ${isLocked ? "lock" : "unlock"} periods.` }, { status: 403 });
    }
    const scopePermission = operationType === "SECURITY_GUARDING" ? "manpower.security.manage" : "manpower.fm.manage";
    if (!hasPermission(user, scopePermission)) {
      return NextResponse.json({ error: "Forbidden: Scope isolation mismatch." }, { status: 403 });
    }
  }

  // For unlock, reason is mandatory (must be non-empty and non-whitespace)
  if (!isLocked && (!unlockReason || !unlockReason.trim())) {
    return NextResponse.json({ error: "Missing or empty unlockReason in request body when unlocking a period." }, { status: 400 });
  }

  try {
    const existingLock = await prisma.manpowerSchedulingPeriodLock.findUnique({
      where: {
        operationType_period: { operationType, period }
      }
    });

    if (isLocked) {
      if (existingLock && existingLock.locked) {
        return NextResponse.json({ error: "Conflict: Period is already locked", code: "ALREADY_LOCKED" }, { status: 409 });
      }
    } else {
      if (!existingLock) {
        return NextResponse.json({ error: "Lock not found for this period", code: "LOCK_NOT_FOUND" }, { status: 404 });
      }
      if (!existingLock.locked) {
        return NextResponse.json({ error: "Conflict: Period is already unlocked", code: "ALREADY_UNLOCKED" }, { status: 409 });
      }
    }

    const lock = await prisma.$transaction(async (tx) => {
      let resultLock;
      if (existingLock) {
        resultLock = await tx.manpowerSchedulingPeriodLock.update({
          where: { id: existingLock.id },
          data: {
            locked: isLocked,
            lockedById: user.id,
            lockedAt: new Date()
          }
        });
      } else {
        resultLock = await tx.manpowerSchedulingPeriodLock.create({
          data: {
            operationType,
            period,
            locked: isLocked,
            lockedById: user.id,
            lockedAt: new Date()
          }
        });
      }

      // Audit log (inserted in same transaction)
      await tx.userActivityLog.create({
        data: {
          userId: user.id,
          action: isLocked ? "ROSTER_PERIOD_LOCK" : "ROSTER_PERIOD_UNLOCK",
          entityType: "ManpowerSchedulingPeriodLock",
          entityId: resultLock.id,
          afterJson: JSON.stringify({
            operationType,
            period,
            isLocked,
            unlockReason: isLocked ? undefined : unlockReason.trim(),
            companyId,
            operatorId: user.id,
            timestamp: new Date()
          })
        }
      });

      return resultLock;
    });

    return NextResponse.json({ success: true, locked: lock.locked, lock });
  } catch (error: any) {
    console.error("POST LOCKS ERROR:", error);
    return NextResponse.json({ error: error.message || "Failed to set lock state" }, { status: 500 });
  }
}
