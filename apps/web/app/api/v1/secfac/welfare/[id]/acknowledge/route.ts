import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { acknowledgeWelfareCheck } from "@/lib/secfac-welfare-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { method = "MOBILE_APP" } = body;

    const auth = await checkApiAuth();
    if (auth.error) return auth.error;

    const employeeId = auth.session.user.id;
    const result = await acknowledgeWelfareCheck(params.id, employeeId, method);

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/welfare/[id]/acknowledge error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
