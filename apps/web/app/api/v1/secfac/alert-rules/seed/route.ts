import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { seedPilotAlertRules } from "@/lib/secfac-alert-templates";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType } = body;

  if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json(
      { error: "Explicit valid operationType ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as any,
    requiredPermission: "secfac.alert.rules.manage"
  });
  if (auth.error) return auth.error;

  try {
    const result = await seedPilotAlertRules(operationType as any, (auth.session.user as any).id);
    return NextResponse.json({
      operationType,
      message: `Seeded ${result.seeded} pilot rule template(s). ${result.skipped} existing rule(s) skipped. All seeded rules are INACTIVE by default.`,
      result
    });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/alert-rules/seed error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
