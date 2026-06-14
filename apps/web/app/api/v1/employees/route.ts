import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const employees = await mockDb.getEmployees();
    return NextResponse.json(employees);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { 
      id, name, email, role, departmentId, phone, shiftId, password, 
      employmentStatus, dutyStatus, workerCategory, positionCategoryId, 
      defaultProjectId, defaultSiteId, designationId, tradeClassificationId, 
      costCenterId, defaultLocationId, isRelieverEligible, isStandbyEligible 
    } = payload;

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
      status: dutyStatus || "Offline",
      phone: phone ? phone.trim() : undefined,
      shiftId: shiftId || undefined,
      password: password || undefined,
      employmentStatus: employmentStatus || "ACTIVE",
      dutyStatus: dutyStatus || "OFF_DUTY",
      workerCategory: workerCategory || "WHITE_COLLAR",
      isActive: employmentStatus ? (employmentStatus === "ACTIVE") : true,
      positionCategoryId: positionCategoryId || undefined,
      defaultProjectId: defaultProjectId || undefined,
      defaultSiteId: defaultSiteId || undefined,
      designationId: designationId || undefined,
      tradeClassificationId: tradeClassificationId || undefined,
      costCenterId: costCenterId || undefined,
      defaultLocationId: defaultLocationId || undefined,
      isRelieverEligible: isRelieverEligible || false,
      isStandbyEligible: isStandbyEligible || false
    } as any);

    return NextResponse.json(newEmp);
  } catch (e) {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
