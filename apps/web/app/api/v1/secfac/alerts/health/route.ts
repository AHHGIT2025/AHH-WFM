import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { calculateAlertSlaStatus } from "@/lib/secfac-alert-sla";
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

  try {
    const op = operationTypeParam as any;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      open,
      unassigned,
      adminQueue,
      criticalOpen,
      escalated,
      rulesActive,
      rulesInactive,
      alertsLast24Hours,
      dismissedLast24Hours,
      activeOpenAlerts
    ] = await Promise.all([
      prisma.secFacOperationalAlert.count({ where: { operationType: op, status: "OPEN" } }),
      prisma.secFacOperationalAlert.count({ where: { operationType: op, status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] }, assignedUserId: null } }),
      prisma.secFacOperationalAlert.count({ where: { operationType: op, status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] }, assignmentSource: "ADMIN_QUEUE" } }),
      prisma.secFacOperationalAlert.count({ where: { operationType: op, status: "OPEN", severity: "CRITICAL" } }),
      prisma.secFacOperationalAlert.count({ where: { operationType: op, status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] }, escalationLevel: { gt: 0 } } }),
      prisma.secFacAlertRule.count({ where: { operationType: op, isActive: true } }),
      prisma.secFacAlertRule.count({ where: { operationType: op, isActive: false } }),
      prisma.secFacOperationalAlert.count({ where: { operationType: op, firstDetectedAt: { gte: last24h } } }),
      prisma.secFacOperationalAlert.count({ where: { operationType: op, status: "DISMISSED", dismissedAt: { gte: last24h } } }),
      prisma.secFacOperationalAlert.findMany({
        where: { operationType: op, status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] } },
        include: { rule: true }
      })
    ]);

    let acknowledgementOverdue = 0;
    let resolutionOverdue = 0;

    for (const a of activeOpenAlerts) {
      const sla = calculateAlertSlaStatus(a as unknown as SecFacOperationalAlert, a.rule as unknown as SecFacAlertRule, now);
      if (sla.acknowledgementOverdue) acknowledgementOverdue++;
      if (sla.resolutionOverdue) resolutionOverdue++;
    }

    return NextResponse.json({
      operationType: op,
      open,
      unassigned,
      adminQueue,
      acknowledgementOverdue,
      resolutionOverdue,
      criticalOpen,
      escalated,
      rulesActive,
      rulesInactive,
      alertsLast24Hours,
      dismissedLast24Hours
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/alerts/health error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
