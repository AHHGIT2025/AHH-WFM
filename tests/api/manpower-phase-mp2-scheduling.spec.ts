import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { getQatarDate, getQatarDateString, syncSlotsForContractRange, syncAssignmentToLegacy } from "../../apps/web/lib/roster-engine";
import { POST as syncSlots } from "../../apps/web/app/api/v1/manpower/scheduling/slots/sync/route";
import { POST as assignSlot } from "../../apps/web/app/api/v1/manpower/scheduling/slots/[slotId]/assign/route";
import { POST as unassignSlot } from "../../apps/web/app/api/v1/manpower/scheduling/slots/[slotId]/unassign/route";
import { POST as publishRoster } from "../../apps/web/app/api/v1/manpower/scheduling/publications/route";
import { POST as syncPublication } from "../../apps/web/app/api/v1/manpower/scheduling/publications/[id]/sync/route";
import { POST as lockPeriod } from "../../apps/web/app/api/v1/manpower/scheduling/locks/route";
import { GET as getCoverage } from "../../apps/web/app/api/v1/manpower/scheduling/coverage/route";
import { GET as getRoster } from "../../apps/web/app/api/v1/manpower/scheduling/roster/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Manpower Planning Phase MP-2 Roster-Scheduling Foundation Test Suite", () => {
  let mockClient: any;
  let mockProject: any;
  let mockSite: any;
  let mockEmployee: any;
  let mockSupervisor: any;
  let activeContract: any;
  let draftContract: any;

  beforeAll(async () => {
    // 1. Setup mock data in local database
    mockClient = await prisma.manpowerClient.findFirst();
    if (!mockClient) {
      mockClient = await prisma.manpowerClient.create({
        data: { name: "MP-2 Client", code: "M2C-01", operationType: "SECURITY_GUARDING" }
      });
    }

    // Standard draft & active contracts (created first to link to Project)
    draftContract = await prisma.manpowerContract.create({
      data: {
        clientId: mockClient.id,
        title: "MP-2 Draft Test Contract",
        contractNumber: "MP2-CON-01",
        startDate: new Date("2026-07-22"),
        endDate: new Date("2026-08-22"),
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        manpowerRequirements: {
          create: { position: "Guard", quantity: 2, deploymentType: "Permanent" }
        }
      }
    });

    activeContract = await prisma.manpowerContract.create({
      data: {
        clientId: mockClient.id,
        title: "MP-2 Active Test Contract",
        contractNumber: "MP2-CON-02",
        startDate: new Date("2026-07-22"),
        endDate: new Date("2026-08-22"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        manpowerRequirements: {
          create: { position: "Guard", quantity: 2, deploymentType: "Permanent" }
        },
        shiftRequirements: {
          create: {
            shiftName: "Day Shift",
            startTime: "06:00",
            endTime: "18:00",
            postsCovered: 2,
            daysPattern: "Daily"
          }
        }
      },
      include: {
        manpowerRequirements: true,
        shiftRequirements: true
      }
    });

    mockProject = await prisma.manpowerProject.findFirst();
    if (!mockProject) {
      mockProject = await prisma.manpowerProject.create({
        data: { name: "MP-2 Project", code: "M2P-01", contractId: activeContract.id, operationType: "SECURITY_GUARDING" }
      });
    }

    mockSite = await prisma.manpowerSite.findFirst();
    if (!mockSite) {
      mockSite = await prisma.manpowerSite.create({
        data: { name: "MP-2 Site", code: "M2S-01", projectId: mockProject.id, operationType: "SECURITY_GUARDING" }
      });
    }

    // Now update activeContract with siteId
    await prisma.manpowerContract.update({
      where: { id: activeContract.id },
      data: { siteId: mockSite.id }
    });
    activeContract.siteId = mockSite.id;

    mockSupervisor = await prisma.employee.findFirst({
      where: { role: "SECURITY_ADMIN", isActive: true }
    });
    if (!mockSupervisor) {
      mockSupervisor = await prisma.employee.create({
        data: {
          id: "emp-supervisor-mp2",
          name: "MP2 Supervisor",
          email: "sup@mp2.com",
          role: "SECURITY_ADMIN",
          department: "Security Operations",
          status: "Offline",
          isActive: true
        }
      });
    }

    mockEmployee = await prisma.employee.findFirst({
      where: { operationType: "SECURITY_GUARDING", isActive: true, role: { not: "SECURITY_ADMIN" } }
    });
    if (!mockEmployee) {
      mockEmployee = await prisma.employee.create({
        data: {
          id: "emp-guard-mp2-01",
          name: "MP2 Guard",
          email: "guard@mp2.com",
          role: "EMPLOYEE",
          department: "Security",
          status: "Offline",
          isActive: true,
          operationType: "SECURITY_GUARDING"
        }
      });
    }
  });

  beforeEach(() => {
    // Default mock user is supervisor/admin
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: mockSupervisor.id,
        name: mockSupervisor.name,
        role: mockSupervisor.role,
        email: mockSupervisor.email
      }
    });
  });

  afterAll(async () => {
    // Cleanup test contracts and locks
    await prisma.rosterSlotAssignment.deleteMany({
      where: { slot: { contractId: { in: [activeContract.id, draftContract.id] } } }
    });
    await prisma.rosterRequirementSlot.deleteMany({
      where: { contractId: { in: [activeContract.id, draftContract.id] } }
    });
    await prisma.rosterPublicationSlot.deleteMany({
      where: { slot: { contractId: { in: [activeContract.id, draftContract.id] } } }
    });
    await prisma.rosterPublication.deleteMany({
      where: { contractId: { in: [activeContract.id, draftContract.id] } }
    });
    await prisma.rosterPlanningException.deleteMany({
      where: { contractId: { in: [activeContract.id, draftContract.id] } }
    });
    await prisma.manpowerSchedulingPeriodLock.deleteMany({
      where: { period: "2026-07" }
    });
    await prisma.manpowerContract.deleteMany({
      where: { id: { in: [activeContract.id, draftContract.id] } }
    });
  });

  it("1. ACTIVE contract generates operational slots", async () => {
    const start = new Date("2026-07-22");
    const end = new Date("2026-07-24");

    const result = await syncSlotsForContractRange(activeContract.id, start, end);
    expect(result.generated).toBeGreaterThan(0);

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: { contractId: activeContract.id }
    });
    // 3 days * 1 shift * 2 quantity = 6 slots
    expect(slots.length).toBe(6);
  });

  it("2. DRAFT contract is blocked from generating slots", async () => {
    const start = new Date("2026-07-22");
    const end = new Date("2026-07-24");

    const result = await syncSlotsForContractRange(draftContract.id, start, end);
    expect(result.generated).toBe(0);

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: { contractId: draftContract.id }
    });
    expect(slots.length).toBe(0);
  });

  it("3. Slot generationKey contains stable format and index-1", async () => {
    const slot = await prisma.rosterRequirementSlot.findFirst({
      where: {
        contractId: activeContract.id,
        slotIndex: 1,
        businessDate: getQatarDate("2026-07-22")
      }
    });
    expect(slot).toBeTruthy();
    expect(slot?.generationKey).toContain("2026-07-22");
    expect(slot?.generationKey).toContain(":1"); // Slot index 1
  });

  it("4. Idempotent synchronization avoids duplicates", async () => {
    const start = new Date("2026-07-22");
    const end = new Date("2026-07-24");

    // Second run should result in 0 newly generated slots
    const result = await syncSlotsForContractRange(activeContract.id, start, end);
    expect(result.generated).toBe(0);
  });

  it("5. Assign eligible employee successfully", async () => {
    const slot = await prisma.rosterRequirementSlot.findFirst({
      where: {
        contractId: activeContract.id,
        slotIndex: 1,
        businessDate: getQatarDate("2026-07-22"),
        fulfillmentStatus: "VACANT"
      }
    });
    expect(slot).toBeTruthy();

    const request = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${slot!.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ employeeId: mockEmployee.id, expectedSlotVersion: slot!.rowVersion })
    });

    const response = await assignSlot(request, { params: { slotId: slot!.id } });
    expect(response.status).toBe(200);

    const updatedSlot = await prisma.rosterRequirementSlot.findUnique({
      where: { id: slot!.id }
    });
    expect(updatedSlot?.fulfillmentStatus).toBe("FILLED");
  });

  it("6. Concurrency conflict with wrong expectedSlotVersion is blocked", async () => {
    const slot = await prisma.rosterRequirementSlot.findFirst({
      where: {
        contractId: activeContract.id,
        slotIndex: 1,
        businessDate: getQatarDate("2026-07-22"),
        fulfillmentStatus: "FILLED"
      }
    });
    expect(slot).toBeTruthy();

    const request = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${slot!.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ employeeId: mockEmployee.id, expectedSlotVersion: 999 }) // Wrong version
    });

    const response = await assignSlot(request, { params: { slotId: slot!.id } });
    expect(response.status).toBe(409);
  });

  it("7. Overlapping employee assignments are blocked", async () => {
    const vacantSlot = await prisma.rosterRequirementSlot.findFirst({
      where: {
        contractId: activeContract.id,
        slotIndex: 2,
        businessDate: getQatarDate("2026-07-22"),
        fulfillmentStatus: "VACANT"
      }
    });
    expect(vacantSlot).toBeTruthy();

    const request = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${vacantSlot!.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ employeeId: mockEmployee.id }) // Already assigned to slot 1 on same date
    });

    const response = await assignSlot(request, { params: { slotId: vacantSlot!.id } });
    expect(response.status).toBe(400); // Bad request / blocked
  });

  it("8. Unassign employee successfully", async () => {
    const filledSlot = await prisma.rosterRequirementSlot.findFirst({
      where: { contractId: activeContract.id, fulfillmentStatus: "FILLED" }
    });
    expect(filledSlot).toBeTruthy();

    const request = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${filledSlot!.id}/unassign`, {
      method: "POST",
      body: JSON.stringify({ unassignmentReason: "Test unassign" })
    });

    const response = await unassignSlot(request, { params: { slotId: filledSlot!.id } });
    expect(response.status).toBe(200);

    const updatedSlot = await prisma.rosterRequirementSlot.findUnique({
      where: { id: filledSlot!.id }
    });
    expect(updatedSlot?.fulfillmentStatus).toBe("VACANT");
  });

  it("9. Period lock blocks assignments", async () => {
    // 1. Lock period 2026-07
    const lockRequest = new Request("http://localhost/api/v1/manpower/scheduling/locks", {
      method: "POST",
      body: JSON.stringify({ operationType: "SECURITY_GUARDING", period: "2026-07", locked: true })
    });
    const lockResponse = await lockPeriod(lockRequest);
    expect(lockResponse.status).toBe(200);

    // 2. Try to assign
    const vacantSlot = await prisma.rosterRequirementSlot.findFirst({
      where: { contractId: activeContract.id, businessDate: new Date("2026-07-22") }
    });
    expect(vacantSlot).toBeTruthy();

    const assignReq = new Request(`http://localhost/api/v1/manpower/scheduling/slots/${vacantSlot!.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ employeeId: mockEmployee.id })
    });
    const assignRes = await assignSlot(assignReq, { params: { slotId: vacantSlot!.id } });
    expect(assignRes.status).toBe(409); // Conflict - Locked
  });

  it("10. Coverage metrics calculation", async () => {
    const request = new Request(`http://localhost/api/v1/manpower/scheduling/coverage?contractId=${activeContract.id}&month=2026-07`);
    const response = await getCoverage(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.summary.requiredCount).toBeGreaterThan(0);
  });
});
