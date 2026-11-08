import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  const sessionEmployeeId = (user as any)?.employeeId || user?.id;
  const canManageAll =
    isAdminUser(user) ||
    hasPermission(user, "leaves.manage") ||
    hasPermission(user, "settings.workflows.manage");

  try {
    const delegations = await mockDb.getLeaveApprovalDelegations();
    if (canManageAll) {
      return NextResponse.json(delegations);
    }

    const filtered = delegations.filter(
      (d: any) => d.employeeId === sessionEmployeeId || d.delegateApproverId === sessionEmployeeId
    );
    return NextResponse.json(filtered);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch approval delegations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  const sessionEmployeeId = (user as any)?.employeeId || user?.id;
  const canManageAll =
    isAdminUser(user) ||
    hasPermission(user, "leaves.manage") ||
    hasPermission(user, "settings.workflows.manage");

  const hasApprovalAuthority =
    canManageAll ||
    user?.role === "SUPERVISOR" ||
    user?.role === "DEPARTMENT_MANAGER" ||
    user?.role === "HR_MANAGER" ||
    user?.role === "OPERATIONS_MANAGER" ||
    hasPermission(user, "leaves.approve") ||
    hasPermission(user, "manpower.security.manage") ||
    hasPermission(user, "manpower.fm.manage");

  if (!hasApprovalAuthority) {
    return NextResponse.json(
      { error: "Forbidden: Only authorized approvers or workflow managers can create approval delegations" },
      { status: 403 }
    );
  }

  try {
    const payload = await request.json();
    const { employeeId, delegateApproverId, validFrom, validTo, reason } = payload;
    if (!employeeId || !delegateApproverId || !validFrom || !validTo) {
      return NextResponse.json(
        { error: "Missing required fields (employeeId, delegateApproverId, validFrom, validTo)" },
        { status: 400 }
      );
    }

    if (!canManageAll && employeeId !== sessionEmployeeId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot create approval delegation on behalf of another user" },
        { status: 403 }
      );
    }

    if (employeeId === delegateApproverId) {
      return NextResponse.json(
        { error: "Cannot delegate approval authority to the same employee" },
        { status: 400 }
      );
    }

    const delegation = await mockDb.createLeaveApprovalDelegation(
      employeeId,
      delegateApproverId,
      validFrom,
      validTo,
      reason || ""
    );
    return NextResponse.json(delegation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create approval delegation" }, { status: 500 });
  }
}
