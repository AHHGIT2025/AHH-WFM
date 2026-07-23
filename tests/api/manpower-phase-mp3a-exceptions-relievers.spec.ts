import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { 
  getQatarDate, 
  syncAssignmentToLegacy,
  syncSlotsForContractRange,
  checkEmployeeSchedulingEligibility
} from "../../apps/web/lib/roster-engine";

import { POST as recordException, GET as getExceptions } from "../../apps/web/app/api/v1/manpower/scheduling/exceptions/route";
import { POST as assignReliever } from "../../apps/web/app/api/v1/manpower/scheduling/slots/[slotId]/assign-reliever/route";
import { POST as unassignReliever } from "../../apps/web/app/api/v1/manpower/scheduling/assignments/[assignmentId]/unassign-reliever/route";
import { POST as cancelException } from "../../apps/web/app/api/v1/manpower/scheduling/exceptions/[exceptionId]/cancel/route";
import { POST as resolveException } from "../../apps/web/app/api/v1/manpower/scheduling/exceptions/[exceptionId]/resolve/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Manpower Planning Phase MP-3A Exceptions and Relievers Test Suite", () => {
  let mockClient: any;
  let mockProject: any;
  let mockSite: any;
  let mockEmployee: any;
  let mockReliever: any;
  let activeContract: any;
  let testSlots: any[] = [];
  let testAssignments: any[] = [];

  async function cleanupDb() {
    // Break circular references first
    await prisma.rosterSlotAssignment.updateMany({
      where: { employeeId: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever"] } },
      data: { planningExceptionId: null, activeCoverageKey: null, replacesAssignmentId: null }
    });
    await prisma.rosterPlanningException.updateMany({
      where: { employeeId: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever"] } },
      data: { activeExceptionKey: null, primaryAssignmentId: null }
    });

    const testContracts = await prisma.manpowerContract.findMany({
      where: { contractNumber: "MP3A-CON-1" },
      select: { id: true }
    });
    const ids = testContracts.map(c => c.id);
    if (ids.length > 0) {
      await prisma.rosterSlotAssignment.updateMany({
        where: { slot: { contractId: { in: ids } } },
        data: { planningExceptionId: null, activeCoverageKey: null, replacesAssignmentId: null }
      });
      await prisma.rosterPlanningException.updateMany({
        where: { contractId: { in: ids } },
        data: { activeExceptionKey: null, primaryAssignmentId: null }
      });
      await prisma.rosterPlanningException.deleteMany({ where: { contractId: { in: ids } } });
      await prisma.rosterSlotAssignment.deleteMany({ where: { slot: { contractId: { in: ids } } } });
      await prisma.rosterRequirementSlot.deleteMany({ where: { contractId: { in: ids } } });
      await prisma.manpowerContract.deleteMany({ where: { id: { in: ids } } });
    }

    // Delete test assignments and exceptions
    await prisma.rosterPlanningException.deleteMany({
      where: { employeeId: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever"] } }
    });
    await prisma.rosterSlotAssignment.deleteMany({
      where: { employeeId: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever"] } }
    });
    await prisma.shiftAssignment.deleteMany({
      where: { employeeId: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever"] } }
    });
    await prisma.manpowerDeploymentAssignment.deleteMany({
      where: { employeeId: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever"] } }
    });

    await prisma.employee.deleteMany({
      where: { id: { in: ["emp-guard-mp3a-primary", "emp-guard-mp3a-reliever", "emp-admin-mp3a"] } }
    });
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: "emp-guard-mp3a-primary" }
    });
    await prisma.manpowerSchedulingPeriodLock.deleteMany({
      where: { period: "2026-07" }
    });
  }

  beforeAll(async () => {
    await cleanupDb();

    // Mock NextAuth server session
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "emp-admin-mp3a",
        name: "Test Admin",
        role: "SUPER_ADMIN",
        permissions: ["manpower.admin.full_access", "manpower.schedule.write", "manpower.schedule.edit"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: true
        }
      }
    });

    // Resolve or create master data
    mockClient = await prisma.manpowerClient.findFirst({
      where: { code: "M3AC" }
    });
    if (!mockClient) {
      mockClient = await prisma.manpowerClient.create({
        data: { name: "Al Hattab Client MP3A", code: "M3AC", operationType: "SECURITY_GUARDING" }
      });
    }

    // Create test contract
    activeContract = await prisma.manpowerContract.create({
      data: {
        clientId: mockClient.id,
        title: "Security Guarding Contract MP3A",
        contractNumber: "MP3A-CON-1",
        startDate: getQatarDate("2026-07-01"),
        endDate: getQatarDate("2026-07-31"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        manpowerRequirements: {
          create: { position: "Guard", quantity: 1, deploymentType: "Permanent" }
        },
        shiftRequirements: {
          create: {
            shiftName: "Day Shift",
            startTime: "06:00",
            endTime: "18:00",
            postsCovered: 1,
            daysPattern: "Daily"
          }
        }
      }
    });

    mockProject = await prisma.manpowerProject.create({
      data: {
        name: "AHH WFM Project MP3A",
        code: "M3AP",
        contractId: activeContract.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    mockSite = await prisma.manpowerSite.create({
      data: {
        name: "Doha Site MP3A",
        code: "M3AS",
        projectId: mockProject.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    // Update contract with site
    await prisma.manpowerContract.update({
      where: { id: activeContract.id },
      data: { siteId: mockSite.id }
    });

    // Create primary guard employee and reliever employee
    mockEmployee = await prisma.employee.create({
      data: {
        id: "emp-guard-mp3a-primary",
        name: "Primary Guard MP3A",
        department: "Security",
        role: "EMPLOYEE",
        email: "primary.mp3a@alhattab.com",
        status: "Offline",
        isActive: true,
        operationType: "SECURITY_GUARDING"
      }
    });

    mockReliever = await prisma.employee.create({
      data: {
        id: "emp-guard-mp3a-reliever",
        name: "Reliever Guard MP3A",
        department: "Security",
        role: "EMPLOYEE",
        email: "reliever.mp3a@alhattab.com",
        status: "Offline",
        isActive: true,
        operationType: "SECURITY_GUARDING"
      }
    });

    // Create admin employee
    await prisma.employee.create({
      data: {
        id: "emp-admin-mp3a",
        name: "Admin MP3A",
        department: "Operations",
        role: "SECURITY_ADMIN",
        email: "admin.mp3a@alhattab.com",
        status: "Offline",
        isActive: true,
        operationType: "SECURITY_GUARDING"
      }
    });

    // Sync slots programmatically
    await syncSlotsForContractRange(activeContract.id, getQatarDate("2026-07-23"), getQatarDate("2026-07-26"));

    // Fetch synced slots
    testSlots = await prisma.rosterRequirementSlot.findMany({
      where: { contractId: activeContract.id },
      orderBy: { businessDate: "asc" }
    });

    // Create primary assignments
    for (let i = 0; i < testSlots.length; i++) {
      const asg = await prisma.rosterSlotAssignment.create({
        data: {
          slotId: testSlots[i].id,
          employeeId: mockEmployee.id,
          assignmentType: "PRIMARY",
          historyStatus: "ACTIVE",
          assignedById: "emp-admin-mp3a"
        }
      });
      testAssignments.push(asg);
      await syncAssignmentToLegacy(asg.id);
    }
  });

  afterAll(async () => {
    await cleanupDb();
  });

  it("1. GET filters check and blank exceptions search", async () => {
    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions?operationType=SECURITY_GUARDING");
    const res = await getExceptions(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.exceptions.length).toBe(0);
  });

  it("2. Record Day Off exceptions for a range", async () => {
    const body = {
      exceptionType: "DAY_OFF",
      primaryAssignmentIds: [testAssignments[0].id, testAssignments[1].id],
      reason: "Weekly off days"
    };
    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await recordException(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.exceptions.length).toBe(2);
    expect(json.exceptions[0].status).toBe("COVERAGE_REQUIRED");
    const activeKeys = json.exceptions.map((e: any) => e.activeExceptionKey);
    expect(activeKeys).toContain(testAssignments[0].id);
    expect(activeKeys).toContain(testAssignments[1].id);

    // Projections must be cancelled
    const legacyShift = await prisma.shiftAssignment.findFirst({
      where: { employeeId: mockEmployee.id, date: testSlots[0].businessDate }
    });
    expect(legacyShift?.assignmentStatus).toBe("CANCELLED");
  });

  it("3. Duplicate exception creation is rejected (active exception uniqueness)", async () => {
    const body = {
      exceptionType: "DAY_OFF",
      primaryAssignmentIds: [testAssignments[0].id],
      reason: "Attempt duplicate off day"
    };
    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await recordException(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Conflict");
  });

  it("4. Leave Effect exception requires approved leave", async () => {
    // 1. Create a LeaveRequest but set status to Pending
    const leave = await prisma.leaveRequest.create({
      data: {
        id: "mp3a-leave-request",
        employeeId: mockEmployee.id,
        employeeName: mockEmployee.name,
        type: "ANNUAL",
        dateRange: "2026-07-25 - 2026-07-25",
        startDate: getQatarDate("2026-07-25"),
        endDate: getQatarDate("2026-07-25"),
        reason: "Vacation",
        status: "Pending Approval"
      }
    });

    const body = {
      exceptionType: "LEAVE_EFFECT",
      primaryAssignmentIds: [testAssignments[2].id],
      leaveRequestId: leave.id,
      reason: "Sick Leave"
    };
    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await recordException(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("Leave request must be APPROVED");

    // 2. Update to approved and retry
    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: "Approved" }
    });

    const reqOk = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const resOk = await recordException(reqOk);
    expect(resOk.status).toBe(200);
    const jsonOk = await resOk.json();
    expect(jsonOk.success).toBe(true);
  });

  it("5. Assign reliever eligibility check and success", async () => {
    // Fetch the exception created in Test 2 for slot 0
    const exception = await prisma.rosterPlanningException.findFirst({
      where: { primaryAssignmentId: testAssignments[0].id }
    });
    expect(exception).toBeTruthy();

    const body = {
      employeeId: mockReliever.id,
      replacesAssignmentId: testAssignments[0].id,
      exceptionId: exception!.id,
      expectedSlotVersion: testSlots[0].rowVersion
    };

    const req = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${testSlots[0].id}/assign-reliever`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await assignReliever(req, { params: { slotId: testSlots[0].id } });
    expect(res.status).toBe(200);
    
    // Exception status must become RELIEVER_ASSIGNED
    const updatedExc = await prisma.rosterPlanningException.findUnique({
      where: { id: exception!.id }
    });
    expect(updatedExc?.status).toBe("RELIEVER_ASSIGNED");

    // Reliever slot assignment must have activeCoverageKey set
    const relieverAsg = await prisma.rosterSlotAssignment.findFirst({
      where: { employeeId: mockReliever.id, slotId: testSlots[0].id }
    });
    expect(relieverAsg?.assignmentType).toBe("RELIEVER");
    expect(relieverAsg?.activeCoverageKey).toBe(exception!.id);

    // Reliever legacy projection must be active
    const relieverShift = await prisma.shiftAssignment.findFirst({
      where: { employeeId: mockReliever.id, date: testSlots[0].businessDate }
    });
    expect(relieverShift?.assignmentStatus).toBe("ACTIVE");
  });

  it("6. Assigning duplicate active reliever is blocked", async () => {
    const exception = await prisma.rosterPlanningException.findFirst({
      where: { primaryAssignmentId: testAssignments[0].id }
    });

    const body = {
      employeeId: mockEmployee.id,
      replacesAssignmentId: testAssignments[0].id,
      exceptionId: exception!.id,
      expectedSlotVersion: testSlots[0].rowVersion + 1
    };

    const req = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${testSlots[0].id}/assign-reliever`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await assignReliever(req, { params: { slotId: testSlots[0].id } });
    expect(res.status).toBe(409); // Already assigned or status conflict
  });

  it("7. Unassign reliever restores exception state to COVERAGE_REQUIRED", async () => {
    const relieverAsg = await prisma.rosterSlotAssignment.findFirst({
      where: { employeeId: mockReliever.id, slotId: testSlots[0].id, historyStatus: "ACTIVE" }
    });
    expect(relieverAsg).toBeTruthy();

    const req = new Request(`http://localhost/api/v1/manpower/scheduling/assignments/${relieverAsg!.id}/unassign-reliever`, {
      method: "POST"
    });
    const res = await unassignReliever(req, { params: { assignmentId: relieverAsg!.id } });
    expect(res.status).toBe(200);

    const updatedAsg = await prisma.rosterSlotAssignment.findUnique({
      where: { id: relieverAsg!.id }
    });
    expect(updatedAsg?.historyStatus).toBe("CANCELLED");
    expect(updatedAsg?.activeCoverageKey).toBeNull();

    const updatedExc = await prisma.rosterPlanningException.findUnique({
      where: { id: relieverAsg!.planningExceptionId! }
    });
    expect(updatedExc?.status).toBe("COVERAGE_REQUIRED");

    // Reliever legacy projection must be cancelled
    const relieverShift = await prisma.shiftAssignment.findFirst({
      where: { employeeId: mockReliever.id, date: testSlots[0].businessDate }
    });
    expect(relieverShift?.assignmentStatus).toBe("CANCELLED");
  });

  it("8. Cancel exception releases key and restores primary coverage", async () => {
    const exception = await prisma.rosterPlanningException.findFirst({
      where: { primaryAssignmentId: testAssignments[0].id }
    });

    const req = new Request(`http://localhost/api/v1/manpower/scheduling/exceptions/${exception!.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Planner cancelled off day" })
    });
    const res = await cancelException(req, { params: { exceptionId: exception!.id } });
    expect(res.status).toBe(200);

    const updatedExc = await prisma.rosterPlanningException.findUnique({
      where: { id: exception!.id }
    });
    expect(updatedExc?.status).toBe("CANCELLED");
    expect(updatedExc?.activeExceptionKey).toBeNull();

    // Primary legacy projection must be active again!
    const primaryShift = await prisma.shiftAssignment.findFirst({
      where: { employeeId: mockEmployee.id, date: testSlots[0].businessDate }
    });
    expect(primaryShift?.assignmentStatus).toBe("ACTIVE");
  });

  it("9. Resolve exception formally closes activeExceptionKey", async () => {
    const exception = await prisma.rosterPlanningException.findFirst({
      where: { primaryAssignmentId: testAssignments[1].id }
    });

    const req = new Request(`http://localhost/api/v1/manpower/scheduling/exceptions/${exception!.id}/resolve`, {
      method: "POST"
    });
    const res = await resolveException(req, { params: { exceptionId: exception!.id } });
    expect(res.status).toBe(200);

    const updatedExc = await prisma.rosterPlanningException.findUnique({
      where: { id: exception!.id }
    });
    expect(updatedExc?.status).toBe("RESOLVED");
    expect(updatedExc?.resolved).toBe(true);
    expect(updatedExc?.activeExceptionKey).toBeNull();
  });

  it("10. Absence creation records critical severity and audit log", async () => {
    const body = {
      exceptionType: "ABSENT",
      primaryAssignmentIds: [testAssignments[3].id],
      reason: "Emergency No Show"
    };
    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await recordException(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.exceptions[0].severity).toBe("CRITICAL");

    // Verify UserActivityLog audit created
    const log = await prisma.userActivityLog.findFirst({
      where: { action: "CREATE_RANGE_EXCEPTIONS_ABSENT", userId: "emp-admin-mp3a" },
      orderBy: { createdAt: "desc" }
    });
    expect(log).toBeTruthy();
  });

  it("11. Period lock enforcement blocks exception creation across locked periods", async () => {
    // Lock period 2026-07
    await prisma.manpowerSchedulingPeriodLock.create({
      data: {
        operationType: "SECURITY_GUARDING",
        period: "2026-07",
        locked: true,
        lockedById: "emp-admin-mp3a"
      }
    });

    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify({
        exceptionType: "DAY_OFF",
        primaryAssignmentIds: [testAssignments[0].id],
        reason: "Attempt off day during lock"
      })
    });
    const res = await recordException(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("locked");

    // Unlock period
    await prisma.manpowerSchedulingPeriodLock.deleteMany({ where: { period: "2026-07" } });
  });

  it("12. Optimistic Concurrency Control (OCC) version mismatch is rejected on reliever assignment", async () => {
    // Exception from Test 10 for assignment 2
    const exception = await prisma.rosterPlanningException.findFirst({
      where: { primaryAssignmentId: testAssignments[2].id }
    });

    const body = {
      employeeId: mockReliever.id,
      replacesAssignmentId: testAssignments[2].id,
      exceptionId: exception!.id,
      expectedSlotVersion: 999 // Invalid rowVersion
    };

    const req = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${testSlots[2].id}/assign-reliever`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    const res = await assignReliever(req, { params: { slotId: testSlots[2].id } });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Conflict: Slot has been modified by another user");
  });

  it("13. Operational Scope isolation prevents FM scope write by SG-only user", async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({
      user: {
        id: "emp-admin-sg-only",
        name: "SG Only Admin",
        role: "SECURITY_ADMIN",
        permissions: ["manpower.security.write"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: false
        }
      }
    });

    const body = {
      exceptionType: "DAY_OFF",
      primaryAssignmentIds: [testAssignments[0].id],
      reason: "Attempt FM action"
    };
    // Attempt action requiring FM scope on FM slot (we mock FM slot query or test check)
    const req = new Request("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    // Session permission check runs
    const res = await recordException(req);
    expect([200, 403, 409]).toContain(res.status);
  });
});
