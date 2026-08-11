import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { GET as getActivities, POST as logActivity } from "../../apps/web/app/api/v1/commercial/activities/route";
import { GET as getTasks, POST as createTask } from "../../apps/web/app/api/v1/commercial/tasks/route";
import { PATCH as updateTask } from "../../apps/web/app/api/v1/commercial/tasks/[id]/route";
import { GET as getOutlookStatus } from "../../apps/web/app/api/v1/commercial/outlook/status/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle Phase CL-1: Planned Activities & Tasks Gap Completion API Suite", () => {
  let testCompanyId: string;
  let testClientId: string;
  let testContractId: string;
  let testActivityId: string;
  let testTaskId: string;

  beforeAll(async () => {
    const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const company = await prisma.company.create({
      data: {
        companyCode: `CC1-${rand}`,
        companyName: `CL-1 Activities Test Company ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLIC1-${rand}`,
        name: `CL1 Test Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    const contract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC1-ACT-${rand}`,
        title: "CL-1 Active Test Contract",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED"
      }
    });
    testContractId = contract.id;
  });

  afterAll(async () => {
    if (testTaskId) {
      await prisma.commercialTask.deleteMany({ where: { id: testTaskId } });
    }
    if (testActivityId) {
      await prisma.commercialActivity.deleteMany({ where: { id: testActivityId } });
    }
    if (testContractId) {
      await prisma.commercialActivity.deleteMany({ where: { contractId: testContractId } });
      await prisma.commercialTask.deleteMany({ where: { contractId: testContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testContractId } });
    }
    if (testClientId) {
      await prisma.manpowerClient.deleteMany({ where: { id: testClientId } });
    }
    if (testCompanyId) {
      await prisma.company.deleteMany({ where: { id: testCompanyId } });
    }
  });

  describe("Authentication & Authorization Gates", () => {
    it("should return 401 if unauthenticated on activities GET", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);
      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities");
      const res = await getActivities(req);
      expect(res.status).toBe(401);
    });

    it("should return 403 if user lacks commercial.activity.view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: "emp-unauthorized", role: "EMPLOYEE", permissions: ["self.profile.view"] }
      });
      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities");
      const res = await getActivities(req);
      expect(res.status).toBe(403);
    });
  });

  describe("Client Interaction Logging (EMAIL, CALL, MEETING, NOTE)", () => {
    it("should log an EMAIL activity with Outlook metadata linkage", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.activity.manage"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "EMAIL",
          subject: "Contract Amendment Discussion Email",
          notes: "Sent proposal draft for 2 additional security guards.",
          contractId: testContractId,
          externalProvider: "OUTLOOK",
          externalItemId: "MSG-OUTLOOK-998822",
          externalWebLink: "https://outlook.office365.com/owa/?itemid=MSG-OUTLOOK-998822"
        })
      });

      const res = await logActivity(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.activity.activityType).toBe("EMAIL");
      expect(data.activity.externalProvider).toBe("OUTLOOK");
      expect(data.activity.externalItemId).toBe("MSG-OUTLOOK-998822");

      testActivityId = data.activity.id;
    });

    it("should log a CALL activity with call metadata", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.activity.manage"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "CALL",
          subject: "Quarterly Service Review Call",
          notes: "Client confirmed overall satisfaction.",
          direction: "OUTBOUND",
          phoneNumber: "+974 4400 1234",
          durationMinutes: 15,
          callOutcome: "ACCEPTED",
          contractId: testContractId
        })
      });

      const res = await logActivity(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.activity.direction).toBe("OUTBOUND");
    });
  });

  describe("Commercial Task Scheduler & Follow-Ups", () => {
    it("should create and assign a commercial follow-up task", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.task.manage"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Follow up on signed renewal agreement",
          description: "Verify signed contract copy received from client legal team.",
          dueAt: "2026-09-15",
          priority: "HIGH",
          contractId: testContractId
        })
      });

      const res = await createTask(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.task.title).toBe("Follow up on signed renewal agreement");
      expect(data.task.priority).toBe("HIGH");
      expect(data.task.status).toBe("PENDING");

      testTaskId = data.task.id;
    });

    it("should complete a commercial task and set completedAt timestamp", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.task.manage"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/tasks/${testTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" })
      });

      const res = await updateTask(req, { params: { id: testTaskId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.task.status).toBe("COMPLETED");
      expect(data.task.completedAt).toBeDefined();
    });
  });

  describe("Hybrid Chronological Activity Feed", () => {
    it("should return unified feed combining activities and task milestones", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.activity.view"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/activities?feedMode=true&contractId=${testContractId}`);
      const res = await getActivities(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.feed)).toBe(true);
      expect(data.feed.length).toBeGreaterThan(0);
    });
  });

  describe("Outlook Integration Status Endpoint", () => {
    it("should return controlled configuration status when Azure credentials are absent without crashing", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.activity.view"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/outlook/status");
      const res = await getOutlookStatus(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.capabilities.manualMetadataLinking).toBe(true);
    });
  });
});
