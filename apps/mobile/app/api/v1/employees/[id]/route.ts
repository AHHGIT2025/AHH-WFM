import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth, canAccessCompany, hasPermission, isAdminUser } from "../../../../../lib/api-guards";

interface RouteParams {
  params: {
    id: string;
  };
}

function sanitizeEmployee(emp: any) {
  if (!emp) return emp;
  const { passwordHash, ...safe } = emp;
  return safe;
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(
    ["ADMIN", "SUPER_ADMIN", "SUPERVISOR", "EMPLOYEE", "EMPLOYEE_SELF_SERVICE"],
    { employeeIdParam: params.id }
  );
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const employees = await mockDb.getEmployees();
    const employee = employees.find((e) => e.id === params.id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!isAdminUser(user) && (employee as any).companyId && !canAccessCompany(user, (employee as any).companyId)) {
      return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
    }
    return NextResponse.json(sanitizeEmployee(employee));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(
    ["ADMIN", "SUPER_ADMIN", "SUPERVISOR", "EMPLOYEE", "EMPLOYEE_SELF_SERVICE"],
    { employeeIdParam: params.id }
  );
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const callerRole = (user.role || "").trim().toUpperCase().replace(/\s+/g, "_");
  const isSelfService =
    user.isSelfServiceOnly ||
    callerRole === "EMPLOYEE" ||
    callerRole === "EMPLOYEE_SELF_SERVICE";

  try {
    const payload = await request.json();
    const { name, email, role, departmentId, status, phone, shiftId } = payload;

    const employees = await mockDb.getEmployees();
    const currentEmp = employees.find((e) => e.id === params.id);
    if (!currentEmp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (isSelfService) {
      if (params.id !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: Self-service users can only update their own profile" },
          { status: 403 }
        );
      }
      if (
        role !== undefined ||
        status !== undefined ||
        departmentId !== undefined ||
        shiftId !== undefined ||
        email !== undefined
      ) {
        return NextResponse.json(
          { error: "Forbidden: Self-service users cannot modify role or administrative employee fields" },
          { status: 403 }
        );
      }
    } else {
      if (!isAdminUser(user) && !hasPermission(user, "employees.edit")) {
        return NextResponse.json(
          { error: "Forbidden: Requires employees.edit permission" },
          { status: 403 }
        );
      }

      if (!isAdminUser(user) && (currentEmp as any).companyId && !canAccessCompany(user, (currentEmp as any).companyId)) {
        return NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 });
      }

      const targetRole = (currentEmp.role || "").trim().toUpperCase().replace(/\s+/g, "_");
      const nextRole = role !== undefined ? String(role).trim().toUpperCase().replace(/\s+/g, "_") : targetRole;
      const isRoleChanged = role !== undefined && nextRole !== targetRole;

      if (targetRole === "SUPER_ADMIN" && callerRole !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Only SUPER_ADMIN can modify a SUPER_ADMIN account" },
          { status: 403 }
        );
      }
      if (targetRole === "ADMIN" && callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Only ADMIN or SUPER_ADMIN can modify an ADMIN account" },
          { status: 403 }
        );
      }
      if (isRoleChanged) {
        if (!isAdminUser(user) && !hasPermission(user, "users.manage")) {
          return NextResponse.json(
            { error: "Forbidden: Role changes require users.manage permission" },
            { status: 403 }
          );
        }
        if (params.id === user.id) {
          return NextResponse.json(
            { error: "Forbidden: Users cannot modify their own role" },
            { status: 403 }
          );
        }
        if ((nextRole === "SUPER_ADMIN" || nextRole === "ADMIN") && callerRole !== "SUPER_ADMIN") {
          return NextResponse.json(
            { error: "Forbidden: Only SUPER_ADMIN can assign SUPER_ADMIN or ADMIN role" },
            { status: 403 }
          );
        }
      }
    }

    // Validation checks
    if (name !== undefined && name.trim() === "") {
      return NextResponse.json({ error: "Employee name is required" }, { status: 400 });
    }
    if (email !== undefined) {
      if (email.trim() === "") {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      if (employees.some(e => e.id !== params.id && e.email.toLowerCase() === email.trim().toLowerCase())) {
        return NextResponse.json({ error: "Employee email already exists" }, { status: 400 });
      }
    }
    if (role !== undefined && role.trim() === "") {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const updated = await mockDb.updateEmployee(params.id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
      ...(role !== undefined ? { role: role.trim() } : {}),
      ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
      ...(status !== undefined ? { status: status.trim() } : {}),
      ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
      ...(shiftId !== undefined ? { shiftId: shiftId || null } : {})
    } as any);

    if (!updated) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json(sanitizeEmployee(updated));
  } catch (e) {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN", "SUPER_ADMIN"]);
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    if (params.id === user.id) {
      return NextResponse.json({ error: "Forbidden: Cannot deactivate your own account" }, { status: 403 });
    }

    const employees = await mockDb.getEmployees();
    const targetEmp = employees.find(e => e.id === params.id);
    if (!targetEmp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const callerRole = (user.role || "").trim().toUpperCase().replace(/\s+/g, "_");
    const targetRole = (targetEmp.role || "").trim().toUpperCase().replace(/\s+/g, "_");

    if (targetRole === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: SUPER_ADMIN account cannot be deactivated" }, { status: 403 });
    }
    if (targetRole === "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Only SUPER_ADMIN can deactivate an ADMIN account" }, { status: 403 });
    }

    const result = await mockDb.deactivateEmployee(params.id);
    if (!result) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Employee deactivated successfully", employee: sanitizeEmployee(result) });
  } catch (e) {
    return NextResponse.json({ error: "Failed to deactivate employee" }, { status: 500 });
  }
}
