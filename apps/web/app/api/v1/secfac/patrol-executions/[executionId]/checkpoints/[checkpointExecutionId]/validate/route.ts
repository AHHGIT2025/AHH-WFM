import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: { executionId: string; checkpointExecutionId: string } }
) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const isSupervisor = ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));

  const { executionId, checkpointExecutionId } = params;

  try {
    const body = await request.json();
    const { scanProofId } = body;

    if (!scanProofId) {
      return NextResponse.json({ success: false, error: "scanProofId is required" }, { status: 400 });
    }

    // 1. Fetch Patrol Execution
    const execution = await mockDb.getSecfacPatrolExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ success: false, error: "Patrol execution not found" }, { status: 404 });
    }

    // Check Employee ownership
    if (!isAdmin && !isSupervisor && execution.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: You do not own this patrol execution" }, { status: 403 });
    }

    // Check route status - "10. Route becomes read-only after COMPLETED/PENDING_REVIEW/CANCELLED."
    if (["COMPLETED", "PENDING_REVIEW", "CANCELLED"].includes(execution.status)) {
      return NextResponse.json({ success: false, error: "Cannot validate checkpoint: patrol execution is finalized and read-only" }, { status: 400 });
    }

    // 2. Fetch Checkpoint Execution Row
    const checkpointExec = (execution.checkpoints || []).find((c: any) => c.id === checkpointExecutionId);
    if (!checkpointExec) {
      return NextResponse.json({ success: false, error: "Checkpoint execution not found on this patrol route" }, { status: 404 });
    }

    // Check if already linked/validated with the same scanProofId (idempotency)
    if (checkpointExec.scanProofId === scanProofId) {
      return NextResponse.json({ success: true, data: execution });
    }

    // 3. Fetch Scan Proof
    let scanProof: any = null;
    if (typeof mockDb.getSecfacScanProofById === "function") {
      scanProof = await (mockDb as any).getSecfacScanProofById(scanProofId);
    } else {
      // Fallback: search in getSecfacScanProofs or manual search
      const proofs = await (mockDb as any).getSecfacScanProofs({ assignmentId: execution.assignmentId });
      scanProof = proofs.find((p: any) => p.id === scanProofId);
    }

    if (!scanProof) {
      // Check in-memory directly
      const db = require("@ahh-wfm/mock-data").readDb();
      scanProof = (db.secfacScanProofs || []).find((p: any) => p.id === scanProofId);
    }

    if (!scanProof) {
      return NextResponse.json({ success: false, error: "Scan proof not found" }, { status: 404 });
    }

    // 4. Validate scan proof parameters match execution
    if (!isAdmin && !isSupervisor && scanProof.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Scan proof belongs to a different employee" }, { status: 403 });
    }
    if (scanProof.assignmentId !== execution.assignmentId) {
      return NextResponse.json({ success: false, error: "Scan proof assignmentId does not match patrol execution assignmentId" }, { status: 400 });
    }
    if (scanProof.checkpointId !== checkpointExec.checkpointId) {
      return NextResponse.json({ success: false, error: "Scan proof checkpointId does not match checkpoint execution checkpointId" }, { status: 400 });
    }

    // 5. Check validationStatus is VALID, INVALID, or PENDING_REVIEW
    if (!["VALID", "INVALID", "PENDING_REVIEW"].includes(scanProof.validationStatus)) {
      return NextResponse.json({ success: false, error: `Invalid scan proof status: ${scanProof.validationStatus}` }, { status: 400 });
    }

    // 6. Validate checkpoint and update status
    const updatedExec = await mockDb.validateSecfacPatrolCheckpoint(
      executionId,
      checkpointExecutionId,
      scanProofId
    );

    return NextResponse.json({ success: true, data: updatedExec });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to validate checkpoint", error: error.message }, { status: 500 });
  }
}
