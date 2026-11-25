import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth, canAccessCompany, hasPermission, isAdminUser } from "../../../../lib/api-guards";

function sanitizeEmployee(emp: any) {
  if (!emp) return emp;
  const { passwordHash, ...safe } = emp;
  return safe;
}

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPER_ADMIN", "SUPERVISOR", "EMPLOYEE", "EMPLOYEE_SELF_SERVICE"]);
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;

  try {
    const employees = await mockDb.getEmployees();
    const isSelfService =
      user?.isSelfServiceOnly ||
      user?.role?.toUpperCase() === "EMPLOYEE" ||
      user?.role?.toUpperCase() === "EMPLOYEE_SELF_SERVICE";

    const filtered = employees.filter((emp: any) => {
      if (isSelfService) {
        return emp.id === user.id;
      }
      if (!isAdminUser(user) && emp.companyId && !canAccessCompany(user, emp.companyId)) {
        return false;
      }
      return true;
    });

    return NextResponse.json(filtered.map(sanitizeEmployee));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPER_ADMIN"]);
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  if (!isAdminUser(user) && !hasPermission(user, "employees.create")) {
    return NextResponse.json({ error: "Forbidden: Requires employees.create permission" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { id, name, email, role, departmentId, phone, shiftId, password } = payload;

    // 1. Validation
    if (!id || id.trim() === "") {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Employee name is required" }, { status: 400 });
    }
    if (!email || email.trim() === "") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (!role || role.trim() === "") {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const callerRole = (user.role || "").trim().toUpperCase().replace(/\s+/g, "_");
    const requestedRole = role.trim().toUpperCase().replace(/\s+/g, "_");
    if ((requestedRole === "SUPER_ADMIN" || requestedRole === "ADMIN") && callerRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only SUPER_ADMIN can create SUPER_ADMIN or ADMIN accounts" },
        { status: 403 }
      );
    }

    const employees = await mockDb.getEmployees();
    // 2. Prevent duplicate Employee ID
    if (employees.some(e => e.id.toLowerCase() === id.trim().toLowerCase())) {
      return NextResponse.json({ error: "Employee ID already exists" }, { status: 400 });
    }
    // 3. Prevent duplicate Email
    if (employees.some(e => e.email.toLowerCase() === email.trim().toLowerCase())) {
      return NextResponse.json({ error: "Employee email already exists" }, { status: 400 });
    }

    const newEmp = await mockDb.createEmployee({
      id: id.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role.trim(),
      departmentId: departmentId || undefined,
      department: "", // Will be auto-resolved by broker based on departmentId
      status: "Offline",
      phone: phone ? phone.trim() : undefined,
      shiftId: shiftId || undefined,
      password: password || undefined
    });

    return NextResponse.json(sanitizeEmployee(newEmp));
  } catch (e) {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
