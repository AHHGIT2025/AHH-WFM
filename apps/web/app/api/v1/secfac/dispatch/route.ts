import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { createDispatchAssignment } from "@/lib/secfac-sos-dispatch-service";
import { prisma } from "@ahh-wfm/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      operationType = "SECURITY_GUARDING",
      alertId,
      responderId,
      siteId,
      acceptanceDeadlineSeconds = 120
    } = body;

    if (!alertId || !responderId) {
      return NextResponse.json({ error: "Missing mandatory alertId or responderId." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.dispatch.create"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const dispatchedById = user.id;

    const dispatch = await createDispatchAssignment({
      operationType: operationType as any,
      alertId,
      responderId,
      dispatchedById,
      siteId,
      acceptanceDeadlineSeconds
    });

    return NextResponse.json({ success: true, dispatch }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/dispatch error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationType = (searchParams.get("operationType") || "SECURITY_GUARDING") as any;
    const alertId = searchParams.get("alertId") || undefined;
    const responderId = searchParams.get("responderId") || undefined;
    const status = searchParams.get("status") || undefined;
    const siteId = searchParams.get("siteId") || undefined;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType,
      requiredPermission: "secfac.dispatch.view"
    });
    if (auth.error) return auth.error;

    const where: any = { operationType };
    if (alertId) where.alertId = alertId;
    if (responderId) where.responderId = responderId;
    if (status) where.status = status;
    if (siteId) where.siteId = siteId;

    const dispatches = await prisma.secFacDispatchAssignment.findMany({
      where,
      orderBy: { dispatchedAt: "desc" },
      include: {
        responder: true,
        dispatchedBy: true,
        alert: true
      }
    });

    return NextResponse.json({ dispatches });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/dispatch error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
