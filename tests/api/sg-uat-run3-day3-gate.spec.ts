import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as createCostingRoute } from "../../apps/web/app/api/v1/commercial/costing/route";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as createProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { POST as proposalWorkflowRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/workflow/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import * as precontractCosting from "../../apps/web/lib/precontract-costing";
import * as precontractProposal from "../../apps/web/lib/precontract-proposal";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("SG UAT Run 3 Day 3 Final Release Gate (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyId: string;
  let oppId: string;
  let surveyId: string;
  let estimateId: string;
  let proposalId: string;
  let costingTplId: string;
  let proposalTplId: string;
  let prevCostingDefaults: string[] = [];
  let prevProposalDefaults: string[] = [];

  const makerId = `emp-g3-mk-${rand}`;
  const checkerId = `emp-g3-ck-${rand}`;

  const makerSession = () => ({
    id: makerId,
    employeeId: makerId,
    name: "Gate3 Maker",
    email: `g3-maker-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
      "precontract.workflow.approve", // Even with approve perm, SoD must block creator
      "precontract.costing.manage",
      "precontract.proposal.manage",
    ],
  });

  const checkerSession = () => ({
    id: checkerId,
    employeeId: checkerId,
    name: "Gate3 Checker",
    email: `g3-checker-${rand}@test.local`,
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
      data: { companyCode: `G3D3-${rand}`, companyName: `Gate3 Co ${rand}`, isActive: true },
    });
    companyId = comp.id;

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

    costingTplId = (
      await prisma.workflowTemplate.create({
        data: {
          workflowName: `Gate3 Costing ${rand}`,
          moduleType: "PRE_CONTRACT_COSTING",
          appliesTo: "ACTIVATION",
          operationType: "SECURITY_GUARDING",
          isDefault: true,
          isActive: true,
          levels: {
            create: [
              {
                levelNumber: 1,
                levelName: "Checker",
                approvalRule: "ANY_ONE",
                isMandatory: true,
                approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "Gate3 Checker" }] },
              },
            ],
          },
        },
      })
    ).id;

    proposalTplId = (
      await prisma.workflowTemplate.create({
        data: {
          workflowName: `Gate3 Proposal ${rand}`,
          moduleType: "PRE_CONTRACT_PROPOSAL",
          appliesTo: "ACTIVATION",
          operationType: "SECURITY_GUARDING",
          isDefault: true,
          isActive: true,
          levels: {
            create: [
              {
                levelNumber: 1,
                levelName: "Checker",
                approvalRule: "ANY_ONE",
                isMandatory: true,
                approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "Gate3 Checker" }] },
              },
            ],
          },
        },
      })
    ).id;

    oppId = (
      await prisma.preContractCase.create({
        data: {
          title: `Gate3 Opp ${rand}`,
          companyId,
          operationType: "SECURITY_GUARDING",
          lifecycle: "COMPLETED",
          businessOutcome: "IN_PROGRESS",
          createdBy: makerId,
        },
      })
    ).id;

    surveyId = (
      await prisma.preContractSurvey.create({
        data: {
          caseId: oppId,
          companyId,
          operationType: "SECURITY_GUARDING",
          lifecycle: "COMPLETED",
          conductedBy: makerId,
          responses: {
            create: [
              { elementCode: "HEADCOUNT", numericValue: 4 },
              { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
              { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
            ],
          },
        },
      })
    ).id;

    await (prisma as any).costRateCardMaster.create({
      data: {
        code: `RC-GATE3-${rand}`,
        name: `Gate3 Synthetic Rate Card ${rand}`,
        currency: "QAR",
        companyId,
        createdBy: makerId,
        versions: {
          create: {
            versionNumber: 1,
            status: "ACTIVE",
            effectiveFrom: new Date(Date.now() - 86400000),
            ratesJson: { BASIC_PAY: 2400, ALLOWANCES: 900, RELIEVER_COST: 2800 },
            createdBy: makerId,
            approvedBy: checkerId,
          },
        },
      },
    });
  });

  afterAll(async () => {
    try {
      if (proposalId) {
        await prisma.preContractProposalVersion.deleteMany({ where: { proposalId } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: proposalId } });
        await prisma.preContractProposal.deleteMany({ where: { id: proposalId } });
      }
      if (estimateId) {
        await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: estimateId } });
        await prisma.preContractCostEstimate.deleteMany({ where: { id: estimateId } });
      }
      await (prisma as any).costRateCardMaster.deleteMany({ where: { code: `RC-GATE3-${rand}` } });
      await prisma.surveyResponse.deleteMany({ where: { surveyId } });
      await prisma.preContractSurvey.deleteMany({ where: { id: surveyId } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: [costingTplId, proposalTplId] } } });
      if (prevCostingDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevCostingDefaults } }, data: { isDefault: true } });
      }
      if (prevProposalDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevProposalDefaults } }, data: { isDefault: true } });
      }
      await prisma.company.deleteMany({ where: { id: companyId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("A1. Costing Approval Center injected snapshot failure triggers complete rollback (no partial approval or snapshot)", async () => {
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

    const spy = jest.spyOn(precontractCosting, "generateCostingSnapshot").mockImplementationOnce(() => {
      throw new Error("Injected Costing Snapshot Failure");
    });

    try {
      (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
      const failRes = await executeApprovalActionRoute(
        new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", remarks: "Should roll back" }),
        }),
        { params: { id: wfId } }
      );
      expect(failRes.status).toBeGreaterThanOrEqual(400);

      const wfAfterFail = await prisma.workflowInstance.findUnique({
        where: { id: wfId },
        include: { history: true },
      });
      const estAfterFail = await prisma.preContractCostEstimate.findUnique({
        where: { id: estimateId },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      expect(wfAfterFail?.status).toBe("IN_PROGRESS");
      expect(wfAfterFail?.history.filter((h) => h.action === "APPROVE").length).toBe(0);
      expect(estAfterFail?.status).toBe("IN_WORKFLOW");
      expect(estAfterFail?.versions[0].checksum).toBeNull();
    } finally {
      spy.mockRestore();
    }

    // Subsequent valid approval succeeds cleanly
    (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
    const okRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Valid Costing Approval" }),
      }),
      { params: { id: wfId } }
    );
    expect(okRes.status).toBe(200);
  });

  it("A2 & B. Proposal snapshot failure rolls back; Proposal creator blocked (403) on APPROVE/RETURN/REJECT in both APIs; Checker completes", async () => {
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
          title: `Gate3 Proposal ${rand}`,
        }),
      })
    );
    expect(propRes.status).toBe(201);
    proposalId = (await propRes.json()).proposal.id;

    const subRes = await proposalWorkflowRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: proposalId } }
    );
    expect(subRes.status).toBe(200);
    const wfId = (await subRes.json()).workflow.instanceId;

    // B: Proposal creator cannot APPROVE, RETURN, or REJECT via Module API OR Approval Center API
    for (const act of ["APPROVE", "RETURN", "REJECT"]) {
      const modRes = await proposalWorkflowRoute(
        new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: act, remarks: "Creator self-action attempt" }),
        }),
        { params: { id: proposalId } }
      );
      expect(modRes.status).toBe(403);

      const acRes = await executeApprovalActionRoute(
        new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: act, remarks: "Creator self-action attempt" }),
        }),
        { params: { id: wfId } }
      );
      expect(acRes.status).toBe(403);
    }

    const wfAfterSoD = await prisma.workflowInstance.findUnique({
      where: { id: wfId },
      include: { history: true },
    });
    expect(wfAfterSoD?.status).toBe("IN_PROGRESS");
    expect(wfAfterSoD?.history.length).toBe(1); // Only initial SUBMIT

    // A2: Injected Proposal snapshot failure rolls back cleanly
    const propSpy = jest.spyOn(precontractProposal, "generateProposalSnapshot").mockImplementationOnce(() => {
      throw new Error("Injected Proposal Snapshot Failure");
    });
    try {
      (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
      const failRes = await executeApprovalActionRoute(
        new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", remarks: "Should roll back" }),
        }),
        { params: { id: wfId } }
      );
      expect(failRes.status).toBeGreaterThanOrEqual(400);

      const wfRolledBack = await prisma.workflowInstance.findUnique({ where: { id: wfId }, include: { history: true } });
      const propRolledBack = await prisma.preContractProposal.findUnique({
        where: { id: proposalId },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      expect(wfRolledBack?.status).toBe("IN_PROGRESS");
      expect(wfRolledBack?.history.length).toBe(1);
      expect(propRolledBack?.status).toBe("IN_WORKFLOW");
      expect(propRolledBack?.versions[0].snapshotChecksum).toBeNull();
    } finally {
      propSpy.mockRestore();
    }

    // Authorized non-creator approver completes workflow cleanly
    (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
    const passRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Gate3 Approved" }),
      }),
      { params: { id: wfId } }
    );
    expect(passRes.status).toBe(200);
    const propFinal = await prisma.preContractProposal.findUnique({
      where: { id: proposalId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    expect(propFinal?.status).toBe("APPROVED_INTERNAL");
    expect(propFinal?.versions[0].snapshotChecksum).toBeTruthy();
  });
});
