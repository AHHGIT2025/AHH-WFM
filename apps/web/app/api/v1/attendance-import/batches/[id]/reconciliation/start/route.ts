import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { isAttendanceReconciliationEnabled, initializeReconciliation } from "@/lib/attendance-reconciliation-engine";

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
    const recBatch = await initializeReconciliation(importBatchId, {
      id: user.id || "SYS_ACTOR",
      name: user.name || "Reviewer",
      role: user.role
    });

    return NextResponse.json({ success: true, reconciliationBatch: recBatch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to initialize reconciliation." }, { status: 400 });
  }
}