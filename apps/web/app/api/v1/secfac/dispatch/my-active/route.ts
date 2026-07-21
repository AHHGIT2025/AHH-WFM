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

    const responderId = auth.session.user.id;

    const dispatch = await prisma.secFacDispatchAssignment.findFirst({
      where: {
        responderId,
        status: { in: ["PENDING_ACCEPTANCE", "ACCEPTED", "ARRIVED"] }
      },
      orderBy: { dispatchedAt: "desc" },
      include: {
        alert: true,
        dispatchedBy: true
      }
    });

    return NextResponse.json({ activeDispatch: dispatch || null });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/dispatch/my-active error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
