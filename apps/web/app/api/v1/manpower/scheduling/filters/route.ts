import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const business = searchParams.get("business");
  const monthStr = searchParams.get("month"); // YYYY-MM

  if (!business) {
    return NextResponse.json({ error: "Missing business query parameter" }, { status: 400 });
  }

  const operationType = business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

  try {
    const clients = await prisma.manpowerClient.findMany({
      where: { operationType },
      orderBy: { name: "asc" }
    });

    const dbContracts = await prisma.manpowerContract.findMany({
      where: { operationType },
      include: {
        manpowerRequirements: true,
        shiftRequirements: true,
        projects: {
          include: {
            sites: {
              where: { operationType }
            }
          }
        }
      },
      orderBy: { contractNumber: "asc" }
    });

    const projects = await prisma.manpowerProject.findMany({
      where: { operationType },
      orderBy: { name: "asc" }
    });

    const sites = await prisma.manpowerSite.findMany({
      where: { operationType },
      orderBy: { name: "asc" }
    });

    // Check if the selected period is locked
    let isPeriodLocked = false;
    if (monthStr) {
      const lock = await prisma.manpowerSchedulingPeriodLock.findFirst({
        where: {
          operationType,
          period: monthStr,
          locked: true
        }
      });
      isPeriodLocked = !!lock;
    }

    const contracts = dbContracts.map(contract => {
      let eligibleSiteCount = 0;
      if (contract.siteId) {
        eligibleSiteCount = 1;
      } else if (contract.eventVenue) {
        eligibleSiteCount = 1;
      } else {
        eligibleSiteCount = contract.projects.reduce((sum, p) => sum + p.sites.length, 0);
      }

      const syncBlockReasons: string[] = [];

      if (contract.status !== "ACTIVE") {
        syncBlockReasons.push("CONTRACT_NOT_ACTIVE");
      }
      if (contract.manpowerRequirements.length === 0) {
        syncBlockReasons.push("NO_EFFECTIVE_MANPOWER_REQUIREMENTS");
      }
      if (contract.shiftRequirements.length === 0) {
        syncBlockReasons.push("NO_ACTIVE_SHIFT_REQUIREMENTS");
      }
      if (eligibleSiteCount === 0) {
        syncBlockReasons.push("NO_ELIGIBLE_SITE");
      }

      if (monthStr) {
        const [year, month] = monthStr.split("-").map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        if (contract.endDate < startOfMonth || contract.startDate > endOfMonth) {
          syncBlockReasons.push("OUTSIDE_CONTRACT_PERIOD");
        }
        if (isPeriodLocked) {
          syncBlockReasons.push("PERIOD_LOCKED");
        }
      }

      return {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        operationType: contract.operationType,
        totalManpowerRequirements: contract.manpowerRequirements.length,
        effectiveManpowerRequirements: contract.manpowerRequirements.length,
        totalShiftRequirements: contract.shiftRequirements.length,
        activeShiftRequirements: contract.shiftRequirements.length,
        eligibleSiteCount,
        syncEligible: syncBlockReasons.length === 0,
        syncBlockReasons
      };
    });

    return NextResponse.json({
      success: true,
      clients,
      contracts,
      projects,
      sites
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load filters" }, { status: 500 });
  }
}
