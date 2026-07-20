import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
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
    requiredPermission: "secfac.alerts.view"
  });
  if (auth.error) return auth.error;

  const events = await prisma.secFacAlertEvent.findMany({
    where: { alertId: params.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ events });
}
