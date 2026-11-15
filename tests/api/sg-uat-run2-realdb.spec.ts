import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as submitContractWorkflowRoute } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/submit/route";
import { POST as approveContractWorkflowRoute } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/approve/route";
import { POST as postSgAddendumRoute } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/addendums/route";
import { GET as getApprovalsInboxRoute } from "../../apps/web/app/api/v1/approvals/route";
import {
  calculateAddendumFinancialImpact,
  getEffectiveContractManpower,
} from "../../apps/web/lib/contract-helpers";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("SG UAT Run 2 Real-DB Integration Gate (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let testCompanyId: string;
  let testClientId: string;
  let testDraftContractId: string;
  let testActiveContractId: string;
  let testTemplateId: string;
  let prevDefaultTemplateIds: string[] = [];
  const makerEmpId = `emp-mk-${rand}`;
  const checkerEmpId = `emp-ck-${rand}`;
  const superAdminEmpId = `emp-sa-${rand}`;
  const createdAddendumIds: string[] = [];

  const makerSession = () => ({
    id: makerEmpId,
    employeeId: makerEmpId,
    name: "SG Maker",
    email: `maker-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true },
    allowedOperations: ["SECURITY_GUARDING"],
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "manpower.security.manage",
      "precontract.workflow.submit",
    ],
  });

  const checkerSession = () => ({
    id: checkerEmpId,
    employeeId: checkerEmpId,
    name: "SG Checker",
    email: `checker-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true },
    allowedOperations: ["SECURITY_GUARDING"],
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "manpower.security.manage",
    ],
  });

  const superAdminSession = () => ({
    id: superAdminEmpId,
    employeeId: superAdminEmpId,
    name: "SG SuperAdmin",
    email: `super-${rand}@test.local`,
    role: "SUPER_ADMIN",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    allowedOperations: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"],
    permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN,
  });

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        companyCode: `SGR2-${rand}`,
        companyName: `SG Run2 Test Company ${rand}`,
        isActive: true,
      },
    });
    testCompanyId = company.id;

    await prisma.employee.createMany({
      data: [
        {
          id: makerEmpId,
          name: "SG Maker User",
          department: "Commercial",
          companyId: testCompanyId,
          role: "EMPLOYEE",
          status: "On Duty",
          email: `maker-${rand}@test.local`,
        },
        {
          id: checkerEmpId,
          name: "SG Checker User",
          department: "Commercial",
          companyId: testCompanyId,
          role: "SUPERVISOR",
          status: "On Duty",
          email: `checker-${rand}@test.local`,
        },
        {
          id: superAdminEmpId,
          name: "SG SuperAdmin User",
          department: "Executive",
          companyId: testCompanyId,
          role: "ADMIN",
          status: "On Duty",
          email: `super-${rand}@test.local`,
        },
      ],
    });

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLSGR2-${rand}`,
        name: `SG Run2 Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true,
      },
    });
    testClientId = client.id;

    const prevDefaults = await prisma.workflowTemplate.findMany({
      where: {
        moduleType: "SECURITY_GUARDING_CONTRACT",
        appliesTo: "ACTIVATION",
        isActive: true,
        isDefault: true,
      },
      select: { id: true },
    });
    prevDefaultTemplateIds = prevDefaults.map((t) => t.id);
    if (prevDefaultTemplateIds.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevDefaultTemplateIds } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.workflowTemplate.create({
      data: {
        workflowName: `SG Run2 Contract Approval ${rand}`,
        moduleType: "SECURITY_GUARDING_CONTRACT",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Commercial Checker Approval",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "SPECIFIC_EMPLOYEE",
                    employeeId: checkerEmpId,
                    employeeName: "SG Checker User",
                  },
                ],
              },
            },
          ],
        },
      },
    });
    testTemplateId = template.id;

    const draftContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CON-SGR2-DRF-${rand}`,
        title: "SG Run2 Draft Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        totalContractValue: 120000,
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        approvalStatus: "DRAFT",
      },
    });
    testDraftContractId = draftContract.id;

    const activeContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CON-SGR2-ACT-${rand}`,
        title: "SG Run2 Active Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        totalContractValue: 240000,
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        mobilisationStatus: "MOBILISED",
      },
    });
    testActiveContractId = activeContract.id;
  });

  afterAll(async () => {
    try {
      await prisma.workflowInstance.deleteMany({
        where: { referenceId: { in: [testDraftContractId, testActiveContractId] } },
      });
      await prisma.contractApprovalWorkflow.deleteMany({
        where: { contractId: { in: [testDraftContractId, testActiveContractId] } },
      });
      if (createdAddendumIds.length > 0) {
        await prisma.manpowerContractAddendum.deleteMany({
          where: { id: { in: createdAddendumIds } },
        });
      }
      await prisma.manpowerContract.deleteMany({
        where: { id: { in: [testDraftContractId, testActiveContractId] } },
      });
      await prisma.workflowTemplate.deleteMany({
        where: { id: testTemplateId },
      });
      if (prevDefaultTemplateIds.length > 0) {
        await prisma.workflowTemplate.updateMany({
          where: { id: { in: prevDefaultTemplateIds } },
          data: { isDefault: true },
        });
      }
      await prisma.manpowerClient.deleteMany({
        where: { id: testClientId },
      });
      await prisma.employee.deleteMany({
        where: { id: { in: [makerEmpId, checkerEmpId, superAdminEmpId] } },
      });
      await prisma.company.deleteMany({
        where: { id: testCompanyId },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Contract submission -> WorkflowInstance in Checker Approval Center -> SoD & impersonation blocks -> Checker approves to APPROVED", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });

    const submitReq = new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/workflow/submit", {
      method: "POST",
    });
    const submitRes = await submitContractWorkflowRoute(submitReq, {
      params: { id: testDraftContractId },
    });
    const submittedContract = await submitRes.json();
    if (submitRes.status !== 200) {
      throw new Error(`Submit failed (${submitRes.status}): ${JSON.stringify(submittedContract)}`);
    }
    expect(submitRes.status).toBe(200);
    const persistedWf = await prisma.contractApprovalWorkflow.findFirst({
      where: { contractId: testDraftContractId },
      include: { levels: { orderBy: { levelNumber: "asc" } } },
    });
    expect(persistedWf).toBeTruthy();
    const levelId = persistedWf!.levels[0].id;

    // Verify WorkflowInstance appears in assigned Checker's Approval Center inbox
    (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
    const inboxReq = new NextRequest(`http://localhost:3100/api/v1/approvals?tab=inbox&pageSize=100&search=${encodeURIComponent(`CON-SGR2-DRF-${rand}`)}`);
    const inboxRes = await getApprovalsInboxRoute(inboxReq);
    expect(inboxRes.status).toBe(200);
    const inboxData = await inboxRes.json();
    const items = inboxData.data || inboxData.items || inboxData.instances || [];
    const found = items.find((i: any) => i.sourceId === testDraftContractId || i.referenceId === testDraftContractId);
    expect(found).toBeTruthy();

    // Maker cannot self-approve even if trying to spoof checker employeeId in payload
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession() });
    const selfApproveReq = new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/workflow/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        levelId,
        employeeId: checkerEmpId, // attempted impersonation must be ignored
        remarks: "Trying self-approval",
      }),
    });
    const selfApproveRes = await approveContractWorkflowRoute(selfApproveReq, {
      params: { id: testDraftContractId },
    });
    expect(selfApproveRes.status).toBe(403);

    // SUPER_ADMIN who is not the assigned Checker is also rejected 403
    (getServerSession as jest.Mock).mockResolvedValue({ user: superAdminSession() });
    const adminApproveReq = new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/workflow/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        levelId,
        employeeId: checkerEmpId,
        remarks: "Unauthorized admin override attempt",
      }),
    });
    const adminApproveRes = await approveContractWorkflowRoute(adminApproveReq, {
      params: { id: testDraftContractId },
    });
    expect(adminApproveRes.status).toBe(403);

    // Assigned Checker approves -> manpowerContract.status becomes APPROVED
    (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
    const checkerApproveReq = new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/workflow/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        levelId,
        remarks: "Approved by Checker",
      }),
    });
    const checkerApproveRes = await approveContractWorkflowRoute(checkerApproveReq, {
      params: { id: testDraftContractId },
    });
    expect(checkerApproveRes.status).toBe(200);

    const updatedContract = await prisma.manpowerContract.findUnique({
      where: { id: testDraftContractId },
    });
    expect(updatedContract?.status).toBe("APPROVED");
    expect(updatedContract?.approvalStatus).toBe("APPROVED");
  });

  it("2. SG Addendums API forces DRAFT even for SUPER_ADMIN, rejects non-ACTIVE contracts, and DRAFT addendum has 0 manpower impact", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: superAdminSession() });

    // Rejects APPROVED (non-ACTIVE) contract
    const rejectReq = new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/addendums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Invalid on APPROVED contract",
        addendumType: "MANPOWER_ADDITION",
        effectiveFrom: "2026-10-01",
        status: "APPROVED",
        lineItems: [{ itemType: "MANPOWER", label: "Security Guard", action: "ADD", quantity: 2, unitPrice: 3000 }],
      }),
    });
    const rejectRes = await postSgAddendumRoute(rejectReq, {
      params: { id: testDraftContractId },
    });
    expect(rejectRes.status).toBe(400);

    // On ACTIVE contract, even SUPER_ADMIN sending status: "APPROVED" gets forced to "DRAFT"
    const createReq = new Request("http://localhost:3100/api/v1/manpower/security-guarding/contracts/addendums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "SG Run2 Forced Draft Addendum",
        addendumType: "MANPOWER_ADDITION",
        effectiveFrom: "2026-10-16",
        effectiveTo: "2026-11-15",
        status: "APPROVED",
        lineItems: [{ itemType: "MANPOWER", label: "Security Guard", action: "ADD", quantity: 4, unitPrice: 3000 }],
      }),
    });
    const createRes = await postSgAddendumRoute(createReq, {
      params: { id: testActiveContractId },
    });
    expect(createRes.status).toBe(200);
    const createdAddendum = await createRes.json();
    createdAddendumIds.push(createdAddendum.id);
    expect(createdAddendum.status).toBe("DRAFT");

    // DRAFT addendum has 0 manpower impact in getEffectiveContractManpower
    const effective = getEffectiveContractManpower({
      manpowerRequirements: [{ position: "Security Guard", quantity: 10 }],
      addendums: [createdAddendum],
    });
    expect(effective.effectiveManpower[0].quantity).toBe(10);
    expect(effective.effectiveManpower[0].addendumQty).toBe(0);
  });

  it("3. calculateAddendumFinancialImpact computes fractional pro-rata calendar months accurately (DEF-079)", () => {
    // Oct 16..31 = 16/31; Nov 1..15 = 15/30 = 0.5 -> total = 16/31 + 0.5 = 1.0161 months
    const res = calculateAddendumFinancialImpact(
      [
        { label: "Security Guard", action: "ADD", quantity: 2, unitPrice: 3000 },
        { label: "FOC Supervisor", action: "ADD", quantity: 1, unitPrice: 5000, isFoc: true },
      ],
      "2026-10-16",
      "2026-11-15"
    );
    expect(res.monthlyNet).toBe(6000);
    expect(res.effectiveMonths).toBeCloseTo(16 / 31 + 15 / 30, 4);
    expect(res.fullTermNet).toBe(Math.round(6000 * res.effectiveMonths * 100) / 100);
  });
});
