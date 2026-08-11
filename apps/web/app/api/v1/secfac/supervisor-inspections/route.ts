import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import {
  createSupervisorInspection,
  getSupervisorInspectionDetails,
  resolveInspectionFollowUp
} from "@/lib/secfac-supervisor-inspection-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const details = await getSupervisorInspectionDetails(id);
    if (!details) {
      return NextResponse.json({ success: false, error: `Supervisor Inspection '${id}' not found` }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: details });
  }

  const companyId = searchParams.get("companyId") || user.companyId || "COMP001";
  const siteId = searchParams.get("siteId");
  const supervisorId = searchParams.get("supervisorId");
  const inspectedEmployeeId = searchParams.get("inspectedEmployeeId");
  const overallResult = searchParams.get("overallResult");

  const whereClause: any = { companyId, operationType: "SECURITY_GUARDING" };
  if (siteId) whereClause.siteId = siteId;
  if (supervisorId) whereClause.supervisorId = supervisorId;
  if (inspectedEmployeeId) whereClause.inspectedEmployeeId = inspectedEmployeeId;
  if (overallResult) whereClause.overallResult = overallResult;

  const inspections = await prisma.secfacSupervisorInspection.findMany({
    where: whereClause,
    include: {
      site: { select: { id: true, name: true, code: true } },
      supervisor: { select: { id: true, name: true, email: true } },
      inspectedEmployee: { select: { id: true, name: true, email: true } },
      checklistExecution: { select: { id: true, status: true } }

    },
    orderBy: { inspectionDate: "desc" }
  });


  return NextResponse.json({ success: true, data: inspections });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json();
    const inspection = await createSupervisorInspection({
      companyId: body.companyId || user.companyId || "COMP001",
      siteId: body.siteId,
      checkpointId: body.checkpointId,
      supervisorId: user.employeeId || user.id,
      inspectedEmployeeId: body.inspectedEmployeeId,
      inspectionDate: body.inspectionDate,
      templateId: body.templateId,
      responses: body.responses || [],
      overallResult: body.overallResult,
      notes: body.notes,
      correctiveAction: body.correctiveAction,
      followUpRequired: body.followUpRequired,
      followUpDueDate: body.followUpDueDate
    });

    return NextResponse.json({ success: true, data: inspection }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json();
    const action = body.action || "resolve_followup";

    if (action === "resolve_followup") {
      if (!body.id || !body.notes) {
        return NextResponse.json({ success: false, error: "Inspection id and resolution notes are required" }, { status: 400 });
      }
      const updated = await resolveInspectionFollowUp(body.id, body.notes, user.employeeId || user.id);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}
