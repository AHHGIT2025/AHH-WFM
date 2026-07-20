import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { manualRetryNotification } from "@/lib/secfac-notification-outbox";

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
    requiredPermission: "secfac.notifications.retry"
  });
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { reason, forceOverride } = body;

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "Reason is required for manual notification retry." }, { status: 400 });
  }

  try {
    const result = await manualRetryNotification(
      params.id,
      (auth.session.user as any).id,
      reason.trim(),
      !!forceOverride
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ notificationId: params.id, message: result.message });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/notifications/[id]/retry error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
