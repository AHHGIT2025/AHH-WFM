import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import crypto from "crypto";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { 
  getQatarDate, 
  getQatarDateString, 
  checkEmployeeSchedulingEligibility 
} from "@/lib/roster-engine";

const PREVIEW_SECRET = process.env.MANPOWER_BULK_PREVIEW_SECRET || "ahh-wfm-bulk-deployment-preview-secret-key-2026";

function computeHmac(payload: string): string {
  return crypto.createHmac("sha256", PREVIEW_SECRET).update(payload).digest("hex");
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  const isSuperOrAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.assign")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to assign schedules." }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const {
    operationType,
    contractId,
    mode = "FULL_MONTH", // "SINGLE_DATE" | "DATE_RANGE" | "FULL_MONTH"
    targetMonth, // "YYYY-MM"
    fromDate: fromDateParam,
    toDate: toDateParam,
    targetSeries = [], // Array of { contractId, projectId, siteId, shiftRequirementId, locationUnitId, slotIndex, categoryId }
    employeeIds = [],
    strategy = "AUTO_FILL", // "MANUAL_MAPPING" | "AUTO_FILL"
    mappings = [], // Array of { employeeId, targetSeriesIndex }
    policy = "PARTIAL" // "PARTIAL" | "STRICT"
  } = body;

  if (!operationType || !targetSeries || targetSeries.length === 0 || !employeeIds || employeeIds.length === 0) {
    return NextResponse.json({ error: "operationType, targetSeries, and employeeIds are required" }, { status: 400 });
  }

  // 1. Resolve date range
  let startDate: Date;
  let endDate: Date;
  let periodStr = targetMonth || "";

  if (mode === "SINGLE_DATE") {
    const singleStr = fromDateParam || toDateParam || new Date().toISOString().split("T")[0];
    startDate = getQatarDate(singleStr);
    endDate = getQatarDate(singleStr);
    periodStr = singleStr;
  } else if (mode === "FULL_MONTH") {
    if (!targetMonth) {
      return NextResponse.json({ error: "targetMonth is required for FULL_MONTH mode" }, { status: 400 });
    }
    const [year, month] = targetMonth.split("-").map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    if (!fromDateParam || !toDateParam) {
      return NextResponse.json({ error: "fromDate and toDate are required for DATE_RANGE mode" }, { status: 400 });
    }
    startDate = getQatarDate(fromDateParam);
    endDate = getQatarDate(toDateParam);
    if (startDate > endDate) {
      return NextResponse.json({ error: "fromDate must be on or before toDate" }, { status: 400 });
    }
  }

  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // 2. Enforce Processing Limits
  if (diffDays > 62) {
    return NextResponse.json({ error: "Processing limit exceeded: Date range cannot exceed 62 calendar days" }, { status: 400 });
  }
  if (targetSeries.length > 50) {
    return NextResponse.json({ error: "Processing limit exceeded: Cannot select more than 50 requirement series" }, { status: 400 });
  }
  if (employeeIds.length > 50) {
    return NextResponse.json({ error: "Processing limit exceeded: Cannot select more than 50 employees" }, { status: 400 });
  }

  // Calculate actual candidate combinations based on strategy
  let mappedPairs: { employeeId: string; seriesIndex: number }[] = [];

  if (strategy === "MANUAL_MAPPING") {
    mappedPairs = mappings.map((m: any) => ({
      employeeId: m.employeeId,
      seriesIndex: Number(m.targetSeriesIndex)
    }));
  } else {
    // AUTO_FILL: 1-to-1 matching based on sorted order
    const count = Math.min(targetSeries.length, employeeIds.length);
    for (let i = 0; i < count; i++) {
      mappedPairs.push({
        employeeId: employeeIds[i],
        seriesIndex: i
      });
    }
  }

  const totalCandidates = mappedPairs.length * diffDays;
  if (totalCandidates > 2000) {
    return NextResponse.json({ error: `Processing limit exceeded: Candidate combinations (${totalCandidates}) exceed maximum allowed limit of 2,000` }, { status: 400 });
  }

  // 3. Batch load matching Requirement Slots using stable relational IDs
  const siteIds = Array.from(new Set(targetSeries.map((ts: any) => ts.siteId).filter(Boolean))) as string[];
  const projectIds = Array.from(new Set(targetSeries.map((ts: any) => ts.projectId).filter(Boolean))) as string[];
  const shiftReqIds = Array.from(new Set(targetSeries.map((ts: any) => ts.shiftRequirementId).filter(Boolean))) as string[];

  const matchingSlots = await prisma.rosterRequirementSlot.findMany({
    where: {
      operationType,
      businessDate: { gte: startDate, lte: endDate },
      fulfillmentStatus: { not: "CANCELLED" },
      ...(contractId ? { contractId } : {}),
      ...(siteIds.length > 0 ? { siteId: { in: siteIds } } : {}),
      ...(projectIds.length > 0 ? { projectId: { in: projectIds } } : {}),
      ...(shiftReqIds.length > 0 ? { shiftRequirementId: { in: shiftReqIds } } : {})
    },
    include: {
      contract: { select: { contractNumber: true, operationType: true } },
      site: { select: { id: true, name: true, code: true, isActive: true } },
      project: { select: { id: true, name: true, code: true } },
      assignments: { where: { historyStatus: "ACTIVE" } }
    },
    orderBy: [{ businessDate: "asc" }, { slotIndex: "asc" }]
  });

  // Batch load shift requirements with locationUnits
  const allShiftReqs = shiftReqIds.length > 0
    ? await prisma.manpowerShiftRequirement.findMany({
        where: { id: { in: shiftReqIds } },
        include: { locationUnit: true }
      })
    : [];
  const shiftReqMap = new Map(allShiftReqs.map((sr) => [sr.id, sr]));

  // Batch load employees
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      operationType: true,
      isActive: true,
      employmentStatus: true,
      positionCategory: { select: { id: true, name: true, code: true } },
      designation: { select: { id: true, name: true, code: true } }
    }
  });
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  // Batch load period locks
  const periodLocks = await prisma.manpowerSchedulingPeriodLock.findMany({
    where: { locked: true, operationType }
  });
  const isDateLocked = (d: Date) => {
    const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return periodLocks.some((lock) => lock.period === yyyymm);
  };

  // 4. Evaluate Per-Date Validation Results for candidate combinations
  const results: any[] = [];
  let eligibleCount = 0;
  let skippedCount = 0;

  for (const pair of mappedPairs) {
    const emp = employeeMap.get(pair.employeeId);
    const seriesSpec = targetSeries[pair.seriesIndex];
    if (!seriesSpec) continue;

    // Filter matching slots for this exact series specification
    const seriesSlots = matchingSlots.filter((slot) => {
      if (seriesSpec.siteId && slot.siteId !== seriesSpec.siteId) return false;
      if (seriesSpec.projectId && slot.projectId !== seriesSpec.projectId) return false;
      if (seriesSpec.shiftRequirementId && slot.shiftRequirementId !== seriesSpec.shiftRequirementId) return false;
      if (seriesSpec.slotIndex !== undefined && slot.slotIndex !== Number(seriesSpec.slotIndex)) return false;
      return true;
    });

    const slotsByDateMap = new Map(seriesSlots.map((s) => [getQatarDateString(s.businessDate), s]));

    // Iterate over calendar days in date range
    const curr = new Date(startDate.getTime());
    while (curr <= endDate) {
      const dateStr = getQatarDateString(curr);
      const slot = slotsByDateMap.get(dateStr);

      const shiftReq = seriesSpec.shiftRequirementId ? shiftReqMap.get(seriesSpec.shiftRequirementId) : null;
      const postName = shiftReq?.locationUnit?.name || "Post Not Specified";
      const siteName = slot?.site?.name || "Site Not Specified";
      const shiftName = slot?.snapshotShiftName || "Shift Not Specified";

      if (!emp) {
        results.push({
          date: dateStr,
          employeeId: pair.employeeId,
          employeeName: "Unknown Employee",
          seriesIndex: pair.seriesIndex,
          siteName,
          postName,
          shiftName,
          slotIndex: seriesSpec.slotIndex,
          status: "SKIPPED",
          reasonCode: "EMPLOYEE_NOT_FOUND",
          message: "Employee record not found"
        });
        skippedCount++;
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      if (!slot) {
        results.push({
          date: dateStr,
          employeeId: emp.id,
          employeeName: emp.name,
          seriesIndex: pair.seriesIndex,
          siteName,
          postName,
          shiftName,
          slotIndex: seriesSpec.slotIndex,
          status: "SKIPPED",
          reasonCode: "NO_MATCHING_SLOT",
          message: `No active requirement slot exists for series on ${dateStr}`
        });
        skippedCount++;
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // Check Period Lock
      if (isDateLocked(curr)) {
        results.push({
          date: dateStr,
          slotId: slot.id,
          employeeId: emp.id,
          employeeName: emp.name,
          seriesIndex: pair.seriesIndex,
          siteName,
          postName,
          shiftName,
          slotIndex: slot.slotIndex,
          status: "SKIPPED",
          reasonCode: "PERIOD_LOCKED",
          message: "Scheduling period is locked"
        });
        skippedCount++;
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // Check Site Active status
      if (slot.site && slot.site.isActive === false) {
        results.push({
          date: dateStr,
          slotId: slot.id,
          employeeId: emp.id,
          employeeName: emp.name,
          seriesIndex: pair.seriesIndex,
          siteName: slot.site.name,
          postName,
          shiftName,
          slotIndex: slot.slotIndex,
          status: "SKIPPED",
          reasonCode: "SITE_INACTIVE",
          message: "Site is inactive"
        });
        skippedCount++;
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // Check if slot already filled
      const isAlreadyFilled = slot.assignments.some((a: any) => a.historyStatus === "ACTIVE");
      if (isAlreadyFilled) {
        const isAssignedToSameEmp = slot.assignments.some((a: any) => a.employeeId === emp.id && a.historyStatus === "ACTIVE");
        results.push({
          date: dateStr,
          slotId: slot.id,
          employeeId: emp.id,
          employeeName: emp.name,
          seriesIndex: pair.seriesIndex,
          siteName,
          postName,
          shiftName,
          slotIndex: slot.slotIndex,
          status: "SKIPPED",
          reasonCode: isAssignedToSameEmp ? "ALREADY_ASSIGNED" : "SLOT_ALREADY_FILLED",
          message: isAssignedToSameEmp ? "Employee is already assigned to this slot" : "Slot is already filled by another employee"
        });
        skippedCount++;
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // Detailed eligibility check
      const evalRes = await checkEmployeeSchedulingEligibility(emp.id, slot.id);
      if (!evalRes.canDeploy) {
        const topError = evalRes.errors[0] || "Eligibility check failed";
        let reasonCode = "ELIGIBILITY_FAILED";
        if (topError.includes("inactive")) reasonCode = "INACTIVE_EMPLOYEE";
        else if (topError.includes("Cross-scope")) reasonCode = "SCOPE_MISMATCH";
        else if (topError.includes("leave")) reasonCode = "APPROVED_LEAVE";
        else if (topError.includes("conflict")) reasonCode = "EMPLOYEE_OVERLAP";
        else if (topError.includes("Trade") || topError.includes("Position")) reasonCode = "POSITION_MISMATCH";

        results.push({
          date: dateStr,
          slotId: slot.id,
          employeeId: emp.id,
          employeeName: emp.name,
          seriesIndex: pair.seriesIndex,
          siteName,
          postName,
          shiftName,
          slotIndex: slot.slotIndex,
          status: "SKIPPED",
          reasonCode,
          message: topError
        });
        skippedCount++;
      } else {
        results.push({
          date: dateStr,
          slotId: slot.id,
          employeeId: emp.id,
          employeeName: emp.name,
          seriesIndex: pair.seriesIndex,
          siteName,
          postName,
          shiftName,
          slotIndex: slot.slotIndex,
          status: "ELIGIBLE",
          message: "Eligible for deployment"
        });
        eligibleCount++;
      }

      curr.setDate(curr.getDate() + 1);
    }
  }

  const unfilledSeriesCount = Math.max(0, targetSeries.length - mappedPairs.length);
  const unusedEmployeeCount = Math.max(0, employeeIds.length - mappedPairs.length);

  // 5. Create Server-Side ManpowerBulkOperationLog record
  const requestBodyStr = JSON.stringify(body);
  const requestHash = crypto.createHash("sha256").update(requestBodyStr).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes short-lived preview token

  const rawTokenId = `prev-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  const previewTokenHash = crypto.createHash("sha256").update(rawTokenId).digest("hex");

  const previewPayload = {
    mode,
    period: periodStr,
    fromDate: startDate.toISOString().split("T")[0],
    toDate: endDate.toISOString().split("T")[0],
    requestedCount: totalCandidates,
    matchingVacantSlots: matchingSlots.length,
    eligibleCount,
    skippedCount,
    unfilledSeriesCount,
    unusedEmployeeCount,
    targetSeriesCount: targetSeries.length,
    employeeCount: employeeIds.length,
    strategy,
    policy,
    results
  };

  await prisma.manpowerBulkOperationLog.create({
    data: {
      previewTokenHash,
      requestHash,
      actorId: user.id,
      operationType,
      mode,
      strategy,
      policy,
      status: "PREVIEWED",
      period: periodStr,
      fromDate: startDate,
      toDate: endDate,
      requestedCount: totalCandidates,
      createdCount: 0,
      skippedCount,
      failedCount: 0,
      unfilledSeriesCount,
      unusedEmployeeCount,
      requestJson: body,
      previewJson: previewPayload,
      expiresAt
    }
  });

  // Construct HMAC Signed Browser Token
  const tokenBody = `${rawTokenId}:${user.id}:${requestHash}:${expiresAt.getTime()}`;
  const signature = computeHmac(tokenBody);
  const previewToken = Buffer.from(JSON.stringify({
    previewId: rawTokenId,
    actorId: user.id,
    requestHash,
    expiresAt: expiresAt.getTime(),
    sig: signature
  })).toString("base64url");

  return NextResponse.json({
    success: true,
    previewToken,
    preview: previewPayload
  });
}
