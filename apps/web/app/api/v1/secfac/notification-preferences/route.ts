import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationTypeParam = searchParams.get("operationType");

  if (!operationTypeParam || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationTypeParam)) {
    return NextResponse.json(
      { error: "Explicit valid operationType parameter ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationTypeParam as any,
    requiredPermission: "secfac.notifications.view"
  });
  if (auth.error) return auth.error;

  try {
    const preferences = await prisma.secFacNotificationPreference.findMany({
      where: { operationType: operationTypeParam as any },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ operationType: operationTypeParam, preferences });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/notification-preferences error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    operationType,
    userId,
    roleCode,
    alertCode,
    inAppEnabled,
    emailEnabled,
    pushEnabled,
    smsEnabled,
    whatsappEnabled,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    timezone,
    minimumSeverity,
    allowCriticalOverride,
    isActive
  } = body;

  if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json({ error: "Explicit valid operationType is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as any,
    requiredPermission: "secfac.notifications.configure"
  });
  if (auth.error) return auth.error;

  try {
    const preference = await prisma.secFacNotificationPreference.create({
      data: {
        operationType,
        userId: userId || null,
        roleCode: roleCode || null,
        alertCode: alertCode || null,
        inAppEnabled: inAppEnabled !== undefined ? !!inAppEnabled : true,
        emailEnabled: !!emailEnabled,
        pushEnabled: !!pushEnabled,
        smsEnabled: !!smsEnabled,
        whatsappEnabled: !!whatsappEnabled,
        quietHoursEnabled: !!quietHoursEnabled,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
        timezone: timezone || "Asia/Qatar",
        minimumSeverity: minimumSeverity || "MEDIUM",
        allowCriticalOverride: allowCriticalOverride !== undefined ? !!allowCriticalOverride : true,
        isActive: isActive !== undefined ? !!isActive : true,
        createdById: (auth.session.user as any).id
      }
    });

    return NextResponse.json({ preference });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/notification-preferences error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
