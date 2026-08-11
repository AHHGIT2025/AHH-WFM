import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";
import {
  createPostOrder,
  publishPostOrder,
  retirePostOrder,
  getGuardActivePostOrders,
  acknowledgePostOrder
} from "@/lib/secfac-post-order-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") || user.companyId || "COMP001";
  const siteId = searchParams.get("siteId");
  const guardMode = searchParams.get("guardMode") === "true";
  const checkpointId = searchParams.get("checkpointId") || undefined;
  const employeeId = searchParams.get("employeeId") || user.employeeId || user.id;

  if (guardMode) {
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
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const body = await request.json();
    const action = body.action || "create";

    if (action === "create") {
      const postOrder = await createPostOrder({
        familyId: body.familyId,
        postOrderCode: body.postOrderCode,
        companyId: body.companyId || user.companyId || "COMP001",
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
