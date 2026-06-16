import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

function normalizeEmployee(emp: any) {
  if (!emp) return emp;
  const copy = { ...emp };

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

interface RouteParams {
  params: {
    id: string;
  };
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
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const employees = await mockDb.getEmployees();
    const targetId = params.id === "me" ? (auth.session?.user as any)?.id : params.id;
    const employee = employees.find(e => e.id === targetId);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const normalized = normalizeEmployee(employee);
    delete (normalized as any).passwordHash;
    if (!canViewIdentity(auth.session?.user)) {
      if (normalized.qidNumber) normalized.qidNumber = maskNumber(normalized.qidNumber) as any;
      if (normalized.passportNumber) normalized.passportNumber = maskNumber(normalized.passportNumber) as any;
    }

    return NextResponse.json(normalized);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { 
      name, email, role, departmentId, status, phone, shiftId, 
      employmentStatus, dutyStatus, employeeCategory,
      positionCategoryId, defaultProjectId, defaultSiteId,
      designationId, tradeClassificationId, costCenterId, defaultLocationId,
      isRelieverEligible, isStandbyEligible,
      immediateSupervisorId, reportingManagerId, projectSupervisorId, siteSupervisorId,
      isSupervisor, supervisorScopeType,
      username, authMode, ssoProvider, ssoSubject, isLoginEnabled, mustChangePassword, isLocked,
      webAccessEnabled, mobileAccessEnabled, usernameStrategy,
      defaultPassword, confirmDefaultPassword, mustChangePasswordOnFirstLogin,
      profilePhotoUrl,
      companyId, qidNumber, qidExpiryDate, passportNumber, passportExpiryDate, passportIssueDate, passportIssuingCountry, dateOfJoining, sponsor
    } = payload;

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
    if (profilePhotoUrl !== undefined && (auth.session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update profile photo from Web UI" }, { status: 403 });
    }

    const employees = await mockDb.getEmployees();
    const currentEmp = employees.find(e => e.id === params.id);
    if (!currentEmp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Prevent duplicate QID / Passport
    if (qidNumber !== undefined && qidNumber !== null && qidNumber.trim() !== "") {
      if (employees.some(e => e.id !== params.id && e.qidNumber && e.qidNumber.trim() === qidNumber.trim())) {
        return NextResponse.json({ error: "Qatar ID number already exists" }, { status: 400 });
      }
    }
    if (passportNumber !== undefined && passportNumber !== null && passportNumber.trim() !== "") {
      if (employees.some(e => e.id !== params.id && e.passportNumber && e.passportNumber.trim().toUpperCase() === passportNumber.trim().toUpperCase())) {
        return NextResponse.json({ error: "Passport number already exists" }, { status: 400 });
      }
    }

    // Date validations
    const resolvedJoining = dateOfJoining !== undefined ? dateOfJoining : currentEmp.dateOfJoining;
    const resolvedQidExpiry = qidExpiryDate !== undefined ? qidExpiryDate : currentEmp.qidExpiryDate;
    const resolvedPassportIssue = passportIssueDate !== undefined ? passportIssueDate : currentEmp.passportIssueDate;
    const resolvedPassportExpiry = passportExpiryDate !== undefined ? passportExpiryDate : currentEmp.passportExpiryDate;

    if (resolvedQidExpiry && resolvedJoining) {
      if (new Date(resolvedQidExpiry) < new Date(resolvedJoining)) {
        return NextResponse.json({ error: "Qatar ID expiry date cannot be before date of joining" }, { status: 400 });
      }
    }
    if (resolvedPassportExpiry && resolvedPassportIssue) {
      if (new Date(resolvedPassportExpiry) < new Date(resolvedPassportIssue)) {
        return NextResponse.json({ error: "Passport expiry date cannot be before issue date" }, { status: 400 });
      }
    }

    const updated = await mockDb.updateEmployee(params.id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
      ...(role !== undefined ? { role: role.trim() } : {}),
      ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
      ...(status !== undefined ? { status: status.trim() } : {}),
      ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
      ...(shiftId !== undefined ? { shiftId: shiftId || null } : {}),
      ...(employmentStatus !== undefined ? { employmentStatus, isActive: employmentStatus === "ACTIVE" } : {}),
      ...(dutyStatus !== undefined ? { dutyStatus, status: dutyStatus } : {}),
      ...(employeeCategory !== undefined ? { employeeCategory } : {}),
      ...(positionCategoryId !== undefined ? { positionCategoryId: positionCategoryId || null } : {}),
      ...(defaultProjectId !== undefined ? { defaultProjectId: defaultProjectId || null } : {}),
      ...(defaultSiteId !== undefined ? { defaultSiteId: defaultSiteId || null } : {}),
      ...(designationId !== undefined ? { designationId: designationId || null } : {}),
      ...(tradeClassificationId !== undefined ? { tradeClassificationId: tradeClassificationId || null } : {}),
      ...(costCenterId !== undefined ? { costCenterId: costCenterId || null } : {}),
      ...(defaultLocationId !== undefined ? { defaultLocationId: defaultLocationId || null } : {}),
      ...(isRelieverEligible !== undefined ? { isRelieverEligible } : {}),
      ...(isStandbyEligible !== undefined ? { isStandbyEligible } : {}),
      ...(immediateSupervisorId !== undefined ? { immediateSupervisorId: immediateSupervisorId || null } : {}),
      ...(reportingManagerId !== undefined ? { reportingManagerId: reportingManagerId || null } : {}),
      ...(projectSupervisorId !== undefined ? { projectSupervisorId: projectSupervisorId || null } : {}),
      ...(siteSupervisorId !== undefined ? { siteSupervisorId: siteSupervisorId || null } : {}),
      ...(isSupervisor !== undefined ? { isSupervisor } : {}),
      ...(supervisorScopeType !== undefined ? { supervisorScopeType } : {}),
      ...(username !== undefined ? { username: username ? username.trim() : null } : {}),
      ...(authMode !== undefined ? { authMode } : {}),
      ...(ssoProvider !== undefined ? { ssoProvider: ssoProvider || null } : {}),
      ...(ssoSubject !== undefined ? { ssoSubject: ssoSubject || null } : {}),
      ...(isLoginEnabled !== undefined ? { isLoginEnabled } : {}),
      ...(mustChangePassword !== undefined ? { mustChangePassword } : {}),
      ...(isLocked !== undefined ? { isLocked } : {}),
      ...(webAccessEnabled !== undefined ? { webAccessEnabled } : {}),
      ...(mobileAccessEnabled !== undefined ? { mobileAccessEnabled } : {}),
      ...(usernameStrategy !== undefined ? { usernameStrategy } : {}),
      ...(defaultPassword !== undefined ? { defaultPassword } : {}),
      ...(confirmDefaultPassword !== undefined ? { confirmDefaultPassword } : {}),
      ...(mustChangePasswordOnFirstLogin !== undefined ? { mustChangePasswordOnFirstLogin } : {}),
      ...(profilePhotoUrl !== undefined ? { profilePhotoUrl: profilePhotoUrl ? profilePhotoUrl.trim() : null } : {}),
      
      // New company & identity fields
      ...(companyId !== undefined ? { companyId: companyId || null } : {}),
      ...(qidNumber !== undefined ? { qidNumber: qidNumber ? qidNumber.trim() : null } : {}),
      ...(qidExpiryDate !== undefined ? { qidExpiryDate: qidExpiryDate ? new Date(qidExpiryDate) : null } : {}),
      ...(passportNumber !== undefined ? { passportNumber: passportNumber ? passportNumber.trim().toUpperCase() : null } : {}),
      ...(passportExpiryDate !== undefined ? { passportExpiryDate: passportExpiryDate ? new Date(passportExpiryDate) : null } : {}),
      ...(passportIssueDate !== undefined ? { passportIssueDate: passportIssueDate ? new Date(passportIssueDate) : null } : {}),
      ...(passportIssuingCountry !== undefined ? { passportIssuingCountry: passportIssuingCountry ? passportIssuingCountry.trim() : null } : {}),
      ...(dateOfJoining !== undefined ? { dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null } : {}),
      ...(sponsor !== undefined ? { sponsor: sponsor ? sponsor.trim() : null } : {})
    } as any);

    if (!updated) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const employeesList = await mockDb.getEmployees();
    const resolvedEmp = employeesList.find(e => e.id === params.id) || updated;
    const normalized = normalizeEmployee(resolvedEmp);
    delete (normalized as any).passwordHash;
    if (!canViewIdentity(auth.session?.user)) {
      if (normalized.qidNumber) normalized.qidNumber = maskNumber(normalized.qidNumber) as any;
      if (normalized.passportNumber) normalized.passportNumber = maskNumber(normalized.passportNumber) as any;
    }

    return NextResponse.json(normalized);
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
    
    const copy = { ...result };
    delete (copy as any).passwordHash;
    return NextResponse.json({ message: "Employee deactivated successfully", employee: copy });
  } catch (e) {
    return NextResponse.json({ error: "Failed to deactivate employee" }, { status: 500 });
  }
}
