import { NextResponse } from "next/server";
import { checkApiAuth, canAccessCompany, getAuthorizedCompanyIds } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import {
  reportIncident,
  promoteOccurrenceToIncident,
  assignIncidentSupervisor,
  transitionIncidentStatus,
  requestIncidentClosure,
  handleIncidentWorkflowAction,
  getIncidentDetails
} from "@/lib/secfac-incident-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const canView =
    isAdminUser(user) ||
    hasPermission(user, "secfac.incidents.view") ||
    hasPermission(user, "secfac.incidents.manage") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.security.manage");

  if (!canView) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission secfac.incidents.view" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const details = await getIncidentDetails(id);
    if (!details) {
      return NextResponse.json({ success: false, error: `Incident '${id}' not found` }, { status: 404 });
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
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");
  const type = searchParams.get("type");

  const whereClause: any = { companyId, operationType: "SECURITY_GUARDING" };
  if (siteId) whereClause.siteId = siteId;
  if (status) whereClause.status = status;
  if (severity) whereClause.severity = severity;
  if (type) whereClause.type = type;

  const incidents = await prisma.secfacIncident.findMany({
    where: whereClause,
    include: {
      site: { select: { id: true, name: true, code: true } },
      checkpoint: { select: { id: true, checkpointName: true, checkpointCode: true } },
      reportedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: { incidentDate: "desc" }
  });

  return NextResponse.json({ success: true, data: incidents });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const canReport =
    isAdminUser(user) ||
    hasPermission(user, "secfac.incidents.report") ||
    hasPermission(user, "secfac.incidents.manage") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.security.manage");

  if (!canReport) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission secfac.incidents.report" },
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

    const incident = await reportIncident({
      companyId: resolvedCompanyId,
      siteId: body.siteId,
      checkpointId: body.checkpointId,
      reportedById: user.employeeId || user.id,
      source: body.source || "MOBILE_APP",
      type: body.type || "INCIDENT",
      category: body.category || "OTHER",
      severity: body.severity || "MINOR",
      title: body.title,
      description: body.description,
      immediateAction: body.immediateAction,
      incidentDate: body.incidentDate,
      assignedToId: body.assignedToId,
      sosAlertId: body.sosAlertId,
      dispatchAssignmentId: body.dispatchAssignmentId,
      idempotencyKey: body.idempotencyKey
    });

    return NextResponse.json({ success: true, data: incident }, { status: 201 });
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
    hasPermission(user, "secfac.incidents.manage") ||
    hasPermission(user, "manpower.security.manage");
  const canClose =
    canManage ||
    hasPermission(user, "secfac.incidents.close");

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "promote" || action === "assign" || action === "transition") {
      if (!canManage) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Missing permission secfac.incidents.manage" },
          { status: 403 }
        );
      }
    } else if (action === "request_closure" || action === "workflow_action") {
      if (!canClose) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Missing permission secfac.incidents.close" },
          { status: 403 }
        );
      }
    }

    if (action === "promote") {
      if (!body.incidentId) {
        return NextResponse.json({ success: false, error: "incidentId is required for promote action" }, { status: 400 });
      }
      const updated = await promoteOccurrenceToIncident({
        incidentId: body.incidentId,
        performedById: user.employeeId || user.id,
        remarks: body.remarks,
        category: body.category,
        severity: body.severity
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "assign") {
      if (!body.incidentId || !body.assignedToId) {
        return NextResponse.json({ success: false, error: "incidentId and assignedToId are required for assign action" }, { status: 400 });
      }
      const updated = await assignIncidentSupervisor({
        incidentId: body.incidentId,
        assignedToId: body.assignedToId,
        performedById: user.employeeId || user.id,
        remarks: body.remarks
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "transition") {
      if (!body.incidentId || !body.targetStatus) {
        return NextResponse.json({ success: false, error: "incidentId and targetStatus are required for transition action" }, { status: 400 });
      }
      const updated = await transitionIncidentStatus({
        incidentId: body.incidentId,
        targetStatus: body.targetStatus,
        performedById: user.employeeId || user.id,
        remarks: body.remarks
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "request_closure") {
      if (!body.incidentId || !body.closureReason) {
        return NextResponse.json({ success: false, error: "incidentId and closureReason are required for request_closure action" }, { status: 400 });
      }
      const result = await requestIncidentClosure({
        incidentId: body.incidentId,
        closedById: user.employeeId || user.id,
        closureReason: body.closureReason
      });
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "workflow_action") {
      if (!body.incidentId || !body.workflowAction) {
        return NextResponse.json({ success: false, error: "incidentId and workflowAction (APPROVE/RETURN/REJECT) are required" }, { status: 400 });
      }
      const updated = await handleIncidentWorkflowAction({
        incidentId: body.incidentId,
        action: body.workflowAction,
        performerId: user.employeeId || user.id,
        remarks: body.remarks
      });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}
