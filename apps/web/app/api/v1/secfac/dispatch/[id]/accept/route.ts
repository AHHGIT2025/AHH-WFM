import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { acceptDispatchAssignment } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const dispatchId = params.id;
    const body = await req.json().catch(() => ({}));
    const operationType = (body.operationType || "SECURITY_GUARDING") as any;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType,
      requiredPermission: "secfac.dispatch.accept"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const responderId = user.id;

    const result = await acceptDispatchAssignment(dispatchId, responderId);

    return NextResponse.json({ success: true, dispatch: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/dispatch/[id]/accept error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
