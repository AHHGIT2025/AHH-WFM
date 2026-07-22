import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { getQatarDate } from "../../../../../../lib/roster-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const business = searchParams.get("business");
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const monthStr = searchParams.get("month"); // YYYY-MM

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
      return NextResponse.json({ error: "Forbidden: You do not have permission to view schedule for this scope." }, { status: 403 });
    }
  }

  // Parse date range
  let startDate: Date;
  let endDate: Date;

  if (monthStr) {
    const [year, month] = monthStr.split("-").map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    if (contractId && contractId !== "all") {
      const contract = await prisma.manpowerContract.findUnique({ where: { id: contractId } });
      startDate = startDateStr ? getQatarDate(startDateStr) : getQatarDate(contract!.startDate);
      endDate = endDateStr ? getQatarDate(endDateStr) : (contract!.endDate ? getQatarDate(contract!.endDate) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000));
    } else {
      startDate = startDateStr ? getQatarDate(startDateStr) : new Date();
      endDate = endDateStr ? getQatarDate(endDateStr) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  try {
    const slots = await prisma.rosterRequirementSlot.findMany({
      where: {
        ...contractFilter,
        businessDate: { gte: startDate, lte: endDate }
      },
      include: {
        contract: {
          select: {
            title: true,
            contractNumber: true
          }
        },
        assignments: {
          where: { historyStatus: "ACTIVE" },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                employeeCategory: true,
                designation: { select: { name: true, code: true } }
              }
            }
          }
        }
      },
      orderBy: [
        { businessDate: "asc" },
        { shiftKey: "asc" },
        { slotIndex: "asc" }
      ]
    });

    return NextResponse.json({ success: true, slots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch roster slots" }, { status: 500 });
  }
}
