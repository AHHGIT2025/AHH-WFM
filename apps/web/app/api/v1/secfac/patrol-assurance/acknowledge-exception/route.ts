import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { acknowledgePatrolException } from "@/lib/secfac-patrol-evaluator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checkpointExecutionId, notes = "Patrol exception reviewed and acknowledged." } = body;

    if (!checkpointExecutionId) {
      return NextResponse.json({ error: "Missing checkpointExecutionId." }, { status: 400 });
    }

    const auth = await checkApiAuth(undefined, {
      requiredPermission: "secfac.patrolAssurance.manage"
    });
    if (auth.error) return auth.error;

    const supervisorId = auth.session.user.id;
    const result = await acknowledgePatrolException(checkpointExecutionId, supervisorId, notes);

    return NextResponse.json({ success: true, checkpoint: result });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/patrol-assurance/acknowledge-exception error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
