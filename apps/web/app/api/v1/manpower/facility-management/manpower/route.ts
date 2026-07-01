import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const normalizeCategory = (cat?: string) => {
      if (!cat) return "";
      return cat.trim().toUpperCase().replace(/[\s_-]+/g, "_");
    };

    const normalizeCompanyCode = (code?: string) => {
      if (!code) return "";
      return code.trim().toUpperCase();
    };

    const allEmployees = await mockDb.getEmployees();

    // Debugging counters
    const totalFetched = allEmployees.length;
    const tc01Count = allEmployees.filter(e => normalizeCompanyCode(e.company?.companyCode || (e as any).companyCode) === "TC01").length;
    const tc01BlueCollarActiveCount = allEmployees.filter(e => 
      normalizeCompanyCode(e.company?.companyCode || (e as any).companyCode) === "TC01" &&
      normalizeCategory(e.employeeCategory) === "BLUE_COLLAR" &&
      (e.isActive === true || e.status === "Active" || e.employmentStatus === "ACTIVE")
    ).length;

    console.log(`[FM Manpower API GET] Total fetched: ${totalFetched}, TC01: ${tc01Count}, TC01 Blue Collar Active: ${tc01BlueCollarActiveCount}`);

    let employees = allEmployees.filter(e => {
      const compCode = normalizeCompanyCode(e.company?.companyCode || (e as any).companyCode);
      const category = normalizeCategory(e.employeeCategory);
      
      const isFmCompany = compCode === "TC01";
      const isBlueCollar = category === "BLUE_COLLAR";
      
      return isFmCompany && isBlueCollar;
    });

    if (!includeInactive) {
      employees = employees.filter(e => e.isActive === true || e.status === "Active" || e.employmentStatus === "ACTIVE");
    }

    return NextResponse.json(employees);
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
    if (!payload.id || !payload.manpowerCategoryId) {
      return NextResponse.json({ error: "Employee ID and Category are required" }, { status: 400 });
    }

    const employees = await mockDb.getEmployees();
    const existing = employees.find(e => e.id === payload.id);

    if (existing) {
      // Promote existing workforce directory employee to facility management
      const updated = await mockDb.updateEmployee(payload.id, {
        operationType: "FACILITY_MANAGEMENT",
        manpowerCategoryId: payload.manpowerCategoryId,
        companyId: "COMP-003",
        isActive: true,
        status: "Active"
      });
      return NextResponse.json(updated);
    } else {
      if (!payload.name || !payload.email) {
        return NextResponse.json({ error: "Name and Email are required for new employees" }, { status: 400 });
      }
      const employee = await mockDb.createEmployee({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        manpowerCategoryId: payload.manpowerCategoryId,
        companyId: "COMP-003",
        role: "EMPLOYEE",
        status: "Active",
        employeeCategory: "BLUE_COLLAR",
        operationType: "FACILITY_MANAGEMENT",
        isActive: true,
        employmentStatus: "ACTIVE",
        dutyStatus: "OFF_DUTY"
      });
      return NextResponse.json(employee);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create FM employee" }, { status: 500 });
  }
}
