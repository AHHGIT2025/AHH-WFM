import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { assignOperationalAlert } from "@/lib/secfac-alert-service";
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
    requiredPermission: "secfac.alerts.manage"
  });
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const { targetUserId, note } = body;
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    const userId = (auth.session.user as any).id;
    const updated = await assignOperationalAlert(params.id, targetUserId, userId, note);
    return NextResponse.json({ alert: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Action failed" }, { status: 400 });
  }
}
