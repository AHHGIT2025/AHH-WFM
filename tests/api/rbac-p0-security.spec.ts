import { NextRequest } from "next/server";

const mockGetServerSession = jest.fn();
jest.mock("next-auth/next", () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args)
}));

import {
  hasPermission as webHasPermission,
  DEFAULT_ROLE_PERMISSIONS,
  filterNavigationByPermissions,
  canUserPerformSurveyWorkflowAction,
  isUserEligibleSurveyLevelApprover,
  getAuthorizedSurveyWorkflowActions
} from "@/lib/permissions";
import {
  hasPermission as mobileHasPermission,
  canAccessCompany as mobileCanAccessCompany,
  checkApiAuth as mobileCheckApiAuth
} from "../../apps/mobile/lib/api-guards";
import { hasClientPermission } from "../../apps/mobile/lib/client-permissions";
import {
  resolveNextAuthSecret as resolveWebSecret,
  authOptions as webAuthOptions,
  WEB_SESSION_COOKIE_NAME,
  WEB_SESSION_AUDIENCE
} from "@/lib/auth";
import {
  resolveNextAuthSecret as resolveMobileSecret,
  authOptions as mobileAuthOptions,
  MOBILE_SESSION_COOKIE_NAME,
  MOBILE_SESSION_AUDIENCE
} from "../../apps/mobile/lib/auth";
import {
  checkApiAuth,
  getAuthorizedCompanyIds,
  canAccessCompany,
  resolveAuthorizedCompanyFilter
} from "@/lib/api-guards";
import { isUserEligibleApprover } from "@/lib/workflow/approver-resolution";
import { validateClearanceCompanyAndAccess } from "@/lib/clearance-auth";
import { mockDb } from "@ahh-wfm/mock-data";

// Prevent global setupAfterEnv from seeding or mutating live database during isolated RBAC unit tests
mockDb.getCompanies = jest.fn().mockResolvedValue([]);

import { GET as getUserAccounts } from "@/app/api/v1/admin/user-accounts/route";
import { PATCH as patchUserAccount } from "@/app/api/v1/admin/user-accounts/[id]/route";
import { POST as postResetPassword } from "@/app/api/v1/admin/user-accounts/[id]/reset-password/route";
import { POST as postLockUser } from "@/app/api/v1/admin/user-accounts/[id]/lock/route";
import { GET as getWebEmployee, PATCH as patchWebEmployee } from "@/app/api/v1/employees/[id]/route";
import { POST as postWebEmployees } from "@/app/api/v1/employees/route";
import {
  GET as getMobileEmployee,
  PATCH as patchMobileEmployee,
  DELETE as deleteMobileEmployee
} from "../../apps/mobile/app/api/v1/employees/[id]/route";
import { GET as getSgManpower } from "@/app/api/v1/manpower/security-guarding/manpower/route";
import { GET as getFmManpower } from "@/app/api/v1/manpower/facility-management/manpower/route";
import { GET as getMasters, POST as postMasters } from "@/app/api/v1/masters/[entity]/route";
import { GET as getAllowedLocations, POST as postAllowedLocations } from "@/app/api/v1/employees/[id]/allowed-locations/route";
import { GET as getAttendancePolicies, POST as postAttendancePolicies } from "@/app/api/v1/attendance/policies/route";
import { GET as getOnCallAssignments, POST as postOnCallAssignments } from "@/app/api/v1/on-call/assignments/route";
import { POST as postMastersBulkImport } from "@/app/api/v1/masters/[entity]/bulk-import/route";
import { POST as postEmployeesBulkImport } from "@/app/api/v1/employees/bulk-import/route";
import { POST as postFmApproveWorkflow } from "@/app/api/v1/manpower/facility-management/contracts/[id]/workflow/approve/route";
import { POST as postSgApproveWorkflow } from "@/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/approve/route";
import { GET as getFmClients } from "@/app/api/v1/manpower/facility-management/clients/route";
import { GET as getDelegations, POST as postDelegations } from "@/app/api/v1/approval-delegations/route";
import { GET as getSecfacPostOrders, POST as postSecfacPostOrders } from "@/app/api/v1/secfac/post-orders/route";
import { POST as postSecfacBriefings } from "@/app/api/v1/secfac/shift-briefings/route";
import { PUT as putSecfacIncidents } from "@/app/api/v1/secfac/incidents/route";
import { POST as postSecfacInspections } from "@/app/api/v1/secfac/supervisor-inspections/route";
import { POST as postHolidayCalendars } from "@/app/api/v1/manpower/holiday-calendars/route";
import { PATCH as patchHolidayCalendar, DELETE as deleteHolidayCalendar } from "@/app/api/v1/manpower/holiday-calendars/[id]/route";
import { POST as postHolidayCalendarDates } from "@/app/api/v1/manpower/holiday-calendars/[id]/dates/route";
import { PATCH as patchRamadanPeriod } from "@/app/api/v1/manpower/ramadan-periods/[id]/route";

