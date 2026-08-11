import { prisma } from "@ahh-wfm/database";
import {
  createPostOrder,
  publishPostOrder,
  retirePostOrder,
  getGuardActivePostOrders,
  acknowledgePostOrder
} from "../../apps/web/lib/secfac-post-order-service";
import {
  createOrUpdateBriefing,
  manageBriefingParticipants,
  completeBriefingStage,
  getBriefingDetails
} from "../../apps/web/lib/secfac-shift-briefing-service";
import {
  generateIncidentNumber,
  reportIncident,
  promoteOccurrenceToIncident,
  assignIncidentSupervisor,
  transitionIncidentStatus,
  requestIncidentClosure,
  handleIncidentWorkflowAction
} from "../../apps/web/lib/secfac-incident-service";
import {
  createSupervisorInspection,
  getSupervisorInspectionDetails,
  resolveInspectionFollowUp
} from "../../apps/web/lib/secfac-supervisor-inspection-service";

describe("SECFAC Phase 6B - Incidents, Post Orders, Briefings & Supervisor Inspections", () => {
  const companyId = "COMP001";
  const siteId = "SITE01";
  const employeeId = "EMP001";
  const supervisorId = "EMP_SUP_01";
  const inspectedGuardId = "EMP_GUARD_02";

  beforeAll(async () => {
    // Ensure test company exists
    await prisma.company.upsert({
      where: { id: companyId },
      update: {},
      create: {
        id: companyId,
        companyCode: "COMP001",
        companyName: "Test Company Alpha"

      }
    });

    // Ensure test client, contract & project exist

    await prisma.manpowerClient.upsert({
      where: { id: "CLI001" },
      update: {},
      create: {
        id: "CLI001",
        code: "CLI001",
        name: "Test Client",
        operationType: "SECURITY_GUARDING"
      }
    });

    await prisma.manpowerContract.upsert({
      where: { id: "CTR001" },
      update: {},
      create: {
        id: "CTR001",
        contractNumber: "CTR001",
        title: "Test Contract",
        clientId: "CLI001",
        operationType: "SECURITY_GUARDING",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });





    await prisma.manpowerProject.upsert({
      where: { id: "PRJ001" },
      update: {},
      create: {
        id: "PRJ001",
        code: "PRJ001",
        name: "Test Project",
        operationType: "SECURITY_GUARDING",
        contractId: "CTR001"
      }
    });

    // Ensure test site exists
    await prisma.manpowerSite.upsert({
      where: { id: siteId },
      update: {},
      create: {
        id: siteId,
        code: "SITE01",
        name: "Test Security Site Alpha",
        operationType: "SECURITY_GUARDING",
        projectId: "PRJ001"
      }
    });


    // Ensure test employees exist
    await prisma.employee.upsert({
      where: { id: employeeId },
      update: {},
      create: {
        id: employeeId,
        name: "Test Officer",
        email: "test.officer@ahh.qa",
        department: "SECURITY",
        role: "EMPLOYEE",
        status: "On Duty",
        companyId
      }
    });

    await prisma.employee.upsert({
      where: { id: supervisorId },
      update: {},
      create: {
        id: supervisorId,
        name: "Field Supervisor",
        email: "field.sup@ahh.qa",
        department: "SECURITY",
        role: "SUPERVISOR",
        status: "On Duty",
        companyId
      }
    });

    await prisma.employee.upsert({
      where: { id: inspectedGuardId },
      update: {},
      create: {
        id: inspectedGuardId,
        name: "Guard Junior",
        email: "guard.junior@ahh.qa",
        department: "SECURITY",
        role: "EMPLOYEE",
        status: "On Duty",
        companyId
      }
    });

    // Ensure checklist template and items for supervisor inspection tests
    await prisma.secfacChecklistTemplate.upsert({
      where: { id: "TMPL-GUARD-TURNOUT-01" },
      update: {},
      create: {
        id: "TMPL-GUARD-TURNOUT-01",
        templateCode: "TMPL-GUARD-TURNOUT-01",
        templateName: "Guard Turnout & Equipment Audit",
        operationType: "SECURITY_GUARDING"
      }
    });

    await prisma.secfacChecklistItem.upsert({
      where: { id: "ITEM-UNIFORM-01" },
      update: {},
      create: {
        id: "ITEM-UNIFORM-01",
        templateId: "TMPL-GUARD-TURNOUT-01",
        itemText: "Uniform Clean & Complete",
        itemCode: "ITEM-UNIFORM-01",
        itemType: "PASS_FAIL",
        sortOrder: 1
      }
    });

    await prisma.secfacChecklistItem.upsert({
      where: { id: "ITEM-EQUIPMENT-01" },
      update: {},
      create: {
        id: "ITEM-EQUIPMENT-01",
        templateId: "TMPL-GUARD-TURNOUT-01",
        itemText: "Guard Equipment Checked",
        itemCode: "ITEM-EQUIPMENT-01",
        itemType: "PASS_FAIL",
        sortOrder: 2
      }
    });

    // Clean up test post orders from prior test runs
    await prisma.secfacPostOrderAcknowledgement.deleteMany({});
    await prisma.secfacPostOrder.deleteMany({
      where: { familyId: "FAM-ACCESS-PROC-01" }
    });
  });





  describe("1. Digital Security Post Orders & Lineage", () => {
    const familyA = "FAM-ACCESS-PROC-01";

    it("creates post order draft v1", async () => {
      const po1 = await createPostOrder({
        familyId: familyA,
        companyId,
        siteId,
        title: "Main Gate Access Procedure v1",
        content: "Verify identity cards at gate entry.",
        createdById: employeeId
      });

      expect(po1).toBeDefined();
      expect(po1.familyId).toBe(familyA);
      expect(po1.version).toBe(1);
      expect(po1.status).toBe("DRAFT");
    });

    it("publishes v1 and then publishes v2 of same family, setting v1 to SUPERSEDED", async () => {
      // Find v1 draft
      const draft1 = await prisma.secfacPostOrder.findFirst({
        where: { familyId: familyA, version: 1 }
      });
      expect(draft1).toBeDefined();

      // Publish v1
      const pub1 = await publishPostOrder(draft1!.id, supervisorId);
      expect(pub1.status).toBe("PUBLISHED");

      // Create v2 draft in same family
      const po2 = await createPostOrder({
        familyId: familyA,
        companyId,
        siteId,
        title: "Main Gate Access Procedure v2",
        content: "Verify biometric pass at gate entry.",
        createdById: employeeId
      });
      expect(po2.version).toBe(2);

      // Publish v2
      const pub2 = await publishPostOrder(po2.id, supervisorId);
      expect(pub2.status).toBe("PUBLISHED");

      // Verify v1 is now SUPERSEDED
      const v1After = await prisma.secfacPostOrder.findUnique({ where: { id: draft1!.id } });
      expect(v1After?.status).toBe("SUPERSEDED");
      expect(v1After?.effectiveTo).toBeDefined();
    });

    it("fetches active post orders and records guard digital acknowledgement", async () => {
      const activeList = await getGuardActivePostOrders({
        employeeId: inspectedGuardId,
        companyId,
        siteId
      });

      expect(activeList.length).toBeGreaterThan(0);
      const activePo = activeList.find(p => p.familyId === familyA);
      expect(activePo).toBeDefined();
      expect(activePo?.version).toBe(2);
      expect(activePo?.isAcknowledged).toBe(false);

      // Guard acknowledges v2
      const ack = await acknowledgePostOrder({
        postOrderId: activePo!.id,
        employeeId: inspectedGuardId,
        acknowledgementMethod: "MOBILE_APP"
      });

      expect(ack).toBeDefined();
      expect(ack.postOrderId).toBe(activePo!.id);

      // Re-query active orders to verify isAcknowledged flag is now true
      const updatedActiveList = await getGuardActivePostOrders({
        employeeId: inspectedGuardId,
        companyId,
        siteId
      });
      const updatedPo = updatedActiveList.find(p => p.id === activePo!.id);
      expect(updatedPo?.isAcknowledged).toBe(true);
    });
  });

  describe("2. Shift Briefing & Debriefing Lifecycle", () => {
    let briefingId: string;

    it("creates shift briefing draft and attaches normalized participants", async () => {
      const briefing = await createOrUpdateBriefing({
        companyId,
        siteId,
        supervisorId,
        safetyNotes: "Wear reflective vests during night shift",
        knownRisks: "Roadwork at Gate 2",
        temporaryInstructions: "Extra checks on North Perimeter"
      });

      expect(briefing).toBeDefined();
      expect(briefing.stage).toBe("BRIEFING_DRAFT");
      briefingId = briefing.id;

      // Add participants
      const participants = await manageBriefingParticipants(briefingId, [
        { employeeId: inspectedGuardId, attendanceStatus: "PRESENT", recordedById: supervisorId },
        { employeeId, attendanceStatus: "EXCUSED", recordedById: supervisorId }
      ]);

      expect(participants.length).toBe(2);
    });

    it("completes briefing stage and transitions to debriefing completed", async () => {
      const completedBriefing = await completeBriefingStage({
        briefingId,
        targetStage: "BRIEFING_COMPLETED",
        notes: "All guards briefed on perimeter risks",
        supervisorId
      });

      expect(completedBriefing.stage).toBe("BRIEFING_COMPLETED");

      const completedDebriefing = await completeBriefingStage({
        briefingId,
        targetStage: "DEBRIEFING_COMPLETED",
        notes: "Shift handed over with zero incidents",
        supervisorId
      });

      expect(completedDebriefing.stage).toBe("DEBRIEFING_COMPLETED");

      const details = await getBriefingDetails(briefingId);
      expect(details?.stage).toBe("DEBRIEFING_COMPLETED");
      expect(details?.participants.length).toBe(2);
    });
  });

  describe("3. Incident & Occurrence Lifecycle and Strict Governance Guardrails", () => {
    let occurrenceId: string;
    let criticalIncidentId: string;

    it("generates reference number and reports an occurrence", async () => {
      const refNum = await generateIncidentNumber(companyId);
      expect(refNum).toMatch(/^INC-\d{6}-\d{4}$/);

      const occurrence = await reportIncident({
        companyId,
        siteId,
        reportedById: inspectedGuardId,
        type: "OCCURRENCE",
        severity: "MINOR",
        category: "SAFETY_HAZARD",
        title: "Slippery floor near lobby entrance",
        description: "Water leaking from aircon duct",
        immediateAction: "Placed caution cone"
      });

      expect(occurrence).toBeDefined();
      expect(occurrence.type).toBe("OCCURRENCE");
      expect(occurrence.incidentNumber).toMatch(/^INC-\d{6}-\d{4}$/);
      occurrenceId = occurrence.id;
    });

    it("promotes occurrence to formal incident", async () => {
      const promoted = await promoteOccurrenceToIncident({
        incidentId: occurrenceId,
        performedById: supervisorId,
        remarks: "Promoted due to repeated water leak risk",
        severity: "MODERATE"
      });

      expect(promoted.type).toBe("INCIDENT");
      expect(promoted.severity).toBe("MODERATE");
    });

    it("reports a CRITICAL incident and verifies missing-workflow error blocking direct closure", async () => {
      const criticalInc = await reportIncident({
        companyId,
        siteId,
        reportedById: inspectedGuardId,
        type: "INCIDENT",
        severity: "CRITICAL",
        category: "THEFT",
        title: "Perimeter breach and property damage at Warehouse 3",
        description: "Forced entry detected on door sensor."
      });

      expect(criticalInc.severity).toBe("CRITICAL");
      criticalIncidentId = criticalInc.id;

      // Assign supervisor
      await assignIncidentSupervisor({
        incidentId: criticalIncidentId,
        assignedToId: supervisorId,
        performedById: supervisorId
      });

      // Transition to INVESTIGATING
      await transitionIncidentStatus({
        incidentId: criticalIncidentId,
        targetStatus: "INVESTIGATING",
        performedById: supervisorId
      });

      // Attempt closure request on CRITICAL incident without workflow configuration
      let caughtError: any = null;
      try {
        await requestIncidentClosure({
          incidentId: criticalIncidentId,
          closedById: supervisorId,
          closureReason: "Investigation completed and police notified."
        });
      } catch (e: any) {
        caughtError = e;
      }
      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain("WORKFLOW_CONFIGURATION_REQUIRED");
    });
  });


  describe("4. Supervisor Field Inspections (Checklist Engine Reused 100%)", () => {
    it("creates supervisor field inspection linking underlying checklist execution", async () => {
      const inspection = await createSupervisorInspection({
        companyId,
        siteId,
        supervisorId,
        inspectedEmployeeId: inspectedGuardId,
        templateId: "TMPL-GUARD-TURNOUT-01",
        overallResult: "COMPLIANT",
        notes: "Guard turnout neat and presentable.",
        responses: [
          { itemTemplateId: "ITEM-UNIFORM-01", responseValue: "PASS", isCompliant: true },
          { itemTemplateId: "ITEM-EQUIPMENT-01", responseValue: "PASS", isCompliant: true }
        ]
      });

      expect(inspection).toBeDefined();
      expect(inspection.checklistExecutionId).toBeDefined();
      expect(inspection.overallResult).toBe("COMPLIANT");
      expect(inspection.status).toBe("COMPLETED");

      const details = await getSupervisorInspectionDetails(inspection.id);
      expect(details?.checklistExecution).toBeDefined();
      expect(details?.inspectedEmployee?.id).toBe("EMP_GUARD_02");

    });
  });
});
