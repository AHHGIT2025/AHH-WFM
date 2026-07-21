import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { rejectDispatchAssignment } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const dispatchId = params.id;
    const body = await req.json();
    const { operationType = "SECURITY_GUARDING", rejectionCategory = "UNAVAILABLE", rejectionReason } = body;

    if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length < 3) {
      return NextResponse.json({ error: "Mandatory rejectionReason required." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.dispatch.accept"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;
    const responderId = user.id;

    const result = await rejectDispatchAssignment(dispatchId, responderId, rejectionCategory, rejectionReason);

    return NextResponse.json({ success: true, dispatch: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/dispatch/[id]/reject error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
