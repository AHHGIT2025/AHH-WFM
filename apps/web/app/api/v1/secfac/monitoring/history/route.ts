import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("operationType") || "SECURITY_GUARDING";
  const snapshotType = searchParams.get("snapshotType") || undefined;
  const healthStatus = searchParams.get("healthStatus") || undefined;
  const severity = searchParams.get("severity") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const where: any = { operationType: op };
    if (snapshotType) where.snapshotType = snapshotType;
    if (healthStatus) where.healthStatus = healthStatus;
    if (severity) where.severity = severity;

    const [snapshots, totalCount] = await Promise.all([
      prisma.secFacMonitoringSnapshot.findMany({
        where,
        orderBy: { capturedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.secFacMonitoringSnapshot.count({ where })
    ]);

    return NextResponse.json({
      snapshots,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/monitoring/history error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
