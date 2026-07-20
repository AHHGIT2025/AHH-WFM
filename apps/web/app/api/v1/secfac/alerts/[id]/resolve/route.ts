import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { resolveOperationalAlert } from "@/lib/secfac-alert-service";
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
    requiredPermission: "secfac.alerts.resolve"
  });
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const userId = (auth.session.user as any).id;
    const updated = await resolveOperationalAlert(params.id, userId, body.note || body.resolutionNote);
    return NextResponse.json({ alert: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Action failed" }, { status: 400 });
  }
}
