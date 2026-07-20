import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { evaluateAlertEscalation } from "@/lib/secfac-alert-escalation";
import { prisma } from "@ahh-wfm/database";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const alert = await prisma.secFacOperationalAlert.findUnique({
    where: { id: params.id },
    select: { id: true, operationType: true }
  });

  if (!alert) {
    return NextResponse.json({ error: "Operational alert not found" }, { status: 404 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: alert.operationType as any,
    requiredPermission: "secfac.alerts.escalate"
  });
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const userId = (auth.session.user as any).id;
    const force = body.force === true || body.reason !== undefined;
    const result = await evaluateAlertEscalation(params.id, {
      force,
      actorUserId: userId,
      forceReason: body.reason || body.note || "Manual escalation request"
    });

    if (!result.success) {
      return NextResponse.json({ error: result.warning || "Escalation failed" }, { status: 400 });
    }

    const updated = await prisma.secFacOperationalAlert.findUnique({
      where: { id: params.id },
      include: { events: { orderBy: { createdAt: "desc" }, take: 5 } }
    });

    return NextResponse.json({ alert: updated, result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Action failed" }, { status: 400 });
  }
}
