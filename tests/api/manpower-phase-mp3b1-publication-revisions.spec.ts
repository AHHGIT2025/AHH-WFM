import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as publishRoster } from "../../apps/web/app/api/v1/manpower/scheduling/publish/route";
import { GET as getPublications } from "../../apps/web/app/api/v1/manpower/scheduling/publications/route";
import { POST as cancelPublication } from "../../apps/web/app/api/v1/manpower/scheduling/publications/[id]/cancel/route";
import { POST as submitChangeRequest, GET as getChangeRequests } from "../../apps/web/app/api/v1/manpower/scheduling/change-requests/route";
import { PUT as reviewChangeRequest } from "../../apps/web/app/api/v1/manpower/scheduling/change-requests/[id]/review/route";
import { POST as withdrawChangeRequest } from "../../apps/web/app/api/v1/manpower/scheduling/change-requests/[id]/withdraw/route";
import { POST as acknowledgeMobileShift } from "../../apps/web/app/api/v1/mobile/schedule/acknowledge/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Phase MP-3B1: Roster Publication Governance & Mobile Shift Acknowledgment Test Suite", () => {
  let testContract: any;
  let testClient: any;
  let testProject: any;
  let testSite: any;
  let testRequirement: any;
  let testEmployee: any;
  let mockUserSession: any;

  async function cleanAllTestFixtures() {
    try { await prisma.rosterPublication.updateMany({ data: { activeSeriesKey: null, supersedesPublicationId: null } }); } catch (e) {}
    try { await prisma.manpowerPublicationScopeLock.deleteMany({}); } catch (e) {}
    try { await prisma.rosterSlotAcknowledgment.deleteMany({}); } catch (e) {}
    try { await prisma.rosterChangeRequest.deleteMany({}); } catch (e) {}
    try { await prisma.rosterPublicationSlot.deleteMany({}); } catch (e) {}
    try { await prisma.rosterPublication.deleteMany({}); } catch (e) {}
    try { await prisma.rosterSlotAssignment.deleteMany({ where: { slot: { contractId: "MP3B1-CON-1" } } }); } catch (e) {}
    try { await prisma.rosterRequirementSlot.deleteMany({ where: { contractId: "MP3B1-CON-1" } }); } catch (e) {}
    try { await prisma.manpowerContract.updateMany({ where: { id: "MP3B1-CON-1" }, data: { siteId: null } }); } catch (e) {}
    try { await prisma.manpowerSite.deleteMany({ where: { code: "M3B1S" } }); } catch (e) {}
    try { await prisma.manpowerProject.deleteMany({ where: { code: "M3B1P" } }); } catch (e) {}
    try { await prisma.contractManpowerRequirement.deleteMany({ where: { contractId: "MP3B1-CON-1" } }); } catch (e) {}
    try { await prisma.manpowerContract.deleteMany({ where: { id: "MP3B1-CON-1" } }); } catch (e) {}
    try { await prisma.employee.deleteMany({ where: { id: { in: ["emp-guard-mp3b1", "emp-ops-mgr"] } } }); } catch (e) {}
  }

  beforeAll(async () => {
    await cleanAllTestFixtures();

    testClient = await prisma.manpowerClient.findFirst({ where: { code: "M3B1C" } });
    if (!testClient) {
      testClient = await prisma.manpowerClient.create({
        data: { name: "Al Hattab Client MP3B1", code: "M3B1C", operationType: "SECURITY_GUARDING" }
      });
    }

    testContract = await prisma.manpowerContract.findUnique({ where: { id: "MP3B1-CON-1" } });
    if (!testContract) {
      testContract = await prisma.manpowerContract.create({
        data: {
          id: "MP3B1-CON-1",
          clientId: testClient.id,
          operationType: "SECURITY_GUARDING",
          contractNumber: "MP3B1-CON-1",
          title: "Security Guarding Contract MP3B1",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-31"),
          status: "ACTIVE"
        }
      });
    }

    testRequirement = await prisma.contractManpowerRequirement.findFirst({ where: { contractId: testContract.id } });
    if (!testRequirement) {
      testRequirement = await prisma.contractManpowerRequirement.create({
        data: {
          id: "mp3b1-req-1",
          contractId: testContract.id,
          position: "Security Guard",
          quantity: 1,
          deploymentType: "Permanent"
        }
      });
    }

    testProject = await prisma.manpowerProject.findFirst({ where: { code: "M3B1P" } });
    if (!testProject) {
      testProject = await prisma.manpowerProject.create({
        data: {
          name: "AHH WFM Project MP3B1",
          code: "M3B1P",
          contractId: testContract.id,
          operationType: "SECURITY_GUARDING"
        }
      });
    }

    testSite = await prisma.manpowerSite.findFirst({ where: { code: "M3B1S" } });
    if (!testSite) {
      testSite = await prisma.manpowerSite.create({
        data: {
          name: "Doha Site MP3B1",
          code: "M3B1S",
          projectId: testProject.id,
          operationType: "SECURITY_GUARDING"
        }
      });
    }

    await prisma.manpowerContract.update({
      where: { id: testContract.id },
      data: { siteId: testSite.id }
    });

    testEmployee = await prisma.employee.upsert({
      where: { id: "emp-guard-mp3b1" },
      update: { name: "John Guard" },
      create: {
        id: "emp-guard-mp3b1",
        name: "John Guard",
        email: "john.guard.mp3b1@ahh.qa",
        role: "EMPLOYEE",
        status: "On Duty",
        department: "Security",
        employeeCategory: "BLUE_COLLAR",
        workAssignmentType: "OPERATIONS_FIELD"
      }
    });

    await prisma.employee.upsert({
      where: { id: "emp-ops-mgr" },
      update: { name: "Ops Manager" },
      create: {
        id: "emp-ops-mgr",
        name: "Ops Manager",
        email: "ops.manager.mp3b1@ahh.qa",
        role: "OPERATIONS_MANAGER",
        status: "Active",
        department: "Operations",
        employeeCategory: "WHITE_COLLAR",
        workAssignmentType: "ADMINISTRATION"
      }
    });

    const reqSlot = await prisma.rosterRequirementSlot.upsert({
      where: { id: "mp3b1-slot-1" },
      update: { fulfillmentStatus: "FILLED" },
      create: {
        id: "mp3b1-slot-1",
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        projectId: testProject.id,
        siteId: testSite.id,
        locationKey: `site:${testSite.id}`,
        contractRequirementId: testRequirement.id,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-08-01"),
        businessDate: new Date("2026-08-05"),
        shiftKey: "shift:DAY",
        slotIndex: 1,
        generationKey: "MP3B1-CON-1:2026-08-05:shift:DAY:1",
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift",
        snapshotStartTime: "06:00",
        snapshotEndTime: "18:00",
        fulfillmentStatus: "FILLED"
      }
    });

    await prisma.rosterSlotAssignment.upsert({
      where: { id: "mp3b1-asg-1" },
      update: { historyStatus: "ACTIVE" },
      create: {
        id: "mp3b1-asg-1",
        slotId: reqSlot.id,
        employeeId: testEmployee.id,
        assignmentType: "PRIMARY",
        historyStatus: "ACTIVE",
        assignedById: testEmployee.id
      }
    });

    mockUserSession = {
      user: {
        id: "usr-admin-mp3b1",
        employeeId: testEmployee.id,
        role: "ADMIN",
        permissions: [
          "manpower.roster.publish",
          "manpower.roster.cancel",
          "manpower.roster.changeRequest.submit",
          "manpower.roster.changeRequest.review",
          "manpower.roster.changeRequest.approve",
          "manpower.roster.changeRequest.reject",
          "manpower.roster.changeRequest.withdraw",
          "manpower.roster.acknowledge",
          "manpower.roster.publication.viewHistory"
        ],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
      }
    };

    (getServerSession as jest.Mock).mockResolvedValue(mockUserSession);
  });

  afterAll(async () => {
    await cleanAllTestFixtures();
  });

  let createdPublicationId: string;
  let createdPublicationSlotId: string;

  test("1. Initial publication creates v1 ACTIVE with activeSeriesKey and snapshots", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/manpower/scheduling/publish", {
      method: "POST",
      body: JSON.stringify({
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        siteId: testSite.id,
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        revisionReason: "Initial v1 test"
      })
    });

    const res = await publishRoster(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.publication.publicationVersion).toBe(1);
    expect(json.publication.status).toBe("ACTIVE");
    expect(json.publication.activeSeriesKey).toBeDefined();

    createdPublicationId = json.publication.id;

    const slots = await prisma.rosterPublicationSlot.findMany({
      where: { publicationId: createdPublicationId }
    });
    expect(slots.length).toBeGreaterThan(0);
    createdPublicationSlotId = slots[0].id;
    expect(slots[0].employeeId).toBe(testEmployee.id);
  });

  test("2. Direct republish against ACTIVE series returns 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/manpower/scheduling/publish", {
      method: "POST",
      body: JSON.stringify({
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        siteId: testSite.id,
        startDate: "2026-08-01",
        endDate: "2026-08-07"
      })
    });

    const res = await publishRoster(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Active publication version already exists");
  });

  test("3. View publication history returns ACTIVE version", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/manpower/scheduling/publications?operationType=SECURITY_GUARDING&contractId=${testContract.id}`);
    const res = await getPublications(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.publications.length).toBeGreaterThan(0);
    expect(json.publications[0].status).toBe("ACTIVE");
  });

  test("4. Overlapping active date range publication is rejected with 409", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/manpower/scheduling/publish", {
      method: "POST",
      body: JSON.stringify({
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        siteId: testSite.id,
        startDate: "2026-08-05",
        endDate: "2026-08-10"
      })
    });

    const res = await publishRoster(req);
    expect(res.status).toBe(409);
  });

  let createdRequestId: string;

  test("5. Post-publication change request submission creates PENDING request", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/manpower/scheduling/change-requests", {
      method: "POST",
      body: JSON.stringify({
        basePublicationId: createdPublicationId,
        publicationSlotId: createdPublicationSlotId,
        changeType: "ASSIGNMENT_REMOVAL",
        reason: "Employee sick leave request"
      })
    });

    const res = await submitChangeRequest(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.changeRequest.status).toBe("PENDING");
    createdRequestId = json.changeRequest.id;
  });

  test("6. Duplicate change request submission on same slot rejected", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/manpower/scheduling/change-requests", {
      method: "POST",
      body: JSON.stringify({
        basePublicationId: createdPublicationId,
        publicationSlotId: createdPublicationSlotId,
        changeType: "ASSIGNMENT_REMOVAL",
        reason: "Duplicate submission attempt"
      })
    });

    const res = await submitChangeRequest(req);
    expect(res.status).toBe(409);
  });

  test("7. Self-approval by requester rejected with 403 Forbidden for non-SUPER_ADMIN", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/manpower/scheduling/change-requests/${createdRequestId}/review`, {
      method: "PUT",
      body: JSON.stringify({
        decision: "APPROVE",
        reviewNotes: "Self-approval attempt"
      })
    });

    const res = await reviewChangeRequest(req, { params: { id: createdRequestId } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Self-approval is forbidden");
  });

  test("8. Approved change request generates v2 ACTIVE and marks v1 SUPERSEDED", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "usr-ops-manager",
        employeeId: "emp-ops-mgr",
        role: "OPERATIONS_MANAGER",
        permissions: ["manpower.roster.changeRequest.review", "manpower.roster.changeRequest.approve"],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
      }
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/manpower/scheduling/change-requests/${createdRequestId}/review`, {
      method: "PUT",
      body: JSON.stringify({
        decision: "APPROVE",
        reviewNotes: "Approved by Operations Manager"
      })
    });

    const res = await reviewChangeRequest(req, { params: { id: createdRequestId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.newPublication.publicationVersion).toBe(2);
    expect(json.newPublication.status).toBe("ACTIVE");
    expect(json.newPublication.supersedesPublicationId).toBe(createdPublicationId);

    const v1Pub = await prisma.rosterPublication.findUnique({ where: { id: createdPublicationId } });
    expect(v1Pub?.status).toBe("SUPERSEDED");
    expect(v1Pub?.activeSeriesKey).toBeNull();
  });

  test("9. Mobile shift acknowledgment is version-aware and idempotent", async () => {
    const v2Pub = await prisma.rosterPublication.findFirst({
      where: { contractId: testContract.id, status: "ACTIVE" },
      include: { publicationSlots: true }
    });

    expect(v2Pub).toBeDefined();
    const v2Slot = v2Pub!.publicationSlots[0];

    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: testEmployee.id,
        employeeId: testEmployee.id,
        role: "EMPLOYEE",
        permissions: ["manpower.roster.acknowledge"],
        operationAccess: { allowedSecurityGuarding: true }
      }
    });

    const clientReqId = `CLIENT_ACK_${Date.now()}`;
    const req1 = new NextRequest("http://localhost:3000/api/v1/mobile/schedule/acknowledge", {
      method: "POST",
      body: JSON.stringify({
        publicationSlotId: v2Slot.id,
        clientRequestId: clientReqId,
        deviceGeneratedAt: new Date().toISOString()
      })
    });

    const res1 = await acknowledgeMobileShift(req1);
    expect(res1.status).toBe(201);

    const req2 = new NextRequest("http://localhost:3000/api/v1/mobile/schedule/acknowledge", {
      method: "POST",
      body: JSON.stringify({
        publicationSlotId: v2Slot.id,
        clientRequestId: clientReqId,
        deviceGeneratedAt: new Date().toISOString()
      })
    });

    const res2 = await acknowledgeMobileShift(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.idempotent).toBe(true);
  });
});
