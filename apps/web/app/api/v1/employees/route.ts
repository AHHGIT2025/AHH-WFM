import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

function normalizeEmployee(emp: any) {
  if (!emp) return emp;
  const copy = { ...emp };
  copy.employeeCode = emp.id;

  // Normalize Company
  if (emp.company) {
    copy.company = {
      id: emp.company.id,
      code: emp.company.companyCode,
      name: emp.company.companyName,
      companyCode: emp.company.companyCode,
      companyName: emp.company.companyName
    };
  } else if (emp.companyId) {
    copy.company = { id: emp.companyId, code: "", name: "" };
  } else {
    copy.company = null;
  }

  // Normalize Department (map departmentRef to department)
  if (emp.departmentRef) {
    copy.department = {
      id: emp.departmentRef.id,
      code: "",
      name: emp.departmentRef.name
    };
  } else if (emp.departmentId) {
    copy.department = { id: emp.departmentId, code: "", name: "" };
  } else {
    copy.department = null;
  }

  // Normalize Cost Center (map costCenterRef to costCenter)
  if (emp.costCenterRef) {
    copy.costCenter = {
      id: emp.costCenterRef.id,
      code: emp.costCenterRef.costCenterCode,
      name: emp.costCenterRef.costCenterName
    };
  } else if (emp.costCenterId) {
    copy.costCenter = { id: emp.costCenterId, code: "", name: "" };
  } else {
    copy.costCenter = null;
  }

  // Normalize Default Location
  if (emp.defaultLocation) {
    copy.defaultLocation = {
      id: emp.defaultLocation.id,
      code: emp.defaultLocation.locationCode,
      name: emp.defaultLocation.locationName
    };
  } else if (emp.defaultLocationId) {
    copy.defaultLocation = { id: emp.defaultLocationId, code: "", name: "" };
  } else {
    copy.defaultLocation = null;
  }

  // Normalize Designation
  if (emp.designation) {
    copy.designation = {
      id: emp.designation.id,
      code: emp.designation.code,
      name: emp.designation.name
    };
  } else if (emp.designationId) {
    copy.designation = { id: emp.designationId, code: "", name: "" };
  } else {
    copy.designation = null;
  }

  return copy;
}

function canViewIdentity(user: any): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "HR" || role === "HR_MANAGER") return true;
  try {
    return hasPermission(user, "employee.identity.viewSensitive");
  } catch (e) {
    return false;
  }
}

function maskNumber(num: string | null | undefined): string | null {
  if (!num) return null;
  const clean = num.trim();
  if (clean.length <= 4) return clean;
  return "*".repeat(clean.length - 4) + clean.substring(clean.length - 4);
}

