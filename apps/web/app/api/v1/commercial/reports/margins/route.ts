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

    const estimates = await prisma.preContractCostEstimate.findMany({
      where: companyFilter,
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const marginAnalytics = estimates.map((est: any) => {
      const latestVersion = est.versions[0];
      const targetMarginPct = latestVersion?.targetMarginPercentage ? Number(latestVersion.targetMarginPercentage) : 0;
      const totalCost = latestVersion?.totalCost ? Number(latestVersion.totalCost) : 0;
      const sellingPrice = latestVersion?.sellingPrice ? Number(latestVersion.sellingPrice) : 0;

      let marginBand = "HEALTHY";
      if (targetMarginPct < 10) marginBand = "CRITICAL";
      else if (targetMarginPct < 20) marginBand = "WARN";

      return {
        id: est.id,
        title: est.estimateNumber || `Estimate #${est.id.substring(0, 8)}`,
        operationType: est.operationType || "SECURITY_GUARDING",
        totalMonthlyCost: totalCost,
        totalMonthlySellPrice: sellingPrice,
        targetMarginPct,
        marginBand
      };
    });

    const validMargins = marginAnalytics.map((m: any) => m.targetMarginPct);
    const averageMargin = validMargins.length > 0
      ? Math.round((validMargins.reduce((sum: number, val: number) => sum + val, 0) / validMargins.length) * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalCostingsAudited: estimates.length,
        averageMarginPct: averageMargin,
        marginBands: {
          healthy: marginAnalytics.filter((m: any) => m.marginBand === "HEALTHY").length,
          warn: marginAnalytics.filter((m: any) => m.marginBand === "WARN").length,
          critical: marginAnalytics.filter((m: any) => m.marginBand === "CRITICAL").length
        }
      },
      items: marginAnalytics
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch margin analytics." },
      { status: 400 }
    );
  }
}