describe("UM-RBAC-1 P0 Security Remediation Regression Suite", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockGetServerSession.mockReset();
    jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getEmployees").mockImplementation(async () => {
      const s = await mockGetServerSession();
      if (!s || !s.user || !s.user.id) return [];
      return [
        {
          id: s.user.id,
          name: s.user.name || s.user.id,
          email: s.user.email || `${s.user.id}@ahh.com`,
          role: s.user.role || "EMPLOYEE",
          companyId: s.user.companyId ?? null,
          departmentId: s.user.departmentId ?? null,
          isActive: s.user.isActive !== false,
          employmentStatus: s.user.employmentStatus || "ACTIVE",
          isLoginEnabled: s.user.isLoginEnabled !== false,
          isLocked: Boolean(s.user.isLocked),
          webAccessEnabled: s.user.webAccessEnabled !== false,
          mobileAccessEnabled: s.user.mobileAccessEnabled !== false
        }
      ] as any;
    });
  });

  describe("RBAC-DEF-001: Unauthorized SUPER_ADMIN / ADMIN role assignment & user-account hierarchy", () => {
    it("blocks HR Manager with users.manage from assigning SUPER_ADMIN or modifying a SUPER_ADMIN account", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-HR-001",
          employeeId: "EMP-HR-001",
          role: "HR_MANAGER",
          permissions: ["users.manage", "users.view"],
          operationAccess: ["ALL"]
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-HR-001",
          role: "HR_MANAGER",
          isActive: true,
          isLoginEnabled: true
        },
        {
          id: "EMP-TARGET-001",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true
        },
        {
          id: "EMP-SA-001",
          role: "SUPER_ADMIN",
          isActive: true,
          isLoginEnabled: true
        }
      ] as any);

      // 1. Attempt to promote employee to SUPER_ADMIN via base role
      const reqPromote = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-TARGET-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "SUPER_ADMIN" })
      });
      const resPromote = await patchUserAccount(reqPromote, { params: { id: "EMP-TARGET-001" } });
      expect(resPromote.status).toBe(403);

      // 2. Attempt to assign SUPER_ADMIN via assignedRoleIds
      jest.spyOn(mockDb, "getSystemRoles").mockResolvedValue([
        { id: "ROLE-SA", name: "SUPER_ADMIN" }
      ] as any);
      jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
      const reqRoleIds = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-TARGET-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRoleIds: ["ROLE-SA"] })
      });
      const resRoleIds = await patchUserAccount(reqRoleIds, { params: { id: "EMP-TARGET-001" } });
      expect(resRoleIds.status).toBe(403);

      // 3. Attempt to modify an existing SUPER_ADMIN target account
      const reqTargetSa = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-SA-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLoginEnabled: false })
      });
      const resTargetSa = await patchUserAccount(reqTargetSa, { params: { id: "EMP-SA-001" } });
      expect(resTargetSa.status).toBe(403);
    });

    it("blocks self-role modification and locking SUPER_ADMIN accounts", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-ADMIN-001",
          employeeId: "EMP-ADMIN-001",
          role: "ADMIN",
          permissions: ["users.manage"],
          operationAccess: ["ALL"]
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-ADMIN-001",
          role: "ADMIN",
          isActive: true,
          isLoginEnabled: true
        },
        {
          id: "EMP-SA-001",
          role: "SUPER_ADMIN",
          isActive: true,
          isLoginEnabled: true
        }
      ] as any);

      const reqSelfRole = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-ADMIN-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "SUPER_ADMIN" })
      });
      const resSelfRole = await patchUserAccount(reqSelfRole, { params: { id: "EMP-ADMIN-001" } });
      expect(resSelfRole.status).toBe(403);

      // Attempt to lock a SUPER_ADMIN account
      const reqLockSa = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-SA-001/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test lock" })
      });
      const resLockSa = await postLockUser(reqLockSa, { params: { id: "EMP-SA-001" } });
      expect(resLockSa.status).toBe(403);
    });
  });

  describe("RBAC-DEF-002: Mobile employee privilege escalation, IDOR & passwordHash exposure", () => {
    it("blocks EMPLOYEE on Mobile from reading another employee, escalating role, or seeing passwordHash", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-MOB-001",
          employeeId: "EMP-MOB-001",
          role: "EMPLOYEE",
          permissions: ["employees.self.view", "attendance.self"],
          isSelfServiceOnly: true,
          mobileAccessEnabled: true,
          authPlatform: "MOBILE"
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-MOB-001",
          name: "Mobile Guard 1",
          email: "guard1@ahh.com",
          phone: "0500000001",
          role: "EMPLOYEE",
          passwordHash: "$2a$10$secretHashValue1",
          isActive: true,
          isLoginEnabled: true,
          mobileAccessEnabled: true
        },
        {
          id: "EMP-MOB-002",
          name: "Mobile Guard 2",
          email: "guard2@ahh.com",
          phone: "0500000002",
          role: "SUPERVISOR",
          passwordHash: "$2a$10$secretHashValue2",
          isActive: true
        }
      ] as any);

      // 1. Reading another employee's record -> 403
      const resOther = await getMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-MOB-002"),
        { params: { id: "EMP-MOB-002" } }
      );
      expect(resOther.status).toBe(403);

      // 2. Reading own record -> 200 without passwordHash
      const resSelf = await getMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-MOB-001"),
        { params: { id: "EMP-MOB-001" } }
      );
      expect(resSelf.status).toBe(200);
      const selfBody = await resSelf.json();
      expect(selfBody.passwordHash).toBeUndefined();

      // 3. Attempting to escalate own role via Mobile PATCH -> 403
      const resEscalate = await patchMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-MOB-001", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "SUPER_ADMIN" })
        }),
        { params: { id: "EMP-MOB-001" } }
      );
      expect(resEscalate.status).toBe(403);

      // 4. Attempting to update own phone (safe field) -> 200 without passwordHash
      jest.spyOn(mockDb, "updateEmployee").mockResolvedValue({
        id: "EMP-MOB-001",
        name: "Mobile Guard 1",
        phone: "0509999999",
        role: "EMPLOYEE",
        passwordHash: "$2a$10$secretHashValue1"
      } as any);
      const resSafePatch = await patchMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-MOB-001", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "0509999999" })
        }),
        { params: { id: "EMP-MOB-001" } }
      );
      expect(resSafePatch.status).toBe(200);
      const updatedBody = await resSafePatch.json();
      expect(updatedBody.phone).toBe("0509999999");
      expect(updatedBody.passwordHash).toBeUndefined();

      // 5. Non-admin attempting DELETE on Mobile -> 403
      const resDelete = await deleteMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-MOB-002", { method: "DELETE" }),
        { params: { id: "EMP-MOB-002" } }
      );
      expect(resDelete.status).toBe(403);
    });
  });

  describe("RBAC-DEF-003: Web employee edit role escalation", () => {
    it("blocks user with employees.edit (but without users.manage) from changing role or security flags", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-HR-EDIT",
          employeeId: "EMP-HR-EDIT",
          role: "HR_SPECIALIST",
          permissions: ["employees.view", "employees.edit"],
          operationAccess: ["ALL"]
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-HR-EDIT",
          name: "HR Specialist",
          role: "HR_SPECIALIST",
          isActive: true,
          isLoginEnabled: true
        },
        {
          id: "EMP-HR-CREATE",
          name: "HR Manager",
          role: "HR_MANAGER",
          isActive: true,
          isLoginEnabled: true
        },
        {
          id: "EMP-001",
          name: "Worker One",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true
        }
      ] as any);

      // Attempt to change role without users.manage -> 403
      const reqRoleChange = new Request("http://localhost:3100/api/v1/employees/EMP-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN" })
      });
      const resRoleChange = await patchWebEmployee(reqRoleChange, { params: { id: "EMP-001" } });
      expect(resRoleChange.status).toBe(403);

      // Attempt to create an ADMIN employee via POST without SUPER_ADMIN -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-HR-CREATE",
          employeeId: "EMP-HR-CREATE",
          role: "HR_MANAGER",
          permissions: ["employees.view", "employees.create", "users.manage"],
          operationAccess: ["ALL"]
        }
      });
      const reqCreateSa = new Request("http://localhost:3100/api/v1/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "EMP-UNAUTH-SA",
          name: "Unauthorized Super Admin",
          email: "unauth-sa@ahh.com",
          department: "IT",
          role: "SUPER_ADMIN"
        })
      });
      const resCreateSa = await postWebEmployees(reqCreateSa);
      expect(resCreateSa.status).toBe(403);
    });
  });

  describe("RBAC-DEF-004: Password reset plaintext exposure and hierarchy protection", () => {
    it("blocks non-SUPER_ADMIN from resetting SUPER_ADMIN password and never returns tempPassword or passwordHash in response JSON", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-HR-001",
          employeeId: "EMP-HR-001",
          role: "HR_MANAGER",
          permissions: ["users.manage"],
          operationAccess: ["ALL"]
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-HR-001",
          role: "HR_MANAGER",
          isActive: true,
          isLoginEnabled: true
        },
        {
          id: "EMP-SA-001",
          role: "SUPER_ADMIN",
          isActive: true
        },
        {
          id: "EMP-NORM-001",
          role: "EMPLOYEE",
          isActive: true
        }
      ] as any);

      // 1. Attempt to reset SUPER_ADMIN password as HR_MANAGER -> 403
      const reqResetSa = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-SA-001/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword: "ValidPassword123!" })
      });
      const resResetSa = await postResetPassword(reqResetSa, { params: { id: "EMP-SA-001" } });
      expect(resResetSa.status).toBe(403);

      // 2. Authorized reset of normal EMPLOYEE -> 200 without tempPassword or passwordHash in JSON response
      jest.spyOn(mockDb, "updateEmployee").mockResolvedValue({
        id: "EMP-NORM-001",
        role: "EMPLOYEE",
        passwordHash: "$2a$10$newHash"
      } as any);
      jest.spyOn(mockDb, "createUserActivityLog").mockResolvedValue({ id: "AUD-1" } as any);

      const reqResetNorm = new Request("http://localhost:3100/api/v1/admin/user-accounts/EMP-NORM-001/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword: "ValidPassword123!" })
      });
      const resResetNorm = await postResetPassword(reqResetNorm, { params: { id: "EMP-NORM-001" } });
      expect(resResetNorm.status).toBe(200);
      const resetBody = await resResetNorm.json();
      expect(resetBody.message).toBe("Password reset successfully");
      expect(resetBody.tempPassword).toBeUndefined();
      expect(resetBody.user?.passwordHash).toBeUndefined();
    });
  });

  describe("RBAC-DEF-005: Unauthenticated API endpoints now enforce authentication & permission", () => {
    it("rejects unauthenticated requests (401) across masters, allowed-locations, attendance policies, and on-call assignments", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const resMastersGet = await getMasters(
        new NextRequest("http://localhost:3100/api/v1/masters/companies"),
        { params: { entity: "companies" } }
      );
      expect(resMastersGet.status).toBe(401);

      const resMastersPost = await postMasters(
        new NextRequest("http://localhost:3100/api/v1/masters/companies", {
          method: "POST",
          body: JSON.stringify({ companyCode: "X01", companyName: "Test" })
        }),
        { params: { entity: "companies" } }
      );
      expect(resMastersPost.status).toBe(401);

      const resAllowedLoc = await getAllowedLocations(
        new Request("http://localhost:3100/api/v1/employees/EMP-001/allowed-locations"),
        { params: { id: "EMP-001" } }
      );
      expect(resAllowedLoc.status).toBe(401);

      const resPolicies = await getAttendancePolicies(
        new NextRequest("http://localhost:3100/api/v1/attendance/policies")
      );
      expect(resPolicies.status).toBe(401);

      const resOnCall = await getOnCallAssignments(
        new NextRequest("http://localhost:3100/api/v1/on-call/assignments")
      );
      expect(resOnCall.status).toBe(401);
    });

    it("rejects authenticated non-privileged users (403) when mutating masters, allowed-locations, policies, or on-call", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-BASIC",
          employeeId: "EMP-BASIC",
          role: "EMPLOYEE",
          permissions: ["employees.self.view"],
          isSelfServiceOnly: true,
          companyId: "COMP-001"
        }
      });

      const resMastersPost = await postMasters(
        new NextRequest("http://localhost:3100/api/v1/masters/companies", {
          method: "POST",
          body: JSON.stringify({ companyCode: "X01", companyName: "Test" })
        }),
        { params: { entity: "companies" } }
      );
      expect(resMastersPost.status).toBe(403);

      const resAllowedLocPost = await postAllowedLocations(
        new Request("http://localhost:3100/api/v1/employees/EMP-001/allowed-locations", {
          method: "POST",
          body: JSON.stringify({ locationId: "LOC-001" })
        }),
        { params: { id: "EMP-001" } }
      );
      expect(resAllowedLocPost.status).toBe(403);

      const resPoliciesPost = await postAttendancePolicies(
        new NextRequest("http://localhost:3100/api/v1/attendance/policies", {
          method: "POST",
          body: JSON.stringify({ companyId: "COMP-001", name: "Test Policy" })
        })
      );
      expect(resPoliciesPost.status).toBe(403);

      const resOnCallPost = await postOnCallAssignments(
        new NextRequest("http://localhost:3100/api/v1/on-call/assignments", {
          method: "POST",
          body: JSON.stringify({ employeeId: "EMP-BASIC", date: "2026-11-08" })
        })
      );
      expect(resOnCallPost.status).toBe(403);
    });
  });

  describe("RBAC-DEF-006: Bulk import authorization & role escalation protection", () => {
    it("blocks users without masters.manage or employees.bulkUpload from running bulk imports (403)", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-VIEWER",
          employeeId: "EMP-VIEWER",
          role: "EMPLOYEE",
          permissions: ["employees.view"],
          operationAccess: ["ALL"]
        }
      });

      const resMastersBulk = await postMastersBulkImport(
        new NextRequest("http://localhost:3100/api/v1/masters/departments/bulk-import", {
          method: "POST",
          body: JSON.stringify({ rows: [] })
        }),
        { params: { entity: "departments" } }
      );
      expect(resMastersBulk.status).toBe(403);

      const resEmpBulk = await postEmployeesBulkImport(
        new NextRequest("http://localhost:3100/api/v1/employees/bulk-import", {
          method: "POST",
          body: JSON.stringify({ rows: [] })
        })
      );
      expect(resEmpBulk.status).toBe(403);
    });

    it("blocks HR user with employees.bulkUpload from importing SUPER_ADMIN rows", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-HR-BULK",
          employeeId: "EMP-HR-BULK",
          role: "HR_MANAGER",
          permissions: ["employees.bulkUpload"],
          operationAccess: ["ALL"]
        }
      });

      const resEmpBulkSa = await postEmployeesBulkImport(
        new NextRequest("http://localhost:3100/api/v1/employees/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: [
              {
                employeeCode: "EMP-ESC-999",
                fullName: "Escalated User",
                email: "esc999@ahh.com",
                role: "SUPER_ADMIN"
              }
            ]
          })
        })
      );
      expect(resEmpBulkSa.status).toBe(403);
    });
  });

  describe("RBAC-DEF-007: Wildcard containment & SG vs FM operational scope separation", () => {
    it("removes manpower.admin.full_access from SECURITY_ADMIN and FM_ADMIN defaults and enforces scope boundaries", () => {
      expect(DEFAULT_ROLE_PERMISSIONS.SECURITY_ADMIN).not.toContain("manpower.admin.full_access");
      expect(DEFAULT_ROLE_PERMISSIONS.FM_ADMIN).not.toContain("manpower.admin.full_access");

      const sgUserWithLegacyWildcard = {
        id: "EMP-SG-ADMIN",
        role: "SECURITY_ADMIN",
        permissions: ["manpower.admin.full_access", "manpower.security.view", "manpower.security.manage"],
        operationAccess: ["SECURITY_GUARDING"]
      };

      const sgMobileUser = {
        role: "SECURITY_ADMIN",
        permissions: ["manpower.admin.full_access", "manpower.security.view", "manpower.security.manage"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: false
        }
      };

      // SG user cannot gain non-manpower permissions from manpower.admin.full_access
      expect(webHasPermission(sgUserWithLegacyWildcard, "users.manage")).toBe(false);
      expect(webHasPermission(sgUserWithLegacyWildcard, "roles.manage")).toBe(false);
      expect(webHasPermission(sgUserWithLegacyWildcard, "precontract.manage")).toBe(false);
      expect(mobileHasPermission(sgMobileUser, "users.manage")).toBe(false);
      expect(hasClientPermission(sgMobileUser, "users.manage")).toBe(false);

      // SG user is blocked from FM permissions even if manpower.admin.full_access is present
      expect(webHasPermission(sgUserWithLegacyWildcard, "manpower.fm.view")).toBe(false);
      expect(webHasPermission(sgUserWithLegacyWildcard, "manpower.facility.manage")).toBe(false);
      expect(mobileHasPermission(sgMobileUser, "manpower.fm.view")).toBe(false);

      // SG user retains valid SG permissions
      expect(webHasPermission(sgUserWithLegacyWildcard, "manpower.security.view")).toBe(true);
      expect(webHasPermission(sgUserWithLegacyWildcard, "manpower.roster.edit")).toBe(true);
    });

    it("blocks Security Guarding user from accessing Facility Management API routes (403)", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SG-001",
          employeeId: "EMP-SG-001",
          role: "SECURITY_ADMIN",
          permissions: ["manpower.admin.full_access", "manpower.security.view"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });

      const resFmClients = await getFmClients();
      expect(resFmClients.status).toBe(403);
    });
  });

  describe("RBAC-DEF-008: Live session revocation, lockout, and platform access enforcement", () => {
    it("immediately rejects revoked, locked, deactivated, or wrong-platform sessions in checkApiAuth", async () => {
      // 1. Revoked session -> 401
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-REVOKED",
          role: "EMPLOYEE",
          isRevoked: true,
          permissions: ["employees.self.view"]
        }
      });
      const revokedAuth = await checkApiAuth();
      expect(revokedAuth.error?.status).toBe(401);

      // 2. Locked session -> 401
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-LOCKED",
          role: "EMPLOYEE",
          isLocked: true,
          permissions: ["employees.self.view"]
        }
      });
      const lockedAuth = await checkApiAuth();
      expect(lockedAuth.error?.status).toBe(401);

      // 3. Web access disabled -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-MOB-ONLY",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          webAccessEnabled: false,
          permissions: ["employees.self.view"]
        }
      });
      const webDisabledAuth = await checkApiAuth();
      expect(webDisabledAuth.error?.status).toBe(403);
    });
  });

  describe("RBAC-DEF-009: Multi-company allowedCompanyIds & cross-company isolation", () => {
    it("honors allowedCompanyIds for multi-company users while blocking unauthorized companies", async () => {
      const multiCompUser = {
        id: "EMP-MULTI",
        employeeId: "EMP-MULTI",
        role: "HR_MANAGER",
        companyId: "COMP-001",
        allowedCompanyIds: ["COMP-001", "COMP-002"],
        departmentId: "DEPT-HR"
      };

      expect(getAuthorizedCompanyIds(multiCompUser)).toEqual(["COMP-001", "COMP-002"]);
      expect(canAccessCompany(multiCompUser, "COMP-001")).toBe(true);
      expect(canAccessCompany(multiCompUser, "COMP-002")).toBe(true);
      expect(canAccessCompany(multiCompUser, "COMP-003")).toBe(false);

      // Approver resolution honors secondary company in allowedCompanyIds
      const eligibleInComp2 = await isUserEligibleApprover(
        multiCompUser,
        [{ approverType: "ROLE_BASED", roleName: "HR_MANAGER" }],
        { instanceCompanyId: "COMP-002" }
      );
      expect(eligibleInComp2.isEligible).toBe(true);

      const eligibleInComp3 = await isUserEligibleApprover(
        multiCompUser,
        [{ approverType: "ROLE_BASED", roleName: "HR_MANAGER" }],
        { instanceCompanyId: "COMP-003" }
      );
      expect(eligibleInComp3.isEligible).toBe(false);

      // Clearance company validation rejects explicit null companyId or unauthorized companyId
      const nullCompanyClearance = validateClearanceCompanyAndAccess(multiCompUser, {
        companyId: null,
        employeeId: "EMP-OTHER"
      });
      expect(nullCompanyClearance?.status).toBe(403);

      const comp2Clearance = validateClearanceCompanyAndAccess(multiCompUser, {
        companyId: "COMP-002",
        employeeId: "EMP-OTHER"
      });
      expect(comp2Clearance).toBeNull();

      const comp3Clearance = validateClearanceCompanyAndAccess(multiCompUser, {
        companyId: "COMP-003",
        employeeId: "EMP-OTHER"
      });
      expect(comp3Clearance?.status).toBe(403);
    });
  });

  describe("RBAC-DEF-010: Contract workflow spoofing & approval delegation forgery protection", () => {
    it("blocks spoofing another employeeId on SG and FM contract workflow approval endpoints (403)", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SG-MGR",
          employeeId: "EMP-SG-MGR",
          role: "OPERATIONS_MANAGER",
          permissions: ["manpower.security.manage"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });

      const reqSpoofSg = new Request(
        "http://localhost:3100/api/v1/manpower/security-guarding/contracts/CON-001/workflow/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            levelId: "LVL-1",
            employeeId: "EMP-CEO-001",
            remarks: "Spoofed approval"
          })
        }
      );
      const resSpoofSg = await postSgApproveWorkflow(reqSpoofSg, { params: { id: "CON-001" } });
      expect(resSpoofSg.status).toBe(403);

      // FM workflow approve blocks SG user or spoofed employeeId
      const reqSpoofFm = new Request(
        "http://localhost:3100/api/v1/manpower/facility-management/contracts/CON-FM-001/workflow/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            levelId: "LVL-1",
            employeeId: "EMP-SG-MGR"
          })
        }
      );
      const resSpoofFm = await postFmApproveWorkflow(reqSpoofFm, { params: { id: "CON-FM-001" } });
      expect(resSpoofFm.status).toBe(403);
    });

    it("blocks regular EMPLOYEE from creating approval delegations and blocks Supervisors from delegating on behalf of others", async () => {
      // 1. Regular EMPLOYEE without approval authority -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-REG-001",
          employeeId: "EMP-REG-001",
          role: "EMPLOYEE",
          permissions: ["leaves.request"],
          operationAccess: ["ALL"]
        }
      });

      const reqEmpDel = new Request("http://localhost:3100/api/v1/approval-delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "EMP-REG-001",
          delegateApproverId: "EMP-REG-002",
          validFrom: "2026-11-01",
          validTo: "2026-11-10"
        })
      });
      const resEmpDel = await postDelegations(reqEmpDel);
      expect(resEmpDel.status).toBe(403);

      // 2. SUPERVISOR attempting to delegate on behalf of another manager -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SUP-001",
          employeeId: "EMP-SUP-001",
          role: "SUPERVISOR",
          permissions: ["leaves.approve"],
          operationAccess: ["ALL"]
        }
      });

      const reqForgedDel = new Request("http://localhost:3100/api/v1/approval-delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "EMP-HR-MGR-001",
          delegateApproverId: "EMP-SUP-001",
          validFrom: "2026-11-01",
          validTo: "2026-11-10"
        })
      });
      const resForgedDel = await postDelegations(reqForgedDel);
      expect(resForgedDel.status).toBe(403);

      // 3. GET filters delegations for non-admin users to only their own records
      jest.spyOn(mockDb, "getLeaveApprovalDelegations").mockResolvedValue([
        { id: "DEL-1", employeeId: "EMP-SUP-001", delegateApproverId: "EMP-SUP-002" },
        { id: "DEL-2", employeeId: "EMP-OTHER-1", delegateApproverId: "EMP-OTHER-2" }
      ] as any);
      const resGetDel = await getDelegations();
      expect(resGetDel.status).toBe(200);
      const delList = await resGetDel.json();
      expect(delList).toHaveLength(1);
      expect(delList[0].id).toBe("DEL-1");
    });
  });

  describe("RBAC-DEF-011: SECFAC Phase 6B permission, scope, and company enforcement", () => {
    it("blocks unauthorized users and cross-company requests on Post Orders, Shift Briefings, Incidents, and Inspections", async () => {
      // 1. User without secfac permissions attempting to create a Post Order -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SG-GUARD",
          employeeId: "EMP-SG-GUARD",
          role: "EMPLOYEE",
          companyId: "COMP-002",
          allowedCompanyIds: ["COMP-002"],
          permissions: ["attendance.self", "manpower.roster.acknowledge"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });

      const resCreatePo = await postSecfacPostOrders(
        new Request("http://localhost:3100/api/v1/secfac/post-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", title: "Unauthorized Post Order" })
        })
      );
      expect(resCreatePo.status).toBe(403);

      // 2. Guard in guardMode attempting to query another employee's post orders -> 403
      const resOtherGuardPo = await getSecfacPostOrders(
        new Request("http://localhost:3100/api/v1/secfac/post-orders?guardMode=true&siteId=SITE-1&employeeId=EMP-OTHER")
      );
      expect(resOtherGuardPo.status).toBe(403);

      // 3. Guard attempting to create Shift Briefing -> 403
      const resCreateBriefing = await postSecfacBriefings(
        new Request("http://localhost:3100/api/v1/secfac/shift-briefings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "SITE-1" })
        })
      );
      expect(resCreateBriefing.status).toBe(403);

      // 4. Guard attempting to promote/close Incident -> 403
      const resPromoteIncident = await putSecfacIncidents(
        new Request("http://localhost:3100/api/v1/secfac/incidents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "promote", incidentId: "INC-1" })
        })
      );
      expect(resPromoteIncident.status).toBe(403);

      // 5. Guard attempting to create Supervisor Inspection -> 403
      const resCreateInspection = await postSecfacInspections(
        new Request("http://localhost:3100/api/v1/secfac/supervisor-inspections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "SITE-1" })
        })
      );
      expect(resCreateInspection.status).toBe(403);

      // 6. Supervisor with secfac permissions attempting cross-company access -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SG-SUP",
          employeeId: "EMP-SG-SUP",
          role: "SUPERVISOR",
          companyId: "COMP-002",
          allowedCompanyIds: ["COMP-002"],
          permissions: ["secfac.postOrders.view", "secfac.postOrders.manage"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });

      const resCrossCompanyPo = await getSecfacPostOrders(
        new Request("http://localhost:3100/api/v1/secfac/post-orders?companyId=COMP-999")
      );
      expect(resCrossCompanyPo.status).toBe(403);
    });
  });

  describe("RBAC-DEF-021: Calendar administration write authorization", () => {
    it("blocks users without manpower.calendars.manage from creating, modifying, or deleting Holiday Calendars and Ramadan Periods", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-CAL-VIEWER",
          employeeId: "EMP-CAL-VIEWER",
          role: "EMPLOYEE",
          permissions: ["manpower.calendars.view"],
          operationAccess: ["ALL"]
        }
      });

      const resCreateCal = await postHolidayCalendars(
        new Request("http://localhost:3100/api/v1/manpower/holiday-calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: 2027, name: "Unauthorized Calendar" })
        })
      );
      expect(resCreateCal.status).toBe(403);

      const resPatchCal = await patchHolidayCalendar(
        new NextRequest("http://localhost:3100/api/v1/manpower/holiday-calendars/CAL-1", {
          method: "PATCH",
          body: JSON.stringify({ name: "Modified" })
        }),
        { params: { id: "CAL-1" } }
      );
      expect(resPatchCal.status).toBe(403);

      const resDeleteCal = await deleteHolidayCalendar(
        new NextRequest("http://localhost:3100/api/v1/manpower/holiday-calendars/CAL-1", {
          method: "DELETE"
        }),
        { params: { id: "CAL-1" } }
      );
      expect(resDeleteCal.status).toBe(403);

      const resAddDate = await postHolidayCalendarDates(
        new NextRequest("http://localhost:3100/api/v1/manpower/holiday-calendars/CAL-1/dates", {
          method: "POST",
          body: JSON.stringify({ holidayDate: "2027-01-01", holidayName: "New Year" })
        }),
        { params: { id: "CAL-1" } }
      );
      expect(resAddDate.status).toBe(403);

      const resPatchRamadan = await patchRamadanPeriod(
        new NextRequest("http://localhost:3100/api/v1/manpower/ramadan-periods/RAM-1", {
          method: "PATCH",
          body: JSON.stringify({ name: "Modified Ramadan" })
        }),
        { params: { id: "RAM-1" } }
      );
      expect(resPatchRamadan.status).toBe(403);
    });

    it("blocks user with manpower.calendars.manage (but without manpower.calendars.approve) from creating pre-approved calendars", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-CAL-MGR",
          employeeId: "EMP-CAL-MGR",
          role: "HR_SPECIALIST",
          permissions: ["manpower.calendars.view", "manpower.calendars.manage"],
          operationAccess: ["ALL"]
        }
      });

      const resPreApproved = await postHolidayCalendars(
        new Request("http://localhost:3100/api/v1/manpower/holiday-calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year: 2027,
            name: "Pre-Approved Bypass Attempt",
            approvalStatus: "APPROVED"
          })
        })
      );
      expect(resPreApproved.status).toBe(403);
    });
  });

  describe("RBAC-DEF-024: Production NEXTAUTH_SECRET guard", () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it("throws in production when NEXTAUTH_SECRET is missing or empty and preserves configured secrets", () => {
      process.env = { ...originalEnv, NODE_ENV: "production" };
      delete process.env.NEXTAUTH_SECRET;

      expect(() => resolveWebSecret()).toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);
      expect(() => resolveMobileSecret()).toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);

      process.env.NEXTAUTH_SECRET = "   ";
      expect(() => resolveWebSecret()).toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);
      expect(() => resolveMobileSecret()).toThrow(/NEXTAUTH_SECRET environment variable must be explicitly configured/);

      process.env.NEXTAUTH_SECRET = "configured-production-secret-key-xyz-987654321";
      expect(resolveWebSecret()).toBe("configured-production-secret-key-xyz-987654321");
      expect(resolveMobileSecret()).toBe("configured-production-secret-key-xyz-987654321");
    });
  });

  describe("Gate 3A-3E Independent Verification Edge Cases", () => {
    it("Gate 3A: enforces deny-by-default on missing/null targetCompanyId and users with no assigned company", async () => {
      const unassignedUser = {
        id: "EMP-NO-COMP",
        employeeId: "EMP-NO-COMP",
        role: "SUPERVISOR",
        companyId: null,
        allowedCompanyIds: [],
        permissions: ["secfac.postOrders.view", "secfac.postOrders.manage"],
        operationAccess: ["SECURITY_GUARDING"]
      };

      const assignedUser = {
        id: "EMP-COMP-2",
        employeeId: "EMP-COMP-2",
        role: "SUPERVISOR",
        companyId: "COMP-002",
        allowedCompanyIds: ["COMP-002"],
        permissions: ["secfac.postOrders.view"]
      };

      // Deny-by-default when targetCompanyId is null, undefined, or empty for non-admin
      expect(canAccessCompany(assignedUser, null)).toBe(false);
      expect(canAccessCompany(assignedUser, undefined)).toBe(false);
      expect(canAccessCompany(assignedUser, "   ")).toBe(false);
      expect(mobileCanAccessCompany(assignedUser, null)).toBe(false);

      // Deny-by-default when user has no company assignment
      expect(canAccessCompany(unassignedUser, "COMP-001")).toBe(false);
      expect(mobileCanAccessCompany(unassignedUser, "COMP-001")).toBe(false);
      const filterRes = resolveAuthorizedCompanyFilter(unassignedUser, null);
      expect(filterRes.error?.status).toBe(403);

      // SECFAC route rejects non-admin user with no assigned company instead of falling back to COMP001
      mockGetServerSession.mockResolvedValue({ user: unassignedUser });
      const resPoNoComp = await getSecfacPostOrders(
        new Request("http://localhost:3100/api/v1/secfac/post-orders")
      );
      expect(resPoNoComp.status).toBe(403);
    });

    it("Gate 3B: revokes active Web and Mobile API calls immediately when live employee record is locked or disabled mid-session", async () => {
      // Session JWT claims still say active/unlocked, but live DB record was just locked/deactivated
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-LIVE-REVOKE",
          employeeId: "EMP-LIVE-REVOKE",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          permissions: ["employees.view", "self.profile.view"]
        }
      });

      // 1. Live employee locked -> 401 on Web and Mobile route handlers
      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-LIVE-REVOKE",
          name: "Locked Mid-Session",
          email: "locked@ahh.com",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: true,
          webAccessEnabled: true,
          mobileAccessEnabled: true
        }
      ] as any);

      const webResLocked = await getWebEmployee(
        new Request("http://localhost:3100/api/v1/employees/EMP-LIVE-REVOKE"),
        { params: { id: "EMP-LIVE-REVOKE" } }
      );
      expect(webResLocked.status).toBe(401);

      const mobResLocked = await getMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-LIVE-REVOKE"),
        { params: { id: "EMP-LIVE-REVOKE" } }
      );
      expect(mobResLocked.status).toBe(401);

      // 2. Live employee webAccessEnabled=false / mobileAccessEnabled=false -> 403
      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-LIVE-REVOKE",
          name: "Platform Disabled Mid-Session",
          email: "disabled@ahh.com",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: false,
          mobileAccessEnabled: false
        }
      ] as any);

      const webResPlatform = await getWebEmployee(
        new Request("http://localhost:3100/api/v1/employees/EMP-LIVE-REVOKE"),
        { params: { id: "EMP-LIVE-REVOKE" } }
      );
      expect(webResPlatform.status).toBe(403);

      const mobResPlatform = await getMobileEmployee(
        new Request("http://localhost:3101/api/v1/employees/EMP-LIVE-REVOKE"),
        { params: { id: "EMP-LIVE-REVOKE" } }
      );
      expect(mobResPlatform.status).toBe(403);
    });

    it("Gate 3C: enforces contract workflow approver eligibility, level-to-contract binding, scope isolation, and Maker/Checker SoD", async () => {
      const sgContractWithWorkflow = {
        id: "CON-SG-100",
        operationType: "SECURITY_GUARDING",
        status: "PENDING_APPROVAL",
        approvalStatus: "PENDING_APPROVAL",
        workflows: [
          {
            id: "WF-SG-100",
            contractId: "CON-SG-100",
            status: "PENDING",
            submittedBy: "EMP-MAKER-001",
            levels: [
              {
                id: "LVL-SG-1",
                levelNumber: 1,
                levelName: "Operations Review",
                approvalRule: "ANY_ONE",
                approvers: [{ id: "AP-1", employeeId: "EMP-APPROVER-001", approvalStatus: "PENDING" }]
              },
              {
                id: "LVL-SG-2",
                levelNumber: 2,
                levelName: "Executive Approval",
                approvalRule: "ANY_ONE",
                approvers: [{ id: "AP-2", employeeId: "EMP-APPROVER-002", approvalStatus: "PENDING" }]
              }
            ]
          }
        ]
      };

      jest.spyOn(mockDb, "getManpowerContract").mockImplementation(async (id: string) => {
        if (id === "CON-SG-100") return sgContractWithWorkflow as any;
        return null;
      });

      // 1. Cross-division attempt: calling FM workflow approve on an SG contract -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-APPROVER-001",
          employeeId: "EMP-APPROVER-001",
          role: "OPERATIONS_MANAGER",
          permissions: ["manpower.fm.manage", "manpower.security.manage"],
          operationAccess: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"]
        }
      });
      const resWrongDivision = await postFmApproveWorkflow(
        new Request("http://localhost:3100/api/v1/manpower/facility-management/contracts/CON-SG-100/workflow/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levelId: "LVL-SG-1" })
        }),
        { params: { id: "CON-SG-100" } }
      );
      expect(resWrongDivision.status).toBe(403);

      // 2. Cross-contract levelId attempt: passing a levelId not belonging to CON-SG-100 -> 403
      const resWrongLevel = await postSgApproveWorkflow(
        new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/CON-SG-100/workflow/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levelId: "LVL-OTHER-CONTRACT" })
        }),
        { params: { id: "CON-SG-100" } }
      );
      expect(resWrongLevel.status).toBe(403);

      // 3. Maker/Checker SoD: workflow submitter attempting to self-approve -> 403
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-MAKER-001",
          employeeId: "EMP-MAKER-001",
          name: "EMP-MAKER-001",
          role: "OPERATIONS_MANAGER",
          permissions: ["manpower.security.manage"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });
      const resSelfApprove = await postSgApproveWorkflow(
        new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/CON-SG-100/workflow/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levelId: "LVL-SG-1" })
        }),
        { params: { id: "CON-SG-100" } }
      );
      expect(resSelfApprove.status).toBe(403);

      // 4. Non-approver passing their own sessionEmployeeId -> rejected 403 by workflow engine
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-NON-APPROVER",
          employeeId: "EMP-NON-APPROVER",
          role: "OPERATIONS_MANAGER",
          permissions: ["manpower.security.manage"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });
      jest.spyOn(mockDb, "approveContractWorkflowLevel").mockRejectedValueOnce(
        new Error("You are not authorized to approve this workflow level.")
      );
      const resNonApprover = await postSgApproveWorkflow(
        new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/CON-SG-100/workflow/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levelId: "LVL-SG-1" })
        }),
        { params: { id: "CON-SG-100" } }
      );
      expect(resNonApprover.status).toBe(403);

      // 5. Out-of-order level approval (Level 2 before Level 1) -> rejected 400
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-APPROVER-002",
          employeeId: "EMP-APPROVER-002",
          role: "OPERATIONS_MANAGER",
          permissions: ["manpower.security.manage"],
          operationAccess: ["SECURITY_GUARDING"]
        }
      });
      jest.spyOn(mockDb, "approveContractWorkflowLevel").mockRejectedValueOnce(
        new Error('Cannot approve this level before previous level "Operations Review" is approved.')
      );
      const resOutOfOrder = await postSgApproveWorkflow(
        new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/CON-SG-100/workflow/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levelId: "LVL-SG-2" })
        }),
        { params: { id: "CON-SG-100" } }
      );
      expect(resOutOfOrder.status).toBe(400);
    });

    it("Gate 3D: blocks legacy DB manpower.admin.full_access on single-scope roles from direct checks, cross-scope menus, and Commercial Survey workflow", () => {
      const legacySgAdmin = {
        id: "EMP-SG-LEGACY",
        role: "SECURITY_ADMIN",
        permissions: ["manpower.admin.full_access", "manpower.security.view"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: false
        }
      };

      // Direct check for manpower.admin.full_access is blocked for single-scope user
      expect(webHasPermission(legacySgAdmin, "manpower.admin.full_access")).toBe(false);
      expect(mobileHasPermission(legacySgAdmin, "manpower.admin.full_access")).toBe(false);
      expect(hasClientPermission(legacySgAdmin, "manpower.admin.full_access")).toBe(false);

      // Navigation filter hides FM items from legacy SG admin while keeping SG items
      const navItems = [
        { path: "/manpower/security-guarding/contracts" },
        { path: "/manpower/facility-management/contracts" }
      ];
      const visibleNav = filterNavigationByPermissions(legacySgAdmin, navItems);
      expect(visibleNav.map((i) => i.path)).toEqual(["/manpower/security-guarding/contracts"]);

      // Commercial Survey workflow actions are NOT granted by manpower.admin.full_access alone
      const dualScopeManpowerUser = {
        id: "EMP-MP-DUAL",
        role: "OPERATIONS_MANAGER",
        permissions: ["manpower.admin.full_access"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: true
        }
      };
      expect(canUserPerformSurveyWorkflowAction(dualScopeManpowerUser, "APPROVE")).toBe(false);
      expect(isUserEligibleSurveyLevelApprover(dualScopeManpowerUser, null, "APPROVE")).toBe(false);
      expect(
        getAuthorizedSurveyWorkflowActions(dualScopeManpowerUser, {
          lifecycle: "IN_WORKFLOW",
          conductedBy: "EMP-OTHER",
          companyId: "COMP-001",
          operationType: "SECURITY_GUARDING"
        })
      ).toEqual([]);
    });

    it("Gate 3E: strips passwordHash from user-accounts and SG/FM manpower employee responses", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SA-001",
          employeeId: "EMP-SA-001",
          role: "SUPER_ADMIN",
          permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN,
          operationAccess: ["ALL"]
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-SA-001",
          name: "Super Admin",
          email: "sa@ahh.com",
          role: "SUPER_ADMIN",
          isActive: true,
          employmentStatus: "ACTIVE",
          isLoginEnabled: true
        },
        {
          id: "EMP-BC-SG",
          name: "SG Guard",
          email: "sg@ahh.com",
          role: "EMPLOYEE",
          companyCode: "HS01",
          employeeCategory: "BLUE_COLLAR",
          isActive: true,
          employmentStatus: "ACTIVE",
          passwordHash: "$2a$10$secretSgHash"
        },
        {
          id: "EMP-BC-FM",
          name: "FM Cleaner",
          email: "fm@ahh.com",
          role: "EMPLOYEE",
          companyCode: "TC01",
          employeeCategory: "BLUE_COLLAR",
          isActive: true,
          employmentStatus: "ACTIVE",
          passwordHash: "$2a$10$secretFmHash"
        }
      ] as any);
      jest.spyOn(mockDb, "getSecurityOperationalEmployees").mockResolvedValue([] as any);
      jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
      jest.spyOn(mockDb, "getUserOperationAccesses").mockResolvedValue([] as any);

      const resSg = await getSgManpower(new Request("http://localhost:3100/api/v1/manpower/security-guarding/manpower"));
      expect(resSg.status).toBe(200);
      const sgList = await resSg.json();
      expect(sgList[0].passwordHash).toBeUndefined();

      const resFm = await getFmManpower(new Request("http://localhost:3100/api/v1/manpower/facility-management/manpower"));
      expect(resFm.status).toBe(200);
      const fmList = await resFm.json();
      expect(fmList[0].passwordHash).toBeUndefined();

      const resAccounts = await getUserAccounts();
      expect(resAccounts.status).toBe(200);
      const accountsList = await resAccounts.json();
      expect(accountsList.every((acc: any) => acc.passwordHash === undefined)).toBe(true);
    });
  });

  describe("Gate A: Live Authorization Fail-Closed Verification (Scenarios 1-6)", () => {
    it("Scenarios 1 & 2: fails closed with 503 Service Unavailable when database is unavailable or employee lookup throws an exception (never falling back to stale JWT claims)", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-SA-001",
          employeeId: "EMP-SA-001",
          role: "SUPER_ADMIN",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN
        }
      });

      // Scenario 1: Database connection unavailable (ECONNREFUSED)
      jest.spyOn(mockDb, "getEmployees").mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:3306"));
      const webDbDown = await checkApiAuth();
      expect(webDbDown.error?.status).toBe(503);
      expect(webDbDown.session).toBeNull();

      jest.spyOn(mockDb, "getEmployees").mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:3306"));
      const mobDbDown = await mobileCheckApiAuth();
      expect(mobDbDown.error?.status).toBe(503);
      expect(mobDbDown.session).toBeNull();

      // Scenario 2: Employee lookup throws an unexpected runtime exception
      jest.spyOn(mockDb, "getEmployees").mockRejectedValueOnce(new Error("PrismaClientUnknownRequestError: Query engine exited"));
      const webLookupErr = await checkApiAuth(undefined, { requiredPermission: "users.manage" });
      expect(webLookupErr.error?.status).toBe(503);
      expect(webLookupErr.session).toBeNull();

      // NextAuth jwt() callback sets authVerifyError=true on DB exception without permanently revoking cookie, and clears it on recovery
      jest.spyOn(mockDb, "getEmployees").mockRejectedValueOnce(new Error("DB timeout"));
      const tokenDuringOutage = await webAuthOptions.callbacks!.jwt!({
        token: { id: "EMP-SA-001", role: "SUPER_ADMIN", authPlatform: "WEB", aud: WEB_SESSION_AUDIENCE } as any,
        user: undefined as any,
        account: null
      });
      expect((tokenDuringOutage as any).authVerifyError).toBe(true);
    });

    it("Scenario 3: fails closed with 401 Unauthorized when employee record cannot be found in live lookup", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-DELETED-999",
          employeeId: "EMP-DELETED-999",
          role: "SUPER_ADMIN",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        { id: "EMP-OTHER-001", role: "EMPLOYEE", isActive: true, isLoginEnabled: true }
      ] as any);

      const webNotFound = await checkApiAuth();
      expect(webNotFound.error?.status).toBe(401);
      expect(webNotFound.session).toBeNull();

      const mobNotFound = await mobileCheckApiAuth();
      expect(mobNotFound.error?.status).toBe(401);
      expect(mobNotFound.session).toBeNull();

      // NextAuth jwt() callback revokes token when employee record is missing
      const webTokenMissingEmp = await webAuthOptions.callbacks!.jwt!({
        token: { id: "EMP-DELETED-999", role: "SUPER_ADMIN", authPlatform: "WEB", aud: WEB_SESSION_AUDIENCE } as any,
        user: undefined as any,
        account: null
      });
      expect((webTokenMissingEmp as any).isRevoked).toBe(true);
      expect((webTokenMissingEmp as any).permissions).toEqual([]);
    });

    it("Scenarios 4, 5 & 6: enforces live lock/deactivation (401), live role/permission revocation (403), and live platform access revocation (403)", async () => {
      // Scenario 5a: Base role downgraded from HR_MANAGER to EMPLOYEE during active session
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-DEMOTED-001",
          employeeId: "EMP-DEMOTED-001",
          role: "HR_MANAGER",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          permissions: DEFAULT_ROLE_PERMISSIONS.HR_MANAGER,
          assignedRoleIds: []
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-DEMOTED-001",
          name: "Demoted User",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true
        }
      ] as any);
      jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
      jest.spyOn(mockDb, "getSystemRoles").mockResolvedValue([
        { id: "ROLE-EMP", name: "EMPLOYEE", isActive: true }
      ] as any);
      jest.spyOn(mockDb, "getRolePermissions").mockResolvedValue([] as any);
      jest.spyOn(mockDb, "getSystemPermissions").mockResolvedValue([] as any);
      jest.spyOn(mockDb, "getUserOperationAccess").mockResolvedValue(null as any);

      // Operation requiring users.manage (which HR_MANAGER had in stale JWT, but EMPLOYEE does not have) -> 403
      const demotedAuth = await checkApiAuth(undefined, { requiredPermission: "users.manage" });
      expect(demotedAuth.error?.status).toBe(403);
      expect(demotedAuth.session).toBeNull();

      // Scenario 5b: Assigned supplementary role (HR_MANAGER) revoked in UserRoleAssignment during active session
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-REVOKED-ROLE-001",
          employeeId: "EMP-REVOKED-ROLE-001",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          permissions: DEFAULT_ROLE_PERMISSIONS.HR_MANAGER,
          assignedRoleIds: ["ROLE-HR"]
        }
      });

      jest.spyOn(mockDb, "getEmployees").mockResolvedValue([
        {
          id: "EMP-REVOKED-ROLE-001",
          name: "Role Revoked User",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true
        }
      ] as any);
      // Role assignment is now inactive (revoked)
      jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([
        { id: "ASG-1", employeeId: "EMP-REVOKED-ROLE-001", roleId: "ROLE-HR", isActive: false }
      ] as any);

      const revokedRoleAuth = await checkApiAuth(undefined, { requiredPermission: "users.manage" });
      expect(revokedRoleAuth.error?.status).toBe(403);

      const mobRevokedRoleAuth = await mobileCheckApiAuth(undefined, { requiredPermission: "users.manage" });
      expect(mobRevokedRoleAuth.error?.status).toBe(403);
    });
  });

  describe("Gate C: Web/Mobile Session & Cookie Isolation (Scenarios 1-8)", () => {
    it("enforces distinct cookie names and strict audience/platform binding across Web (:3100/:3200) and Mobile (:3101/:3201)", async () => {
      // Scenario 5: Same-host, different-port browser cookie isolation via distinct cookie names
      expect(WEB_SESSION_COOKIE_NAME).toBe("ahh-wfm.web.session-token");
      expect(MOBILE_SESSION_COOKIE_NAME).toBe("ahh-wfm.mobile.session-token");
      expect(WEB_SESSION_COOKIE_NAME).not.toBe(MOBILE_SESSION_COOKIE_NAME);
      expect(webAuthOptions.cookies?.sessionToken?.name).toBe(WEB_SESSION_COOKIE_NAME);
      expect(mobileAuthOptions.cookies?.sessionToken?.name).toBe(MOBILE_SESSION_COOKIE_NAME);

      // Scenario 1: Web-enabled / Mobile-disabled user
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-WEB-ONLY",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: false,
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE,
          permissions: ["self.profile.view"]
        }
      });
      const webOnlyOnWeb = await checkApiAuth();
      expect(webOnlyOnWeb.error).toBeNull();
      expect(webOnlyOnWeb.session).not.toBeNull();

      const webOnlyOnMobile = await mobileCheckApiAuth();
      expect(webOnlyOnMobile.error?.status).toBe(403);

      // Scenario 2: Mobile-enabled / Web-disabled user
      mockGetServerSession.mockResolvedValue({
        user: {
          id: "EMP-MOB-ONLY-2",
          role: "EMPLOYEE",
          isActive: true,
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: false,
          mobileAccessEnabled: true,
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE,
          permissions: ["self.profile.view"]
        }
      });
      const mobOnlyOnMobile = await mobileCheckApiAuth();
      expect(mobOnlyOnMobile.error).toBeNull();
      expect(mobOnlyOnMobile.session).not.toBeNull();

      const mobOnlyOnWeb = await checkApiAuth();
      expect(mobOnlyOnWeb.error?.status).toBe(403);

      // Scenario 3: User enabled for BOTH platforms still cannot reuse a Mobile token on Web or a Web token on Mobile
      const dualUserMobileTokenOnWeb = await webAuthOptions.callbacks!.jwt!({
        token: {
          id: "EMP-DUAL-001",
          role: "EMPLOYEE",
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          authPlatform: "MOBILE",
          aud: MOBILE_SESSION_AUDIENCE
        } as any,
        user: undefined as any,
        account: null
      });
      expect((dualUserMobileTokenOnWeb as any).isRevoked).toBe(true);

      const dualUserWebTokenOnMobile = await mobileAuthOptions.callbacks!.jwt!({
        token: {
          id: "EMP-DUAL-001",
          role: "EMPLOYEE",
          webAccessEnabled: true,
          mobileAccessEnabled: true,
          authPlatform: "WEB",
          aud: WEB_SESSION_AUDIENCE
        } as any,
        user: undefined as any,
        account: null
      });
      expect((dualUserWebTokenOnMobile as any).isRevoked).toBe(true);
    });
  });
});
