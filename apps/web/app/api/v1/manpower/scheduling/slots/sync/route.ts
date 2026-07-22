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

  if (!contractId) {
    return NextResponse.json({ error: "Missing contractId in request body" }, { status: 400 });
  }

  const contract = await prisma.manpowerContract.findUnique({
    where: { id: contractId }
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Security & Isolation checks
  const isSecurity = contract.operationType === "SECURITY_GUARDING";
  const requiredPermission = isSecurity ? "manpower.security.contracts.manage" : "manpower.fm.contracts.manage";
  if (!hasPermission(user, "manpower.admin.full_access") &&
      !hasPermission(user, requiredPermission)) {
    return NextResponse.json({ error: "Forbidden: Cross-scope scope violation." }, { status: 403 });
  }

  try {
    const startDate = startDateStr ? getQatarDate(startDateStr) : getQatarDate(contract.startDate);
    const endDate = endDateStr ? getQatarDate(endDateStr) : (contract.endDate ? getQatarDate(contract.endDate) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000));

    const result = await syncSlotsForContractRange(contractId, startDate, endDate);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to synchronize slots" }, { status: 500 });
  }
}
