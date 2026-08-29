import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceReconciliationEnabled, applyDecision } from "@/lib/attendance-reconciliation-engine";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAttendanceReconciliationEnabled()) {
    return NextResponse.json({ error: "Attendance Reconciliation module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { id: importBatchId } = await params;
  const user = (auth.session?.user as any) || {};

  try {
    const body = await request.json();
    const { decisions, reconciliationBatchId } = body;

    const recBatch = await prisma.attendanceReconciliationBatch.findFirst({
      where: reconciliationBatchId ? { id: reconciliationBatchId } : { importBatchId }
    });

    if (!recBatch) {
      return NextResponse.json({ error: "Reconciliation batch not found." }, { status: 404 });
    }

    const decisionList = Array.isArray(decisions) ? decisions : [body];
    const results = [];

    for (const d of decisionList) {
      const res = await applyDecision(recBatch.id, d, {
        id: user.id || "SYS_ACTOR",
        name: user.name || "Reviewer",
        role: user.role
      });
      results.push(res);
    }

    return NextResponse.json({ success: true, updatedDecisions: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to apply decision." }, { status: 400 });
  }
}