import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { GET as getActivities, POST as logActivity } from "../../apps/web/app/api/v1/commercial/activities/route";
import { GET as getTasks, POST as createTask } from "../../apps/web/app/api/v1/commercial/tasks/route";
import { PATCH as updateTask } from "../../apps/web/app/api/v1/commercial/tasks/[id]/route";
import { GET as getOutlookStatus } from "../../apps/web/app/api/v1/commercial/outlook/status/route";
import { runCommercialReminderCycle } from "../../apps/web/workers/commercial-reminder-worker";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle Phase CL-1: Planned Activities & Tasks Final Release Hardening API Suite", () => {
  let testCompanyId: string;
  let testClientId: string;
  let testContractId: string;
  let testActivityId: string;
  let testTaskId: string;

  beforeAll(async () => {
    const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const company = await prisma.company.create({
      data: {
        companyCode: `CC1-H-${rand}`,
        companyName: `CL-1 Hardened Test Company ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLIC1-H-${rand}`,
        name: `CL1 Hardened Test Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    const contract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC1-ACT-H-${rand}`,
        title: "CL-1 Hardened Active Test Contract",
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
    it("1. should return 401 if unauthenticated on activities GET", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);
      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities");
      const res = await getActivities(req);
      expect(res.status).toBe(401);
    });

    it("2. should return 403 if user lacks commercial.activity.view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: "emp-unauthorized", role: "EMPLOYEE", permissions: ["self.profile.view"] }
      });
      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities");
      const res = await getActivities(req);
      expect(res.status).toBe(403);
    });
  });

  describe("Client Interaction Logging (EMAIL, CALL, MEETING, NOTE)", () => {
    it("3. should log an EMAIL activity with Outlook metadata linkage", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl1",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.activity.manage"]
        }
      });

      const extId = `MSG-OUTLOOK-${Date.now()}`;
      const req = new NextRequest("http://localhost:3100/api/v1/commercial/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "EMAIL",
          subject: "Contract Amendment Discussion Email",
          notes: "Sent proposal draft for 2 additional security guards.",
          contractId: testContractId,
          externalProvider: "OUTLOOK",
          externalItemId: extId,
          externalWebLink: `https://outlook.office365.com/owa/?itemid=${extId}`
        })
      });

      const res = await logActivity(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.activity.activityType).toBe("EMAIL");
      expect(data.activity.externalProvider).toBe("OUTLOOK");
      expect(data.activity.externalItemId).toBe(extId);

      testActivityId = data.activity.id;
    });

    it("4. should log a CALL activity with call metadata", async () => {
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

    it("5. should log a MEETING activity with location and attendees", async () => {
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
          activityType: "MEETING",
          subject: "Annual Rate Negotiation Meeting",
          notes: "Agreed on 3% cost indexation for 2027.",
          meetingLocation: "West Bay HQ Conference Room A",
          attendees: "John Doe, Jane Smith, Client Director",
          contractId: testContractId
        })
      });

      const res = await logActivity(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.activity.activityType).toBe("MEETING");
    });

    it("6. should log an internal NOTE activity", async () => {
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
          activityType: "NOTE",
          subject: "Internal Commercial Assessment Remark",
          notes: "Client requested option for weekend night shift extension.",
          contractId: testContractId
        })
      });

      const res = await logActivity(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.activity.activityType).toBe("NOTE");
    });
  });

  describe("Commercial Task Scheduler & Follow-Ups", () => {
    it("7. should create and assign a commercial follow-up task", async () => {
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
          reminderAt: new Date(Date.now() - 60000).toISOString(), // Due for reminder
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

    it("8. should complete a commercial task and set completedAt timestamp", async () => {
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

    it("9. should execute Commercial Reminder Worker cycle with atomic claim idempotency", async () => {
      // Create a pending task with past reminderAt
      const taskForReminder = await prisma.commercialTask.create({
        data: {
          title: "Automated Reminder Test Task",
          priority: "URGENT",
          status: "PENDING",
          reminderAt: new Date(Date.now() - 120000),
          reminderSent: false,
          contractId: testContractId,
          operationType: "SECURITY_GUARDING"
        }
      });

      // First run of worker cycle should process the reminder
      const result1 = await runCommercialReminderCycle();
      expect(result1.remindersProcessed).toBeGreaterThanOrEqual(1);

      // Verify task reminderSent flag was set to true
      const updatedTask = await prisma.commercialTask.findUnique({ where: { id: taskForReminder.id } });
      expect(updatedTask?.reminderSent).toBe(true);

      // Repeat run of worker cycle should find 0 pending reminders (atomic claim idempotency)
      const result2 = await runCommercialReminderCycle();
      const recheckTask = result2.remindersProcessed;
      expect(recheckTask).toBe(0);

      await prisma.commercialTask.delete({ where: { id: taskForReminder.id } });
    });

    it("10. should roll back transaction on notification persistence failure, keeping reminder retryable", async () => {
      const taskForFail = await prisma.commercialTask.create({
        data: {
          title: "Failure Injection Test Task",
          priority: "HIGH",
          status: "PENDING",
          reminderAt: new Date(Date.now() - 120000),
          reminderSent: false,
          contractId: testContractId,
          operationType: "SECURITY_GUARDING"
        }
      });

      // Inject simulated notification persistence failure
      const failureInjector = (taskId: string) => {
        if (taskId === taskForFail.id) {
          throw new Error("Simulated Notification Persist Error");
        }
      };

      const resultFail = await runCommercialReminderCycle(failureInjector);
      expect(resultFail.failedCount).toBeGreaterThanOrEqual(1);

      // Verify task.reminderSent is STILL false due to transaction rollback
      const recheckedTask = await prisma.commercialTask.findUnique({ where: { id: taskForFail.id } });
      expect(recheckedTask?.reminderSent).toBe(false);

      // Subsequent scan without failure injector succeeds and marks reminderSent = true
      const resultSuccess = await runCommercialReminderCycle();
      expect(resultSuccess.notificationsDispatched).toBeGreaterThanOrEqual(1);

      const finalTask = await prisma.commercialTask.findUnique({ where: { id: taskForFail.id } });
      expect(finalTask?.reminderSent).toBe(true);

      await prisma.commercialTask.delete({ where: { id: taskForFail.id } });
    });
  });

  describe("Hybrid Chronological Activity Feed", () => {
    it("10. should return unified feed combining activities and task milestones in chronological order", async () => {
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

  describe("UserActivityLog Audit Recording", () => {
    it("11. should record UserActivityLog on commercial activity and task mutations", async () => {
      const logs = await prisma.userActivityLog.findMany({
        where: {
          entityType: { in: ["CommercialActivity", "CommercialTask"] }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(["CREATE_COMMERCIAL_ACTIVITY", "CREATE_COMMERCIAL_TASK", "COMPLETE_COMMERCIAL_TASK", "LINK_OUTLOOK_ACTIVITY", "DISPATCH_COMMERCIAL_REMINDER"]).toContain(logs[0].action);
    });
  });

  describe("Outlook Integration Status Endpoint", () => {
    it("12. should return controlled configuration status when Azure credentials are absent without crashing", async () => {
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
