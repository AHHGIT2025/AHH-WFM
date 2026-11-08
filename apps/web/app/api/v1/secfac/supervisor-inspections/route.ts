import { NextResponse } from "next/server";
import { checkApiAuth, canAccessCompany, getAuthorizedCompanyIds } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import {
  createSupervisorInspection,
  getSupervisorInspectionDetails,
  resolveInspectionFollowUp
} from "@/lib/secfac-supervisor-inspection-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const canView =
    isAdminUser(user) ||
    hasPermission(user, "secfac.inspections.view") ||
    hasPermission(user, "secfac.inspections.manage") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.security.manage");

  if (!canView) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission secfac.inspections.view" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const details = await getSupervisorInspectionDetails(id);
    if (!details) {
      return NextResponse.json({ success: false, error: `Supervisor Inspection '${id}' not found` }, { status: 404 });
    }
    if ((details as any).companyId && !canAccessCompany(user, (details as any).companyId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cross-company access denied" },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, data: details });
  }

  const requestedCompanyId = searchParams.get("companyId");
  if (requestedCompanyId && !canAccessCompany(user, requestedCompanyId)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Cross-company access denied" },
      { status: 403 }
    );
  }

  const isAdmin = isAdminUser(user);
  const authorizedCompanies = getAuthorizedCompanyIds(user);
  const companyId = requestedCompanyId || user.companyId || authorizedCompanies?.[0] || (isAdmin ? "COMP001" : null);
  if (!isAdmin && (!companyId || !canAccessCompany(user, companyId))) {
    return NextResponse.json(
      { success: false, error: "Forbidden: User account has no assigned company scope" },
      { status: 403 }
    );
  }
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
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const canManage =
    isAdminUser(user) ||
    hasPermission(user, "secfac.inspections.manage") ||
    hasPermission(user, "manpower.security.manage");

  if (!canManage) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission secfac.inspections.manage" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    if (body.companyId && !canAccessCompany(user, body.companyId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cross-company access denied" },
        { status: 403 }
      );
    }

    const isAdmin = isAdminUser(user);
    const authorizedCompanies = getAuthorizedCompanyIds(user);
    const resolvedCompanyId = body.companyId || user.companyId || authorizedCompanies?.[0] || (isAdmin ? "COMP001" : null);
    if (!isAdmin && (!resolvedCompanyId || !canAccessCompany(user, resolvedCompanyId))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: User account has no assigned company scope" },
        { status: 403 }
      );
    }

    const inspection = await createSupervisorInspection({
      companyId: resolvedCompanyId,
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
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const canManage =
    isAdminUser(user) ||
    hasPermission(user, "secfac.inspections.manage") ||
    hasPermission(user, "manpower.security.manage");

  if (!canManage) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission secfac.inspections.manage" },
      { status: 403 }
    );
  }

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
