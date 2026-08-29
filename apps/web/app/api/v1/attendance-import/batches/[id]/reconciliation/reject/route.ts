import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceReconciliationEnabled, rejectReconciliation } from "@/lib/attendance-reconciliation-engine";

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
    const { rejectionReason } = body;

    const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
      where: { importBatchId }
    });

    if (!recBatch) {
      return NextResponse.json({ error: "Reconciliation batch not found." }, { status: 404 });
    }

    const updated = await rejectReconciliation(recBatch.id, rejectionReason, {
      id: user.id || "SYS_ACTOR",
      name: user.name || "Approver",
      role: user.role
    });

    return NextResponse.json({ success: true, reconciliationBatch: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reject reconciliation batch." }, { status: 400 });
  }
}