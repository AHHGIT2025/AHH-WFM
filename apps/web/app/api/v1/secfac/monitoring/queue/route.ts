import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getQueueHealth } from "@/lib/secfac-monitoring";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("operationType") || "SECURITY_GUARDING";
  const channel = searchParams.get("channel") || "IN_APP";

  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const queue = await getQueueHealth(op, channel);
    return NextResponse.json(queue);
  } catch (e: any) {
    console.error("GET /api/v1/secfac/monitoring/queue error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
