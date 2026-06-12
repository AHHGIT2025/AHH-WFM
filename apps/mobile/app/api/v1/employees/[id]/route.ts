import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const employees = await mockDb.getEmployees();
    const employee = employees.find((e) => e.id === params.id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json(employee);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { name, email, role, departmentId, status, phone, shiftId } = payload;

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

      const employees = await mockDb.getEmployees();
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
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const result = await mockDb.deactivateEmployee(params.id);
    if (!result) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Employee deactivated successfully", employee: result });
  } catch (e) {
    return NextResponse.json({ error: "Failed to deactivate employee" }, { status: 500 });
  }
}
