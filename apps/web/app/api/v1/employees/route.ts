import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

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
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const employees = await mockDb.getEmployees();
    const canView = canViewIdentity(auth.session?.user);

    const mapped = employees.map(emp => {
      const copy = { ...emp };
      delete (copy as any).passwordHash;
      if (!canView) {
        if (copy.qidNumber) copy.qidNumber = maskNumber(copy.qidNumber) as any;
        if (copy.passportNumber) copy.passportNumber = maskNumber(copy.passportNumber) as any;
      }
      return copy;
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
      id, name, email, role, departmentId, phone, shiftId, password, 
      employmentStatus, dutyStatus, workerCategory, positionCategoryId, 
      defaultProjectId, defaultSiteId, designationId, tradeClassificationId, 
      costCenterId, defaultLocationId, isRelieverEligible, isStandbyEligible,
      immediateSupervisorId, reportingManagerId, projectSupervisorId, siteSupervisorId,
      isSupervisor, supervisorScopeType,
      username, authMode, ssoProvider, ssoSubject, isLoginEnabled, mustChangePassword, isLocked,
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

    // New business validation: Company is required for new active employees
    if ((employmentStatus === "ACTIVE" || !employmentStatus) && (!companyId || companyId.trim() === "")) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
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
    // 4. Prevent duplicate Username (if local login)
    if (username && username.trim() !== "") {
      if (employees.some(e => e.username && e.username.toLowerCase() === username.trim().toLowerCase())) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
    }

    // 5. Prevent duplicate QID / Passport
    if (qidNumber && qidNumber.trim() !== "") {
      if (employees.some(e => e.qidNumber && e.qidNumber.trim() === qidNumber.trim())) {
        return NextResponse.json({ error: "Qatar ID number already exists" }, { status: 400 });
      }
    }
    if (passportNumber && passportNumber.trim() !== "") {
      if (employees.some(e => e.passportNumber && e.passportNumber.trim().toUpperCase() === passportNumber.trim().toUpperCase())) {
        return NextResponse.json({ error: "Passport number already exists" }, { status: 400 });
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
      isStandbyEligible: isStandbyEligible || false,
      immediateSupervisorId: immediateSupervisorId || undefined,
      reportingManagerId: reportingManagerId || undefined,
      projectSupervisorId: projectSupervisorId || undefined,
      siteSupervisorId: siteSupervisorId || undefined,
      isSupervisor: isSupervisor || false,
      supervisorScopeType: supervisorScopeType || "DIRECT_REPORTS",
      username: username ? username.trim() : undefined,
      authMode: authMode || "LOCAL",
      ssoProvider: ssoProvider || undefined,
      ssoSubject: ssoSubject || undefined,
      isLoginEnabled: isLoginEnabled !== undefined ? isLoginEnabled : true,
      mustChangePassword: mustChangePassword || false,
      isLocked: isLocked || false,
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
    const copy = { ...newEmp };
    delete (copy as any).passwordHash;
    if (!canView) {
      if (copy.qidNumber) copy.qidNumber = maskNumber(copy.qidNumber) as any;
      if (copy.passportNumber) copy.passportNumber = maskNumber(copy.passportNumber) as any;
    }

    return NextResponse.json(copy);
  } catch (e) {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
