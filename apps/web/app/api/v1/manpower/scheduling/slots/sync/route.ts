import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../../lib/permissions";
import { getQatarDate, syncSlotsForContractRange } from "../../../../../../../lib/roster-engine";

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.sync") &&
      !hasPermission(user, "manpower.schedule.manage")) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to sync slots." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contractId, startDate: startDateStr, endDate: endDateStr } = body;

  if (!contractId || contractId === "all") {
    return NextResponse.json({ error: "A specific active contract is required to synchronize slots.", code: "CONTRACT_REQUIRED" }, { status: 400 });
  }

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: "Missing startDate or endDate in request body." }, { status: 400 });
  }

  const contract = await prisma.manpowerContract.findUnique({
    where: { id: contractId }
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found", code: "CONTRACT_NOT_FOUND" }, { status: 404 });
  }

  // Security & Isolation checks
  const isSecurity = contract.operationType === "SECURITY_GUARDING";
  const requiredPermission = isSecurity ? "manpower.security.contracts.manage" : "manpower.fm.contracts.manage";
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, requiredPermission)) {
    return NextResponse.json({ error: "Forbidden: Cross-scope scope violation." }, { status: 403 });
  }

  // 1. Validate contract status
  if (contract.status !== "ACTIVE") {
    return NextResponse.json({ error: "Contract is not active.", code: "CONTRACT_NOT_ACTIVE" }, { status: 422 });
  }

  // 2. Validate period lock
  const startPeriod = startDateStr.slice(0, 7);
  const endPeriod = endDateStr.slice(0, 7);
  const lock = await prisma.manpowerSchedulingPeriodLock.findFirst({
    where: {
      operationType: contract.operationType,
      period: { in: [startPeriod, endPeriod] },
      locked: true
    }
  });

  if (lock) {
    return NextResponse.json({
      error: `Conflict: Period ${lock.period} is locked for scheduling.`,
      code: "PERIOD_LOCKED"
    }, { status: 409 });
  }

  // 3. Validate contract effective period intersection
  const startDate = getQatarDate(startDateStr);
  const endDate = getQatarDate(endDateStr);
  if (endDate < contract.startDate || startDate > contract.endDate) {
    return NextResponse.json({
      error: "Selected month is outside the contract effective date range.",
      code: "OUTSIDE_CONTRACT_PERIOD"
    }, { status: 422 });
  }

  // 4. Resolve eligible project/site allocations and count
  let eligibleSiteCount = 0;
  if (contract.siteId) {
    eligibleSiteCount = 1;
  } else if (contract.eventVenue) {
    eligibleSiteCount = 1;
  } else {
    const projectsWithSites = await prisma.manpowerProject.findMany({
      where: { contractId },
      include: { sites: { where: { operationType: contract.operationType } } }
    });
    eligibleSiteCount = projectsWithSites.reduce((sum, p) => sum + p.sites.length, 0);
  }

  if (eligibleSiteCount === 0) {
    return NextResponse.json({
      error: "Contract contains no eligible project/site allocations or event location.",
      code: "NO_ELIGIBLE_SITE"
    }, { status: 422 });
  }

  // 5. Validate manpower requirements
  const manpowerCount = await prisma.contractManpowerRequirement.count({
    where: { contractId }
  });
  if (manpowerCount === 0) {
    return NextResponse.json({
      error: "Contract has no manpower requirements.",
      code: "NO_EFFECTIVE_MANPOWER_REQUIREMENTS"
    }, { status: 422 });
  }

  // 6. Validate shift requirements
  const shiftCount = await prisma.contractShiftRequirement.count({
    where: { contractId }
  });
  if (shiftCount === 0) {
    return NextResponse.json({
      error: "Contract has no active shift requirements.",
      code: "NO_ACTIVE_SHIFT_REQUIREMENTS"
    }, { status: 422 });
  }

  try {
    const result = await syncSlotsForContractRange(contractId, startDate, endDate);

    const totalActiveSlots = await prisma.rosterRequirementSlot.count({
      where: {
        contractId,
        businessDate: { gte: startDate, lte: endDate },
        fulfillmentStatus: { not: "CANCELLED" }
      }
    });
    const slotsExisting = Math.max(0, totalActiveSlots - result.generated);

    return NextResponse.json({
      success: true,
      contractsEvaluated: 1,
      sitesEvaluated: eligibleSiteCount,
      slotsCreated: result.generated,
      slotsExisting,
      slotsCancelled: result.cancelled,
      exceptionsCreated: result.exceptions.length,
      skippedReasons: []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to synchronize slots" }, { status: 500 });
  }
}
