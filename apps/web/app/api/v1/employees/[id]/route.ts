import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

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
    const employee = employees.find(e => e.id === params.id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const copy = { ...employee };
    delete (copy as any).passwordHash;
    if (!canViewIdentity(auth.session?.user)) {
      if (copy.qidNumber) copy.qidNumber = maskNumber(copy.qidNumber) as any;
      if (copy.passportNumber) copy.passportNumber = maskNumber(copy.passportNumber) as any;
    }

    return NextResponse.json(copy);
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
      employmentStatus, dutyStatus, workerCategory, 
      positionCategoryId, defaultProjectId, defaultSiteId,
      designationId, tradeClassificationId, costCenterId, defaultLocationId,
      isRelieverEligible, isStandbyEligible,
      immediateSupervisorId, reportingManagerId, projectSupervisorId, siteSupervisorId,
      isSupervisor, supervisorScopeType,
      username, authMode, ssoProvider, ssoSubject, isLoginEnabled, mustChangePassword, isLocked,
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
      ...(workerCategory !== undefined ? { workerCategory } : {}),
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

    const copy = { ...updated };
    delete (copy as any).passwordHash;
    if (!canViewIdentity(auth.session?.user)) {
      if (copy.qidNumber) copy.qidNumber = maskNumber(copy.qidNumber) as any;
      if (copy.passportNumber) copy.passportNumber = maskNumber(copy.passportNumber) as any;
    }

    return NextResponse.json(copy);
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
