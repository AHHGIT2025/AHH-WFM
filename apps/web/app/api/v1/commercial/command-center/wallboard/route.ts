import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { getQatarDateString } from "@/lib/roster-engine";
import { getAttendancePulseAggregations } from "@/lib/attendance-helpers";
import { getRosterCoverageAggregations } from "@/lib/roster-coverage-helpers";
import { getEscalationAggregations } from "@/lib/escalation-helpers";
import { getCommercialHealthAggregations } from "@/lib/commercial-health-helpers";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const isAuthorized =
    isAdminUser(user) ||
    hasPermission(user, "commercial.commandCenter.view") ||
    hasPermission(user, "manpower.admin.full_access") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.fm.view");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view the Commercial Command Center Wallboard." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const businessDateStr = searchParams.get("businessDate") || getQatarDateString(new Date());

  let companyId = searchParams.get("companyId") || undefined;
  if (!isAdminUser(user) && user?.companyId) {
    companyId = user.companyId;
  }

  let operationType = searchParams.get("operationType") || undefined;
  if (!isAdminUser(user) && !hasPermission(user, "manpower.admin.full_access")) {
    const userAllowedSG = user?.operationAccess?.allowedSecurityGuarding ?? true;
    const userAllowedFM = user?.operationAccess?.allowedFacilityManagement ?? true;

    if (!userAllowedSG && userAllowedFM) {
      operationType = "FACILITY_MANAGEMENT";
    } else if (userAllowedSG && !userAllowedFM) {
      operationType = "SECURITY_GUARDING";
    }
  }

  try {
    const [attendancePulse, rosterCoverage, escalationsResult, commercialHealth] = await Promise.all([
      getAttendancePulseAggregations({ companyId, operationType, businessDateStr }),
      getRosterCoverageAggregations({ companyId, operationType, businessDateStr }),
      getEscalationAggregations({ companyId, operationType, businessDateStr, user }),
      getCommercialHealthAggregations({ companyId, operationType, businessDateStr, user })
    ]);

    const primaryKpis = {
      overallHealthScore: commercialHealth.portfolioMetrics.totalActiveContracts > 0
        ? Math.round(
            (commercialHealth.portfolioMetrics.healthyContractsCount / commercialHealth.portfolioMetrics.totalActiveContracts) * 100
          )
        : 100,
      activeContractsCount: commercialHealth.portfolioMetrics.totalActiveContracts,
      overallCoveragePercentage: rosterCoverage.coveragePercentage,
      totalOpenEscalations: escalationsResult.summaryMetrics.totalOpen,
      criticalEscalationsCount: escalationsResult.summaryMetrics.criticalCount,
      relieverReadinessStatus: rosterCoverage.readinessStatus,
      availableStandbyCount: rosterCoverage.availableStandbyCount,
      uncoveredRelieverDemand: rosterCoverage.uncoveredRelieverDemand
    };

    const payload = {
      context: {
        businessDate: businessDateStr,
        operationType: operationType || "ALL",
        companyId: companyId || null,
        scopeIsolation: {
          userRole: user?.role || "USER",
          companyBound: Boolean(user?.companyId)
        }
      },
      primaryKpis,
      attendancePulse,
      rosterCoverage,
      escalationSummary: {
        metrics: escalationsResult.summaryMetrics,
        topCriticalEscalations: escalationsResult.escalations.filter((e) => e.severity === "CRITICAL" || e.severity === "HIGH").slice(0, 10)
      },
      commercialPortfolio: {
        portfolioMetrics: commercialHealth.portfolioMetrics,
        contracts: commercialHealth.contracts.slice(0, 15)
      },
      generatedAt: new Date().toISOString()
    };

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache, no-store, must-revalidate"
      }
    });
  } catch (error: any) {
    console.error("COMMERCIAL COMMAND CENTER WALLBOARD API ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Commercial Command Center Wallboard data." },
      { status: 500 }
    );
  }
}
