import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { calculateAlertSlaStatus } from "@/lib/secfac-alert-sla";
import { calculateAlertRuleHealth } from "@/lib/secfac-alert-rollout";
import { SecFacAlertRule, SecFacOperationalAlert } from "@ahh-wfm/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationTypeParam = searchParams.get("operationType");

  if (!operationTypeParam || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationTypeParam)) {
    return NextResponse.json(
      { error: "Explicit valid operationType parameter ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationTypeParam as any,
    requiredPermission: "secfac.alerts.view"
  });
  if (auth.error) return auth.error;

  const fromDateStr = searchParams.get("fromDate");
  const toDateStr = searchParams.get("toDate");

  if (!fromDateStr || !toDateStr) {
    return NextResponse.json(
      { error: "Date range parameters 'fromDate' and 'toDate' are required." },
      { status: 400 }
    );
  }

  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || diffDays < 0) {
    return NextResponse.json({ error: "Invalid date range parameters." }, { status: 400 });
  }

  if (diffDays > 90) {
    return NextResponse.json(
      { error: "Maximum allowed analytics query range is 90 days." },
      { status: 400 }
    );
  }

  try {
    const op = operationTypeParam as any;

    const alerts = await prisma.secFacOperationalAlert.findMany({
      where: {
        operationType: op,
        firstDetectedAt: { gte: fromDate, lte: toDate }
      },
      include: { rule: true }
    });

    const totalGenerated = alerts.length;
    const acknowledged = alerts.filter(a => a.acknowledgedAt !== null).length;
    const resolved = alerts.filter(a => a.status === "RESOLVED").length;
    const dismissed = alerts.filter(a => a.status === "DISMISSED").length;
    const cancelled = alerts.filter(a => a.status === "CANCELLED").length;
    const escalated = alerts.filter(a => a.escalationLevel > 0).length;
    const adminQueueRouted = alerts.filter(a => a.assignmentSource === "ADMIN_QUEUE").length;
    const unassignedCount = alerts.filter(a => a.assignedUserId === null).length;

    const reopenedEventsCount = await prisma.secFacAlertEvent.count({
      where: {
        operationType: op,
        eventType: "ALERT_REOPENED",
        createdAt: { gte: fromDate, lte: toDate }
      }
    });

    // SLA breaches & response time calculations
    let totalAckMins = 0;
    let ackCount = 0;
    let totalResMins = 0;
    let resCount = 0;
    let slaBreachedCount = 0;

    const codeCounts: Record<string, number> = {};
    const dismissedCodeCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};
    const siteCounts: Record<string, number> = {};

    for (const a of alerts) {
      codeCounts[a.alertCode] = (codeCounts[a.alertCode] || 0) + 1;
      if (a.status === "DISMISSED") {
        dismissedCodeCounts[a.alertCode] = (dismissedCodeCounts[a.alertCode] || 0) + 1;
      }
      if (a.projectId) {
        projectCounts[a.projectId] = (projectCounts[a.projectId] || 0) + 1;
      }
      if (a.siteId) {
        siteCounts[a.siteId] = (siteCounts[a.siteId] || 0) + 1;
      }

      if (a.acknowledgedAt) {
        const diff = (new Date(a.acknowledgedAt).getTime() - new Date(a.firstDetectedAt).getTime()) / (60 * 1000);
        if (diff >= 0) {
          totalAckMins += diff;
          ackCount++;
        }
      }

      if (a.resolvedAt) {
        const diff = (new Date(a.resolvedAt).getTime() - new Date(a.firstDetectedAt).getTime()) / (60 * 1000);
        if (diff >= 0) {
          totalResMins += diff;
          resCount++;
        }
      }

      const sla = calculateAlertSlaStatus(a as unknown as SecFacOperationalAlert, a.rule as unknown as SecFacAlertRule);
      if (sla.breachedSlaType) {
        slaBreachedCount++;
      }
    }

    // Evaluate health of active rules for fatigue indicators
    const rules = await prisma.secFacAlertRule.findMany({ where: { operationType: op, isActive: true } });
    const ruleHealthList = await Promise.all(
      rules.map(r => calculateAlertRuleHealth(r.id, Math.max(1, Math.round(diffDays))))
    );

    const highNoiseRules = ruleHealthList.filter(rh => rh.health === "HIGH_NOISE" || rh.health === "REVIEW");

    return NextResponse.json({
      operationType: op,
      dateRange: { fromDate, toDate, days: Math.round(diffDays) },
      metrics: {
        totalGenerated,
        acknowledged,
        resolved,
        dismissed,
        cancelled,
        escalated,
        reopened: reopenedEventsCount,
        adminQueueRouted,
        unassignedCount,
        averageAcknowledgementMinutes: ackCount > 0 ? Math.round(totalAckMins / ackCount) : null,
        averageResolutionMinutes: resCount > 0 ? Math.round(totalResMins / resCount) : null,
        slaBreachedCount
      },
      breakdowns: {
        mostFrequentAlertCodes: Object.entries(codeCounts).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5),
        mostDismissedAlertCodes: Object.entries(dismissedCodeCounts).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5),
        projectDistribution: projectCounts,
        siteDistribution: siteCounts
      },
      alertFatigueIndicators: {
        totalActiveRules: rules.length,
        highNoiseRulesCount: highNoiseRules.length,
        ruleHealthList
      }
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/alerts/analytics error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
