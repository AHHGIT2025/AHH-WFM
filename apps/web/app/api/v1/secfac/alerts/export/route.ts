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
      { error: "Maximum allowed export date range is 90 days." },
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
      include: { rule: true },
      orderBy: { firstDetectedAt: "desc" }
    });

    const headers = [
      "Alert Reference",
      "Operation Type",
      "Alert Code",
      "Severity",
      "Status",
      "Project ID",
      "Site ID",
      "Employee ID",
      "Source Reference",
      "Assigned Supervisor",
      "Assignment Source",
      "First Detected",
      "Acknowledged At",
      "Action Started At",
      "Resolved At",
      "Dismissed At",
      "Escalation Level",
      "Reminder Count",
      "Ack SLA Overdue",
      "Resolution SLA Overdue",
      "Resolution Note",
      "Dismissal Reason"
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = alerts.map(a => {
      const sla = calculateAlertSlaStatus(a as unknown as SecFacOperationalAlert, a.rule as unknown as SecFacAlertRule);
      return [
        escapeCsv(a.id),
        escapeCsv(a.operationType),
        escapeCsv(a.alertCode),
        escapeCsv(a.severity),
        escapeCsv(a.status),
        escapeCsv(a.projectId),
        escapeCsv(a.siteId),
        escapeCsv(a.employeeId),
        escapeCsv(a.sourceReference || a.sourceId),
        escapeCsv(a.assignedUserId || a.assignedRole),
        escapeCsv(a.assignmentSource),
        escapeCsv(new Date(a.firstDetectedAt).toISOString()),
        escapeCsv(a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString() : null),
        escapeCsv(a.actionStartedAt ? new Date(a.actionStartedAt).toISOString() : null),
        escapeCsv(a.resolvedAt ? new Date(a.resolvedAt).toISOString() : null),
        escapeCsv(a.dismissedAt ? new Date(a.dismissedAt).toISOString() : null),
        escapeCsv(a.escalationLevel),
        escapeCsv(a.reminderCount),
        escapeCsv(sla.acknowledgementOverdue ? "YES" : "NO"),
        escapeCsv(sla.resolutionOverdue ? "YES" : "NO"),
        escapeCsv(a.resolutionNote),
        escapeCsv(a.dismissalReason)
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    // Write audit event
    await prisma.secFacAlertEvent.create({
      data: {
        alertId: "SYSTEM_EXPORT",
        operationType: op,
        eventType: "ALERT_EXPORT_GENERATED",
        performedById: (auth.session.user as any).id,
        note: `Generated alert export for range ${fromDateStr} to ${toDateStr} (${alerts.length} records)`
      }
    });

    const filename = `secfac_alerts_${op.toLowerCase()}_${fromDateStr}_to_${toDateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/alerts/export error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
