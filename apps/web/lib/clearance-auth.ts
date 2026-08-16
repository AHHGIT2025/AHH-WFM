import { checkApiAuth } from "./api-guards";
import { isAdminUser } from "./permissions";
import { NextResponse } from "next/server";

export async function authorizeClearanceRequest(
  request: any,
  requiredPermission: string
) {
  const auth = await checkApiAuth(undefined, { requiredPermission });
  if (auth.error) {
    return { error: auth.error, session: null, user: null };
  }
  return { error: null, session: auth.session, user: auth.session.user };
}

export function validateClearanceCompanyAndAccess(
  user: any,
  clearance: { companyId?: string | null; employeeId?: string | null; requestedById?: string | null }
) {
  if (isAdminUser(user)) return null;

  // 1. Company Isolation
  if (user.companyId && clearance.companyId && clearance.companyId !== user.companyId) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Access to specified company clearance is restricted" },
      { status: 403 }
    );
  }

  // 2. Employee Self-Service Scope (Canonical User-to-Employee Identity Linkage)
  const canonicalEmployeeId = user.employeeId || user.id;
  if (user.isSelfServiceOnly || user.role === "EMPLOYEE") {
    if (clearance.employeeId !== canonicalEmployeeId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cannot access another employee's clearance request" },
        { status: 403 }
      );
    }
  }

  return null;
}

export function validateClearanceApproverSoD(
  user: any,
  clearance: { employeeId?: string | null; requestedById?: string | null },
  step: { assignedApproverId?: string | null; fallbackRole?: string | null }
) {
  if (isAdminUser(user)) return null;

  const canonicalEmployeeId = user.employeeId || user.id;

  // 1. Requester / Subject Self-Approval Guard (SoD)
  if (clearance.employeeId === canonicalEmployeeId || clearance.requestedById === user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Requester self-approval is restricted" },
      { status: 403 }
    );
  }

  // 2. Assigned Approver Verification (Strict: assignedApproverId is authoritative when present)
  if (step.assignedApproverId && step.assignedApproverId.trim() !== "") {
    if (step.assignedApproverId !== user.id && step.assignedApproverId !== canonicalEmployeeId) {
      return NextResponse.json(
        { success: false, error: `Forbidden: Approval step assigned to another user (${step.assignedApproverId})` },
        { status: 403 }
      );
    }
  } else if (step.fallbackRole && step.fallbackRole.trim() !== "") {
    // If assignedApproverId is empty, evaluate fallbackRole
    const userRole = user.role?.toUpperCase().replace(/\s+/g, "_");
    const requiredRole = step.fallbackRole.toUpperCase().replace(/\s+/g, "_");
    if (userRole !== requiredRole && userRole !== "HR_MANAGER" && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: `Forbidden: Approval step requires role ${step.fallbackRole}` },
        { status: 403 }
      );
    }
  }

  return null;
}
