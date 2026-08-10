import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { hasPermission } from "../../../../../../lib/permissions";

export async function GET(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "commercial.reports.view"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const canCrossCompany = hasPermission(user, "precontract.proposal.crossCompany") || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || hasPermission(user, "manpower.admin.full_access");
    
    const companyFilter = (!canCrossCompany && user.companyId) ? { companyId: user.companyId } : {};

    const cases = await prisma.preContractCase.findMany({
      where: companyFilter,
      include: {
        surveys: true,
        costEstimates: true,
        proposals: {
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              include: { clientResponse: true }
            }
          }
        }
      }
    });

    const totalCases = cases.length;
    const surveysCompleted = cases.filter(c => c.surveys.length > 0).length;
    const costingsCompleted = cases.filter(c => c.costEstimates.length > 0).length;
    const proposalsIssued = cases.filter(c => c.proposals.some(p => p.status === "ISSUED_TO_CLIENT" || p.status === "ACCEPTED" || p.status === "REJECTED")).length;
    const accepted = cases.filter(c => c.businessOutcome === "WON" || c.proposals.some(p => p.status === "ACCEPTED")).length;
    const rejected = cases.filter(c => c.businessOutcome === "LOST" || c.proposals.some(p => p.status === "REJECTED")).length;

    const pipelineFunnel = {
      enquiries: totalCases,
      surveysCompleted,
      costingsCompleted,
      proposalsIssued,
      accepted,
      rejected
    };

    const winRate = (accepted + rejected) > 0
      ? Math.round((accepted / (accepted + rejected)) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalCases,
        winRatePercentage: winRate,
        pipelineFunnel
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch pipeline analytics." },
      { status: 400 }
    );
  }
}
