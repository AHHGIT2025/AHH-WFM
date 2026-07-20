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
    const op = operationTypeParam as any;
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");
    const alertCode = searchParams.get("alertCode");
    const recipientUserId = searchParams.get("recipientUserId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
    const skip = (Math.max(page, 1) - 1) * pageSize;

    const where: any = { operationType: op };
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (recipientUserId) where.recipientUserId = recipientUserId;
    if (alertCode) {
      where.alert = { alertCode };
    }

    const [total, notifications] = await Promise.all([
      prisma.secFacAlertNotification.count({ where }),
      prisma.secFacAlertNotification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          alert: {
            select: { id: true, alertCode: true, title: true, severity: true, status: true }
          },
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 3
          }
        }
      })
    ]);

    return NextResponse.json({
      operationType: op,
      notifications,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/notifications error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
