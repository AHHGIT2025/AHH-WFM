import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const licenseStatus = url.searchParams.get("licenseStatus") || undefined; // "VALID" | "EXPIRED" | "MISSING"
    const gatePassStatus = url.searchParams.get("gatePassStatus") || undefined; // "VALID" | "EXPIRED" | "MISSING"

    const normalizeCategory = (cat?: string) => {
      if (!cat) return "";
      return cat.trim().toUpperCase().replace(/[\s_-]+/g, "_");
    };

    const normalizeCompanyCode = (code?: string) => {
      if (!code) return "";
      return code.trim().toUpperCase();
    };

    let allEmployees = await mockDb.getEmployees();

    // Debugging counters
    const totalFetched = allEmployees.length;
    const hs01Count = allEmployees.filter(e => normalizeCompanyCode(e.company?.companyCode || (e as any).companyCode) === "HS01").length;
    const hs01BlueCollarActiveCount = allEmployees.filter(e => 
      normalizeCompanyCode(e.company?.companyCode || (e as any).companyCode) === "HS01" &&
      normalizeCategory(e.employeeCategory) === "BLUE_COLLAR" &&
      (e.isActive === true || e.status === "Active" || e.employmentStatus === "ACTIVE")
    ).length;

    console.log(`[Security Manpower API GET] Total fetched: ${totalFetched}, HS01: ${hs01Count}, HS01 Blue Collar Active: ${hs01BlueCollarActiveCount}`);

    let employees = allEmployees.filter(e => {
      const compCode = normalizeCompanyCode(e.company?.companyCode || (e as any).companyCode);
      const category = normalizeCategory(e.employeeCategory);
      
      const isSecCompany = compCode === "HS01";
      const isBlueCollar = category === "BLUE_COLLAR";
      
      return isSecCompany && isBlueCollar;
    });

    // 2. Filter by isActive
    if (!includeInactive) {
      employees = employees.filter(e => e.isActive === true || e.status === "Active" || e.employmentStatus === "ACTIVE");
    }

    // 3. Filter by category
    if (categoryId && categoryId !== "ALL") {
      employees = employees.filter(e => e.manpowerCategoryId === categoryId);
    }

    // 4. Filter by licenseStatus
    if (licenseStatus && licenseStatus !== "ALL") {
      const licenses = await mockDb.getSecurityLicenses();
      const todayStr = new Date().toISOString().split("T")[0];
      employees = employees.filter(e => {
        const lic = licenses.find((l: any) => l.employeeId === e.id);
        if (licenseStatus === "MISSING") return !lic;
        if (licenseStatus === "EXPIRED") return lic && lic.expiryDate < todayStr;
        if (licenseStatus === "VALID") return lic && lic.expiryDate >= todayStr;
        return true;
      });
    }

    // 5. Filter by gatePassStatus
    if (gatePassStatus && gatePassStatus !== "ALL") {
      const passes = await mockDb.getSecurityGatePasses();
      const todayStr = new Date().toISOString().split("T")[0];
      employees = employees.filter(e => {
        const gp = passes.filter((p: any) => p.employeeId === e.id);
        if (gatePassStatus === "MISSING") return gp.length === 0;
        const hasActive = gp.some((p: any) => p.expiryDate >= todayStr);
        if (gatePassStatus === "VALID") return hasActive;
        if (gatePassStatus === "EXPIRED") return gp.length > 0 && !hasActive;
        return true;
      });
    }

    return NextResponse.json(employees);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch security force" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
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
      // Promote existing workforce directory employee to security guarding
      const updated = await mockDb.updateEmployee(payload.id, {
        operationType: "SECURITY_GUARDING",
        manpowerCategoryId: payload.manpowerCategoryId,
        companyId: "COMP-002",
        isActive: true,
        status: "Active"
      });
      return NextResponse.json(updated);
    } else {
      // Create a brand new employee in the workforce directory, defaulting to Al Hattab Security (COMP-002)
      if (!payload.name || !payload.email) {
        return NextResponse.json({ error: "Name and Email are required for new employees" }, { status: 400 });
      }
      const employee = await mockDb.createEmployee({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        manpowerCategoryId: payload.manpowerCategoryId,
        companyId: "COMP-002",
        role: "EMPLOYEE",
        status: "Active",
        employeeCategory: "BLUE_COLLAR",
        operationType: "SECURITY_GUARDING",
        isActive: true,
        employmentStatus: "ACTIVE",
        dutyStatus: "OFF_DUTY"
      });
      return NextResponse.json(employee);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to save security employee" }, { status: 500 });
  }
}

