import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { completeDispatchAssignment } from "@/lib/secfac-sos-dispatch-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const dispatchId = params.id;
    const body = await req.json();
    const { operationType = "SECURITY_GUARDING", completionNotes } = body;

    if (!completionNotes || typeof completionNotes !== "string" || completionNotes.trim().length < 5) {
      return NextResponse.json({ error: "Mandatory completionNotes (minimum 5 characters) required." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredOperation: operationType as any,
      requiredPermission: "secfac.dispatch.complete"
    });
    if (auth.error) return auth.error;

    const user = auth.session.user;

    const result = await completeDispatchAssignment(dispatchId, user.id, completionNotes);

    return NextResponse.json({ success: true, dispatch: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/dispatch/[id]/complete error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
