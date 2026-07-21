import {
  raiseSosPanicAlert,
  acknowledgeSosAlert,
  markSosFalseAlarm,
  cancelSosAlert,
  createDispatchAssignment,
  acceptDispatchAssignment,
  rejectDispatchAssignment,
  arriveDispatchAssignment,
  completeDispatchAssignment,
  getControlRoomIncrementalFeed
} from "../../apps/web/lib/secfac-sos-dispatch-service";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 6A.1 — Safety and Architecture Foundation Test Suite", () => {
  let testEmployeeId: string;
  let testResponderId: string;
  let testDispatcherId: string;
  let testSiteId: string;

  beforeAll(async () => {
    // Clean test dispatch assignments and SOS alerts
    await prisma.secFacDispatchAssignment.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacAlertEvent.deleteMany({
      where: { alert: { alertCode: "SOS_PANIC" } }
    });
    await prisma.secFacOperationalAlert.deleteMany({
      where: { alertCode: "SOS_PANIC" }
    });

    let site = await prisma.manpowerSite.findFirst({ where: { isActive: true } });
    testSiteId = site?.id || "site-6a1-test";

    let employees = await prisma.employee.findMany({ take: 3 });
    testEmployeeId = employees[0]?.id || "emp-6a1-01";
    testResponderId = employees[1]?.id || "emp-6a1-02";
    testDispatcherId = employees[2]?.id || "emp-6a1-03";
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Real SOS Panic Alert Creation & Idempotency", () => {
    const idempotencyKey = `idemp-sos-test-${Date.now()}`;

    it("creates a new CRITICAL SOS_PANIC alert atomically", async () => {
      const result = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey,
        siteId: testSiteId,
        latitude: 25.2854,
        longitude: 51.531,
        accuracyMeters: 10,
        holdDurationMs: 2000,
        clientCapturedAt: new Date().toISOString(),
        emergencyNotes: "Test SOS Panic Hold"
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.alert).not.toBeNull();
      expect(result.alert.alertCode).toBe("SOS_PANIC");
      expect(result.alert.severity).toBe("CRITICAL");
      expect(result.alert.status).toBe("OPEN");
      expect(result.alert.employeeId).toBe(testEmployeeId);
      expect(result.alert.siteId).toBe(testSiteId);
    });

    it("returns duplicate existing alert when same idempotencyKey is resubmitted", async () => {
      const result = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert.alertCode).toBe("SOS_PANIC");
    });
  });

  describe("2. Control Room Acknowledgement & Lifecycle", () => {
    let alertId: string;

    beforeAll(async () => {
      const res = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey: `idemp-ack-${Date.now()}`,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });
      alertId = res.alert.id;
    });

    it("acknowledges an open SOS alert", async () => {
      const updated = await acknowledgeSosAlert(alertId, testDispatcherId, "SECURITY_GUARDING");
      expect(updated.status).toBe("ACKNOWLEDGED");
      expect(updated.acknowledgedById).toBe(testDispatcherId);
      expect(updated.acknowledgedAt).not.toBeNull();
    });

    it("marks SOS alert as False Alarm with mandatory reason", async () => {
      const falseAlarmRes = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey: `idemp-fa-${Date.now()}`,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });

      const updated = await markSosFalseAlarm(
        falseAlarmRes.alert.id,
        testDispatcherId,
        "Accidental hold by guard during shift briefing",
        "SECURITY_GUARDING"
      );

      expect(updated.status).toBe("DISMISSED");
      expect(updated.dismissalReason).toContain("Accidental hold");
    });
  });

  describe("3. Dedicated Dispatch Assignment Lifecycle", () => {
    let alertId: string;
    let dispatchId: string;

    beforeAll(async () => {
      const res = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey: `idemp-disp-${Date.now()}`,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });
      alertId = res.alert.id;
      await acknowledgeSosAlert(alertId, testDispatcherId, "SECURITY_GUARDING");
    });

    it("creates a dedicated dispatch assignment (Attempt #1)", async () => {
      const dispatch = await createDispatchAssignment({
        operationType: "SECURITY_GUARDING",
        alertId,
        responderId: testResponderId,
        dispatchedById: testDispatcherId,
        siteId: testSiteId
      });

      expect(dispatch.id).toBeDefined();
      expect(dispatch.status).toBe("PENDING_ACCEPTANCE");
      expect(dispatch.attemptNumber).toBe(1);
      expect(dispatch.assignmentSequence).toBe(1);
      expect(dispatch.responderId).toBe(testResponderId);

      dispatchId = dispatch.id;
    });

    it("responder accepts dispatch assignment", async () => {
      const accepted = await acceptDispatchAssignment(dispatchId, testResponderId);
      expect(accepted.status).toBe("ACCEPTED");
      expect(accepted.acceptedAt).not.toBeNull();
    });

    it("responder marks arrival at scene with GPS coordinates", async () => {
      const arrived = await arriveDispatchAssignment(dispatchId, testResponderId, 25.2855, 51.5312, 5);
      expect(arrived.status).toBe("ARRIVED");
      expect(arrived.arrivalLatitude).toBe(25.2855);
      expect(arrived.arrivalLongitude).toBe(51.5312);
    });

    it("completes dispatch and resolves parent alert", async () => {
      const completed = await completeDispatchAssignment(dispatchId, testDispatcherId, "Incident investigated and post secured.");
      expect(completed.status).toBe("COMPLETED");

      const alert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
      expect(alert?.status).toBe("RESOLVED");
      expect(alert?.resolutionNote).toContain("post secured");
    });

    it("preserves previous attempts when reassigning dispatch", async () => {
      const newSos = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey: `idemp-reassign-${Date.now()}`,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });
      await acknowledgeSosAlert(newSos.alert.id, testDispatcherId, "SECURITY_GUARDING");

      const firstDisp = await createDispatchAssignment({
        operationType: "SECURITY_GUARDING",
        alertId: newSos.alert.id,
        responderId: testResponderId,
        dispatchedById: testDispatcherId,
        siteId: testSiteId
      });

      // Reject first dispatch
      await rejectDispatchAssignment(firstDisp.id, testResponderId, "BUSY_ON_PATROL", "Currently addressing a perimeter check.");

      // Reassign to create second attempt
      const secondDisp = await createDispatchAssignment({
        operationType: "SECURITY_GUARDING",
        alertId: newSos.alert.id,
        responderId: testDispatcherId, // using alternate employee
        dispatchedById: testDispatcherId,
        siteId: testSiteId
      });

      expect(secondDisp.attemptNumber).toBe(2);
      expect(secondDisp.previousAssignmentId).toBe(firstDisp.id);

      // Verify both dispatch records exist in database (history preserved!)
      const allDispatches = await prisma.secFacDispatchAssignment.findMany({
        where: { alertId: newSos.alert.id },
        orderBy: { attemptNumber: "asc" }
      });
      expect(allDispatches.length).toBe(2);
      expect(allDispatches[0].status).toBe("REJECTED");
      expect(allDispatches[1].status).toBe("PENDING_ACCEPTANCE");
    });
  });

  describe("4. Scope Isolation & Security Denial Boundaries", () => {
    it("rejects acknowledge operation when operationType scope mismatches", async () => {
      const res = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey: `idemp-scope-${Date.now()}`,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });

      await expect(
        acknowledgeSosAlert(res.alert.id, testDispatcherId, "FACILITY_MANAGEMENT")
      ).rejects.toThrow("Scope mismatch");
    });

    it("rejects responder acceptance if user is not assigned responder", async () => {
      const res = await raiseSosPanicAlert({
        operationType: "SECURITY_GUARDING",
        employeeId: testEmployeeId,
        idempotencyKey: `idemp-impers-${Date.now()}`,
        siteId: testSiteId,
        clientCapturedAt: new Date().toISOString()
      });
      const dispatch = await createDispatchAssignment({
        operationType: "SECURITY_GUARDING",
        alertId: res.alert.id,
        responderId: testResponderId,
        dispatchedById: testDispatcherId,
        siteId: testSiteId
      });

      await expect(
        acceptDispatchAssignment(dispatch.id, testEmployeeId) // wrong user!
      ).rejects.toThrow("Forbidden: You are not the assigned responder");
    });
  });

  describe("5. Incremental Control Room Feed Query", () => {
    it("fetches incremental updates using cursor pagination", async () => {
      const feed = await getControlRoomIncrementalFeed({
        operationType: "SECURITY_GUARDING",
        limit: 10
      });

      expect(feed.alerts).toBeDefined();
      expect(feed.dispatches).toBeDefined();
      expect(feed.nextCursor).toBeDefined();
    });
  });
});
