import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as proposalWorkflowRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/workflow/route";
import { POST as issueProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/issue/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #8 (DEF-100): Costing & Proposal Approval Status Synchronization (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyId: string;
  let makerId: string;
  let checker1Id: string;
  let checker2Id: string;
  let clientId: string;
  let oppId: string;
  let surveyId: string;
  let costingTplId: string;
  let proposalTplId: string;
  let estimateId: string;
  let estimate2Id: string;
  let proposal1Id: string;
  let proposal2Id: string;

  const makerSession = () => ({
    user: {
      id: makerId,
      email: `iss8-mk-${rand}@ahh.local`,
      name: "Issue8 Maker",
      role: "COMMERCIAL_CREATOR",
      companyId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const checker1Session = () => ({
    user: {
      id: checker1Id,
      email: `iss8-c1-${rand}@ahh.local`,
      name: "Issue8 Checker 1",
      role: "COMMERCIAL_APPROVER",
      companyId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const checker2Session = () => ({
    user: {
      id: checker2Id,
      email: `iss8-c2-${rand}@ahh.local`,
      name: "Issue8 Checker 2",
      role: "COMMERCIAL_APPROVER",
      companyId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const createDraftEstimate = async () => {
    return prisma.preContractCostEstimate.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        surveyId,
        status: "DRAFT",
        createdBy: makerId,
        versions: {
          create: [
            {
              versionNumber: 1,
              status: "DRAFT",
              costConfigVersionId: `CFG-${rand}`,
              pricingBasis: "MARKUP",
              totalDirectCost: 20000,
              totalIndirectCost: 0,
              totalCost: 20000,
              targetMarkupPercentage: 20,
              sellingPrice: 24000,
              createdBy: makerId,
              items: {
                create: [
                  {
                    elementCode: "BASIC_PAY",
                    elementName: "Basic Pay",
                    categoryCode: "MANPOWER",
                    isDirect: true,
                    quantity: 10,
                    unitRate: 2000,
                    totalAmount: 20000,
                    calculationBasis: "CONFIGURED",
                  },
                ],
              },
            },
          ],
        },
      },
      include: { versions: true },
    });
  };

  const createDraftProposal = async (costEstId: string, costEstVerId: string, suffix: string) => {
    return prisma.preContractProposal.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        proposalCode: `PROP-I8-${suffix}-${rand}`,
        status: "DRAFT",
        createdBy: makerId,
        versions: {
          create: [
            {
              versionNumber: 1,
              title: `Issue8 Proposal ${suffix}`,
              status: "DRAFT",
              costEstimateId: costEstId,
              costEstimateVersionId: costEstVerId,
              currency: "QAR",
              sellingPrice: 24000,
              createdBy: makerId,
            },
          ],
        },
      },
      include: { versions: true },
    });
  };

  beforeAll(async () => {
    const comp = await prisma.company.create({
      data: { companyName: `Issue8 Co ${rand}`, companyCode: `I8-${rand}`, isActive: true },
    });
    companyId = comp.id;

    const [m, c1, c2] = await Promise.all([
      prisma.employee.create({
        data: { id: `emp-iss8-mk-${rand}`, name: "Issue8 Maker", department: "Commercial", companyId, role: "COMMERCIAL_CREATOR", status: "Active", email: `iss8-mk-${rand}@ahh.local` },
      }),
      prisma.employee.create({
        data: { id: `emp-iss8-c1-${rand}`, name: "Issue8 Checker 1", department: "Finance", companyId, role: "COMMERCIAL_APPROVER", status: "Active", email: `iss8-c1-${rand}@ahh.local` },
      }),
      prisma.employee.create({
        data: { id: `emp-iss8-c2-${rand}`, name: "Issue8 Checker 2", department: "Director", companyId, role: "COMMERCIAL_APPROVER", status: "Active", email: `iss8-c2-${rand}@ahh.local` },
      }),
    ]);
    makerId = m.id;
    checker1Id = c1.id;
    checker2Id = c2.id;

    const client = await prisma.preContractProspectClient.create({
      data: { companyId, operationType: "SECURITY_GUARDING", name: `Issue8 Client ${rand}` },
    });
    clientId = client.id;

    const opp = await prisma.preContractCase.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        title: `Issue8 Opp ${rand}`,
        prospectClientId: clientId,
        lifecycle: "COMPLETED",
        businessOutcome: "IN_PROGRESS",
        createdBy: makerId,
      },
    });
    oppId = opp.id;

    const survey = await prisma.preContractSurvey.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        lifecycle: "COMPLETED",
        conductedBy: makerId,
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 10 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        },
      },
    });
    surveyId = survey.id;

    await prisma.workflowTemplate.updateMany({
      where: { moduleType: { in: ["PRE_CONTRACT_COSTING", "COMMERCIAL_COSTING", "COSTING", "PRE_CONTRACT_PROPOSAL", "COMMERCIAL_PROPOSAL"] }, isDefault: true },
      data: { isDefault: false },
    });

    const cTpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Issue8 Costing 2L ${rand}`,
        moduleType: "COSTING",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isActive: true,
        isDefault: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Finance L1",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checker1Id, employeeName: "Issue8 Checker 1" }] },
            },
            {
              levelNumber: 2,
              levelName: "Director L2",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checker2Id, employeeName: "Issue8 Checker 2" }] },
            },
          ],
        },
      },
    });
    costingTplId = cTpl.id;

    const pTpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Issue8 Proposal 1L ${rand}`,
        moduleType: "COMMERCIAL_PROPOSAL",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isActive: true,
        isDefault: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Commercial Approver",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checker1Id, employeeName: "Issue8 Checker 1" }] },
            },
          ],
        },
      },
    });
    proposalTplId = pTpl.id;

    const e1 = await createDraftEstimate();
    estimateId = e1.id;
    const e2 = await createDraftEstimate();
    estimate2Id = e2.id;

    const p1 = await createDraftProposal(e1.id, e1.versions[0].id, "A");
    proposal1Id = p1.id;
    const p2 = await createDraftProposal(e1.id, e1.versions[0].id, "B");
    proposal2Id = p2.id;
  });

  afterAll(async () => {
    try {
      const refIds = [estimateId, estimate2Id, proposal1Id, proposal2Id].filter(Boolean);
      const wfInstances = await prisma.workflowInstance.findMany({
        where: { referenceId: { in: refIds } },
        select: { id: true },
      });
      const wfIds = wfInstances.map((w) => w.id);
      if (wfIds.length > 0) {
        await prisma.workflowActionHistory.deleteMany({ where: { instanceId: { in: wfIds } } });
        await prisma.workflowInstance.deleteMany({ where: { id: { in: wfIds } } });
      }
      await prisma.proposalIssuanceLog.deleteMany({ where: { proposalVersion: { proposalId: { in: [proposal1Id, proposal2Id] } } } });
      await prisma.preContractProposalVersion.deleteMany({ where: { proposalId: { in: [proposal1Id, proposal2Id] } } });
      await prisma.preContractProposal.deleteMany({ where: { id: { in: [proposal1Id, proposal2Id] } } });
      await prisma.preContractCostEstimateItem.deleteMany({ where: { estimateVersion: { estimateId: { in: [estimateId, estimate2Id] } } } });
      await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId: { in: [estimateId, estimate2Id] } } });
      await prisma.preContractCostEstimate.deleteMany({ where: { id: { in: [estimateId, estimate2Id] } } });
      await prisma.surveyResponse.deleteMany({ where: { surveyId } });
      await prisma.preContractSurvey.deleteMany({ where: { id: surveyId } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.preContractProspectClient.deleteMany({ where: { id: clientId } });
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: { in: [costingTplId, proposalTplId] } } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: { in: [costingTplId, proposalTplId] } } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: [costingTplId, proposalTplId] } } });
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checker1Id, checker2Id] } } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    await prisma.$disconnect();
  });

  it("1. Multi-level Costing SUBMIT -> L1 (stays IN_WORKFLOW) -> L2 final APPROVE (Estimate, Version & Snapshot synchronized), self-approval blocked (403), repeated approval blocked (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
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

    // Self-approval blocked (403)
    const selfRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Self" }),
      }),
      { params: { id: wfId } }
    );
    expect(selfRes.status).toBe(403);

    // L1 approval -> must NOT prematurely finalize
    (getServerSession as jest.Mock).mockResolvedValue(checker1Session());
    const l1Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "L1 OK" }),
      }),
      { params: { id: wfId } }
    );
    expect(l1Res.status).toBe(200);

    const afterL1 = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(afterL1?.status).toBe("IN_WORKFLOW");
    expect(afterL1?.versions[0].status).toBe("SUBMITTED");
    expect(afterL1?.versions[0].checksum).toBeNull();

    // L2 final approval -> Estimate, Version, Snapshot all synchronized
    (getServerSession as jest.Mock).mockResolvedValue(checker2Session());
    const l2Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "L2 Final" }),
      }),
      { params: { id: wfId } }
    );
    expect(l2Res.status).toBe(200);

    const afterL2 = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimateId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(afterL2?.status).toBe("APPROVED");
    expect(afterL2?.versions[0].status).toBe("APPROVED");
    expect(afterL2?.versions[0].checksum).toBeTruthy();
    expect(afterL2?.versions[0].snapshotJson).toBeTruthy();

    // Repeated final approval blocked (409) in both Approval Center and Direct Route
    const dupAcRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Dup" }),
      }),
      { params: { id: wfId } }
    );
    expect(dupAcRes.status).toBe(409);

    const dupDirectRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Dup Direct" }),
      }),
      { params: { id: estimateId } }
    );
    expect(dupDirectRes.status).toBe(409);
  });

  it("2. Direct Costing RETURN resets Estimate & Version to DRAFT, and REJECT sets both to REJECTED", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const subRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: estimate2Id } }
    );
    expect(subRes.status).toBe(200);

    (getServerSession as jest.Mock).mockResolvedValue(checker1Session());
    const retRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", remarks: "Adjust margin" }),
      }),
      { params: { id: estimate2Id } }
    );
    expect(retRes.status).toBe(200);

    const afterRet = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimate2Id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(afterRet?.status).toBe("DRAFT");
    expect(afterRet?.versions[0].status).toBe("DRAFT");

    // Resubmit and REJECT
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: estimate2Id } }
    );

    (getServerSession as jest.Mock).mockResolvedValue(checker1Session());
    const rejRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", remarks: "Rejected" }),
      }),
      { params: { id: estimate2Id } }
    );
    expect(rejRes.status).toBe(200);

    const afterRej = await prisma.preContractCostEstimate.findUnique({
      where: { id: estimate2Id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(afterRej?.status).toBe("REJECTED");
    expect(afterRej?.versions[0].status).toBe("REJECTED");
  });

  it("3. Proposal Approval Center & Direct Route both synchronize APPROVED_INTERNAL + Snapshot and unlock ISSUED_TO_CLIENT", async () => {
    // Path A: Approval Center
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const subA = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposal1Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: proposal1Id } }
    );
    expect(subA.status).toBe(200);
    const wfAId = (await subA.json()).workflow.instanceId;

    // Unapproved IN_WORKFLOW proposal cannot be issued (400)
    const blockedIssue = await issueProposalRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposal1Id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Client A" }),
      }),
      { params: { id: proposal1Id } }
    );
    expect(blockedIssue.status).toBe(400);

    // Approve via Approval Center
    (getServerSession as jest.Mock).mockResolvedValue(checker1Session());
    const appA = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfAId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "AC Approved" }),
      }),
      { params: { id: wfAId } }
    );
    expect(appA.status).toBe(200);

    const propA = await prisma.preContractProposal.findUnique({
      where: { id: proposal1Id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(propA?.status).toBe("APPROVED_INTERNAL");
    expect(propA?.versions[0].status).toBe("APPROVED_INTERNAL");
    expect(propA?.versions[0].snapshotChecksum).toBeTruthy();

    // Now eligible for ISSUED_TO_CLIENT (200)
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const issueA = await issueProposalRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposal1Id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Client A" }),
      }),
      { params: { id: proposal1Id } }
    );
    expect(issueA.status).toBe(200);

    // Path B: Direct Proposal Workflow Route
    const subB = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposal2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: proposal2Id } }
    );
    expect(subB.status).toBe(200);

    (getServerSession as jest.Mock).mockResolvedValue(checker1Session());
    const appB = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposal2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Direct Approved" }),
      }),
      { params: { id: proposal2Id } }
    );
    expect(appB.status).toBe(200);

    const propB = await prisma.preContractProposal.findUnique({
      where: { id: proposal2Id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(propB?.status).toBe("APPROVED_INTERNAL");
    expect(propB?.versions[0].status).toBe("APPROVED_INTERNAL");
    expect(propB?.versions[0].snapshotChecksum).toBeTruthy();
  });

  it("4. Costing and Proposal UIs read synchronized Estimate & Version statuses", () => {
    const costingUi = fs.readFileSync(path.resolve(__dirname, "../../apps/web/app/commercial/costing/page.tsx"), "utf8");
    const proposalUi = fs.readFileSync(path.resolve(__dirname, "../../apps/web/app/commercial/proposals/[id]/page.tsx"), "utf8");
    expect(costingUi).toContain("selectedEstimate.status");
    expect(proposalUi).toContain('ver.status === "APPROVED_INTERNAL"');
    expect(proposalUi).toContain('ver.status === "ISSUED_TO_CLIENT"');
  });
});
