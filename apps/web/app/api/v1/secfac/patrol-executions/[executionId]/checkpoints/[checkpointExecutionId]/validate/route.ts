import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

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

    // 2. Fetch Checkpoint Execution Row
    const checkpointExec = (execution.checkpoints || []).find((c: any) => c.id === checkpointExecutionId);
    if (!checkpointExec) {
      return NextResponse.json({ success: false, error: "Checkpoint execution not found on this patrol route" }, { status: 404 });
    }

    // Check route status - "10. Route becomes read-only after COMPLETED/PENDING_REVIEW/CANCELLED."
    if (["COMPLETED", "PENDING_REVIEW", "CANCELLED"].includes(execution.status)) {
      if (checkpointExec.scanProofId === scanProofId) {
        return NextResponse.json({ success: true, data: execution });
      }
      const errorMsg = "Cannot validate checkpoint: patrol execution is finalized and read-only";
      return NextResponse.json({
        success: false,
        error: errorMsg,
        conflict: {
          code: "EXECUTION_ALREADY_FINALIZED",
          conflictType: "EXECUTION_ALREADY_FINALIZED",
          message: errorMsg,
          recommendedAction: "CONTACT_SUPERVISOR",
          canRetry: false,
          canDiscard: true,
          needsSupervisorReview: true
        }
      }, { status: 409 });
    }

    // Check if already linked/validated with the same scanProofId (idempotency)
    if (checkpointExec.scanProofId === scanProofId) {
      return NextResponse.json({ success: true, data: execution });
    }

    // Check if already validated by another scan proof
    if (checkpointExec.status === "VALIDATED" && checkpointExec.scanProofId && checkpointExec.scanProofId !== scanProofId) {
      const errorMsg = "This checkpoint has already been validated by another scan proof.";
      return NextResponse.json({
        success: false,
        error: errorMsg,
        conflict: {
          code: "CHECKPOINT_ALREADY_VALIDATED",
          conflictType: "CHECKPOINT_ALREADY_VALIDATED",
          message: errorMsg,
          recommendedAction: "CONTACT_SUPERVISOR",
          canRetry: false,
          canDiscard: true,
          needsSupervisorReview: true
        }
      }, { status: 409 });
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
    if (scanProof.validationStatus === "INVALID" || scanProof.validationStatus === "REJECTED") {
      const errorMsg = `Scan proof was rejected or is invalid: ${scanProof.failureReason || "Incorrect code"}`;
      return NextResponse.json({
        success: false,
        error: errorMsg,
        conflict: {
          code: "SCAN_PROOF_REJECTED",
          conflictType: "SCAN_PROOF_REJECTED",
          message: errorMsg,
          recommendedAction: "RE_SCAN",
          canRetry: true,
          canDiscard: true,
          needsSupervisorReview: false
        }
      }, { status: 409 });
    }

    if (!["VALID", "INVALID", "PENDING_REVIEW"].includes(scanProof.validationStatus)) {
      return NextResponse.json({ success: false, error: `Invalid scan proof status: ${scanProof.validationStatus}` }, { status: 400 });
    }

    // 6. Validate checkpoint and update status
    const updatedExec = await mockDb.validateSecfacPatrolCheckpoint(
      executionId,
      checkpointExecutionId,
      scanProofId
    );

    // Write audit record
    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: execution.operationType || "SECURITY_GUARDING",
      employeeId: execution.employeeId,
      employeeCode: execution.employee?.employeeId || null,
      employeeName: execution.employee?.name || null,
      assignmentId: execution.assignmentId,
      patrolExecutionId: executionId,
      checkpointExecutionId,
      scanProofId,
      actionType: "PATROL_CHECKPOINT_VALIDATE",
      actionSource: auditHeaders.syncMode === "OFFLINE_REPLAY" ? "MOBILE_OFFLINE_SYNC" : "MOBILE_ONLINE",
      ...auditHeaders,
      resultStatus: "SUCCESS",
      resultMessage: `Checkpoint ${checkpointExec.checkpoint?.label || checkpointExecutionId} validated successfully.`
    });

    return NextResponse.json({ success: true, data: updatedExec });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Failed to validate checkpoint", error: error.message }, { status: 500 });
  }
}
