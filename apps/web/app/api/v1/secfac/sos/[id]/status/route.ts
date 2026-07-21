import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const alertId = params.id;
    const { searchParams } = new URL(req.url);
    const operationType = (searchParams.get("operationType") || "SECURITY_GUARDING") as any;

    const auth = await checkApiAuth(undefined, { requiredOperation: operationType });
    if (auth.error) return auth.error;

    const alert = await prisma.secFacOperationalAlert.findUnique({
      where: { id: alertId },
      include: {
        events: { orderBy: { createdAt: "desc" } },
        dispatchAssignments: {
          orderBy: { attemptNumber: "desc" },
          include: { responder: true, dispatchedBy: true }
        }
      }
    });

    if (!alert) {
      return NextResponse.json({ error: "SOS Alert not found." }, { status: 404 });
    }

    if (alert.operationType !== operationType) {
      return NextResponse.json({ error: "Forbidden: Operation scope mismatch." }, { status: 403 });
    }

    const latestDispatch = alert.dispatchAssignments[0] || null;

    return NextResponse.json({
      alertId: alert.id,
      alertCode: alert.alertCode,
      severity: alert.severity,
      status: alert.status,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedById: alert.acknowledgedById,
      resolvedAt: alert.resolvedAt,
      cancelledAt: alert.cancelledAt,
      metadata: alert.metadata,
      latestDispatch: latestDispatch
        ? {
            dispatchId: latestDispatch.id,
            status: latestDispatch.status,
            responderId: latestDispatch.responderId,
            responderName: latestDispatch.responder
              ? latestDispatch.responder.name
              : null,
            attemptNumber: latestDispatch.attemptNumber,
            dispatchedAt: latestDispatch.dispatchedAt,
            acceptedAt: latestDispatch.acceptedAt,
            arrivedAt: latestDispatch.arrivedAt,
            completedAt: latestDispatch.completedAt
          }
        : null
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/sos/[id]/status error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
