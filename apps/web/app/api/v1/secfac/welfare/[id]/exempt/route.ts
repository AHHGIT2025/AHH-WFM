import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { exemptWelfareCheck } from "@/lib/secfac-welfare-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { exemptionType = "SUPERVISOR_OVERRIDE", exemptionReason = "Approved supervisor override." } = body;

    const auth = await checkApiAuth(undefined, {
      requiredPermission: "secfac.welfare.manage"
    });
    if (auth.error) return auth.error;

    const supervisorId = auth.session.user.id;
    const result = await exemptWelfareCheck(params.id, supervisorId, exemptionType, exemptionReason);

    return NextResponse.json({ success: true, check: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/welfare/[id]/exempt error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
