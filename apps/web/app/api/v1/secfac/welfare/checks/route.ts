import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationType = searchParams.get("operationType") as any;
    const status = searchParams.get("status") || undefined;
    const siteId = searchParams.get("siteId") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType || undefined,
      requiredPermission: "secfac.welfare.view"
    });
    if (auth.error) return auth.error;

    const where: any = {};
    if (operationType) where.operationType = operationType;
    if (status) where.status = status;
    if (siteId) where.siteId = siteId;
    if (employeeId) where.employeeId = employeeId;

    const checks = await prisma.secFacWelfareCheck.findMany({
      where,
      orderBy: { dueAt: "desc" },
      take: 100,
      include: {
        employee: true,
        site: true,
        alert: true
      }
    });

    return NextResponse.json({ checks });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/welfare/checks error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
