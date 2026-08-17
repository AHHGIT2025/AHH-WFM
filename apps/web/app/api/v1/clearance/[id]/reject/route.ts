import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { executeClearanceReject } from "@/lib/clearance-execution";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.approve" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;
    const data = await request.json();

    const result = await executeClearanceReject(clearanceId, user, data);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, message: "Action recorded successfully" });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/[id]/reject error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
