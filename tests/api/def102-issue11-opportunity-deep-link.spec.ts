import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { WorkflowAdapterRegistry } from "../../apps/web/lib/workflow/adapters/registry";
import { GET as getOpportunitiesRoute } from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { GET as getApprovalsInboxRoute } from "../../apps/web/app/api/v1/approvals/route";
import { GET as getApprovalsCountsRoute } from "../../apps/web/app/api/v1/approvals/counts/route";
import { GET as getApprovalDetailRoute } from "../../apps/web/app/api/v1/approvals/[id]/route";
import { POST as postApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import { GET as getSurveysRoute } from "../../apps/web/app/api/v1/commercial/surveys/route";
import { GET as getActivitiesRoute } from "../../apps/web/app/api/v1/commercial/activities/route";
import { GET as getTasksRoute } from "../../apps/web/app/api/v1/commercial/tasks/route";
import { GET as getCommercialHealthRoute } from "../../apps/web/app/api/v1/commercial/command-center/commercial-health/route";
import { GET as getEscalationsRoute } from "../../apps/web/app/api/v1/commercial/command-center/escalations/route";
import { GET as getRosterCoverageRoute } from "../../apps/web/app/api/v1/commercial/command-center/roster-coverage/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #11 (DEF-102): Opportunity Approval Deep Link (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyAId: string;
  let companyBId: string;
  let makerId: string;
  let checkerId: string;
  let compBUserId: string;
  let clientId: string;
  let oppId: string;
  let tplId: string;
  let wfId: string;

  const makerSession = () => ({
    user: {
      id: makerId,
      email: `iss11-mk-${rand}@ahh.local`,
      name: "Issue11 Maker",
      role: "COMMERCIAL_CREATOR",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const checkerSession = () => ({
    user: {
      id: checkerId,
      email: `iss11-ck-${rand}@ahh.local`,
      name: "Issue11 Checker",
      role: "COMMERCIAL_APPROVER",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const compBSession = () => ({
    user: {
      id: compBUserId,
      email: `iss11-cb-${rand}@ahh.local`,
      name: "Issue11 CompB",
      role: "COMMERCIAL_CREATOR",
      companyId: companyBId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  beforeAll(async () => {
    const [compA, compB] = await Promise.all([
      prisma.company.create({ data: { companyName: `Issue11 CoA ${rand}`, companyCode: `I11A-${rand}`, isActive: true } }),
      prisma.company.create({ data: { companyName: `Issue11 CoB ${rand}`, companyCode: `I11B-${rand}`, isActive: true } }),
    ]);
    companyAId = compA.id;
    companyBId = compB.id;

    const [m, c, cb] = await Promise.all([
      prisma.employee.create({ data: { id: `emp-i11-mk-${rand}`, name: "Issue11 Maker", department: "Commercial", companyId: companyAId, role: "COMMERCIAL_CREATOR", status: "Active", email: `iss11-mk-${rand}@ahh.local` } }),
      prisma.employee.create({ data: { id: `emp-i11-ck-${rand}`, name: "Issue11 Checker", department: "Operations", companyId: companyAId, role: "COMMERCIAL_APPROVER", status: "Active", email: `iss11-ck-${rand}@ahh.local` } }),
      prisma.employee.create({ data: { id: `emp-i11-cb-${rand}`, name: "Issue11 CompB", department: "Commercial", companyId: companyBId, role: "COMMERCIAL_CREATOR", status: "Active", email: `iss11-cb-${rand}@ahh.local` } }),
    ]);
    makerId = m.id;
    checkerId = c.id;
    compBUserId = cb.id;

    const client = await prisma.preContractProspectClient.create({
      data: { companyId: companyAId, operationType: "SECURITY_GUARDING", name: `Issue11 Client ${rand}` },
    });
    clientId = client.id;

    const opp = await prisma.preContractCase.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        title: `Issue11 OPP7 ${rand}`,
        prospectClientId: clientId,
        lifecycle: "IN_WORKFLOW",
        createdBy: makerId,
      },
    });
    oppId = opp.id;

    const tpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Issue11 Opp Tpl ${rand}`,
        moduleType: "PRE_CONTRACT_CASE",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isActive: true,
        isDefault: false,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Opp Approver",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "Issue11 Checker" }] },
            },
          ],
        },
      },
    });
    tplId = tpl.id;

    const wf = await prisma.workflowInstance.create({
      data: {
        templateId: tplId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: oppId,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: companyAId,
        operationScope: "SECURITY_GUARDING",
      },
    });
    wfId = wf.id;
  });

  afterAll(async () => {
    try {
      await prisma.workflowActionHistory.deleteMany({ where: { instanceId: wfId } });
      await prisma.workflowInstance.deleteMany({ where: { id: wfId } });
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: tplId } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: tplId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: tplId } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.preContractProspectClient.deleteMany({ where: { id: clientId } });
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checkerId, compBUserId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    await prisma.$disconnect();
  });

  it("1. Workflow adapters generate exact deep links for Opportunity, Survey, Costing, and Proposal", () => {
    expect(WorkflowAdapterRegistry.get("PRE_CONTRACT_CASE")?.getSourceDeepLink("case-123")).toBe("/commercial/opportunities?id=case-123");
    expect(WorkflowAdapterRegistry.get("COMMERCIAL_OPPORTUNITY")?.getSourceDeepLink("case-123")).toBe("/commercial/opportunities?id=case-123");
    expect(WorkflowAdapterRegistry.get("SITE_SURVEY")?.getSourceDeepLink("srv-123")).toBe("/commercial/surveys?id=srv-123");
    expect(WorkflowAdapterRegistry.get("PRE_CONTRACT_COSTING")?.getSourceDeepLink("est-123")).toBe("/commercial/costing?id=est-123");
    expect(WorkflowAdapterRegistry.get("COMMERCIAL_PROPOSAL")?.getSourceDeepLink("prop-123")).toBe("/commercial/proposals/prop-123");
  });

  it("2. Approval Center inbox returns exact /commercial/opportunities?id=<oppId> link for Opportunity task", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(checkerSession());
    const res = await getApprovalsInboxRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals?tab=inbox&pageSize=100&search=${encodeURIComponent(`Issue11 OPP7 ${rand}`)}`)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const item = body.data.find((i: any) => i.sourceId === oppId);
    expect(item).toBeTruthy();
    expect(item.deepLink).toBe(`/commercial/opportunities?id=${oppId}`);
  });

  it("3. Opportunities API enforces company isolation so unauthorized deep-link IDs are never returned", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const authRes = await getOpportunitiesRoute(new Request("http://localhost:3100/api/v1/commercial/opportunities"));
    expect(authRes.status).toBe(200);
    const authBody = await authRes.json();
    expect(authBody.cases.some((c: any) => c.id === oppId)).toBe(true);

    (getServerSession as jest.Mock).mockResolvedValue(compBSession());
    const unauthRes = await getOpportunitiesRoute(new Request("http://localhost:3100/api/v1/commercial/opportunities"));
    expect(unauthRes.status).toBe(200);
    const unauthBody = await unauthRes.json();
    expect(unauthBody.cases.some((c: any) => c.id === oppId)).toBe(false);
  });

  it("4. Opportunities page implements ?id= deep link selection, detail modal, loop guard, and safe unavailable error", () => {
    const uiPath = path.resolve(__dirname, "../../apps/web/app/commercial/opportunities/page.tsx");
    const source = fs.readFileSync(uiPath, "utf8");
    expect(source).toContain('new URLSearchParams(window.location.search).get("id")');
    expect(source).toContain("handledDeepLinkRef");
    expect(source).toContain("detailCase");
    expect(source).toContain("Requested opportunity record was not found or you do not have permission to view it.");
  });

  it("5. Opportunities API fails closed when session companyId is missing and blocks query-param companyId bypass", async () => {
    // Missing companyId fails closed with 403
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: compBUserId,
        email: `iss11-cb-${rand}@ahh.local`,
        name: "No Company User",
        role: "COMMERCIAL_CREATOR",
        companyId: null,
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
      },
    });
    const missingRes = await getOpportunitiesRoute(new Request("http://localhost:3100/api/v1/commercial/opportunities"));
    expect(missingRes.status).toBe(403);

    // Query-param companyId override cannot bypass Company B user's own companyId
    (getServerSession as jest.Mock).mockResolvedValue(compBSession());
    const overrideRes = await getOpportunitiesRoute(
      new Request(`http://localhost:3100/api/v1/commercial/opportunities?companyId=${companyAId}`)
    );
    expect(overrideRes.status).toBe(200);
    const overrideBody = await overrideRes.json();
    expect(overrideBody.cases.some((c: any) => c.id === oppId)).toBe(false);
  });

  it("6. NextAuth configuration propagates companyId into authorize, jwt, and session", () => {
    const authPath = path.resolve(__dirname, "../../apps/web/lib/auth.ts");
    const authSource = fs.readFileSync(authPath, "utf8");
    expect(authSource).toContain("companyId: (employee as any).companyId || null");
    expect(authSource).toContain("token.companyId = (user as any).companyId || null");
    expect(authSource).toContain("(employee as any).companyId || null");
    expect(authSource).toContain("(session.user as any).companyId = token.companyId ?? null");
  });

  it("7. Surveys, Activities, Tasks, Command Center, and Approval Center fail closed (403) when non-cross-company user lacks companyId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: checkerId,
        email: `iss11-ck-${rand}@ahh.local`,
        name: "Missing Company Checker",
        role: "COMMERCIAL_APPROVER",
        companyId: null,
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
      },
    });

    const checks = await Promise.all([
      getSurveysRoute(new Request("http://localhost:3100/api/v1/commercial/surveys")),
      getActivitiesRoute(new NextRequest("http://localhost:3100/api/v1/commercial/activities")),
      getTasksRoute(new NextRequest("http://localhost:3100/api/v1/commercial/tasks")),
      getCommercialHealthRoute(new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health")),
      getEscalationsRoute(new Request("http://localhost:3100/api/v1/commercial/command-center/escalations")),
      getRosterCoverageRoute(new Request("http://localhost:3100/api/v1/commercial/command-center/roster-coverage")),
      getApprovalsInboxRoute(new NextRequest("http://localhost:3100/api/v1/approvals")),
      getApprovalsCountsRoute(new NextRequest("http://localhost:3100/api/v1/approvals/counts")),
      getApprovalDetailRoute(new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}`), { params: { id: wfId } }),
      postApprovalActionRoute(
        new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
          method: "POST",
          body: JSON.stringify({ action: "APPROVE", remarks: "test" }),
        }),
        { params: { id: wfId } }
      ),
    ]);

    for (const res of checks) {
      expect(res.status).toBe(403);
    }
  });

  it("8. Approval Center detail & action enforce cross-company isolation (403 for Company B, 200 for SUPER_ADMIN)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(compBSession());
    const detailRes = await getApprovalDetailRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}`),
      { params: { id: wfId } }
    );
    expect(detailRes.status).toBe(403);

    const actionRes = await postApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE", remarks: "cross-company" }),
      }),
      { params: { id: wfId } }
    );
    expect(actionRes.status).toBe(403);

    // SUPER_ADMIN retains cross-company access
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: checkerId,
        email: `iss11-sa-${rand}@ahh.local`,
        name: "Super Admin",
        role: "SUPER_ADMIN",
        companyId: null,
      },
    });
    const saDetailRes = await getApprovalDetailRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}`),
      { params: { id: wfId } }
    );
    expect(saDetailRes.status).toBe(200);
  });

  it("9. Disabled/deleted session fails closed (401) and COMMERCIAL_ADMIN without companyId does not gain Approval Center global access", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: checkerId,
        email: `iss11-dis-${rand}@ahh.local`,
        name: "Disabled User",
        role: "EMPLOYEE",
        companyId: null,
        isDisabled: true,
        permissions: [],
      },
    });
    const disabledRes = await getApprovalsInboxRoute(new NextRequest("http://localhost:3100/api/v1/approvals"));
    expect(disabledRes.status).toBe(401);

    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: checkerId,
        email: `iss11-ca-${rand}@ahh.local`,
        name: "Commercial Admin",
        role: "COMMERCIAL_ADMIN",
        companyId: null,
      },
    });
    const caRes = await getApprovalsInboxRoute(new NextRequest("http://localhost:3100/api/v1/approvals"));
    expect(caRes.status).toBe(403);
  });
});
