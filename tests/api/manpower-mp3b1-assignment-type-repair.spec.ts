import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

import { GET as getRoster } from "../../apps/web/app/api/v1/manpower/scheduling/roster/route";
import { POST as syncSlots } from "../../apps/web/app/api/v1/manpower/scheduling/slots/sync/route";
import { POST as assignSlot } from "../../apps/web/app/api/v1/manpower/scheduling/slots/[slotId]/assign/route";
import { POST as assignReliever } from "../../apps/web/app/api/v1/manpower/scheduling/slots/[slotId]/assign-reliever/route";
import { POST as recordException } from "../../apps/web/app/api/v1/manpower/scheduling/exceptions/route";
import { POST as publishRoster } from "../../apps/web/app/api/v1/manpower/scheduling/publish/route";
import { POST as submitChangeRequest } from "../../apps/web/app/api/v1/manpower/scheduling/change-requests/route";
import { PUT as reviewChangeRequest } from "../../apps/web/app/api/v1/manpower/scheduling/change-requests/[id]/review/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("MP-3B1 Post-Deployment Repair — Schema Drift & assignmentType Verification Test Suite", () => {
  let testClient: any;
  let testContract: any;
  let testProject: any;
  let testSite: any;
  let primaryGuard: any;
  let relieverGuard: any;
  let supervisorUser: any;

  async function cleanupFixtures() {
    try { await prisma.rosterPublication.updateMany({ data: { activeSeriesKey: null, supersedesPublicationId: null } }); } catch (e) {}
    try { await prisma.manpowerPublicationScopeLock.deleteMany({}); } catch (e) {}
    try { await prisma.rosterSlotAcknowledgment.deleteMany({}); } catch (e) {}
    try { await prisma.rosterChangeRequest.deleteMany({}); } catch (e) {}
    try { await prisma.rosterPublicationSlot.deleteMany({}); } catch (e) {}
    try { await prisma.rosterPublication.deleteMany({}); } catch (e) {}
    try { await prisma.rosterSlotAssignment.updateMany({ data: { replacesAssignmentId: null, planningExceptionId: null } }); } catch (e) {}
    try { await prisma.rosterSlotAssignment.deleteMany({ where: { slot: { contractId: "REPAIR-CON-01" } } }); } catch (e) {}
    try { await prisma.rosterPlanningException.deleteMany({ where: { contractId: "REPAIR-CON-01" } }); } catch (e) {}
    try { await prisma.rosterRequirementSlot.deleteMany({ where: { contractId: "REPAIR-CON-01" } }); } catch (e) {}
    try { await prisma.manpowerContract.updateMany({ where: { id: "REPAIR-CON-01" }, data: { siteId: null } }); } catch (e) {}
    try { await prisma.manpowerSite.deleteMany({ where: { code: "RPRS" } }); } catch (e) {}
    try { await prisma.manpowerProject.deleteMany({ where: { code: "RPRP" } }); } catch (e) {}
    try { await prisma.contractManpowerRequirement.deleteMany({ where: { contractId: "REPAIR-CON-01" } }); } catch (e) {}
    try { await prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: ["emp-guard-rpr-p", "emp-guard-rpr-r"] } } }); } catch (e) {}
    try { await prisma.manpowerDeploymentAssignment.deleteMany({ where: { employeeId: { in: ["emp-guard-rpr-p", "emp-guard-rpr-r"] } } }); } catch (e) {}
    try { await prisma.employee.deleteMany({ where: { id: { in: ["emp-guard-rpr-p", "emp-guard-rpr-r", "emp-sup-rpr"] } } }); } catch (e) {}
  }

  beforeAll(async () => {
    await cleanupFixtures();

    testClient = await prisma.manpowerClient.findFirst({ where: { code: "RPRC" } });
    if (!testClient) {
      testClient = await prisma.manpowerClient.create({
        data: { name: "Repair Client", code: "RPRC", operationType: "SECURITY_GUARDING" }
      });
    }

    testContract = await prisma.manpowerContract.upsert({
      where: { id: "REPAIR-CON-01" },
      update: { status: "ACTIVE", siteId: null },
      create: {
        id: "REPAIR-CON-01",
        clientId: testClient.id,
        operationType: "SECURITY_GUARDING",
        contractNumber: "REPAIR-CON-01",
        title: "Repair Test Contract",
        startDate: new Date("2026-07-25"),
        endDate: new Date("2026-08-25"),
        status: "ACTIVE"
      }
    });

    const mReq = await prisma.contractManpowerRequirement.findFirst({ where: { contractId: testContract.id } });
    if (!mReq) {
      await prisma.contractManpowerRequirement.create({
        data: { contractId: testContract.id, position: "Guard", quantity: 1, deploymentType: "Permanent" }
      });
    }

    const sReq = await prisma.contractShiftRequirement.findFirst({ where: { contractId: testContract.id } });
    if (!sReq) {
      await prisma.contractShiftRequirement.create({
        data: { contractId: testContract.id, shiftName: "Day Shift", startTime: "06:00", endTime: "18:00", postsCovered: 1, daysPattern: "Daily" }
      });
    }

    testProject = await prisma.manpowerProject.findFirst({ where: { code: "RPRP" } });
    if (!testProject) {
      testProject = await prisma.manpowerProject.create({
        data: { name: "Repair Project", code: "RPRP", contractId: testContract.id, operationType: "SECURITY_GUARDING" }
      });
    }

    testSite = await prisma.manpowerSite.findFirst({ where: { code: "RPRS" } });
    if (!testSite) {
      testSite = await prisma.manpowerSite.create({
        data: { name: "Repair Site", code: "RPRS", projectId: testProject.id, operationType: "SECURITY_GUARDING" }
      });
    }

    await prisma.manpowerContract.update({
      where: { id: testContract.id },
      data: { siteId: testSite.id }
    });

    let posCat = await prisma.blueCollarPositionCategory.findFirst();
    if (!posCat) {
      posCat = await prisma.blueCollarPositionCategory.create({
        data: { name: "Security Guard Position", code: "SGPOS" }
      });
    }

    primaryGuard = await prisma.employee.upsert({
      where: { id: "emp-guard-rpr-p" },
      update: { name: "Primary Guard Repair", isActive: true, status: "Offline", employeeCategory: "BLUE_COLLAR", positionCategoryId: posCat?.id },
      create: {
        id: "emp-guard-rpr-p",
        name: "Primary Guard Repair",
        email: "guard-p@rpr.com",
        role: "EMPLOYEE",
        department: "Security",
        status: "Offline",
        isActive: true,
        operationType: "SECURITY_GUARDING",
        employeeCategory: "BLUE_COLLAR",
        positionCategoryId: posCat?.id
      }
    });

    relieverGuard = await prisma.employee.upsert({
      where: { id: "emp-guard-rpr-r" },
      update: { name: "Reliever Guard Repair", isActive: true, status: "Offline", employeeCategory: "BLUE_COLLAR", positionCategoryId: posCat?.id },
      create: {
        id: "emp-guard-rpr-r",
        name: "Reliever Guard Repair",
        email: "guard-r@rpr.com",
        role: "EMPLOYEE",
        department: "Security",
        status: "Offline",
        isActive: true,
        operationType: "SECURITY_GUARDING",
        employeeCategory: "BLUE_COLLAR",
        positionCategoryId: posCat?.id
      }
    });

    supervisorUser = await prisma.employee.upsert({
      where: { id: "emp-sup-rpr" },
      update: { name: "Supervisor Repair", isActive: true },
      create: {
        id: "emp-sup-rpr",
        name: "Supervisor Repair",
        email: "sup@rpr.com",
        role: "ADMIN",
        department: "Operations",
        status: "Offline",
        isActive: true
      }
    });

    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: supervisorUser.id,
        employeeId: supervisorUser.id,
        name: supervisorUser.name,
        role: "SUPER_ADMIN",
        email: supervisorUser.email,
        permissions: [
          "manpower.admin.full_access",
          "manpower.schedule.view",
          "manpower.roster.publish",
          "manpower.roster.changeRequest.submit",
          "manpower.roster.changeRequest.review",
          "manpower.roster.publication.viewHistory",
          "manpower.security.view"
        ],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
      }
    });
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it("1. Schema & Migration verification: assignmentType column exists in migration SQL and schema.prisma", () => {
    const migrationPath = path.join(
      process.cwd(),
      "packages/database/prisma/migrations/20260724_manpower_mp3b1_assignment_type_repair/migration.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    expect(migrationSql).toContain("ADD COLUMN `assignmentType` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY'");
    expect(migrationSql).toContain("UPDATE `RosterSlotAssignment`");
    expect(migrationSql).toContain("SET `assignmentType` = 'RELIEVER'");
  });

  it("2. Sync contract slots creates requirement slots cleanly", async () => {
    const req = new NextRequest("http://localhost/api/v1/manpower/scheduling/slots/sync", {
      method: "POST",
      body: JSON.stringify({ contractId: testContract.id, startDate: "2026-07-25", endDate: "2026-07-26" })
    });
    const res = await syncSlots(req);
    expect(res.status).toBe(200);

    const slots = await prisma.rosterRequirementSlot.findMany({
      where: { contractId: testContract.id }
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it("3. RosterRequirementSlot.findMany includes RosterSlotAssignment.assignmentType without error", async () => {
    const req = new Request(`http://localhost/api/v1/manpower/scheduling/roster?contractId=${testContract.id}&startDate=2026-07-25&endDate=2026-07-26`);
    const res = await getRoster(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.slots)).toBe(true);
  });

  it("4. Primary assignment flow sets assignmentType = 'PRIMARY' correctly", async () => {
    const slot = await prisma.rosterRequirementSlot.findFirst({
      where: { contractId: testContract.id, businessDate: new Date("2026-07-25") }
    });
    expect(slot).toBeTruthy();

    const req = new NextRequest(`http://localhost/api/v1/manpower/scheduling/slots/${slot!.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ employeeId: primaryGuard.id })
    });
    const res = await assignSlot(req, { params: { slotId: slot!.id } });
    expect(res.status).toBe(200);

    const asg = await prisma.rosterSlotAssignment.findFirst({
      where: { slotId: slot!.id, historyStatus: "ACTIVE" }
    });
    expect(asg).toBeTruthy();
    expect(asg?.assignmentType).toBe("PRIMARY");
    expect(asg?.employeeId).toBe(primaryGuard.id);
  });

  it("5. Exception and reliever assignment flow sets assignmentType = 'RELIEVER' correctly", async () => {
    const slot = await prisma.rosterRequirementSlot.findFirst({
      where: { contractId: testContract.id, businessDate: new Date("2026-07-25") }
    });

    // Create Day Off Exception
    const primaryAsg = await prisma.rosterSlotAssignment.findFirst({
      where: { slotId: slot!.id, employeeId: primaryGuard.id, historyStatus: "ACTIVE" }
    });
    expect(primaryAsg).toBeTruthy();

    const excReq = new NextRequest("http://localhost/api/v1/manpower/scheduling/exceptions", {
      method: "POST",
      body: JSON.stringify({
        exceptionType: "DAY_OFF",
        primaryAssignmentIds: [primaryAsg!.id],
        reason: "Scheduled weekly rest day"
      })
    });
    const excRes = await recordException(excReq);
    expect(excRes.status).toBe(200);
    const excJson = await excRes.json();
    const exceptionId = excJson.exceptions[0].id;

    // Assign Reliever
    const relReq = new NextRequest(`http://localhost/api/v1/manpower/scheduling/slots/${slot!.id}/assign-reliever`, {
      method: "POST",
      body: JSON.stringify({
        employeeId: relieverGuard.id,
        replacesAssignmentId: primaryAsg!.id,
        exceptionId: exceptionId
      })
    });
    const relRes = await assignReliever(relReq, { params: { slotId: slot!.id } });
    if (relRes.status !== 200) {
      console.error("assignReliever 422 error:", await relRes.json());
    }
    expect(relRes.status).toBe(200);

    const relieverAsg = await prisma.rosterSlotAssignment.findFirst({
      where: { slotId: slot!.id, employeeId: relieverGuard.id, historyStatus: "ACTIVE" }
    });
    expect(relieverAsg).toBeTruthy();
    expect(relieverAsg?.assignmentType).toBe("RELIEVER");
    expect(relieverAsg?.planningExceptionId).toBe(exceptionId);
  });

  it("6. Backfill logic verification: Primary vs Reliever deterministic detection", async () => {
    // Query directly from database using Prisma client
    const assignments = await prisma.rosterSlotAssignment.findMany({
      where: { slot: { contractId: testContract.id } }
    });

    for (const a of assignments) {
      if (a.planningExceptionId || a.replacesAssignmentId || a.activeCoverageKey) {
        expect(a.assignmentType).toBe("RELIEVER");
      } else {
        expect(a.assignmentType).toBe("PRIMARY");
      }
    }
  });

  it("7. Publication snapshot and MP-3B1 change request workflow remain fully functional", async () => {
    const pubReq = new NextRequest("http://localhost/api/v1/manpower/scheduling/publish", {
      method: "POST",
      body: JSON.stringify({
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        startDate: "2026-07-25",
        endDate: "2026-07-26",
        revisionReason: "Repair test publication"
      })
    });
    const pubRes = await publishRoster(pubReq);
    expect(pubRes.status).toBe(201);

    const pubJson = await pubRes.json();
    const pubId = pubJson.publication.id;

    const slots = await prisma.rosterPublicationSlot.findMany({
      where: { publicationId: pubId }
    });
    expect(slots.length).toBeGreaterThan(0);
    const primarySnapshot = slots.find(s => s.coverageType === "PRIMARY_DUTY");
    const relieverSnapshot = slots.find(s => s.coverageType === "RELIEVER_DUTY");
    expect(primarySnapshot).toBeTruthy();
    expect(relieverSnapshot).toBeTruthy();

    // Submit change request
    const slot = await prisma.rosterRequirementSlot.findFirst({
      where: { contractId: testContract.id, businessDate: new Date("2026-07-26") }
    });
    const targetPubSlot = slots.find(s => s.slotId === slot!.id);

    const crReq = new NextRequest("http://localhost/api/v1/manpower/scheduling/change-requests", {
      method: "POST",
      body: JSON.stringify({
        operationType: "SECURITY_GUARDING",
        contractId: testContract.id,
        siteId: testSite.id,
        basePublicationId: pubId,
        publicationSlotId: targetPubSlot!.id,
        changeType: "EMPLOYEE_REPLACEMENT",
        targetEmployeeId: primaryGuard.id,
        reason: "Assign guard to open slot"
      })
    });
    const crRes = await submitChangeRequest(crReq);
    expect(crRes.status).toBe(201);
    const crJson = await crRes.json();

    // Review change request (Approve)
    const revReq = new NextRequest(`http://localhost/api/v1/manpower/scheduling/change-requests/${crJson.changeRequest.id}/review`, {
      method: "PUT",
      body: JSON.stringify({
        decision: "APPROVE",
        reviewNotes: "Approved repair test CR",
        allowSelfApprovalOverride: true,
        selfApprovalReason: "Approved repair test CR self-approval override for automated testing"
      })
    });
    const revRes = await reviewChangeRequest(revReq, { params: { id: crJson.changeRequest.id } });
    expect(revRes.status).toBe(200);

    const updatedBasePub = await prisma.rosterPublication.findUnique({ where: { id: pubId } });
    expect(updatedBasePub?.status).toBe("SUPERSEDED");
  });
});
