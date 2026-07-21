import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import { auditSecfacDeleteAction } from "@/lib/secfac-delete-audit-service";

export async function POST(
  request: Request,
  { params }: { params: { routeId: string } }
) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "secfac.patrolRoutes.edit" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const routeId = params.routeId;

  try {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Deactivated via Control Room UI";

    const route = await mockDb.getSecfacPatrolRouteById(routeId);
    if (!route) {
      return NextResponse.json({ success: false, error: "Patrol route not found" }, { status: 404 });
    }

    const opType = route.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";

    if (!isAdmin) {
      if (opType === "SECURITY_GUARDING" && operationAccess.allowedSecurityGuarding !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Security Guarding" }, { status: 403 });
      }
      if (opType === "FACILITY_MANAGEMENT" && operationAccess.allowedFacilityManagement !== true) {
        return NextResponse.json({ success: false, error: "Forbidden: Scope access denied for Facility Management" }, { status: 403 });
      }
    }

    let result;
    if (isDbConnected()) {
      result = await prisma.secfacPatrolRoute.update({
        where: { id: routeId },
        data: { isActive: false }
      });
    } else {
      result = await mockDb.updateSecfacPatrolRoute(routeId, { isActive: false });
    }

    await auditSecfacDeleteAction({
      entityType: "PATROL_ROUTE",
      entityId: routeId,
      actionType: "DEACTIVATE",
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      permission: "secfac.patrolRoutes.edit",
      operationType: opType,
      siteId: route.siteId,
      reason,
      resultStatus: "SUCCESS",
      resultMessage: "Patrol route deactivated (isActive = false)"
    });

    return NextResponse.json({ success: true, data: result, message: "Patrol route deactivated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to deactivate patrol route", error: error.message }, { status: 500 });
  }
}
