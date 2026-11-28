import { prisma, Prisma } from "@ahh-wfm/database";
import { mockDb } from "@ahh-wfm/mock-data";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { GET as getApprovals } from "../../apps/web/app/api/v1/approvals/route";
import { GET as getApprovalCounts } from "../../apps/web/app/api/v1/approvals/counts/route";
import {
  GET as getOpportunities,
  POST as postOpportunity,
  PATCH as patchOpportunity,
} from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { GET as getCostingList } from "../../apps/web/app/api/v1/commercial/costing/route";
import { GET as getCostingDetail } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";
import { GET as getProposals } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { POST as postProposalIssue } from "../../apps/web/app/api/v1/commercial/proposals/[id]/issue/route";
import { UNLINKED_CLIENT_LABEL } from "../../apps/web/lib/commercial-client-resolution";

const Decimal = Prisma.Decimal;

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Shana UAT Run 3 Day 10 Remediation — Priority 1 (Approval Center Outbox) & Priority 2 (Direct Intake Client Linking)", () => {
  const RUN_ID = `DAY10-${Date.now()}`;
  const COMP_SG = `COMP-${RUN_ID}-SG`;
  const COMP_OTHER = `COMP-${RUN_ID}-OTHER`;
  const SHARED_DISPLAY_NAME = `Mohammed Shared ${RUN_ID}`;

  const sgUser = {
    id: `USR-${RUN_ID}-SG`,
    email: `shana.day10.${RUN_ID}@ahh-uat.local`,
    name: `Shana Day10 ${RUN_ID}`,
    role: "COMMERCIAL_MAKER",
    companyId: COMP_SG,
    permissions: [
      "precontract.case.view",
      "precontract.case.manage",
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.proposal.view",
      "precontract.proposal.manage",
      "precontract.proposal.issue",
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const sameNameUserA = {
    id: `USR-${RUN_ID}-SAME-A`,
    email: `same.a.${RUN_ID}@ahh-uat.local`,
    name: SHARED_DISPLAY_NAME,
    role: "COMMERCIAL_CHECKER",
    companyId: COMP_SG,
    permissions: ["precontract.case.view"],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const sameNameUserB = {
    id: `USR-${RUN_ID}-SAME-B`,
    email: `same.b.${RUN_ID}@ahh-uat.local`,
    name: SHARED_DISPLAY_NAME,
    role: "COMMERCIAL_CHECKER",
    companyId: COMP_SG,
    permissions: ["precontract.case.view"],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const fmUser = {
    id: `USR-${RUN_ID}-FM`,
    email: `fm.day10.${RUN_ID}@ahh-uat.local`,
    name: `FM Day10 ${RUN_ID}`,
    role: "COMMERCIAL_MAKER",
    companyId: COMP_SG,
    permissions: ["precontract.case.view", "precontract.case.manage"],
    operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true },
  };

  let wfTemplateId = "";
  let sgProspectId = "";
  let otherCompProspectId = "";
  let sgExistingClientId = "";
  let fmExistingClientId = "";
  let directCaseId = "";
  let directSurveyId = "";
  let directCostingId = "";
  let directProposalId = "";
  let archivedCaseId = "";
  let historicalCaseId = "";
  const createdWfInstanceIds: string[] = [];

  function setSession(user: any) {
    (getServerSession as jest.Mock).mockResolvedValue(user ? { user } : null);
  }

  beforeEach(() => {
    jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getEmployees").mockImplementation(async () => {
      const s = await (getServerSession as jest.Mock)();
      if (!s || !s.user || !s.user.id) return [];
      return [
        {
          id: s.user.id,
          name: s.user.name || s.user.id,
          email: s.user.email || `${s.user.id}@ahh.com`,
          role: s.user.role || "EMPLOYEE",
          companyId: s.user.companyId ?? null,
          departmentId: null,
          isActive: true,
          employmentStatus: "ACTIVE",
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      ] as any;
    });
  });

  beforeAll(async () => {
    await prisma.company.createMany({
      data: [
        { id: COMP_SG, companyCode: `SG10-${RUN_ID.slice(-5)}`, companyName: "Day10 SG Company" },
        { id: COMP_OTHER, companyCode: `OT10-${RUN_ID.slice(-5)}`, companyName: "Day10 Other Company" },
      ],
      skipDuplicates: true,
    });

    await prisma.employee.createMany({
      data: [
        {
          id: sgUser.id,
          name: sgUser.name,
          email: sgUser.email,
          department: "Commercial",
          companyId: COMP_SG,
          role: "EMPLOYEE",
          status: "On Duty",
        },
        {
          id: sameNameUserA.id,
          name: SHARED_DISPLAY_NAME,
          email: sameNameUserA.email,
          department: "Commercial",
          companyId: COMP_SG,
          role: "EMPLOYEE",
          status: "On Duty",
        },
        {
          id: sameNameUserB.id,
          name: SHARED_DISPLAY_NAME,
          email: sameNameUserB.email,
          department: "Commercial",
          companyId: COMP_SG,
          role: "EMPLOYEE",
          status: "On Duty",
        },
      ],
      skipDuplicates: true,
    });

    const pSg = await prisma.preContractProspectClient.create({
      data: { name: `Verified SG Prospect ${RUN_ID}`, companyId: COMP_SG },
    });
    sgProspectId = pSg.id;

    const pOther = await prisma.preContractProspectClient.create({
      data: { name: `Other Co Prospect ${RUN_ID}`, companyId: COMP_OTHER },
    });
    otherCompProspectId = pOther.id;

    const cSg = await prisma.manpowerClient.create({
      data: {
        code: `CSG-${RUN_ID.slice(-6)}`,
        name: `Existing SG Client ${RUN_ID}`,
        operationType: "SECURITY_GUARDING",
        isActive: true,
      },
    });
    sgExistingClientId = cSg.id;

    const cFm = await prisma.manpowerClient.create({
      data: {
        code: `CFM-${RUN_ID.slice(-6)}`,
        name: `Existing FM Client ${RUN_ID}`,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true,
      },
    });
    fmExistingClientId = cFm.id;

    const tpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Day10 Test Template ${RUN_ID}`,
        moduleType: "PRE_CONTRACT_CASE",
        appliesTo: "APPROVAL",
        isActive: true,
        isDefault: false,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Review L1",
              approvers: { create: [{ approverType: "ROLE_BASED", roleName: "COMMERCIAL_CHECKER" }] },
            },
          ],
        },
      },
    });
    wfTemplateId = tpl.id;

    // Seed cases for Priority 1 Outbox classification:
    // 1. Historical completed case (valid historical audit)
    const histCase = await prisma.preContractCase.create({
      data: {
        title: `Historical OPP6 Case ${RUN_ID}`,
        prospectClientId: sgProspectId,
        companyId: COMP_SG,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        createdBy: sgUser.id,
      },
    });
    historicalCaseId = histCase.id;

    // 2. Archived/Cancelled case
    const archCase = await prisma.preContractCase.create({
      data: {
        title: `Cancelled OPP4 Case ${RUN_ID}`,
        prospectClientId: sgProspectId,
        companyId: COMP_SG,
        operationType: "SECURITY_GUARDING",
        lifecycle: "CANCELLED",
        createdBy: sgUser.id,
      },
    });
    archivedCaseId = archCase.id;

    // Create 4 workflow instances acted on by sgUser:
    // A. Valid historical SG approval (actedBy stored as EMAIL to verify actor-token matching!)
    const wiHist = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: historicalCaseId,
        status: "APPROVED",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "SECURITY_GUARDING",
        history: {
          create: [{ levelNumber: 1, action: "APPROVE", actedBy: sgUser.email, remarks: "Approved OPP6" }],
        },
      },
    });
    createdWfInstanceIds.push(wiHist.id);

    // B. Archived/Cancelled SG case (actedBy stored as user.id)
    const wiArch = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: archivedCaseId,
        status: "APPROVED",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "SECURITY_GUARDING",
        history: {
          create: [{ levelNumber: 1, action: "APPROVE", actedBy: sgUser.id, remarks: "Approved before cancel" }],
        },
      },
    });
    createdWfInstanceIds.push(wiArch.id);

    // C. Orphaned / Missing Source SG workflow (referenceId does not exist)
    const wiOrphan = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: `NON-EXISTENT-${RUN_ID}`,
        status: "APPROVED",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "SECURITY_GUARDING",
        history: {
          create: [{ levelNumber: 1, action: "APPROVE", actedBy: sgUser.name, remarks: "Orphaned record" }],
        },
      },
    });
    createdWfInstanceIds.push(wiOrphan.id);

    // D. Cross-operation FM workflow (MUST be filtered out for SG-only user)
    const wiFm = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: historicalCaseId,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "FACILITY_MANAGEMENT",
        history: {
          create: [{ levelNumber: 1, action: "RETURN", actedBy: sgUser.id, remarks: "FM scope item" }],
        },
      },
    });
    createdWfInstanceIds.push(wiFm.id);

    // E. Same-name isolation: User A acted by immutable ID; User B acted by shared display name & by User B ID
    const wiSameA = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: historicalCaseId,
        status: "APPROVED",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "SECURITY_GUARDING",
        history: {
          create: [{ levelNumber: 1, action: "APPROVE", actedBy: sameNameUserA.id, remarks: "User A action" }],
        },
      },
    });
    createdWfInstanceIds.push(wiSameA.id);

    const wiSameBByName = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: historicalCaseId,
        status: "APPROVED",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "SECURITY_GUARDING",
        history: {
          create: [{ levelNumber: 1, action: "APPROVE", actedBy: SHARED_DISPLAY_NAME, remarks: "User B legacy name action" }],
        },
      },
    });
    createdWfInstanceIds.push(wiSameBByName.id);

    const wiSameBById = await prisma.workflowInstance.create({
      data: {
        templateId: wfTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: historicalCaseId,
        status: "APPROVED",
        currentLevelNumber: 1,
        companyId: COMP_SG,
        operationScope: "SECURITY_GUARDING",
        history: {
          create: [{ levelNumber: 1, action: "APPROVE", actedBy: sameNameUserB.id, remarks: "User B ID action" }],
        },
      },
    });
    createdWfInstanceIds.push(wiSameBById.id);
  });

  afterAll(async () => {
    await prisma.userActivityLog.deleteMany({ where: { entityId: directCaseId } });
    if (directProposalId) {
      await prisma.preContractProposalVersion.deleteMany({ where: { proposalId: directProposalId } });
      await prisma.preContractProposal.deleteMany({ where: { id: directProposalId } });
    }
    if (directCostingId) {
      await prisma.preContractCostEstimateItem.deleteMany({ where: { estimateVersion: { estimateId: directCostingId } } });
      await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId: directCostingId } });
      await prisma.preContractCostEstimate.deleteMany({ where: { id: directCostingId } });
    }
    if (directSurveyId) {
      await prisma.surveyResponse.deleteMany({ where: { surveyId: directSurveyId } });
      await prisma.preContractSurvey.deleteMany({ where: { id: directSurveyId } });
    }
    if (createdWfInstanceIds.length > 0) {
      await prisma.workflowActionHistory.deleteMany({ where: { instanceId: { in: createdWfInstanceIds } } });
      await prisma.workflowInstance.deleteMany({ where: { id: { in: createdWfInstanceIds } } });
    }
    if (wfTemplateId) {
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: wfTemplateId } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: wfTemplateId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wfTemplateId } });
    }
    const caseIds = [directCaseId, archivedCaseId, historicalCaseId].filter(Boolean);
    if (caseIds.length > 0) {
      await prisma.preContractCase.deleteMany({ where: { id: { in: caseIds } } });
    }
    await prisma.preContractProspectClient.deleteMany({ where: { id: { in: [sgProspectId, otherCompProspectId] } } });
    await prisma.manpowerClient.deleteMany({ where: { id: { in: [sgExistingClientId, fmExistingClientId] } } });
    await prisma.employee.deleteMany({ where: { id: { in: [sgUser.id, sameNameUserA.id, sameNameUserB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [COMP_SG, COMP_OTHER] } } });
  });

  test("P1: Outbox matches actor by id/email/name, enforces SG/FM scope, classifies HISTORICAL/ARCHIVED/MISSING_SOURCE, and disables broken deepLink", async () => {
    setSession(sgUser);

    const resAll = await getApprovals(new NextRequest("http://localhost:3100/api/v1/approvals?tab=outbox&pageSize=50"));
    const bodyAll = await resAll.json();
    expect(resAll.status).toBe(200);

    const items = bodyAll.data as any[];
    // Cross-operation FM item MUST be excluded for SG-only user
    expect(items.find((i) => i.id === createdWfInstanceIds[3])).toBeUndefined();

    // Historical item (actedBy = email) MUST be present & classified HISTORICAL (audit preserved!)
    const histItem = items.find((i) => i.id === createdWfInstanceIds[0]);
    expect(histItem).toBeDefined();
    expect(histItem.sourceState).toBe("HISTORICAL");
    expect(histItem.hasValidSourceLink).toBe(true);

    // Archived/Cancelled item MUST be present & classified ARCHIVED
    const archItem = items.find((i) => i.id === createdWfInstanceIds[1]);
    expect(archItem).toBeDefined();
    expect(archItem.sourceState).toBe("ARCHIVED");

    // Missing/Orphaned item (actedBy = name) MUST be classified MISSING_SOURCE with deepLink = null
    const orphanItem = items.find((i) => i.id === createdWfInstanceIds[2]);
    expect(orphanItem).toBeDefined();
    expect(orphanItem.sourceState).toBe("MISSING_SOURCE");
    expect(orphanItem.hasValidSourceLink).toBe(false);
    expect(orphanItem.deepLink).toBeNull();

    // Active view excludes historical/archived/orphaned items without deleting them
    const resActive = await getApprovals(
      new NextRequest("http://localhost:3100/api/v1/approvals?tab=outbox&view=active&pageSize=50")
    );
    const bodyActive = await resActive.json();
    expect(bodyActive.data.find((i: any) => i.id === createdWfInstanceIds[0])).toBeUndefined();
    expect(bodyActive.data.find((i: any) => i.id === createdWfInstanceIds[2])).toBeUndefined();

    // Counts endpoint matches SG-only Outbox count (3 SG items, excluding FM item)
    const cntRes = await getApprovalCounts(new NextRequest("http://localhost:3100/api/v1/approvals/counts"));
    const cntBody = await cntRes.json();
    expect(cntRes.status).toBe(200);
    expect(cntBody.data.actionedCount).toBe(3);
  });

  test("P1b: Same-name employees remain strictly isolated — User A never sees User B's approval history or counts", async () => {
    setSession(sameNameUserA);

    const outboxA = await getApprovals(new NextRequest("http://localhost:3100/api/v1/approvals?tab=outbox&pageSize=50"));
    const bodyA = await outboxA.json();
    expect(outboxA.status).toBe(200);

    const idsA = (bodyA.data as any[]).map((i) => i.id);
    // User A sees ONLY User A's immutable-ID action (wiSameA = index 4)
    expect(idsA).toContain(createdWfInstanceIds[4]);
    // User A MUST NOT see User B's shared-name action (index 5) or User B's ID action (index 6)
    expect(idsA).not.toContain(createdWfInstanceIds[5]);
    expect(idsA).not.toContain(createdWfInstanceIds[6]);

    const cntA = await getApprovalCounts(new NextRequest("http://localhost:3100/api/v1/approvals/counts"));
    const cntBodyA = await cntA.json();
    expect(cntA.status).toBe(200);
    expect(cntBodyA.data.actionedCount).toBe(1);
  });

  test("P2: Direct Intake opportunity shows 'Client not linked', blocks external Proposal issuance, and supports audited client linking across Costing & Proposal", async () => {
    setSession(sgUser);

    // 1. Create Direct Intake draft opportunity without client
    const createRes = await postOpportunity(
      new Request("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `OPP9 Direct Intake ${RUN_ID}`,
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    const createBody = await createRes.json();
    expect(createRes.status).toBe(201);
    directCaseId = createBody.case.id;
    expect(createBody.case.clientDisplayName).toBe(UNLINKED_CLIENT_LABEL);
    expect(createBody.case.resolvedClient.isLinked).toBe(false);

    // Seed survey, costing, and approved proposal on this Direct Intake opportunity
    const surv = await prisma.preContractSurvey.create({
      data: {
        caseId: directCaseId,
        lifecycle: "COMPLETED",
        responses: { create: [{ elementCode: "HEADCOUNT", numericValue: 14 }, { elementCode: "RELIEVER_REQUIRED", booleanValue: true }] },
      },
    });
    directSurveyId = surv.id;

    const est = await prisma.preContractCostEstimate.create({
      data: {
        caseId: directCaseId,
        surveyId: directSurveyId,
        companyId: COMP_SG,
        operationType: "SECURITY_GUARDING",
        currentVersionNumber: 1,
        status: "APPROVED",
        createdBy: sgUser.id,
        versions: {
          create: {
            versionNumber: 1,
            status: "APPROVED",
            totalDirectCost: new Decimal(65450),
            totalIndirectCost: new Decimal(0),
            totalCost: new Decimal(65450),
            sellingPrice: new Decimal(77000),
            pricingBasis: "MARGIN",
            targetMarginPercentage: new Decimal(15),
            createdBy: sgUser.id,
          },
        },
      },
      include: { versions: true },
    });
    directCostingId = est.id;

    const prop = await prisma.preContractProposal.create({
      data: {
        caseId: directCaseId,
        companyId: COMP_SG,
        operationType: "SECURITY_GUARDING",
        proposalCode: `PROP-${RUN_ID.slice(-6)}`,
        status: "APPROVED_INTERNAL",
        currentVersionNumber: 1,
        createdBy: sgUser.id,
        versions: {
          create: {
            versionNumber: 1,
            title: "Direct Intake Proposal",
            status: "APPROVED_INTERNAL",
            costEstimateId: directCostingId,
            costEstimateVersionId: est.versions[0].id,
            sellingPrice: new Decimal(77000),
            currency: "QAR",
            createdBy: sgUser.id,
          },
        },
      },
    });
    directProposalId = prop.id;

    // 2. Costing detail shows 'Client not linked' (not N/A)
    const costRes1 = await getCostingDetail(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${directCostingId}`),
      { params: { id: directCostingId } }
    );
    const costBody1 = await costRes1.json();
    expect(costRes1.status).toBe(200);
    expect(costBody1.estimate.case.clientDisplayName).toBe(UNLINKED_CLIENT_LABEL);

    // 3. External proposal issuance is BLOCKED (400) while client is unlinked OR has an invalid/random client ID
    const issueRes = await postProposalIssue(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${directProposalId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: "client@example.com" }),
      }),
      { params: { id: directProposalId } }
    );
    const issueBody = await issueRes.json();
    expect(issueRes.status).toBe(400);
    expect(issueBody.error).toMatch(/Client Verification Guard/i);

    // Random non-existent existingClientId must STILL fail Client Verification Guard (400)
    await prisma.preContractCase.update({
      where: { id: directCaseId },
      data: { existingClientId: "RANDOM-NONEXISTENT-CLIENT-ID" },
    });
    const fakeIdIssueRes = await postProposalIssue(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${directProposalId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: "client@example.com" }),
      }),
      { params: { id: directProposalId } }
    );
    expect(fakeIdIssueRes.status).toBe(400);
    await prisma.preContractCase.update({
      where: { id: directCaseId },
      data: { existingClientId: null },
    });

    // 4. Negative checks: linking BOTH prospect & existing fails (400); cross-company prospect fails (403); FM existing client fails (403)
    const bothRes = await patchOpportunity(
      new Request("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: directCaseId, prospectClientId: sgProspectId, existingClientId: sgExistingClientId }),
      })
    );
    expect(bothRes.status).toBe(400);

    const xCompProspectRes = await patchOpportunity(
      new Request("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: directCaseId, prospectClientId: otherCompProspectId }),
      })
    );
    expect(xCompProspectRes.status).toBe(403);

    const fmClientRes = await patchOpportunity(
      new Request("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: directCaseId, existingClientId: fmExistingClientId }),
      })
    );
    expect(fmClientRes.status).toBe(403);

    // 5. Link Existing SG Client Master via PATCH -> audit logged, preserved links, reflected in Opportunity, Costing & Proposal
    const linkRes = await patchOpportunity(
      new Request("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: directCaseId, existingClientId: sgExistingClientId }),
      })
    );
    const linkBody = await linkRes.json();
    expect(linkRes.status).toBe(200);
    expect(linkBody.case.clientDisplayName).toBe(`Existing SG Client ${RUN_ID}`);
    expect(linkBody.case.resolvedClient.type).toBe("EXISTING");

    // Audit log recorded
    const auditLogs = await prisma.userActivityLog.findMany({
      where: { entityId: directCaseId, action: "OPPORTUNITY_CLIENT_LINKED" },
    });
    expect(auditLogs.length).toBe(1);

    // Costing list & detail reflect the linked existing client
    const costRes2 = await getCostingDetail(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${directCostingId}`),
      { params: { id: directCostingId } }
    );
    const costBody2 = await costRes2.json();
    expect(costBody2.estimate.case.clientDisplayName).toBe(`Existing SG Client ${RUN_ID}`);

    const costListRes = await getCostingList(new Request(`http://localhost:3100/api/v1/commercial/costing?caseId=${directCaseId}`));
    const costListBody = await costListRes.json();
    expect(costListBody.estimates[0].case.clientDisplayName).toBe(`Existing SG Client ${RUN_ID}`);

    // Opportunities list & Proposals list reflect the linked existing client
    const oppRes = await getOpportunities(new Request("http://localhost:3100/api/v1/commercial/opportunities"));
    const oppBody = await oppRes.json();
    const matchedOpp = oppBody.cases.find((c: any) => c.id === directCaseId);
    expect(matchedOpp.clientDisplayName).toBe(`Existing SG Client ${RUN_ID}`);

    const propListRes = await getProposals(new NextRequest("http://localhost:3100/api/v1/commercial/proposals"));
    const propListBody = await propListRes.json();
    const matchedProp = propListBody.proposals.find((p: any) => p.id === directProposalId);
    expect(matchedProp.client?.name).toBe(`Existing SG Client ${RUN_ID}`);

    // 6. Switch to Verified Prospect via PATCH (clearing existingClientId) -> reflected in Opportunity, Costing & Proposal
    const linkProspectRes = await patchOpportunity(
      new Request("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: directCaseId, prospectClientId: sgProspectId, existingClientId: null }),
      })
    );
    const linkProspectBody = await linkProspectRes.json();
    expect(linkProspectRes.status).toBe(200);
    expect(linkProspectBody.case.clientDisplayName).toBe(`Verified SG Prospect ${RUN_ID}`);
    expect(linkProspectBody.case.resolvedClient.type).toBe("PROSPECT");

    const propListRes2 = await getProposals(new NextRequest("http://localhost:3100/api/v1/commercial/proposals"));
    const propListBody2 = await propListRes2.json();
    const matchedProp2 = propListBody2.proposals.find((p: any) => p.id === directProposalId);
    expect(matchedProp2.client?.name).toBe(`Verified SG Prospect ${RUN_ID}`);

    // Historical OPP6 approval record remains completely untouched
    const histWfCheck = await prisma.workflowInstance.findUnique({
      where: { id: createdWfInstanceIds[0] },
      include: { history: true },
    });
    expect(histWfCheck?.status).toBe("APPROVED");
    expect(histWfCheck?.history.length).toBe(1);
  });
});
