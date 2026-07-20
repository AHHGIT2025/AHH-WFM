import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { generateDailyOperationalSummary } from "@/lib/secfac-monitoring";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("operationType") || "SECURITY_GUARDING";
  const businessDate = searchParams.get("businessDate") || undefined;

  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const summary = await generateDailyOperationalSummary(businessDate, op);
    return NextResponse.json(summary);
  } catch (e: any) {
    console.error("GET /api/v1/secfac/monitoring/daily-summary error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
