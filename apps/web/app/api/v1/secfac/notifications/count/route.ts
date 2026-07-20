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

    const [pending, claimed, retryScheduled, sent, failed, deadLetter, suppressed] = await Promise.all([
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "PENDING" } }),
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "CLAIMED" } }),
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "RETRY_SCHEDULED" } }),
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "SENT" } }),
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "FAILED" } }),
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "DEAD_LETTER" } }),
      prisma.secFacAlertNotification.count({ where: { operationType: op, status: "SUPPRESSED" } })
    ]);

    return NextResponse.json({
      operationType: op,
      pending,
      claimed,
      retryScheduled,
      sent,
      failed,
      deadLetter,
      suppressed,
      totalActiveQueue: pending + claimed + retryScheduled
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/notifications/count error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
