import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { raiseSosPanicAlert } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      operationType = "SECURITY_GUARDING",
      idempotencyKey,
      siteId,
      latitude,
      longitude,
      accuracyMeters,
      holdDurationMs,
      clientCapturedAt,
      emergencyNotes,
      deviceSessionId
    } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing mandatory idempotencyKey." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const employeeId = user.id;

    const result = await raiseSosPanicAlert({
      operationType: operationType as any,
      employeeId,
      idempotencyKey,
      siteId,
      latitude,
      longitude,
      accuracyMeters,
      holdDurationMs,
      clientCapturedAt: clientCapturedAt || new Date().toISOString(),
      emergencyNotes,
      deviceSessionId
    });

    return NextResponse.json(
      {
        success: true,
        alertId: result.alert.id,
        status: result.alert.status,
        isDuplicate: result.isDuplicate,
        message: result.isDuplicate ? "Duplicate SOS event recognized." : "SOS panic alert received by server."
      },
      { status: result.isDuplicate ? 200 : 201 }
    );
  } catch (e: any) {
    console.error("POST /api/v1/secfac/sos error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
