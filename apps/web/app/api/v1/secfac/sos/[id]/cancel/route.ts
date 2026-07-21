import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { cancelSosAlert } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const alertId = params.id;
    const body = await req.json();
    const { operationType = "SECURITY_GUARDING", reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json({ error: "Mandatory cancellation reason (minimum 5 characters) required." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.sos.cancel"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const result = await cancelSosAlert(alertId, user.id, reason, operationType as any);

    return NextResponse.json({ success: true, alert: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/sos/[id]/cancel error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
