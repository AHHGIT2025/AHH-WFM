import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-provider-signature") || req.headers.get("authorization");
  const expectedSecret = process.env.SECFAC_SMS_WEBHOOK_SECRET;

  if (process.env.SECFAC_SMS_ENABLED !== "true") {
    return NextResponse.json({ error: "SMS provider is disabled." }, { status: 403 });
  }

  if (expectedSecret && signature !== expectedSecret) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { providerMessageId, status, reason } = body;

    if (!providerMessageId) {
      return NextResponse.json({ error: "providerMessageId is required." }, { status: 400 });
    }

    const attempt = await prisma.secFacNotificationAttempt.findFirst({
      where: { providerMessageId },
      include: { notification: true }
    });

    if (!attempt) {
      return NextResponse.json({ message: "No matching attempt found for providerMessageId." }, { status: 200 });
    }

    const mappedStatus = (status || "").toUpperCase() === "DELIVERED" ? "DELIVERED" : "FAILED";

    await prisma.secFacNotificationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: mappedStatus,
        responseMessage: `SMS webhook callback: ${mappedStatus}`,
        errorMessage: reason || null
      }
    });

    return NextResponse.json({ success: true, notificationId: attempt.notificationId });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/notifications/webhooks/sms error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
