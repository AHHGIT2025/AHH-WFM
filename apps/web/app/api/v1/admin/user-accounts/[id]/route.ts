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

    const callerRole = (user.role || "").trim().toUpperCase().replace(/\s+/g, "_");
    const isCallerSuperAdmin = callerRole === "SUPER_ADMIN";
    const isCallerAdmin = isCallerSuperAdmin || callerRole === "ADMIN";
    const targetRole = (employee.role || "").trim().toUpperCase().replace(/\s+/g, "_");
    const nextRole = role !== undefined ? String(role).trim().toUpperCase().replace(/\s+/g, "_") : targetRole;

    // 1. Role hierarchy protection on target account
    if (targetRole === "SUPER_ADMIN" && !isCallerSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only SUPER_ADMIN can modify a SUPER_ADMIN account" },
        { status: 403 }
      );
    }
    if (targetRole === "ADMIN" && !isCallerAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN or SUPER_ADMIN can modify an ADMIN account" },
        { status: 403 }
      );
    }

    // 2. Prevent self-role promotion / modification
    if (params.id === user.id) {
      if (role !== undefined && nextRole !== targetRole) {
        return NextResponse.json(
          { error: "Forbidden: Users cannot modify their own base role" },
          { status: 403 }
        );
      }
      if (assignedRoleIds !== undefined && Array.isArray(assignedRoleIds)) {
        const currentAssignments = (await mockDb.getUserRoleAssignments())
          .filter(a => a.employeeId === params.id && a.isActive)
          .map(a => a.roleId);
        const currentSet = new Set(currentAssignments);
        const nextSet = new Set(assignedRoleIds);
        const isRoleSetChanged =
          currentSet.size !== nextSet.size ||
          Array.from(nextSet).some(rid => !currentSet.has(rid));
        if (isRoleSetChanged) {
          return NextResponse.json(
            { error: "Forbidden: Users cannot modify their own role assignments" },
            { status: 403 }
          );
        }
      }
    }

    // 3. Restrict assigning SUPER_ADMIN or ADMIN base role to SUPER_ADMIN only
    if (role !== undefined && nextRole !== targetRole) {
      if ((nextRole === "SUPER_ADMIN" || nextRole === "ADMIN") && !isCallerSuperAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Only SUPER_ADMIN can assign SUPER_ADMIN or ADMIN role" },
          { status: 403 }
        );
      }
    }

    // 4. Restrict assigning SUPER_ADMIN or ADMIN via assignedRoleIds to SUPER_ADMIN only
    if (assignedRoleIds && Array.isArray(assignedRoleIds)) {
      const systemRoles = await mockDb.getSystemRoles();
      const privilegedRoleIds = new Set(
        systemRoles
          .filter(r => {
            const rName = (r.name || "").trim().toUpperCase().replace(/\s+/g, "_");
            return rName === "SUPER_ADMIN" || rName === "ADMIN" || r.id === "ROLE-SUPER-ADMIN" || r.id === "ROLE-ADMIN";
          })
          .map(r => r.id)
      );
      privilegedRoleIds.add("SUPER_ADMIN");
      privilegedRoleIds.add("ADMIN");
      privilegedRoleIds.add("ROLE-SUPER-ADMIN");
      privilegedRoleIds.add("ROLE-ADMIN");

      const currentAssignments = (await mockDb.getUserRoleAssignments())
        .filter(a => a.employeeId === params.id && a.isActive)
        .map(a => a.roleId);
      const currentSet = new Set(currentAssignments);

      const attemptsPrivilegedRoleChange = assignedRoleIds.some(
        (rid: string) =>
          (privilegedRoleIds.has(rid) ||
            rid.trim().toUpperCase() === "SUPER_ADMIN" ||
            rid.trim().toUpperCase() === "ADMIN") &&
          !currentSet.has(rid)
      );

      if (attemptsPrivilegedRoleChange && !isCallerSuperAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Only SUPER_ADMIN can assign SUPER_ADMIN or ADMIN system roles" },
          { status: 403 }
        );
      }
    }

    if (username !== undefined) {
      if (employees.some(e => e.id !== params.id && e.username?.toLowerCase() === username.trim().toLowerCase())) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
    }

    // Super Admin lockout protection
    if (targetRole === "SUPER_ADMIN") {
      if (isLoginEnabled === false) {
        return NextResponse.json({ error: "Super Admin account cannot be disabled." }, { status: 400 });
      }
      if (selfServiceEnabled === false) {
        return NextResponse.json({ error: "Super Admin self-service cannot be disabled." }, { status: 400 });
      }
      if (role !== undefined && nextRole !== "SUPER_ADMIN") {
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
      if (targetRole === "SUPER_ADMIN") {
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
      if (targetRole === "SUPER_ADMIN") {
        oaData.allowedWhiteCollar = true;
        oaData.allowedSecurityGuarding = true;
        oaData.allowedFacilityManagement = true;
      }
      await mockDb.upsertUserOperationAccess(params.id, oaData);
    }

    try {
      await mockDb.createUserActivityLog({
        userId: user.id || "admin-system",
        action: "USER_ACCOUNT_UPDATED",
        entityType: "USER_ACCOUNT",
        entityId: params.id,
        beforeJson: JSON.stringify({
          role: employee.role,
          isLoginEnabled: employee.isLoginEnabled,
          authMode: employee.authMode
        }),
        afterJson: JSON.stringify({
          role: updated.role,
          isLoginEnabled: updated.isLoginEnabled,
          authMode: updated.authMode,
          assignedRoleIds: assignedRoleIds || undefined
        })
      });
    } catch {
      // Non-blocking audit log fallback
    }

    const { passwordHash, ...rest } = updated;
    return NextResponse.json(rest);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update user account" }, { status: 500 });
  }
}
