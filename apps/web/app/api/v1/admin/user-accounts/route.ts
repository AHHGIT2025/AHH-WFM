import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuper = (auth.session?.user as any)?.role === "SUPER_ADMIN";
  if (!isSuper && !checkApiAuth(["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const employees = await mockDb.getEmployees();
    const assignments = await mockDb.getUserRoleAssignments();
    const accesses = await mockDb.getUserOperationAccesses();

    const accounts = employees.map(({ passwordHash, ...rest }) => {
      const userAssignments = assignments.filter(a => a.employeeId === rest.id && a.isActive);
      const opAccess = accesses.find(a => a.employeeId === rest.id) || {
        allowedWhiteCollar: true,
        allowedSecurityGuarding: rest.role === "SUPER_ADMIN" || rest.role === "ADMIN",
        allowedFacilityManagement: rest.role === "SUPER_ADMIN" || rest.role === "ADMIN",
        defaultLanding: "/dashboard",
        allowedCompanyIds: null
      };

      return {
        ...rest,
        roleAssignments: userAssignments,
        assignedRoleIds: userAssignments.map(a => a.roleId),
        operationAccess: opAccess
      };
    });

    return NextResponse.json(accounts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch user accounts" }, { status: 500 });
  }
}
