import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { 
  getQatarDate, 
  getQatarDateString, 
  checkEmployeeSchedulingEligibility, 
  syncAssignmentToLegacy 
} from "@/lib/roster-engine";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  const isSuperOrAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.security.manage") &&
      !hasPermission(user, "security.scheduling.assign") &&
      !hasPermission(user, "manpower.schedule.manage")) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions for range deployment." }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const {
    employeeId,
    contractId,
    projectId,
    siteId,
    shiftRequirementId,
    snapshotPosition,
    snapshotShiftName,
    slotIndex,
    fromDate,
    toDate,
    allowPartial = true,
    requireAll = false,
    previewOnly = false,
    idempotencyKey
  } = body;

  if (!employeeId || (!fromDate && !toDate)) {
    return NextResponse.json({ error: "employeeId and fromDate/toDate date range are required" }, { status: 400 });
  }

  const startStr = fromDate || toDate;
  const endStr = toDate || fromDate;

  const startDate = getQatarDate(startStr);
  const endDate = getQatarDate(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid fromDate or toDate format" }, { status: 400 });
  }

  if (startDate > endDate) {
    return NextResponse.json({ error: "fromDate must be on or before toDate" }, { status: 400 });
  }

  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays > 62) {
    return NextResponse.json({ error: "Date range assignment cannot exceed 62 days" }, { status: 400 });
  }

  // Idempotency check if key supplied
  if (idempotencyKey && !previewOnly) {
    const existingLog = await prisma.userActivityLog.findFirst({
      where: {
        action: "SCHEDULING_RANGE_ASSIGNMENT",
        entityId: idempotencyKey
      }
    });

    if (existingLog && existingLog.afterJson) {
      try {
        const cached = JSON.parse(existingLog.afterJson);
        if (cached.response) {
          return NextResponse.json(cached.response);
        }
      } catch (err) {
        // Fallthrough if parsing fails
      }
    }
  }

  // Build slot query filters
  const slotWhere: any = {
    businessDate: { gte: startDate, lte: endDate },
    fulfillmentStatus: { not: "CANCELLED" }
  };

  if (contractId) slotWhere.contractId = contractId;
  if (projectId) slotWhere.projectId = projectId;
  if (siteId) slotWhere.siteId = siteId;
  if (shiftRequirementId) slotWhere.shiftRequirementId = shiftRequirementId;
  if (slotIndex !== undefined && slotIndex !== null) slotWhere.slotIndex = Number(slotIndex);
  if (snapshotPosition) slotWhere.snapshotPosition = snapshotPosition;
  if (snapshotShiftName) slotWhere.snapshotShiftName = snapshotShiftName;

  // Query matching requirement slots
  const matchingSlots = await prisma.rosterRequirementSlot.findMany({
    where: slotWhere,
    include: {
      contract: { select: { contractNumber: true, operationType: true } },
      site: { select: { id: true, name: true, code: true, isActive: true } },
      project: { select: { id: true, name: true, code: true } },
      assignments: { where: { historyStatus: "ACTIVE" } }
    },
    orderBy: [
      { businessDate: "asc" },
      { slotIndex: "asc" }
    ]
  });

  const shiftReqIds = Array.from(new Set(matchingSlots.map((s) => s.shiftRequirementId).filter(Boolean))) as string[];
  const shiftReqs = shiftReqIds.length > 0
    ? await prisma.manpowerShiftRequirement.findMany({
        where: { id: { in: shiftReqIds } },
        include: { locationUnit: true }
      })
    : [];
  const shiftReqMap = new Map(shiftReqs.map((sr) => [sr.id, sr]));

  // Evaluate period locks in date range
  const periodLocks = await prisma.manpowerSchedulingPeriodLock.findMany({
    where: {
      locked: true
    }
  });

  const isDateLocked = (d: Date) => {
    const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return periodLocks.some((lock) => lock.period === yyyymm);
  };

  const results: any[] = [];
  let eligibleCount = 0;
  let skippedCount = 0;

  for (const slot of matchingSlots) {
    const slotDateStr = getQatarDateString(slot.businessDate);
    const shiftReq = slot.shiftRequirementId ? shiftReqMap.get(slot.shiftRequirementId) : null;
    const postName = shiftReq?.locationUnit?.type === "POST" || shiftReq?.locationUnit?.type === "GATE"
      ? shiftReq.locationUnit.name
      : (shiftReq?.locationUnit?.type === "ZONE" ? shiftReq.locationUnit.name : "Post Not Specified");

    // 1. Period lock check
    if (isDateLocked(slot.businessDate)) {
      results.push({
        date: slotDateStr,
        slotId: slot.id,
        siteName: slot.site?.name || "Site Not Specified",
        postName,
        shiftName: slot.snapshotShiftName,
        slotIndex: slot.slotIndex,
        status: "SKIPPED",
        reasonCode: "PERIOD_LOCKED",
        message: "Scheduling period is locked"
      });
      skippedCount++;
      continue;
    }

    // 2. Site active check
    if (slot.site && slot.site.isActive === false) {
      results.push({
        date: slotDateStr,
        slotId: slot.id,
        siteName: slot.site.name,
        postName,
        shiftName: slot.snapshotShiftName,
        slotIndex: slot.slotIndex,
        status: "SKIPPED",
        reasonCode: "SITE_INACTIVE_OR_BLOCKED",
        message: "Site is inactive"
      });
      skippedCount++;
      continue;
    }

    // 3. Already assigned to this exact slot check
    const isAlreadyAssigned = slot.assignments.some((a: any) => a.employeeId === employeeId);
    if (isAlreadyAssigned) {
      results.push({
        date: slotDateStr,
        slotId: slot.id,
        siteName: slot.site?.name || "Site Not Specified",
        postName,
        shiftName: slot.snapshotShiftName,
        slotIndex: slot.slotIndex,
        status: "SKIPPED",
        reasonCode: "ALREADY_ASSIGNED_THIS_SLOT",
        message: "Employee is already assigned to this slot"
      });
      skippedCount++;
      continue;
    }

    // 4. Detailed scheduling eligibility check
    const evalRes = await checkEmployeeSchedulingEligibility(employeeId, slot.id);
    if (!evalRes.canDeploy) {
      const topError = evalRes.errors[0] || "Eligibility check failed";
      let reasonCode = "ELIGIBILITY_FAILED";
      if (topError.includes("inactive")) reasonCode = "INACTIVE_EMPLOYEE";
      else if (topError.includes("Cross-scope")) reasonCode = "SCOPE_MISMATCH";
      else if (topError.includes("leave")) reasonCode = "APPROVED_LEAVE";
      else if (topError.includes("conflict")) reasonCode = "OVERLAPPING_SHIFT";
      else if (topError.includes("Trade") || topError.includes("Position")) reasonCode = "TRADE_POSITION_MISMATCH";

      results.push({
        date: slotDateStr,
        slotId: slot.id,
        siteName: slot.site?.name || "Site Not Specified",
        postName,
        shiftName: slot.snapshotShiftName,
        slotIndex: slot.slotIndex,
        status: "SKIPPED",
        reasonCode,
        message: topError
      });
      skippedCount++;
    } else {
      results.push({
        date: slotDateStr,
        slotId: slot.id,
        siteName: slot.site?.name || "Site Not Specified",
        postName,
        shiftName: slot.snapshotShiftName,
        slotIndex: slot.slotIndex,
        status: "ELIGIBLE",
        message: "Eligible for deployment"
      });
      eligibleCount++;
    }
  }

  const requestedDates = diffDays;

  // Handle previewOnly mode
  if (previewOnly) {
    return NextResponse.json({
      success: true,
      previewOnly: true,
      requestedDates,
      matchingSlots: matchingSlots.length,
      createdAssignments: 0,
      eligibleAssignments: eligibleCount,
      skippedAssignments: skippedCount,
      results
    });
  }

  // Handle all-or-nothing requirement when partial is disallowed
  const isStrictAll = requireAll || allowPartial === false;
  if (isStrictAll && skippedCount > 0) {
    return NextResponse.json({
      success: false,
      error: `Range deployment requires all dates to be eligible. ${skippedCount} of ${matchingSlots.length} dates were skipped.`,
      requestedDates,
      matchingSlots: matchingSlots.length,
      createdAssignments: 0,
      skippedAssignments: skippedCount,
      results
    }, { status: 400 });
  }

  // Execute assignment creation in single atomic transaction for eligible slots
  const createdAssignmentResults: any[] = [];
  let createdCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of results) {
      if (item.status !== "ELIGIBLE") continue;

      const slotId = item.slotId;
      const slot = matchingSlots.find((s) => s.id === slotId);
      if (!slot) continue;

      // Deactivate any existing active primary assignments for this slot
      await tx.rosterSlotAssignment.updateMany({
        where: { slotId, historyStatus: "ACTIVE" },
        data: { historyStatus: "ENDED" }
      });

      // Create new RosterSlotAssignment
      const newAsg = await tx.rosterSlotAssignment.create({
        data: {
          slotId,
          employeeId,
          assignmentType: "PRIMARY",
          historyStatus: "ACTIVE",
          assignedById: user?.id || "system-scheduler"
        }
      });

      // Update RosterRequirementSlot status
      await tx.rosterRequirementSlot.update({
        where: { id: slotId },
        data: { fulfillmentStatus: "FILLED" }
      });

      // Mirror into legacy tables
      await syncAssignmentToLegacy(newAsg.id, tx);

      item.status = "ASSIGNED";
      item.assignmentId = newAsg.id;
      createdCount++;
      createdAssignmentResults.push(item);
    }

    // Write audit log entry
    const auditPayload = {
      action: "SCHEDULING_RANGE_ASSIGNMENT",
      actorId: user?.id || "system-scheduler",
      employeeId,
      contractId: contractId || matchingSlots[0]?.contractId,
      projectId: projectId || matchingSlots[0]?.projectId,
      siteId: siteId || matchingSlots[0]?.siteId,
      fromDate: startStr,
      toDate: endStr,
      requestedDates,
      matchingSlots: matchingSlots.length,
      createdCount,
      skippedCount,
      idempotencyKey: idempotencyKey || null,
      timestamp: new Date().toISOString()
    };

    await tx.userActivityLog.create({
      data: {
        userId: user?.id || "system-scheduler",
        action: "SCHEDULING_RANGE_ASSIGNMENT",
        entityType: "RosterSlotAssignment",
        entityId: idempotencyKey || `range-asg-${Date.now()}`,
        afterJson: JSON.stringify({
          ...auditPayload,
          response: {
            success: true,
            requestedDates,
            matchingSlots: matchingSlots.length,
            createdAssignments: createdCount,
            skippedAssignments: skippedCount,
            results
          }
        })
      }
    });
  });

  return NextResponse.json({
    success: true,
    requestedDates,
    matchingSlots: matchingSlots.length,
    createdAssignments: createdCount,
    skippedAssignments: skippedCount,
    results
  });
}
