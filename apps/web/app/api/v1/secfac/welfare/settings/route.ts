import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { upsertWelfareSetting } from "@/lib/secfac-welfare-service";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationType = searchParams.get("operationType") as any;
    const companyId = searchParams.get("companyId") || undefined;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType || undefined,
      requiredPermission: "secfac.welfare.view"
    });
    if (auth.error) return auth.error;

    const where: any = {};
    if (operationType) where.operationType = operationType;
    if (companyId) where.companyId = companyId;

    const settings = await prisma.secFacWelfareSetting.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ settings });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/welfare/settings error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      operationType = "SECURITY_GUARDING",
      companyId = "COMP-002",
      projectId,
      siteId,
      postId,
      checkFrequencyMins = 60,
      gracePeriodMins = 10
    } = body;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.welfare.manage"
    });
    if (auth.error) return auth.error;

    const createdById = auth.session.user.id;

    const setting = await upsertWelfareSetting({
      operationType: operationType as any,
      companyId,
      projectId,
      siteId,
      postId,
      checkFrequencyMins,
      gracePeriodMins,
      createdById
    });

    return NextResponse.json({ success: true, setting }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/welfare/settings error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
