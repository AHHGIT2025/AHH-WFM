import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const alert = await prisma.secFacOperationalAlert.findUnique({
    where: { id: params.id },
    include: {
      rule: true,
      events: { orderBy: { createdAt: "desc" } },
      notifications: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!alert) {
    return NextResponse.json({ error: "Operational alert not found" }, { status: 404 });
  }

  // Operation scope validation: user must have access to alert's operationType
  const auth = await checkApiAuth(undefined, {
    requiredOperation: alert.operationType as any,
    requiredPermission: "secfac.alerts.view"
  });
  if (auth.error) return auth.error;

  return NextResponse.json({ alert });
}
