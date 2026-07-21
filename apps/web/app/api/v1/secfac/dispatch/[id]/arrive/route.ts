import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { arriveDispatchAssignment } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const dispatchId = params.id;
    const body = await req.json();
    const { operationType = "SECURITY_GUARDING", latitude, longitude, accuracyMeters } = body;

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.dispatch.arrive"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const responderId = user.id;

    const result = await arriveDispatchAssignment(dispatchId, responderId, latitude, longitude, accuracyMeters);

    return NextResponse.json({ success: true, dispatch: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/dispatch/[id]/arrive error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
