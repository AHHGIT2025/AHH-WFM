import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Read employees filtered by FACILITY_MANAGEMENT operational type
    const employees = await mockDb.getEmployees();
    const filtered = employees.filter(e => e.operationType === "FACILITY_MANAGEMENT");
    return NextResponse.json(filtered);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch FM staff" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.id || !payload.name || !payload.email || !payload.manpowerCategoryId) {
      return NextResponse.json({ error: "Employee ID, Name, Email, and Category are required" }, { status: 400 });
    }
    const employee = await mockDb.createEmployee({
      ...payload,
      role: "EMPLOYEE",
      status: "Offline",
      employeeCategory: "BLUE_COLLAR",
      operationType: "FACILITY_MANAGEMENT",
      isActive: true,
      employmentStatus: "ACTIVE",
      dutyStatus: "OFF_DUTY"
    });
    return NextResponse.json(employee);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create FM employee" }, { status: 500 });
  }
}
