import { NextResponse } from "next/server";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@ahh-wfm/database";

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
    let opEmployees = await mockDb.getSecurityOperationalEmployees();

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

    // Merge operational copy snapshot if synced
    employees = employees.map(e => {
      const op = opEmployees.find((o: any) => o.sourceEmployeeId === e.id);
      if (op) {
        return {
          ...e,
          name: op.fullName,
          email: op.email || e.email,
          phone: op.mobile || e.phone,
          companyCode: op.companyCode || (e.company?.companyCode || (e as any).companyCode),
          employeeCategory: op.employeeCategory || e.employeeCategory,
          operationType: op.operationType || "SECURITY_GUARDING",
          isActive: op.isActive,
          employmentStatus: op.employmentStatus || e.employmentStatus,
          syncStatus: op.syncStatus || "SYNCED",
          lastSyncedAt: op.lastSyncedAt,
          designation: op.designation ? {
            id: e.designationId || "temp-designation-id",
            code: op.designation.toUpperCase().replace(/\s+/g, "_"),
            name: op.designation,
            employeeCategory: "BLUE_COLLAR",
            isSupervisorPosition: false,
            isRelieverEligible: false,
            isActive: true
          } : e.designation,
          manpowerCategoryId: e.manpowerCategoryId
        };
      } else {
        return {
          ...e,
          operationType: "", // Set empty so UI shows "Operation Type Needs Sync"
          syncStatus: "NEEDS_SYNC"
        };
      }
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

    const isDb = isDbConnected();
    let companyIdToUse = "COMP-002";
    let companyCodeToUse = "HS01";

    if (isDb) {
      if (existing && existing.companyId) {
        companyIdToUse = existing.companyId;
        companyCodeToUse = existing.company?.companyCode || "HS01";
      } else {
        const company = await prisma.company.findFirst({
          where: { companyCode: "HS01" }
        });
        if (!company) {
          return NextResponse.json({ error: "AHH Security Services (HS01) company not found in database." }, { status: 400 });
        }
        companyIdToUse = company.id;
        companyCodeToUse = company.companyCode;
      }
    } else {
      companyIdToUse = (existing && existing.companyId) || "COMP-002";
      companyCodeToUse = (existing && (existing.company?.companyCode || (existing as any).companyCode)) || "HS01";
    }

    if (existing) {
      const rawDesig = existing.designation?.name || (existing as any).tradeClassification?.name || (existing as any).position;
      const isWhiteCollarOrInvalid = (val: string | null | undefined) => {
        if (!val || typeof val !== "string") return true;
        const lower = val.toLowerCase();
        return lower.includes("hr manager") || lower.includes("human resource") || lower.includes("accountant") || lower.includes("admin") || lower === "operations" || lower.includes("department");
      };
      const designationName = (rawDesig && !isWhiteCollarOrInvalid(rawDesig)) ? rawDesig : "Security Guard";

      const operationalData = {
        sourceEmployeeId: existing.id,
        employeeCode: existing.id,
        fullName: existing.name,
        companyId: companyIdToUse,
        companyCode: companyCodeToUse,
        employeeCategory: "BLUE_COLLAR",
        operationType: "SECURITY_GUARDING",
        designation: designationName,
        position: designationName,
        grade: null,
        department: existing.department || "Operations",
        defaultLocation: existing.defaultLocation?.locationName || null,
        mobile: existing.phone,
        email: existing.email,
        isActive: true,
        employmentStatus: "ACTIVE",
        syncStatus: "SYNCED",
        lastSyncedAt: new Date()
      };
      
      await mockDb.createOrUpdateSecurityOperationalEmployee(operationalData);

      // 2. Update existing workforce directory employee properties (category, company) but do NOT overwrite operationType
      const updated = await mockDb.updateEmployee(payload.id, {
        manpowerCategoryId: payload.manpowerCategoryId,
        companyId: companyIdToUse,
        isActive: true,
        status: "Active"
      });
      return NextResponse.json(updated);
    } else {
      // Create a brand new employee in the workforce directory AND create operational copy
      if (!payload.name || !payload.email) {
        return NextResponse.json({ error: "Name and Email are required for new employees" }, { status: 400 });
      }
      
      const newEmp = await mockDb.createEmployee({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        department: payload.department || "Operations",
        manpowerCategoryId: payload.manpowerCategoryId,
        companyId: companyIdToUse,
        role: "EMPLOYEE",
        status: "Active",
        employeeCategory: "BLUE_COLLAR",
        isActive: true,
        employmentStatus: "ACTIVE",
        dutyStatus: "OFF_DUTY"
      });

      const designationName = "Security Guard";
      const operationalData = {
        sourceEmployeeId: newEmp.id,
        employeeCode: newEmp.id,
        fullName: newEmp.name,
        companyId: companyIdToUse,
        companyCode: companyCodeToUse,
        employeeCategory: "BLUE_COLLAR",
        operationType: "SECURITY_GUARDING",
        designation: designationName,
        position: designationName,
        grade: null,
        department: newEmp.department || "Operations",
        defaultLocation: null,
        mobile: newEmp.phone,
        email: newEmp.email,
        isActive: true,
        employmentStatus: "ACTIVE",
        syncStatus: "SYNCED",
        lastSyncedAt: new Date()
      };

      await mockDb.createOrUpdateSecurityOperationalEmployee(operationalData);

      return NextResponse.json(newEmp);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to save security employee" }, { status: 500 });
  }
}

