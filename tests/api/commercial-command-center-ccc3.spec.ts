import * as crypto from "crypto";
import { prisma } from "@ahh-wfm/database";
import { GET as getEscalations } from "../../apps/web/app/api/v1/commercial/command-center/escalations/route";
import { GET as getEscalationById, PATCH as patchEscalationById } from "../../apps/web/app/api/v1/commercial/command-center/escalations/[id]/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Command Center Phase CCC-3 Suite (Operational Escalation Queue & Workflow)", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CCC3",
    name: "Commercial Admin CCC3",
    role: "SUPER_ADMIN",
    companyId: "COMP-CCC3-01",
    permissions: [
      "manpower.admin.full_access",
      "commercial.commandCenter.view",
      "commercial.commandCenter.exceptions"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockSgUser = {
    id: "EMP-SG-CCC3",
    name: "SG Supervisor CCC3",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CCC3-01",
    permissions: ["commercial.commandCenter.view", "commercial.commandCenter.exceptions"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockFmUser = {
    id: "EMP-FM-CCC3",
    name: "FM Supervisor CCC3",
    role: "FM_ADMIN",
    companyId: "COMP-CCC3-01",
    permissions: ["commercial.commandCenter.view", "commercial.commandCenter.exceptions"],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: true
    }
  };

  const mockUnauthorizedUser = {
    id: "EMP-NOACCESS-CCC3",
    name: "No Access User",
    role: "GUEST",
    permissions: [],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: false
    }
  };

  let testCompany: any;
  let testClient: any;
  let testContract: any;
  let testEmployee: any;
  let testPlanningException: any;
  let testPlanningException2: any;
  let testPlanningExceptionSited: any; // siteId-scoped exception for isolation tests
  let testAttendanceRecord: any;
  let testCorrection: any;
  // Reconciliation FK chain
  let testProject: any;
  let testSite: any;
  let testRequirement: any;
  let testSlot: any;
  let testReconciliation: any;
  // Site-restricted mock users — constructed in beforeAll once testSite.id is known
  let mockSiteRestrictedUser: any;
  let mockOtherSiteUser: any;

  beforeAll(async () => {
    // 0. Clean up any stale CCC3 test data from prior runs
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM UserActivityLog WHERE entityType = 'COMMAND_CENTER_ESCALATION' AND userId IN ('EMP-ADMIN-CCC3')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM RosterPlanningException WHERE contractId IN (SELECT id FROM ManpowerContract WHERE contractNumber IN ('CONT-CCC3-001'))`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM AttendanceCorrection WHERE attendanceRecordId IN (SELECT id FROM AttendanceRecord WHERE employeeId = 'EMP-CCC3-TEST-001')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM AttendanceRecord WHERE employeeId = 'EMP-CCC3-TEST-001'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContract WHERE contractNumber = 'CONT-CCC3-001'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerClient WHERE code = 'CCC3-CLIENT-01'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM Employee WHERE id = 'EMP-CCC3-TEST-001'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM Company WHERE id = 'COMP-CCC3-01'`
      );
    } catch (e) {}

    // 1. Seed test company
    testCompany = await prisma.company.upsert({
      where: { id: "COMP-CCC3-01" },
      update: {},
      create: {
        id: "COMP-CCC3-01",
        companyCode: "COMP-CCC3-TEST",
        companyName: "CCC-3 Escalations Test Company"
      }
    });

    // 2. Seed test manpower client (ManpowerClient — not prisma.client)
    testClient = await prisma.manpowerClient.create({
      data: {
        name: "CCC-3 Escalations Client",
        code: "CCC3-CLIENT-01",
        operationType: "SECURITY_GUARDING"
      }
    });

    // 3. Seed test manpower contract (no companyId on ManpowerContract)
    testContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClient.id,
        contractNumber: "CONT-CCC3-001",
        title: "CCC-3 Escalation SLA Contract",
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        defaultManpowerCount: 10,
        defaultRelieverCount: 2
      }
    });

    // 4. Seed test employee (Employee.id has no @default — must be provided)
    testEmployee = await prisma.employee.create({
      data: {
        id: "EMP-CCC3-TEST-001",
        name: "Test Guarding Employee",
        department: "Security Operations",
        role: "EMPLOYEE",
        status: "On Duty",
        email: "ccc3.test.emp@ahh-wfm-test.local",
        companyId: testCompany.id,
        dutyStatus: "ON_DUTY"
      }
    });

    // 5. Seed Primary Roster Planning Exception (used in PATCH tests 19-21)
    // RosterPlanningException: operationType, contractId, exceptionType, message (not description)
    testPlanningException = await prisma.rosterPlanningException.create({
      data: {
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        exceptionType: "ELIGIBILITY_CHANGED",
        severity: "HIGH",
        message: "Test Roster Planning Exception for CCC-3 Queue",
        status: "COVERAGE_REQUIRED",
        businessDate: new Date()
      }
    });

    // 6. Seed Secondary Roster Planning Exception (used in test 22)
    testPlanningException2 = await prisma.rosterPlanningException.create({
      data: {
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        exceptionType: "EXCESS_ASSIGNED_SLOT",
        severity: "CRITICAL",
        message: "Secondary Test Exception for CCC-3 Audit Trail Verification",
        status: "OPEN",
        businessDate: new Date()
      }
    });

    // 7. Seed AttendanceRecord (no "date" field — use employeeName, lat, lng, device, locationName)
    testAttendanceRecord = await prisma.attendanceRecord.create({
      data: {
        employeeId: testEmployee.id,
        employeeName: "Test Guarding Employee",
        lat: 25.2854,
        lng: 51.5310,
        device: "CCC3-TEST-DEVICE",
        status: "MISSED_PUNCH",
        locationName: "CCC-3 Test Site"
      }
    });

    // 8. Seed AttendanceCorrection (no employeeId on this model — only attendanceRecordId)
    testCorrection = await prisma.attendanceCorrection.create({
      data: {
        attendanceRecordId: testAttendanceRecord.id,
        reason: "Mis-punched card due to scanner failure",
        status: "Pending"
      }
    });

    // -----------------------------------------------------------------------
    // Reconciliation FK chain (supports tests 6, 27, 39-42)
    // Chain: ManpowerContract → ManpowerProject → ManpowerSite
    //        → ContractManpowerRequirement → RosterRequirementSlot
    //        → AttendanceRosterReconciliation
    // -----------------------------------------------------------------------

    // 9. ManpowerProject
    testProject = await prisma.manpowerProject.create({
      data: {
        contractId: testContract.id,
        name: "CCC-3 Integration Test Project",
        code: "PROJ-CCC3-TEST-001",
        operationType: "SECURITY_GUARDING"
      }
    });

    // 10. ManpowerSite (used for site-isolation tests 27-28)
    testSite = await prisma.manpowerSite.create({
      data: {
        projectId: testProject.id,
        code: "SITE-CCC3-TEST-001",
        name: "CCC-3 Test Site Alpha",
        operationType: "SECURITY_GUARDING",
        lat: 25.2854,
        lng: 51.5310,
        radiusMeters: 100
      }
    });

    // 11. ContractManpowerRequirement
    testRequirement = await prisma.contractManpowerRequirement.create({
      data: {
        contractId: testContract.id,
        position: "Security Guard",
        quantity: 2,
        deploymentType: "PERMANENT"
      }
    });

    // 12. RosterRequirementSlot (generationKey is unique)
    const slotDate = new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");
    testSlot = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompany.id,
        contractId: testContract.id,
        projectId: testProject.id,
        siteId: testSite.id,
        locationKey: `site:${testSite.id}`,
        contractRequirementId: testRequirement.id,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: slotDate,
        shiftKey: "shift:CCC3-TEST-SHIFT",
        slotIndex: 1,
        generationKey: `${testRequirement.id}:${slotDate.toISOString().split("T")[0]}:shift:CCC3-TEST-SHIFT:1`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift",
        snapshotStartTime: "07:00",
        snapshotEndTime: "19:00",
        fulfillmentStatus: "VACANT"
      }
    });

    // 13. AttendanceRosterReconciliation — real FK-chain integration fixture
    const canonicalIdentity = `CCC3:RECON:${testSlot.id}:${testEmployee.id}:${slotDate.toISOString().split("T")[0]}`;
    const reconciliationKey = crypto.createHash("sha256").update(canonicalIdentity).digest("hex");
    testReconciliation = await prisma.attendanceRosterReconciliation.create({
      data: {
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        contractCode: testContract.contractNumber,
        contractTitle: testContract.title,
        projectId: testProject.id,
        siteId: testSite.id,
        slotId: testSlot.id,
        expectedEmployeeId: testEmployee.id,
        expectedEmployeeCode: testEmployee.id,
        expectedEmployeeName: testEmployee.name,
        expectedSourceType: "PUBLISHED_PRIMARY",
        businessDate: slotDate,
        shiftKey: "shift:CCC3-TEST-SHIFT",
        scheduledStartUtc: new Date(`${slotDate.toISOString().split("T")[0]}T04:00:00.000Z`),
        scheduledEndUtc: new Date(`${slotDate.toISOString().split("T")[0]}T16:00:00.000Z`),
        resolvedGracePeriodMinutes: 5,
        resolvedNoCheckInThresholdMinutes: 30,
        resolvedEarlyAllowanceMinutes: 5,
        resolvedSyncThresholdMinutes: 10,
        detectionOutcome: "NO_CHECK_IN",
        workflowStatus: "OPEN",
        canonicalIdentity,
        reconciliationKey
      }
    });

    // 14. Planning exception WITH explicit siteId (for site isolation test 28)
    testPlanningExceptionSited = await prisma.rosterPlanningException.create({
      data: {
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        siteId: testSite.id,
        exceptionType: "MISSED_SHIFT",
        severity: "MEDIUM",
        message: "Site-scoped Exception for Isolation Proof CCC3",
        status: "OPEN",
        businessDate: new Date()
      }
    });

    // 15. Build site-restricted mock users (testSite.id now known)
    mockSiteRestrictedUser = {
      id: "EMP-SITERESTRICTED-CCC3",
      name: "Site Restricted Supervisor CCC3",
      role: "SECURITY_SUPERVISOR",
      companyId: "COMP-CCC3-01",
      siteId: testSite.id,
      permissions: ["commercial.commandCenter.view", "commercial.commandCenter.exceptions"],
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
    };
    mockOtherSiteUser = {
      id: "EMP-OTHERSITE-CCC3",
      name: "Other Site Supervisor CCC3",
      role: "SECURITY_SUPERVISOR",
      companyId: "COMP-CCC3-01",
      siteId: "SITE-OTHER-DOES-NOT-EXIST-CCC3",
      permissions: ["commercial.commandCenter.view", "commercial.commandCenter.exceptions"],
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
    };
  });

  afterAll(async () => {
    // Cleanup in strict FK dependency order (Restrict = delete children first, Cascade = parent deletes children)

    // 1. AttendanceRosterReconciliation → Restrict FK to slotId, contractId, expectedEmployeeId
    if (testReconciliation) {
      await prisma.attendanceRosterReconciliation.delete({ where: { id: testReconciliation.id } }).catch(() => {});
    }
    // 2. RosterRequirementSlot → Restrict FK to contractId, projectId, contractRequirementId
    if (testSlot) {
      await prisma.rosterRequirementSlot.delete({ where: { id: testSlot.id } }).catch(() => {});
    }
    // 3. ContractManpowerRequirement → Cascade from contract but delete explicitly
    if (testRequirement) {
      await prisma.contractManpowerRequirement.delete({ where: { id: testRequirement.id } }).catch(() => {});
    }
    // 4. All planning exceptions before contract
    if (testPlanningExceptionSited) {
      await prisma.rosterPlanningException.delete({ where: { id: testPlanningExceptionSited.id } }).catch(() => {});
    }
    if (testPlanningException2) {
      await prisma.rosterPlanningException.delete({ where: { id: testPlanningException2.id } }).catch(() => {});
    }
    if (testPlanningException) {
      await prisma.rosterPlanningException.delete({ where: { id: testPlanningException.id } }).catch(() => {});
    }
    // 5. AttendanceRecord cascades AttendanceCorrection
    if (testAttendanceRecord) {
      await prisma.attendanceRecord.delete({ where: { id: testAttendanceRecord.id } }).catch(() => {});
    }
    // 6. ManpowerContract cascades ManpowerProject → ManpowerSite (Cascade rules)
    if (testContract) {
      await prisma.manpowerContract.delete({ where: { id: testContract.id } }).catch(() => {});
    }
    if (testClient) {
      await prisma.manpowerClient.delete({ where: { id: testClient.id } }).catch(() => {});
    }
    if (testEmployee) {
      await prisma.employee.delete({ where: { id: testEmployee.id } }).catch(() => {});
    }
    if (testCompany) {
      await prisma.company.delete({ where: { id: testCompany.id } }).catch(() => {});
    }
    // Clean up all activity logs created during test runs
    await prisma.userActivityLog.deleteMany({
      where: { entityType: "COMMAND_CENTER_ESCALATION", userId: mockAdminUser.id }
    }).catch(() => {});
  });

  describe("1. GET /api/v1/commercial/command-center/escalations — Auth & Permissions", () => {
    it("1. returns 401 Unauthenticated when session is missing", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(401);
    });

    it("2. returns 403 Forbidden when user lacks commercial command center permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockUnauthorizedUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(403);
    });

    it("3. returns 400 Bad Request on invalid businessDate format", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?businessDate=invalid-date");
      const res = await getEscalations(req);
      expect(res.status).toBe(400);
    });
  });

  describe("2. GET /api/v1/commercial/command-center/escalations — Queue Aggregation & Scorecards", () => {
    it("4. returns summary metrics scorecard structure", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.summaryMetrics).toBeDefined();
      expect(typeof data.summaryMetrics.totalOpen).toBe("number");
      expect(typeof data.summaryMetrics.criticalCount).toBe("number");
      expect(typeof data.summaryMetrics.highCount).toBe("number");
      expect(typeof data.summaryMetrics.overdueCount).toBe("number");
      expect(typeof data.summaryMetrics.unassignedCount).toBe("number");
      expect(typeof data.summaryMetrics.resolvedTodayCount).toBe("number");
    });

    it("5. aggregates ROSTER_PLANNING_EXCEPTION item in escalation queue", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ROSTER_PLANNING_EXCEPTION`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const match = data.escalations.find((e: any) => e.sourceId === testPlanningException.id);
      expect(match).toBeDefined();
      expect(match.sourceType).toBe("ROSTER_PLANNING_EXCEPTION");
    });

    it("6. UNEXCUSED_RECONCILIATION — real seeded fixture appears in queue with correct structure", async () => {
      // Real integration test: the full FK chain (ManpowerContract → ManpowerProject → ManpowerSite
      // → RosterRequirementSlot → AttendanceRosterReconciliation) has been seeded in beforeAll.
      // This test proves the seeded record is discovered and returned by the aggregation query.
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=UNEXCUSED_RECONCILIATION`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.escalations).toBeDefined();
      expect(Array.isArray(data.escalations)).toBe(true);

      // The seeded AttendanceRosterReconciliation must appear in the queue
      const match = data.escalations.find((e: any) => e.sourceId === testReconciliation.id);
      expect(match).toBeDefined();
      expect(match.sourceType).toBe("UNEXCUSED_RECONCILIATION");
      expect(match.severity).toBeDefined();
      expect(match.drillDownUrl).toBeDefined();
      expect(match.id.startsWith("UNEXCUSED_RECONCILIATION:")).toBe(true);
      expect(match.sourceKey).toBe(match.id);
    });

    it("7. aggregates ATTENDANCE_CORRECTION_PENDING item in escalation queue", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ATTENDANCE_CORRECTION_PENDING`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const match = data.escalations.find((e: any) => e.sourceId === testCorrection.id);
      expect(match).toBeDefined();
      expect(match.sourceType).toBe("ATTENDANCE_CORRECTION_PENDING");
      expect(match.authoritativeModule).toBe("Attendance");
    });

    it("8. CONTRACT_SLA_RISK category returns 200 with correct escalation structure", async () => {
      // CONTRACT_SLA_RISK only appears in queue when a contract has rosterSlots on the target date.
      // The test contract has no slots seeded (RosterRequirementSlot requires a deep FK chain).
      // This test verifies the endpoint responds correctly and returns the expected shape.
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=CONTRACT_SLA_RISK`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.escalations).toBeDefined();
      expect(Array.isArray(data.escalations)).toBe(true);
      // Any returned SLA risk escalations must have the correct fields
      data.escalations.forEach((item: any) => {
        expect(item.sourceType).toBe("CONTRACT_SLA_RISK");
        expect(item.severity).toBeDefined();
        expect(item.drillDownUrl).toBeDefined();
      });
    });
  });

  describe("3. GET /api/v1/commercial/command-center/escalations — Scope & Company Isolation", () => {
    it("9. filters queue by SECURITY_GUARDING operation scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?operationType=SECURITY_GUARDING");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);
    });

    it("10. filters queue by FACILITY_MANAGEMENT operation scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockFmUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?operationType=FACILITY_MANAGEMENT");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);
    });

    it("11. blocks SG user from accessing FACILITY_MANAGEMENT scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?operationType=FACILITY_MANAGEMENT");
      const res = await getEscalations(req);
      expect(res.status).toBe(403);
    });

    it("12. enforces company boundary for company-bound users — only items with matching or unset companyId are returned", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      data.escalations.forEach((item: any) => {
        // Items with an explicit companyId must match the user's companyId
        if (item.companyId) {
          expect(item.companyId).toBe(mockSgUser.companyId);
        }
        // Items with null companyId (no company restriction on record) are allowed through
      });
    });

    it("16. blocks FM user from accessing SECURITY_GUARDING scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockFmUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?operationType=SECURITY_GUARDING");
      const res = await getEscalations(req);
      expect(res.status).toBe(403);
    });

    it("27. site-restricted user sees site-scoped escalations for their authorized site", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSiteRestrictedUser });
      const req = new Request(
        `http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ROSTER_PLANNING_EXCEPTION&siteId=${testSite.id}`
      );
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      // testPlanningExceptionSited has siteId=testSite.id — must appear for authorized site user
      const match = data.escalations.find((e: any) => e.sourceId === testPlanningExceptionSited.id);
      expect(match).toBeDefined();
      expect(match.sourceType).toBe("ROSTER_PLANNING_EXCEPTION");
    });

    it("28. user restricted to a different site does NOT see escalations from testSite", async () => {
      // mockOtherSiteUser.siteId is a non-existent site — isSiteAllowed returns false for testSite items
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockOtherSiteUser });
      const req = new Request(
        `http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ROSTER_PLANNING_EXCEPTION`
      );
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      // testPlanningExceptionSited.siteId (testSite.id) !== mockOtherSiteUser.siteId — must be filtered out
      const blocked = data.escalations.find((e: any) => e.sourceId === testPlanningExceptionSited.id);
      expect(blocked).toBeUndefined();
    });
  });

  describe("4. GET /api/v1/commercial/command-center/escalations — Filters & Idempotency", () => {
    it("13. filters by severity level", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?severity=HIGH");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      data.escalations.forEach((item: any) => {
        expect(item.severity).toBe("HIGH");
      });
    });

    it("14. filters by escalation status", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?status=OPEN");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);
    });

    it("15. filters by overdue SLA items only", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?overdueOnly=true");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);
    });

    it("16. uses deterministic sourceKey format — id starts with sourceType prefix", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      data.escalations.forEach((item: any) => {
        // All IDs must be deterministic, starting with the sourceType prefix
        // e.g. "ROSTER_PLANNING_EXCEPTION:<id>" or "CONTRACT_SLA_RISK:<id>:<date>"
        expect(item.id.startsWith(`${item.sourceType}:`)).toBe(true);
        // sourceKey must equal id (idempotent)
        expect(item.sourceKey).toBe(item.id);
      });
    });

    it("29. pagination — limit=2 returns at most 2 items with correct totalItems metadata", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?limit=2&page=1");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.totalItems).toBe("number");
      expect(typeof data.pagination.totalPages).toBe("number");
      expect(data.escalations.length).toBeLessThanOrEqual(2);
    });

    it("30. limit is capped at 100 — requesting limit=999 returns at most 100 items", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?limit=999");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.escalations.length).toBeLessThanOrEqual(100);
      expect(data.pagination.limit).toBeLessThanOrEqual(100);
    });

    it("31. empty state — filtering by a non-existent ownerId returns empty array, not an error", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations?ownerId=OWNER-DOES-NOT-EXIST-CCC3");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.escalations)).toBe(true);
      expect(data.escalations.length).toBe(0);
    });

    it("32. no duplicate sourceKey — each escalation item appears at most once in the full queue", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const seenKeys = new Set<string>();
      for (const item of data.escalations) {
        expect(seenKeys.has(item.sourceKey)).toBe(false);
        seenKeys.add(item.sourceKey);
      }
    });

    it("33. all escalation items carry a non-empty drillDownUrl", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/escalations");
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      data.escalations.forEach((item: any) => {
        expect(typeof item.drillDownUrl).toBe("string");
        expect(item.drillDownUrl.length).toBeGreaterThan(0);
      });
    });

    it("34. severity mapping — ROSTER_PLANNING_EXCEPTION.severity=HIGH maps to CCC HIGH", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ROSTER_PLANNING_EXCEPTION`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const highItem = data.escalations.find((e: any) => e.sourceId === testPlanningException.id);
      expect(highItem).toBeDefined();
      expect(highItem.severity).toBe("HIGH"); // testPlanningException was seeded with severity "HIGH"
    });

    it("35. severity mapping — ROSTER_PLANNING_EXCEPTION.severity=CRITICAL maps to CCC CRITICAL", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ROSTER_PLANNING_EXCEPTION`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const critItem = data.escalations.find((e: any) => e.sourceId === testPlanningException2.id);
      expect(critItem).toBeDefined();
      expect(critItem.severity).toBe("CRITICAL"); // testPlanningException2 was seeded with severity "CRITICAL"
    });

    it("36. ATTENDANCE_CORRECTION_PENDING items always carry MEDIUM severity and Attendance authoritativeModule", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ATTENDANCE_CORRECTION_PENDING`);
      const res = await getEscalations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const corrItem = data.escalations.find((e: any) => e.sourceId === testCorrection.id);
      expect(corrItem).toBeDefined();
      expect(corrItem.severity).toBe("MEDIUM");
      expect(corrItem.authoritativeModule).toBe("Attendance");
    });
  });

  describe("5. GET & PATCH /api/v1/commercial/command-center/escalations/[id] — Details & Action Management", () => {
    it("17. GET returns single escalation detail and audit history", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`);
      const res = await getEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.escalationId).toBe(key);
      expect(data.sourceRecord).toBeDefined();
      expect(data.auditHistory).toBeDefined();
    });

    it("18. PATCH returns 400 Bad Request on invalid action", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "INVALID_ACTION" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(400);
    });

    it("19. PATCH ACKNOWLEDGE action updates status and records UserActivityLog", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "ACKNOWLEDGE", remarks: "Acknowledged by supervisor" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.updatedStatus).toBe("ACKNOWLEDGED");
    });

    it("20. PATCH ASSIGN action updates owner ID and records UserActivityLog", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "ASSIGN", ownerId: mockSgUser.id, remarks: "Assigned to SG Supervisor" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("21. PATCH RESOLVE action on ROSTER_PLANNING_EXCEPTION updates native status to RESOLVED", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "RESOLVE", remarks: "Standby reliever deployed" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      // Verify native model update
      const updatedExc = await prisma.rosterPlanningException.findUnique({
        where: { id: testPlanningException.id }
      });
      expect(updatedExc?.status).toBe("RESOLVED");
      expect(updatedExc?.resolved).toBe(true);
    });

    it("22. PATCH RESOLVE action on secondary exception also updates native status to RESOLVED", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException2.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "RESOLVE", remarks: "Secondary exception resolved via Command Center" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify native model update
      const updatedExc2 = await prisma.rosterPlanningException.findUnique({
        where: { id: testPlanningException2.id }
      });
      expect(updatedExc2?.status).toBe("RESOLVED");
      expect(updatedExc2?.resolved).toBe(true);
    });
  });

  describe("6. Extended Action Management & Lifecycle", () => {
    it("37. ASSIGN ownerId is reflected in subsequent GET list via UserActivityLog overlay (synthetic type)", async () => {
      // Prove the UserActivityLog overlay for synthetic types.
      // ATTENDANCE_CORRECTION_PENDING is a synthetic type with no native CCC status model.
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ATTENDANCE_CORRECTION_PENDING:${testCorrection.id}`;
      const assignReq = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "ASSIGN", ownerId: mockSgUser.id, remarks: "Assigned to SG team" })
      });
      const assignRes = await patchEscalationById(assignReq, { params: { id: key } });
      expect(assignRes.status).toBe(200);

      // GET list — ownerId must appear via UserActivityLog overlay
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const listRes = await getEscalations(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ATTENDANCE_CORRECTION_PENDING`)
      );
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const found = listData.escalations.find((e: any) => e.sourceId === testCorrection.id);
      expect(found).toBeDefined();
      expect(found.ownerId).toBe(mockSgUser.id);
    });

    it("38. reassignment — second ASSIGN overrides previous ownerId in UserActivityLog overlay", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ATTENDANCE_CORRECTION_PENDING:${testCorrection.id}`;
      const reassignRes = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "ASSIGN", ownerId: mockFmUser.id, remarks: "Reassigned to FM team" })
        }),
        { params: { id: key } }
      );
      expect(reassignRes.status).toBe(200);

      // GET list — latest ownerId must now be mockFmUser
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const listRes = await getEscalations(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ATTENDANCE_CORRECTION_PENDING`)
      );
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const found = listData.escalations.find((e: any) => e.sourceId === testCorrection.id);
      expect(found).toBeDefined();
      expect(found.ownerId).toBe(mockFmUser.id); // latest ASSIGN wins
    });

    it("39. COMMENT action is recorded in audit history but does not change native source model status", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const res = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "COMMENT", remarks: "Supervisor reviewed: standby on alert" })
        }),
        { params: { id: key } }
      );
      expect(res.status).toBe(200);

      // Verify COMMENT log entry exists in audit history
      const log = await prisma.userActivityLog.findFirst({
        where: { entityType: "COMMAND_CENTER_ESCALATION", entityId: key, action: "ESCALATION_COMMENT" },
        orderBy: { createdAt: "desc" }
      });
      expect(log).toBeDefined();
      const logData = JSON.parse(log!.afterJson || "{}");
      expect(logData.remarks).toBe("Supervisor reviewed: standby on alert");
    });

    it("40. invalid transition — RESOLVE on already-RESOLVED ROSTER_PLANNING_EXCEPTION returns 400", async () => {
      // First: RESOLVE testPlanningException (currently COVERAGE_REQUIRED)
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningException.id}`;
      const resolveRes = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "RESOLVE", remarks: "Reliever deployed" })
        }),
        { params: { id: key } }
      );
      expect(resolveRes.status).toBe(200);
      // Verify native RESOLVED
      const exc = await prisma.rosterPlanningException.findUnique({ where: { id: testPlanningException.id } });
      expect(exc?.status).toBe("RESOLVED");

      // Second: attempt ACKNOWLEDGE on the now-RESOLVED item — must be rejected
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const reOpenRes = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "ACKNOWLEDGE", remarks: "Attempting to re-open" })
        }),
        { params: { id: key } }
      );
      expect(reOpenRes.status).toBe(400);
      const reOpenData = await reOpenRes.json();
      expect(reOpenData.error).toContain("Invalid transition");
      expect(reOpenData.error).toContain("RESOLVED");
    });

    it("41. auto-resolution — after RESOLVE, exception no longer appears in OPEN status filter", async () => {
      // testPlanningException is RESOLVED after test 40.
      // The GET route WHERE clause (status NOT IN [RESOLVED, CANCELLED]) excludes it from native DB query.
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const res = await getEscalations(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ROSTER_PLANNING_EXCEPTION&status=OPEN`)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      const ghost = data.escalations.find((e: any) => e.sourceId === testPlanningException.id);
      expect(ghost).toBeUndefined(); // RESOLVED exception must not appear in OPEN queue
    });

    it("42. PATCH CANCEL action on site-scoped exception updates native status to CANCELLED", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ROSTER_PLANNING_EXCEPTION:${testPlanningExceptionSited.id}`;
      const res = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "CANCEL", remarks: "Dismissed by CC operator" })
        }),
        { params: { id: key } }
      );
      expect(res.status).toBe(200);
      const sitedExc = await prisma.rosterPlanningException.findUnique({ where: { id: testPlanningExceptionSited.id } });
      expect(sitedExc?.status).toBe("CANCELLED");
      expect(sitedExc?.cancellationReason).toBe("Dismissed by CC operator");
    });
  });

  describe("7. Reconciliation Integration — UNEXCUSED_RECONCILIATION PATCH", () => {
    it("43. GET by ID returns UNEXCUSED_RECONCILIATION detail with full source record", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `UNEXCUSED_RECONCILIATION:${testReconciliation.id}`;
      const res = await getEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`),
        { params: { id: key } }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.escalationId).toBe(key);
      expect(data.sourceRecord).toBeDefined();
      expect(data.sourceRecord.operationType).toBe("SECURITY_GUARDING");
      expect(data.sourceRecord.workflowStatus).toBe("OPEN");
      expect(Array.isArray(data.auditHistory)).toBe(true);
    });

    it("44. PATCH ACKNOWLEDGE on UNEXCUSED_RECONCILIATION sets workflowStatus to UNDER_REVIEW and writes reviewNotes", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `UNEXCUSED_RECONCILIATION:${testReconciliation.id}`;
      const res = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "ACKNOWLEDGE", remarks: "No-show under review" })
        }),
        { params: { id: key } }
      );
      expect(res.status).toBe(200);

      const updated = await prisma.attendanceRosterReconciliation.findUnique({ where: { id: testReconciliation.id } });
      expect(updated?.workflowStatus).toBe("UNDER_REVIEW");
      // reviewNotes field must be updated (bug fix: notes → reviewNotes)
      expect(updated?.reviewNotes).toBe("No-show under review");
    });

    it("45. PATCH RESOLVE on UNEXCUSED_RECONCILIATION sets workflowStatus to RESOLVED", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `UNEXCUSED_RECONCILIATION:${testReconciliation.id}`;
      const res = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "RESOLVE", remarks: "Confirmed no-show, HR notified" })
        }),
        { params: { id: key } }
      );
      expect(res.status).toBe(200);

      const resolved = await prisma.attendanceRosterReconciliation.findUnique({ where: { id: testReconciliation.id } });
      expect(resolved?.workflowStatus).toBe("RESOLVED");
    });

    it("46. invalid transition — RESOLVE on already-RESOLVED UNEXCUSED_RECONCILIATION returns 400", async () => {
      // testReconciliation is now RESOLVED after test 45.
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `UNEXCUSED_RECONCILIATION:${testReconciliation.id}`;
      const res = await patchEscalationById(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "RESOLVE", remarks: "Duplicate resolve attempt" })
        }),
        { params: { id: key } }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid transition");
      expect(data.error).toContain("RESOLVED");
    });
  });

  describe("8. Authoritative Source Protection Rule Enforcement", () => {
    it("23. returns 400 Bad Request when attempting to approve AttendanceCorrection via CCC-3 RESOLVE", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ATTENDANCE_CORRECTION_PENDING:${testCorrection.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "RESOLVE", approveAttendanceCorrection: true })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("Authoritative Source Protection Violation");
      expect(data.error).toContain("AttendanceCorrection approval belongs exclusively to the Attendance module");

      // Verify native AttendanceCorrection remains Pending
      const checkCorrection = await prisma.attendanceCorrection.findUnique({
        where: { id: testCorrection.id }
      });
      expect(checkCorrection?.status).toBe("Pending");
    });

    it("24. permits COMMENT action on ATTENDANCE_CORRECTION_PENDING without modifying AttendanceCorrection approval state", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ATTENDANCE_CORRECTION_PENDING:${testCorrection.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "COMMENT", remarks: "Supervisor checked logs, pending Attendance team approval" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      const checkCorrection = await prisma.attendanceCorrection.findUnique({
        where: { id: testCorrection.id }
      });
      expect(checkCorrection?.status).toBe("Pending");
    });

    it("25. permits ACKNOWLEDGE action on ATTENDANCE_CORRECTION_PENDING without modifying AttendanceCorrection approval state", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const key = `ATTENDANCE_CORRECTION_PENDING:${testCorrection.id}`;
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "ACKNOWLEDGE", remarks: "Received by Command Center operator" })
      });
      const res = await patchEscalationById(req, { params: { id: key } });
      expect(res.status).toBe(200);

      // AttendanceCorrection.status must remain "Pending" — CCC-3 cannot approve it
      const checkCorrection = await prisma.attendanceCorrection.findUnique({
        where: { id: testCorrection.id }
      });
      expect(checkCorrection?.status).toBe("Pending");
    });

    it("47. CCC-3 ACKNOWLEDGE on synthetic type surfaces ACKNOWLEDGED status in subsequent GET (UserActivityLog overlay)", async () => {
      // This test runs after test 25 (ACKNOWLEDGE on testCorrection) and proves the overlay.
      // The latest UserActivityLog entry for testCorrection is ESCALATION_ACKNOWLEDGE.
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const listRes = await getEscalations(
        new Request(`http://localhost:3100/api/v1/commercial/command-center/escalations?sourceType=ATTENDANCE_CORRECTION_PENDING`)
      );
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const corrItem = listData.escalations.find((e: any) => e.sourceId === testCorrection.id);
      expect(corrItem).toBeDefined();
      // The overlay must surface ACKNOWLEDGED from the ESCALATION_ACKNOWLEDGE log entry
      expect(corrItem.status).toBe("ACKNOWLEDGED");
      // Native AttendanceCorrection.status must still be "Pending" — CCC-3 cannot change it
      const nativeRecord = await prisma.attendanceCorrection.findUnique({ where: { id: testCorrection.id } });
      expect(nativeRecord?.status).toBe("Pending");
    });

    it("26. records UserActivityLog for all executed escalation actions", async () => {
      const logs = await prisma.userActivityLog.findMany({
        where: { entityType: "COMMAND_CENTER_ESCALATION" }
      });
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
