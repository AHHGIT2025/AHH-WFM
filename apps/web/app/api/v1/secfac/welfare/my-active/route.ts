import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationType = searchParams.get("operationType") as any;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType || undefined
    });
    if (auth.error) return auth.error;

    const employeeId = auth.session.user.id;

    const activeCheck = await prisma.secFacWelfareCheck.findFirst({
      where: {
        employeeId,
        status: { in: ["PENDING", "MISSED"] }
      },
      orderBy: { dueAt: "asc" },
      include: { site: true }
    });

    return NextResponse.json({ activeCheck: activeCheck || null });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/welfare/my-active error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
