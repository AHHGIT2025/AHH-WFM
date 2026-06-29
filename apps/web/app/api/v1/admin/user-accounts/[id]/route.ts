import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden: Requires users.manage permission" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { username, authMode, isLoginEnabled, selfServiceEnabled, role, assignedRoleIds, operationAccess } = payload;

    if (username !== undefined && username.trim() === "") {
      return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
    }

    const employees = await mockDb.getEmployees();
    const employee = employees.find(e => e.id === params.id);
    
    if (!employee) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    if (username !== undefined) {
      if (employees.some(e => e.id !== params.id && e.username?.toLowerCase() === username.trim().toLowerCase())) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
    }

    // Super Admin lockout protection
    if (employee.role === "SUPER_ADMIN") {
      if (isLoginEnabled === false) {
        return NextResponse.json({ error: "Super Admin account cannot be disabled." }, { status: 400 });
      }
      if (selfServiceEnabled === false) {
        return NextResponse.json({ error: "Super Admin self-service cannot be disabled." }, { status: 400 });
      }
      if (role !== undefined && role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Super Admin role cannot be demoted." }, { status: 400 });
      }
    }

    // 1. Update basic employee details
    const updated = await mockDb.updateEmployee(params.id, {
      username: username !== undefined ? username : employee.username,
      authMode: authMode !== undefined ? authMode : employee.authMode,
      isLoginEnabled: isLoginEnabled !== undefined ? isLoginEnabled : employee.isLoginEnabled,
      selfServiceEnabled: selfServiceEnabled !== undefined ? selfServiceEnabled : employee.selfServiceEnabled,
      role: role !== undefined ? role : employee.role
    } as any);

    if (!updated) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    // 2. Update role assignments
    if (assignedRoleIds && Array.isArray(assignedRoleIds)) {
      let rolesToSave = [...assignedRoleIds];
      if (employee.role === "SUPER_ADMIN") {
        const systemRoles = await mockDb.getSystemRoles();
        const saRole = systemRoles.find(r => r.name === "SUPER_ADMIN");
        if (saRole && !rolesToSave.includes(saRole.id)) {
          rolesToSave.push(saRole.id);
        }
      }
      await mockDb.saveUserRoleAssignments(params.id, rolesToSave, auth.session?.user?.id || "admin-system");
    }

    // 3. Update operation access
    if (operationAccess) {
      let oaData = { ...operationAccess };
      if (employee.role === "SUPER_ADMIN") {
        oaData.allowedWhiteCollar = true;
        oaData.allowedSecurityGuarding = true;
        oaData.allowedFacilityManagement = true;
      }
      await mockDb.upsertUserOperationAccess(params.id, oaData);
    }

    const { passwordHash, ...rest } = updated;
    return NextResponse.json(rest);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update user account" }, { status: 500 });
  }
}
