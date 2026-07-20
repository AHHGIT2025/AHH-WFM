import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { reviewSecFacAlert } from "@/lib/secfac-monitoring";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const alertId = params.id;
  const body = await req.json().catch(() => ({}));
  const { reviewStatus, reviewComment, operationType } = body;

  const op = operationType || "SECURITY_GUARDING";
  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  if (!["VALID", "FALSE_POSITIVE", "DUPLICATE", "INSUFFICIENT_DATA", "RULE_CONFIGURATION_ISSUE", "OPERATIONAL_EXCEPTION"].includes(reviewStatus)) {
    return NextResponse.json({ error: "Invalid or missing reviewStatus." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.alerts.manage"
  });
  if (auth.error) return auth.error;

  try {
    const updatedAlert = await reviewSecFacAlert(alertId, {
      reviewStatus,
      reviewedById: auth.session?.user?.id || "admin",
      reviewComment
    });

    return NextResponse.json(updatedAlert);
  } catch (e: any) {
    console.error(`POST /api/v1/secfac/alerts/${alertId}/review error:`, e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
