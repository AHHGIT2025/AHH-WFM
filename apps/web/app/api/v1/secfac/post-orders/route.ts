import { NextResponse } from "next/server";
import { checkApiAuth, canAccessCompany, getAuthorizedCompanyIds } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import {
  createPostOrder,
  publishPostOrder,
  retirePostOrder,
  getGuardActivePostOrders,
  acknowledgePostOrder
} from "@/lib/secfac-post-order-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);

  const { searchParams } = new URL(request.url);
  const requestedCompanyId = searchParams.get("companyId");
  if (requestedCompanyId && !canAccessCompany(user, requestedCompanyId)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Cross-company access denied" },
      { status: 403 }
    );
  }

  const authorizedCompanies = getAuthorizedCompanyIds(user);
  const companyId = requestedCompanyId || user.companyId || authorizedCompanies?.[0] || (isAdmin ? "COMP001" : null);
  if (!isAdmin && (!companyId || !canAccessCompany(user, companyId))) {
    return NextResponse.json(
      { success: false, error: "Forbidden: User account has no assigned company scope" },
      { status: 403 }
    );
  }
  const siteId = searchParams.get("siteId");
  const guardMode = searchParams.get("guardMode") === "true";
  const checkpointId = searchParams.get("checkpointId") || undefined;
  const sessionEmployeeId = user.employeeId || user.id;
  const requestedEmployeeId = searchParams.get("employeeId");
  const employeeId = requestedEmployeeId || sessionEmployeeId;

  const canViewPostOrders =
    isAdmin ||
    hasPermission(user, "secfac.postOrders.view") ||
    hasPermission(user, "secfac.postOrders.manage") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.security.manage");

  const canManagePostOrders =
    isAdmin ||
    hasPermission(user, "secfac.postOrders.manage") ||
    hasPermission(user, "manpower.security.manage");

  if (!canViewPostOrders && !guardMode) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission secfac.postOrders.view" },
      { status: 403 }
    );
  }

  if (guardMode) {
    if (
      !canViewPostOrders &&
      !hasPermission(user, "manpower.roster.acknowledge") &&
      !hasPermission(user, "attendance.self")
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Not authorized to view guard post orders" },
        { status: 403 }
      );
    }
    if (requestedEmployeeId && requestedEmployeeId !== sessionEmployeeId && !canManagePostOrders) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cannot query post orders for another employee" },
        { status: 403 }
      );
    }
    if (!siteId) {
      return NextResponse.json({ success: false, error: "siteId is required in guardMode" }, { status: 400 });
    }
    const postOrders = await getGuardActivePostOrders({
      employeeId,
      companyId,
      siteId,
      checkpointId
    });
    return NextResponse.json({ success: true, data: postOrders });
  }

  const whereClause: any = { companyId, operationType: "SECURITY_GUARDING" };
  if (siteId) whereClause.siteId = siteId;

  const postOrders = await prisma.secfacPostOrder.findMany({
    where: whereClause,
    include: {
      site: { select: { id: true, name: true, code: true } },
      checkpoint: { select: { id: true, checkpointName: true, checkpointCode: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      publishedBy: { select: { id: true, name: true, email: true } },
      acknowledgements: {
        take: 10,
        orderBy: { acknowledgedAt: "desc" },
        include: {
          employee: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: [{ familyId: "asc" }, { version: "desc" }]
  });

  return NextResponse.json({ success: true, data: postOrders });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const canManagePostOrders =
    isAdmin ||
    hasPermission(user, "secfac.postOrders.manage") ||
    hasPermission(user, "manpower.security.manage");
  const canAcknowledgePostOrders =
    canManagePostOrders ||
    hasPermission(user, "secfac.postOrders.view") ||
    hasPermission(user, "manpower.security.view") ||
    hasPermission(user, "manpower.roster.acknowledge");

  try {
    const body = await request.json();
    const action = body.action || "create";

    if (body.companyId && !canAccessCompany(user, body.companyId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cross-company access denied" },
        { status: 403 }
      );
    }

    if (action === "create" || action === "publish" || action === "retire") {
      if (!canManagePostOrders) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Missing permission secfac.postOrders.manage" },
          { status: 403 }
        );
      }
    } else if (action === "acknowledge") {
      if (!canAcknowledgePostOrders) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Missing permission to acknowledge post orders" },
          { status: 403 }
        );
      }
    }

    if (action === "create") {
      const authorizedCompanies = getAuthorizedCompanyIds(user);
      const resolvedCompanyId = body.companyId || user.companyId || authorizedCompanies?.[0] || (isAdmin ? "COMP001" : null);
      if (!isAdmin && (!resolvedCompanyId || !canAccessCompany(user, resolvedCompanyId))) {
        return NextResponse.json(
          { success: false, error: "Forbidden: User account has no assigned company scope" },
          { status: 403 }
        );
      }
      const postOrder = await createPostOrder({
        familyId: body.familyId,
        postOrderCode: body.postOrderCode,
        companyId: resolvedCompanyId,
        siteId: body.siteId,
        checkpointId: body.checkpointId,
        title: body.title,
        category: body.category,
        content: body.content,
        requiresAcknowledgement: body.requiresAcknowledgement,
        createdById: user.employeeId || user.id
      });
      return NextResponse.json({ success: true, data: postOrder }, { status: 201 });
    }

    if (action === "publish") {
      if (!body.id) {
        return NextResponse.json({ success: false, error: "Post Order id is required for publish action" }, { status: 400 });
      }
      const published = await publishPostOrder(body.id, user.employeeId || user.id);
      return NextResponse.json({ success: true, data: published });
    }

    if (action === "retire") {
      if (!body.id) {
        return NextResponse.json({ success: false, error: "Post Order id is required for retire action" }, { status: 400 });
      }
      const retired = await retirePostOrder(body.id, user.employeeId || user.id);
      return NextResponse.json({ success: true, data: retired });
    }

    if (action === "acknowledge") {
      if (!body.postOrderId) {
        return NextResponse.json({ success: false, error: "postOrderId is required for acknowledge action" }, { status: 400 });
      }
      const ack = await acknowledgePostOrder({
        postOrderId: body.postOrderId,
        employeeId: user.employeeId || user.id,
        deploymentId: body.deploymentId,
        acknowledgementMethod: body.acknowledgementMethod || "MOBILE_APP",
        idempotencyKey: body.idempotencyKey
      });
      return NextResponse.json({ success: true, data: ack });
    }

    return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 400 });
  }
}
