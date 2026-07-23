import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { getQatarDateString } from "../../../../../../lib/roster-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const monthStr = searchParams.get("month"); // Format: YYYY-MM
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const business = searchParams.get("business");

  if (!monthStr && (!startDateStr || !endDateStr)) {
    return NextResponse.json({ error: "Missing month or startDate/endDate query parameters" }, { status: 400 });
  }

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;

  let operationType: string;
  let contractFilter: any = {};

  if (contractId && contractId !== "all") {
    const contract = await prisma.manpowerContract.findUnique({
      where: { id: contractId }
    });
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    operationType = contract.operationType;
    contractFilter = { contractId };
  } else {
    if (!business) {
      return NextResponse.json({ error: "Missing business or contractId query parameter" }, { status: 400 });
    }
    operationType = business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";
    contractFilter = { contract: { status: "ACTIVE", operationType } };
  }

  // Security & Isolation checks
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    const scopePermission = operationType === "SECURITY_GUARDING" ? "manpower.security.view" : "manpower.fm.view";
    if (!hasPermission(user, scopePermission)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view coverage metrics." }, { status: 403 });
    }
  }

  try {
    let startDate: Date;
    let endDate: Date;
    let periodLocked = false;

    if (monthStr) {
      const [year, month] = monthStr.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
      
      const lock = await prisma.manpowerSchedulingPeriodLock.findFirst({
        where: {
          operationType,
          period: monthStr,
          locked: true
        }
      });
      periodLocked = !!lock;
    } else {
      startDate = new Date(startDateStr!);
      endDate = new Date(endDateStr!);
      endDate.setHours(23, 59, 59, 999);

      const periodsToCheck = new Set<string>();
      let cursor = new Date(startDate.getTime());
      while (cursor <= endDate) {
        const yr = cursor.getFullYear();
        const mo = String(cursor.getMonth() + 1).padStart(2, "0");
        periodsToCheck.add(`${yr}-${mo}`);
        cursor.setDate(cursor.getDate() + 1);
      }

      for (const p of periodsToCheck) {
        const lock = await prisma.manpowerSchedulingPeriodLock.findFirst({
          where: {
            operationType,
            period: p,
            locked: true
          }
        });
        if (lock) {
          periodLocked = true;
          break;
        }
      }
    }

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: {
        ...contractFilter,
        businessDate: { gte: startDate, lte: endDate },
        fulfillmentStatus: { not: "CANCELLED" }
      },
      include: {
        assignments: {
          where: { historyStatus: "ACTIVE" }
        }
      }
    });

    const dailyMetrics: Record<string, { required: number; filled: number; vacant: number }> = {};

    let initCursor = new Date(startDate.getTime());
    while (initCursor <= endDate) {
      const dateStr = initCursor.toISOString().split("T")[0];
      dailyMetrics[dateStr] = { required: 0, filled: 0, vacant: 0 };
      initCursor.setDate(initCursor.getDate() + 1);
    }

    for (const slot of slots) {
      const dateStr = getQatarDateString(slot.businessDate);
      if (!dailyMetrics[dateStr]) {
        dailyMetrics[dateStr] = { required: 0, filled: 0, vacant: 0 };
      }

      dailyMetrics[dateStr].required++;
      if (slot.assignments.length > 0) {
        dailyMetrics[dateStr].filled++;
      } else {
        dailyMetrics[dateStr].vacant++;
      }
    }

    // Transform to final response format
    const days = Object.entries(dailyMetrics).map(([date, counts]) => {
      const total = counts.required;
      const coveragePercentage = total > 0 ? parseFloat(((counts.filled / total) * 100).toFixed(2)) : 100.0;
      return {
        date,
        requiredCount: counts.required,
        filledCount: counts.filled,
        vacantCount: counts.vacant,
        coveragePercentage
      };
    });

    // Aggregate monthly overview
    const monthlyRequired = slots.length;
    const monthlyFilled = slots.filter(s => s.assignments.length > 0).length;
    const monthlyVacant = monthlyRequired - monthlyFilled;
    const monthlyCoveragePercentage = monthlyRequired > 0 
      ? parseFloat(((monthlyFilled / monthlyRequired) * 100).toFixed(2)) 
      : 100.0;

    return NextResponse.json({
      success: true,
      locked: periodLocked,
      summary: {
        totalSlotsCount: monthlyRequired,
        filledSlotsCount: monthlyFilled,
        vacantSlotsCount: monthlyVacant,
        coveragePercentage: monthlyCoveragePercentage,
        requiredCount: monthlyRequired,
        filledCount: monthlyFilled,
        vacantCount: monthlyVacant,
        days
      }
    });
  } catch (error: any) {
    console.error("[GET /api/v1/manpower/scheduling/coverage Error]", error);
    const userMessage = typeof error?.message === "string" && !error.message.includes("prisma") && !error.message.includes("invocation") && !error.message.includes("database")
      ? error.message
      : "Unable to load coverage data. Please contact the system administrator.";
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