export async function GET() {
  const auth = await checkApiAuth(); // Any authenticated session may read the directory
  if (auth.error) return auth.error;

  try {
    const employees = await mockDb.getEmployees();
    const canView = canViewIdentity(auth.session?.user);

    const mapped = employees.map(emp => {
      const normalized = normalizeEmployee(emp);
      delete (normalized as any).passwordHash;
      if (!canView) {
        if (normalized.qidNumber) normalized.qidNumber = maskNumber(normalized.qidNumber) as any;
        if (normalized.passportNumber) normalized.passportNumber = maskNumber(normalized.passportNumber) as any;
      }
      return normalized;
    });

    return NextResponse.json(mapped);
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
      id, name, email, role, departmentId, phone, shiftId, password, defaultPassword,
      employmentStatus, dutyStatus, employeeCategory, positionCategoryId, 
      defaultProjectId, defaultSiteId, designationId, tradeClassificationId, 
      costCenterId, defaultLocationId, isRelieverEligible, isStandbyEligible,
      immediateSupervisorId, reportingManagerId, projectSupervisorId, siteSupervisorId,
      isSupervisor, supervisorScopeType,
      username, authMode, ssoProvider, ssoSubject, isLoginEnabled, mustChangePassword, isLocked,
      webAccessEnabled, mobileAccessEnabled, usernameStrategy,
      companyId, qidNumber, qidExpiryDate, passportNumber, passportExpiryDate, passportIssueDate, passportIssuingCountry, dateOfJoining, sponsor
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
    if (!employeeCategory || (employeeCategory !== "WHITE_COLLAR" && employeeCategory !== "BLUE_COLLAR")) {
      return NextResponse.json({ error: "Valid Worker Category is required" }, { status: 400 });
    }
    if (!employmentStatus || employmentStatus.trim() === "") {
      return NextResponse.json({ error: "Employment Status is required" }, { status: 400 });
    }
    if (!dutyStatus || dutyStatus.trim() === "") {
      return NextResponse.json({ error: "Duty Status is required" }, { status: 400 });
    }

    if (webAccessEnabled !== undefined && typeof webAccessEnabled !== "boolean") {
      return NextResponse.json({ error: "Web access flag must be a boolean" }, { status: 400 });
    }
    if (mobileAccessEnabled !== undefined && typeof mobileAccessEnabled !== "boolean") {
      return NextResponse.json({ error: "Mobile access flag must be a boolean" }, { status: 400 });
    }

    // New business validation: Company is required for new active employees
    if (employmentStatus === "ACTIVE") {
      if (!companyId || companyId.trim() === "") {
        return NextResponse.json({ error: "Company is required" }, { status: 400 });
      }
      if (!defaultLocationId || defaultLocationId.trim() === "") {
        return NextResponse.json({ error: "Default Location is required" }, { status: 400 });
      }
    }

    if (passportIssueDate && new Date(passportIssueDate) > new Date()) {
      return NextResponse.json({ error: "Passport issue date cannot be in the future" }, { status: 400 });
    }

    if (passportNumber && passportNumber.trim() !== "" && (!passportIssuingCountry || passportIssuingCountry.trim() === "")) {
      return NextResponse.json({ error: "Passport issue country is required when passport number is provided" }, { status: 400 });
    }

    const employees = await mockDb.getEmployees();
    // 2. Prevent duplicate Employee ID
    if (employees.some(e => e.id.toLowerCase() === id.trim().toLowerCase())) {
      return NextResponse.json({ error: "Employee ID already exists" }, { status: 409 });
    }
    // 3. Prevent duplicate Email
    if (employees.some(e => e.email.toLowerCase() === email.trim().toLowerCase())) {
      return NextResponse.json({ error: "Employee email already exists" }, { status: 409 });
    }

    // Resolve username Strategy and normalize/validate username
    const category = employeeCategory || "WHITE_COLLAR";
    const resolvedStrategy = usernameStrategy || (category === "BLUE_COLLAR" ? "EMPLOYEE_CODE" : "EMAIL");
    let generatedUsername = username;
    if (!generatedUsername && resolvedStrategy !== "MANUAL") {
      generatedUsername = resolvedStrategy === "EMPLOYEE_CODE" ? id.trim() : email.trim().toLowerCase();
    }

    if (generatedUsername && generatedUsername.trim() !== "") {
      const normalizedUsername = generatedUsername.trim().toLowerCase();
      if (employees.some(e => e.username && e.username.toLowerCase() === normalizedUsername)) {
        return NextResponse.json({ error: "Username already exists" }, { status: 409 });
      }
    } else if (isLoginEnabled || webAccessEnabled || mobileAccessEnabled) {
      return NextResponse.json({ error: "Username is required for accounts with login enabled" }, { status: 400 });
    }

    // 5. Prevent duplicate QID / Passport
    if (qidNumber && qidNumber.trim() !== "") {
      if (employees.some(e => e.qidNumber && e.qidNumber.trim() === qidNumber.trim())) {
        return NextResponse.json({ error: "Qatar ID number already exists" }, { status: 409 });
      }
    }
    if (passportNumber && passportNumber.trim() !== "") {
      if (employees.some(e => e.passportNumber && e.passportNumber.trim().toUpperCase() === passportNumber.trim().toUpperCase())) {
        return NextResponse.json({ error: "Passport number already exists" }, { status: 409 });
      }
    }

    // Date validations
    if (qidExpiryDate && dateOfJoining) {
      if (new Date(qidExpiryDate) < new Date(dateOfJoining)) {
        return NextResponse.json({ error: "Qatar ID expiry date cannot be before date of joining" }, { status: 400 });
      }
    }
    if (passportExpiryDate && passportIssueDate) {
      if (new Date(passportExpiryDate) < new Date(passportIssueDate)) {
        return NextResponse.json({ error: "Passport expiry date cannot be before issue date" }, { status: 400 });
      }
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
      password: password || defaultPassword || undefined,
      employmentStatus: employmentStatus || "ACTIVE",
      dutyStatus: dutyStatus || "OFF_DUTY",
      employeeCategory: employeeCategory || "WHITE_COLLAR",
      isActive: employmentStatus ? (employmentStatus === "ACTIVE") : true,
      positionCategoryId: positionCategoryId || undefined,
      defaultProjectId: defaultProjectId || undefined,
      defaultSiteId: defaultSiteId || undefined,
      designationId: designationId || undefined,
      tradeClassificationId: tradeClassificationId || undefined,
      costCenterId: costCenterId || undefined,
      defaultLocationId: defaultLocationId || undefined,
      isRelieverEligible: isRelieverEligible || false,
      isStandbyEligible: isStandbyEligible || false,
      immediateSupervisorId: immediateSupervisorId || undefined,
      reportingManagerId: reportingManagerId || undefined,
      projectSupervisorId: projectSupervisorId || undefined,
      siteSupervisorId: siteSupervisorId || undefined,
      isSupervisor: isSupervisor || false,
      supervisorScopeType: supervisorScopeType || "DIRECT_REPORTS",
      username: generatedUsername ? generatedUsername.trim() : undefined,
      authMode: authMode || "LOCAL",
      ssoProvider: ssoProvider || undefined,
      ssoSubject: ssoSubject || undefined,
      isLoginEnabled: isLoginEnabled !== undefined ? isLoginEnabled : true,
      mustChangePassword: mustChangePassword || false,
      isLocked: isLocked || false,
      webAccessEnabled: webAccessEnabled !== undefined ? webAccessEnabled : true,
      mobileAccessEnabled: mobileAccessEnabled !== undefined ? mobileAccessEnabled : true,
      usernameStrategy: resolvedStrategy,
      failedLoginAttempts: 0,
      
      // New company & identity fields
      companyId: companyId || undefined,
      qidNumber: qidNumber ? qidNumber.trim() : undefined,
      qidExpiryDate: qidExpiryDate ? new Date(qidExpiryDate) : undefined,
      passportNumber: passportNumber ? passportNumber.trim().toUpperCase() : undefined,
      passportExpiryDate: passportExpiryDate ? new Date(passportExpiryDate) : undefined,
      passportIssueDate: passportIssueDate ? new Date(passportIssueDate) : undefined,
      passportIssuingCountry: passportIssuingCountry ? passportIssuingCountry.trim() : undefined,
      dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : undefined,
      sponsor: sponsor ? sponsor.trim() : undefined
    } as any);

    const canView = canViewIdentity(auth.session?.user);
    const employeesList = await mockDb.getEmployees();
    const createdEmp = employeesList.find(e => e.id === newEmp.id) || newEmp;
    const normalized = normalizeEmployee(createdEmp);
    delete (normalized as any).passwordHash;
    if (!canView) {
      if (normalized.qidNumber) normalized.qidNumber = maskNumber(normalized.qidNumber) as any;
      if (normalized.passportNumber) normalized.passportNumber = maskNumber(normalized.passportNumber) as any;
    }

    return NextResponse.json(normalized);
  } catch (e: any) {
    console.error("[POST /api/v1/employees] Failed to create employee:", e);
    const msg = e.message || "Failed to create employee";
    const status = (msg.includes("exists") || msg.includes("duplicate")) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
