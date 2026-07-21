import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { acknowledgeSosAlert } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const alertId = params.id;
    const body = await req.json().catch(() => ({}));
    const operationType = (body.operationType || "SECURITY_GUARDING") as any;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType,
      requiredPermission: "secfac.sos.acknowledge"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const result = await acknowledgeSosAlert(alertId, user.id, operationType);

    return NextResponse.json({ success: true, alert: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/sos/[id]/acknowledge error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
