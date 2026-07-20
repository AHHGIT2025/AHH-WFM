import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const notification = await prisma.secFacAlertNotification.findUnique({
    where: { id: params.id }
  });

  if (!notification) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: notification.operationType as any,
    requiredPermission: "secfac.notifications.manage"
  });
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { reason } = body;

  try {
    const updated = await prisma.secFacAlertNotification.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        failureReason: `Cancelled by administrator '${(auth.session.user as any).id}'. Reason: ${reason || "N/A"}`
      }
    });

    await prisma.secFacAlertEvent.create({
      data: {
        alertId: notification.alertId,
        operationType: notification.operationType,
        eventType: "NOTIFICATION_CANCELLED",
        performedById: (auth.session.user as any).id,
        note: `Notification '${params.id}' cancelled. Reason: ${reason || "N/A"}`
      }
    });

    return NextResponse.json({ notification: updated });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/notifications/[id]/cancel error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
