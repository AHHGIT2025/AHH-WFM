import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { runControlledNotificationPilot } from "@/lib/secfac-notif-activation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType, cycleCount, channelFilter } = body;

  const op = operationType || "SECURITY_GUARDING";
  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.manage"
  });
  if (auth.error) return auth.error;

  try {
    const report = await runControlledNotificationPilot(
      cycleCount || 3,
      op as any,
      channelFilter || "IN_APP"
    );

    return NextResponse.json(report);
  } catch (e: any) {
    console.error("POST /api/v1/secfac/notif-worker/run error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
