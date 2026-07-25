import { NextResponse } from "next/server";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { executeReconciliationRun } from "../../../../../../lib/reconciliation-engine";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.reconciliation.view" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  const { searchParams } = new URL(request.url);
  const business = searchParams.get("business"); // "security-guarding" | "facility-management"
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const contractId = searchParams.get("contractId");
  const siteId = searchParams.get("siteId");
  const detectionOutcome = searchParams.get("detectionOutcome");
  const workflowStatus = searchParams.get("workflowStatus");
  const resolution = searchParams.get("resolution");

  let operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT" = "SECURITY_GUARDING";
  if (business === "facility-management" || business === "FACILITY_MANAGEMENT") {
    operationType = "FACILITY_MANAGEMENT";
  }

  // Enforce Scope Isolation (SG vs FM)
  if (operationType === "SECURITY_GUARDING" && !user?.operationAccess?.allowedSecurityGuarding) {
    return NextResponse.json({ error: "Access Forbidden: User cannot access Security Guarding scope." }, { status: 403 });
  }
  if (operationType === "FACILITY_MANAGEMENT" && !user?.operationAccess?.allowedFacilityManagement) {
    return NextResponse.json({ error: "Access Forbidden: User cannot access Facility Management scope." }, { status: 403 });
  }

  try {
    const businessDate = new Date(`${dateStr}T00:00:00Z`);

    const whereClause: any = {
      operationType,
      businessDate
    };

    if (contractId) whereClause.contractId = contractId;
    if (siteId) whereClause.siteId = siteId;
    if (detectionOutcome) whereClause.detectionOutcome = detectionOutcome;
    if (workflowStatus) whereClause.workflowStatus = workflowStatus;
    if (resolution) whereClause.resolution = resolution;

    const reconciliations = await prisma.attendanceRosterReconciliation.findMany({
      where: whereClause,
      include: {
        contract: { select: { id: true, title: true, contractNumber: true } },
        site: { select: { id: true, name: true, code: true } },
        expectedEmployee: { select: { id: true, name: true } },
        attendanceRecord: true,
        reviewedBy: { select: { id: true, name: true } }
      },
      orderBy: [
        { scheduledStartUtc: "asc" },
        { expectedEmployeeName: "asc" }
      ]
    });

    const recentRun = await prisma.manpowerReconciliationRun.findFirst({
      where: { operationType, businessDate },
      orderBy: { createdAt: "desc" }
    });

    const summary = {
      totalCount: reconciliations.length,
      onTimeCount: reconciliations.filter(r => r.detectionOutcome === "ON_TIME").length,
      lateCount: reconciliations.filter(r => r.detectionOutcome === "LATE").length,
      noCheckInCount: reconciliations.filter(r => r.detectionOutcome === "NO_CHECK_IN").length,
      locationMismatchCount: reconciliations.filter(r => r.detectionOutcome === "LOCATION_MISMATCH").length,
      suppressedCount: reconciliations.filter(r => r.detectionOutcome === "SUPPRESSED").length,
      pendingReviewCount: reconciliations.filter(r => r.workflowStatus === "PENDING_REVIEW").length,
      resolvedCount: reconciliations.filter(r => r.workflowStatus === "RESOLVED").length
    };

    return NextResponse.json({
      success: true,
      businessDate: dateStr,
      operationType,
      scopeOutcome: recentRun?.scopeOutcome || "PROCESSED",
      publicationVersion: recentRun?.publicationId ? 1 : null,
      lastRun: recentRun,
      summary,
      reconciliations
    });
  } catch (error: any) {
    console.error("GET /api/v1/manpower/scheduling/reconciliation Error:", error);
    return NextResponse.json({ error: "Unable to load reconciliation records. Please contact system administrator." }, { status: 500 });
  }
}
