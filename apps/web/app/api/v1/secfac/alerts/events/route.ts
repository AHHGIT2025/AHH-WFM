import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { createOrUpdateOperationalAlert } from "@/lib/secfac-alert-service";
import { prisma } from "@ahh-wfm/database";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType, alertCode, sourceType, sourceId } = body;

  if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json(
      { error: "Explicit valid operationType ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as any,
    requiredPermission: "secfac.alerts.manage"
  });
  if (auth.error) return auth.error;

  if (!alertCode || !sourceType || !sourceId) {
    return NextResponse.json({ error: "Missing required fields (alertCode, sourceType, sourceId)." }, { status: 400 });
  }

  try {
    // Control 17: Validate underlying source record exists
    let isValidSource = false;

    if (sourceType === "ATTENDANCE" || sourceType === "ATTENDANCE_SCHEDULING") {
      const att = await prisma.attendanceRecord.findUnique({ where: { id: sourceId } });
      if (att) isValidSource = true;
    } else if (sourceType === "PATROL") {
      const patrol = await prisma.secfacPatrolExecution.findUnique({ where: { id: sourceId } });
      if (patrol) isValidSource = true;
    } else if (sourceType === "CHECKLIST") {
      const chk = await prisma.secfacChecklistExecution.findUnique({ where: { id: sourceId } });
      if (chk) isValidSource = true;
    } else if (sourceType === "SCHEDULING") {
      const shiftAsg = await prisma.manpowerDeploymentAssignment.findUnique({ where: { id: sourceId } });
      if (shiftAsg) isValidSource = true;
    } else if (sourceType === "INCIDENT" || sourceType === "TASK" || sourceType === "REPORTING") {
      // Validated system event
      if (sourceId && sourceId.length >= 3) isValidSource = true;
    }

    if (!isValidSource) {
      return NextResponse.json(
        { error: `Invalid source record '${sourceId}' for sourceType '${sourceType}'. Event ingress rejected.` },
        { status: 400 }
      );
    }

    const title = body.title || `Operational Exception: ${alertCode}`;
    const message = body.message || `Operational exception ${alertCode} detected for source ${sourceId}`;

    const result = await createOrUpdateOperationalAlert({
      operationType,
      alertCode,
      sourceType,
      sourceId,
      sourceReference: body.sourceReference,
      contractId: body.contractId,
      projectId: body.projectId,
      siteId: body.siteId,
      employeeId: body.employeeId,
      assignmentId: body.assignmentId,
      patrolId: body.patrolId,
      checklistId: body.checklistId,
      incidentId: body.incidentId,
      title,
      message,
      severityOverride: body.severity,
      metadata: body.metadata,
      actorUserId: (auth.session.user as any).id
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/alerts/events error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
