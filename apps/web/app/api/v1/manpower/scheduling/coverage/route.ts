import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { getQatarDateString } from "../../../../../../lib/roster-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const monthStr = searchParams.get("month"); // Format: YYYY-MM

  if (!contractId || !monthStr) {
    return NextResponse.json({ error: "Missing contractId or month query parameter" }, { status: 400 });
  }

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const contract = await prisma.manpowerContract.findUnique({
    where: { id: contractId }
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Security & Isolation checks
  const isSecurity = contract.operationType === "SECURITY_GUARDING";
  const user = auth.session?.user;

  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, "manpower.schedule.view")) {
    const scopePermission = isSecurity ? "manpower.security.view" : "manpower.fm.view";
    if (!hasPermission(user, scopePermission)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view coverage metrics." }, { status: 403 });
    }
  }

  try {
    // Parse year and month
    const [year, month] = monthStr.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: {
        contractId,
        businessDate: { gte: startDate, lte: endDate },
        fulfillmentStatus: { not: "CANCELLED" }
      },
      include: {
        assignments: {
          where: { historyStatus: "ACTIVE" }
        }
      }
    });

    // Group by date
    const dailyMetrics: Record<string, { required: number; filled: number; vacant: number }> = {};

    // Initialize all dates of the month
    const totalDays = new Date(year, month, 0).getDate();
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      dailyMetrics[dateStr] = { required: 0, filled: 0, vacant: 0 };
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
      summary: {
        requiredCount: monthlyRequired,
        filledCount: monthlyFilled,
        vacantCount: monthlyVacant,
        coveragePercentage: monthlyCoveragePercentage
      },
      days
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to calculate coverage metrics" }, { status: 500 });
  }
}
