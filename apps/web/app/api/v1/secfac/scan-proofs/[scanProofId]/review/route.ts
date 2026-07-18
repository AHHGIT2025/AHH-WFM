import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import { createSecfacFieldExecutionAudit, extractAuditHeaders } from "@/lib/secfac-audit-helpers";

interface RouteParams {
  params: {
    scanProofId: string;
  };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const { scanProofId } = params;

  try {
    // 1. Fetch scan proof
    const proof = await mockDb.getSecfacScanProofById(scanProofId);
    if (!proof || !proof.isActive) {
      return NextResponse.json({ success: false, error: "Scan proof not found" }, { status: 404 });
    }

    // 2. Validate reviewer role (Supervisor/Admin only, Standard Employee blocked)
    const isSupervisorOrAdmin = isAdmin || 
      ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_")) ||
      (user.permissions || []).some((p: string) => 
        p === "manpower.security.manage" || 
        p === "manpower.fm.manage" || 
        p.startsWith("manpower.admin.")
      );

    if (!isSupervisorOrAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden: Only supervisors and admins can review scan proofs" }, { status: 403 });
    }

    // 3. Verify operation scope
    let allowedOps: string[] = [];
    if (isAdmin) {
      allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
    } else {
      if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
    }

    if (!allowedOps.includes(proof.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    // 4. Validate body parameters
    const body = await request.json();
    const { validationStatus, reviewRemarks } = body;

    if (!validationStatus || !["VALID", "REJECTED"].includes(validationStatus)) {
      return NextResponse.json({ success: false, error: "validationStatus must be VALID or REJECTED" }, { status: 400 });
    }

    if (!reviewRemarks || reviewRemarks.trim() === "") {
      return NextResponse.json({ success: false, error: "reviewRemarks are required" }, { status: 400 });
    }

    // 5. Update scan proof status
    const result = await mockDb.reviewSecfacScanProof(scanProofId, user.id, validationStatus, reviewRemarks);

    // 6. Sync with linked patrol checkpoints
    const patrolSync = await (mockDb as any).syncPatrolCheckpointFromScanProof(scanProofId);

    // Write audit record
    const auditHeaders = extractAuditHeaders(request);
    await createSecfacFieldExecutionAudit({
      operationType: proof.operationType,
      employeeId: proof.employeeId,
      employeeCode: proof.employee?.employeeId || null,
      employeeName: proof.employee?.name || null,
      assignmentId: proof.assignmentId,
      scanProofId: proof.id,
      actionType: validationStatus === "VALID" ? "SCAN_PROOF_REVIEW_APPROVE" : "SCAN_PROOF_REVIEW_REJECT",
      actionSource: "WEB_SUPERVISOR",
      ...auditHeaders,
      syncMode: "SERVER_SIDE",
      actorUserId: user.id,
      actorEmployeeId: user.employeeId || user.id,
      actorName: user.name || null,
      actorEmail: user.email || null,
      actorRole: user.role || null,
      resultStatus: validationStatus === "VALID" ? "SUCCESS" : "REJECTED",
      resultMessage: `Scan proof reviewed by supervisor. Remarks: ${reviewRemarks}`
    });

    return NextResponse.json({
      success: true,
      data: {
        scanProof: result,
        patrolSync
      }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
