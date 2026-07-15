import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";

interface RouteParams {
  params: {
    scanProofId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const { scanProofId } = params;

  try {
    const proof = await mockDb.getSecfacScanProofById(scanProofId);
    if (!proof || !proof.isActive) {
      return NextResponse.json({ success: false, error: "Scan proof not found" }, { status: 404 });
    }

    // Apply RBAC operation scope checks
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

    // Standard employee can only view own proofs
    const isStandardEmployee = !isAdmin && !["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_"));
    if (isStandardEmployee && proof.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot view another employee's scan proof" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: proof });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
