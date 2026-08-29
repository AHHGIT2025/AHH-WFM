import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceReconciliationEnabled } from "@/lib/attendance-reconciliation-engine";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAttendanceReconciliationEnabled()) {
    return NextResponse.json({ error: "Attendance Reconciliation module is disabled by feature flag." }, { status: 403 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
  });
  if (auth.error) return auth.error;

  const { id: importBatchId } = await params;

  try {
    const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
      where: { importBatchId }
    });

    if (!recBatch) {
      return NextResponse.json({ error: "Reconciliation batch not found." }, { status: 404 });
    }

    const events = await prisma.attendanceReconciliationEvent.findMany({
      where: { reconciliationBatchId: recBatch.id },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to retrieve audit events." }, { status: 500 });
  }
}