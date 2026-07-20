import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const notification = await prisma.secFacAlertNotification.findUnique({
    where: { id: params.id },
    include: {
      alert: true,
      attempts: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!notification) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: notification.operationType as any,
    requiredPermission: "secfac.notifications.view"
  });
  if (auth.error) return auth.error;

  return NextResponse.json({ notification });
}
