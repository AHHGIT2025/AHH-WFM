import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";
import { getQatarDate } from "../../../../../../lib/roster-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  if (!contractId) {
    return NextResponse.json({ error: "Missing contractId query parameter" }, { status: 400 });
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
    // Check specific scope permissions
    const scopePermission = isSecurity ? "manpower.security.view" : "manpower.fm.view";
    if (!hasPermission(user, scopePermission)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view schedule for this scope." }, { status: 403 });
    }
  }

  // Parse date range
  const startDate = startDateStr ? getQatarDate(startDateStr) : getQatarDate(contract.startDate);
  const endDate = endDateStr ? getQatarDate(endDateStr) : (contract.endDate ? getQatarDate(contract.endDate) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000));

  try {
    const slots = await prisma.rosterRequirementSlot.findMany({
      where: {
        contractId,
        businessDate: { gte: startDate, lte: endDate }
      },
      include: {
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
