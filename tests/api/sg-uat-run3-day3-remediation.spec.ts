import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as createSiteSurveyRoute } from "../../apps/web/app/api/v1/commercial/surveys/route";
import { POST as createCostingRoute } from "../../apps/web/app/api/v1/commercial/costing/route";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as createProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { POST as proposalWorkflowRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/workflow/route";
import { POST as issueProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/issue/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import { GET as getApprovalCountsRoute } from "../../apps/web/app/api/v1/approvals/counts/route";
import { GET as getApprovalsInboxRoute } from "../../apps/web/app/api/v1/approvals/route";
import { WorkflowAdapterRegistry } from "../../apps/web/lib/workflow/adapters/registry";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("SG UAT Run 3 Day 3 Remediation Suite (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyId: string;
  let oppId: string;
  let surveyId: string;
  let prospectiveSiteId: string | null = null;
  let estimateId: string;
  let proposalId: string;
  let costingTplId: string;
  let proposalTplId: string;
  let prevCostingDefaults: string[] = [];
  let prevProposalDefaults: string[] = [];

  const makerId = `emp-r3d3-mk-${rand}`;
  const checker1Id = `emp-r3d3-c1-${rand}`;
  const checker2Id = `emp-r3d3-c2-${rand}`;

  const makerSession = () => ({
    id: makerId,
    employeeId: makerId,
    name: "Run3 Day3 Maker",
    email: `maker-d3-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
      "precontract.costing.manage",
      "precontract.proposal.manage",
      "precontract.proposal.issue",
      "commercial.surveys.manage",
    ],
  });

  const checker1Session = () => ({
    id: checker1Id,
    employeeId: checker1Id,
    name: "Run3 Day3 Checker 1",
    email: `checker1-d3-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "precontract.workflow.approve",
      "precontract.workflow.review",
    ],
  });

  const checker2Session = () => ({
    id: checker2Id,
    employeeId: checker2Id,
    name: "Run3 Day3 Checker 2",
    email: `checker2-d3-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "precontract.workflow.approve",
      "precontract.workflow.review",
    ],
  });

  beforeAll(async () => {
    const comp = await prisma.company.create({
      data: { companyCode: `R3D3-${rand}`, companyName: `Run3 Day3 Co ${rand}`, isActive: true },
    });
    companyId = comp.id;

    await prisma.employee.createMany({
      data: [
        { id: makerId, name: "Run3 Day3 Maker", department: "Commercial", companyId, role: "EMPLOYEE", status: "On Duty", email: `maker-d3-${rand}@test.local` },
        { id: checker1Id, name: "Run3 Day3 Checker 1", department: "Commercial", companyId, role: "SUPERVISOR", status: "On Duty", email: `checker1-d3-${rand}@test.local` },
        { id: checker2Id, name: "Run3 Day3 Checker 2", department: "Executive", companyId, role: "SUPERVISOR", status: "On Duty", email: `checker2-d3-${rand}@test.local` },
      ],
    });

    const prevC = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, moduleType: "PRE_CONTRACT_COSTING" },
      select: { id: true },
    });
    prevCostingDefaults = prevC.map((t) => t.id);
    if (prevCostingDefaults.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevCostingDefaults } }, data: { isDefault: false } });
    }

    const prevP = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, moduleType: "PRE_CONTRACT_PROPOSAL" },
      select: { id: true },
    });
    prevProposalDefaults = prevP.map((t) => t.id);
    if (prevProposalDefaults.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevProposalDefaults } }, data: { isDefault: false } });
    }

    const cTpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Run3 Day3 Costing 2-Level ${rand}`,
        moduleType: "PRE_CONTRACT_COSTING",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Costing Reviewer L1",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checker1Id, employeeName: "Run3 Day3 Checker 1" }] },
            },
            {
              levelNumber: 2,
              levelName: "Costing Approver L2",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checker2Id, employeeName: "Run3 Day3 Checker 2" }] },
            },
          ],
        },
      },
    });
    costingTplId = cTpl.id;

    const pTpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Run3 Day3 Proposal Approval ${rand}`,
        moduleType: "PRE_CONTRACT_PROPOSAL",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Proposal Approver L1",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checker1Id, employeeName: "Run3 Day3 Checker 1" }] },
            },
          ],
        },
      },
    });
    proposalTplId = pTpl.id;

    const opp = await prisma.preContractCase.create({
      data: {
        title: `Run3 Day3 Opp ${rand}`,
        companyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "IN_PROGRESS",
        createdBy: makerId,
      },
    });
    oppId = opp.id;

    const site = await prisma.preContractProspectiveSite.create({
      data: {
        name: `Run3 Day3 Site ${rand}`,
        address: "Lusail Marina Plot 10",
        companyId,
        operationType: "SECURITY_GUARDING",
      },
    });
    prospectiveSiteId = site.id;

    const srv = await prisma.preContractSurvey.create({
      data: {
        caseId: oppId,
        prospectiveSiteId,
        companyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        conductedBy: makerId,
      },
    });
    surveyId = srv.id;
  });

  afterAll(async () => {
    try {
      if (proposalId) {
        await prisma.proposalIssuanceLog.deleteMany({ where: { proposalVersion: { proposalId } } });
        await prisma.preContractProposalVersion.deleteMany({ where: { proposalId } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: proposalId } });
        await prisma.preContractProposal.deleteMany({ where: { id: proposalId } });
      }
      if (estimateId) {
        await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: estimateId } });
        await prisma.preContractCostEstimate.deleteMany({ where: { id: estimateId } });
      }
      await prisma.preContractSurvey.deleteMany({ where: { id: surveyId } });
      if (prospectiveSiteId) {
        await prisma.preContractProspectiveSite.deleteMany({ where: { id: prospectiveSiteId } });
      }
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: [costingTplId, proposalTplId] } } });
      if (prevCostingDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevCostingDefaults } }, data: { isDefault: true } });
      }
      if (prevProposalDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevProposalDefaults } }, data: { isDefault: true } });
      }
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checker1Id, checker2Id] } } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. DEF-099: Blank Site Name or Site Address is rejected (400) on Survey creation", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });

    const blankNameRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, siteName: "   ", siteAddress: "Doha" }),
      })
    );
    expect(blankNameRes.status).toBe(400);

    const blankAddrRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, siteName: "Valid Site", siteAddress: "   " }),
      })
    );
    expect(blankAddrRes.status).toBe(400);
  });

  it("2. DEF-100: Costing multi-level Approval Center finalization updates both Estimate & Version + Snapshot on L2 only", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });
    const costRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId }),
      })
    );
    expect(costRes.status).toBe(201);
    estimateId = (await costRes.json()).estimate.id;

    const subRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: estimateId } }
    );
    expect(subRes.status).toBe(200);
    const wfId = (await subRes.json()).workflow.instanceId;

    // Level 1 approve -> must stay IN_WORKFLOW / SUBMITTED
    (getServerSession as jest.Mock).mockResolvedValue({ user: checker1Session() });
    const l1Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "L1 Costing OK" }),
      }),
      { params: { id: wfId } }
    );
    expect(l1Res.status).toBe(200);
    const estL1 = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(estL1?.status).toBe("IN_WORKFLOW");
    expect(estL1?.versions[0].status).toBe("SUBMITTED");

    // Level 2 final approve -> both header & version become APPROVED + snapshot generated
    (getServerSession as jest.Mock).mockResolvedValue({ user: checker2Session() });
    const l2Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "L2 Costing Final" }),
      }),
      { params: { id: wfId } }
    );
    expect(l2Res.status).toBe(200);
    const estL2 = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(estL2?.status).toBe("APPROVED");
    expect(estL2?.versions[0].status).toBe("APPROVED");
    expect(estL2?.versions[0].checksum).toBeTruthy();

    // Duplicate approval rejected 409
    const dupRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { id: wfId } }
    );
    expect(dupRes.status).toBe(409);
  });

  it("3. DEF-101, DEF-102, DEF-103, DEF-105: Proposal SoD, RETURN levelNumber, Approval Center APPROVED_INTERNAL -> Issue to Client, Deep Link, Outbox Count", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });
    const est = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    const propRes = await createProposalRoute(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          costEstimateVersionId: est!.versions[0].id,
          title: `Run3 Day3 Proposal ${rand}`,
        }),
      })
    );
    expect(propRes.status).toBe(201);
    proposalId = (await propRes.json()).proposal.id;

    // Deep link check (DEF-102)
    expect(WorkflowAdapterRegistry.get("COMMERCIAL_PROPOSAL")!.getSourceDeepLink(proposalId)).toBe(
      `/commercial/proposals/${proposalId}`
    );

    // Submit proposal
    const sub1 = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: proposalId } }
    );
    expect(sub1.status).toBe(200);
    const wfId = (await sub1.json()).workflow.instanceId;

    // Creator cannot RETURN/APPROVE via direct route or Approval Center (DEF-103)
    const selfDirectRes = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", remarks: "Unauthorized self-return" }),
      }),
      { params: { id: proposalId } }
    );
    expect(selfDirectRes.status).toBe(403);

    // Checker1 returns via Approval Center -> levelNumber recorded as 1 (not 0! DEF-105)
    (getServerSession as jest.Mock).mockResolvedValue({ user: checker1Session() });
    const retRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", remarks: "Clarify scope" }),
      }),
      { params: { id: wfId } }
    );
    expect(retRes.status).toBe(200);

    const retHistory = await prisma.workflowActionHistory.findFirst({
      where: { instanceId: wfId, action: "RETURN" },
    });
    expect(retHistory?.levelNumber).toBe(1);

    // Resubmit & Approve via Approval Center -> APPROVED_INTERNAL -> Issue to Client succeeds (200)
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });
    const sub2 = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: proposalId } }
    );
    expect(sub2.status).toBe(200);

    (getServerSession as jest.Mock).mockResolvedValue({ user: checker1Session() });
    const appRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved for Client" }),
      }),
      { params: { id: wfId } }
    );
    expect(appRes.status).toBe(200);

    const updatedProp = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(updatedProp?.status).toBe("APPROVED_INTERNAL");
    expect(updatedProp?.versions[0].status).toBe("APPROVED_INTERNAL");
    expect(updatedProp?.versions[0].snapshotChecksum).toBeTruthy();

    // Outbox count deduplicated by instanceId matches outbox list length (DEF-105)
    const countsRes = await getApprovalCountsRoute(new NextRequest("http://localhost:3100/api/v1/approvals/counts"));
    const outboxRes = await getApprovalsInboxRoute(new NextRequest("http://localhost:3100/api/v1/approvals?tab=outbox&pageSize=100"));
    expect(countsRes.status).toBe(200);
    expect(outboxRes.status).toBe(200);
    const countsData = await countsRes.json();
    const outboxData = await outboxRes.json();
    expect(countsData.data.actionedCount).toBe(outboxData.pagination.total);

    // Issue to Client succeeds (200)
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });
    const issueRes = await issueProposalRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Client Rep", deliveryMethod: "MANUAL" }),
      }),
      { params: { id: proposalId } }
    );
    expect(issueRes.status).toBe(200);
  });
});
