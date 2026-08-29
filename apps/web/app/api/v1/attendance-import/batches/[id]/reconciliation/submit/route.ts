import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceReconciliationEnabled, submitForApproval } from "@/lib/attendance-reconciliation-engine";

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
    const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
      where: { importBatchId }
    });

    if (!recBatch) {
      return NextResponse.json({ error: "Reconciliation batch not found." }, { status: 404 });
    }

    const updated = await submitForApproval(recBatch.id, {
      id: user.id || "SYS_ACTOR",
      name: user.name || "Submitter",
      role: user.role
    });

    return NextResponse.json({ success: true, reconciliationBatch: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit for approval." }, { status: 400 });
  }
}