import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { GET as getWelfareChecks } from "../../apps/web/app/api/v1/secfac/welfare/checks/route";
import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("SECFAC Welfare Check Schema Repair Test Suite", () => {
  let testSite: any;
  let testEmp: any;

  beforeAll(async () => {
    // Setup authenticated session
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "emp-welfare-admin",
        name: "Welfare Admin",
        role: "SUPER_ADMIN",
        permissions: ["manpower.admin.full_access", "secfac.welfare.view"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: true
        }
      }
    });

    testSite = await prisma.manpowerSite.findFirst({
      where: { operationType: "SECURITY_GUARDING" }
    });
    if (!testSite) {
      const client = await prisma.manpowerClient.create({
        data: { name: "Client Welfare Test", code: "CWT", operationType: "SECURITY_GUARDING" }
      });
      const contract = await prisma.manpowerContract.create({
        data: {
          clientId: client.id,
          title: "Contract Welfare Test",
          contractNumber: "CWT-001",
          startDate: new Date("2026-07-01"),
          endDate: new Date("2026-12-31"),
          operationType: "SECURITY_GUARDING"
        }
      });
      const project = await prisma.manpowerProject.create({
        data: { name: "Proj Welfare Test", code: "PWT", contractId: contract.id, operationType: "SECURITY_GUARDING" }
      });
      testSite = await prisma.manpowerSite.create({
        data: { name: "Site Welfare Test", code: "SWT", projectId: project.id, operationType: "SECURITY_GUARDING" }
      });
    }

    testEmp = await prisma.employee.findFirst({
      where: { operationType: "SECURITY_GUARDING", isActive: true }
    });
  });

  it("1. Verifies SecFacWelfareCheck database table column alignment (no P2022 error)", async () => {
    // Querying SecFacWelfareCheck must include contractId and postId without P2022 column missing error
    const checks = await prisma.secFacWelfareCheck.findMany({
      take: 1
    });
    expect(Array.isArray(checks)).toBe(true);
  });

  it("2. Welfare Check record with nullable contractId and postId remains readable", async () => {
    if (!testEmp || !testSite) return;

    const check = await prisma.secFacWelfareCheck.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: "COMP-002",
        siteId: testSite.id,
        employeeId: testEmp.id,
        scheduledAt: new Date(),
        dueAt: new Date(Date.now() + 3600000),
        graceExpiresAt: new Date(Date.now() + 4200000),
        status: "PENDING",
        idempotencyKey: `test:null:fields:${Date.now()}`,
        contractId: null,
        postId: null
      }
    });

    expect(check.id).toBeTruthy();
    expect(check.contractId).toBeNull();
    expect(check.postId).toBeNull();

    // Query back
    const fetched = await prisma.secFacWelfareCheck.findUnique({
      where: { id: check.id }
    });
    expect(fetched?.contractId).toBeNull();
    expect(fetched?.postId).toBeNull();

    // Cleanup
    await prisma.secFacWelfareCheck.delete({ where: { id: check.id } });
  });

  it("3. Welfare Check creation with populated contractId and postId", async () => {
    if (!testEmp || !testSite) return;

    const check = await prisma.secFacWelfareCheck.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: "COMP-002",
        siteId: testSite.id,
        employeeId: testEmp.id,
        contractId: "CON-TEST-123",
        postId: "POST-GATE-01",
        scheduledAt: new Date(),
        dueAt: new Date(Date.now() + 3600000),
        graceExpiresAt: new Date(Date.now() + 4200000),
        status: "PENDING",
        idempotencyKey: `test:populated:fields:${Date.now()}`
      }
    });

    expect(check.contractId).toBe("CON-TEST-123");
    expect(check.postId).toBe("POST-GATE-01");

    // Cleanup
    await prisma.secFacWelfareCheck.delete({ where: { id: check.id } });
  });

  it("4. GET /api/v1/secfac/welfare/checks handles contractId and postId filters", async () => {
    const req = new NextRequest("http://localhost/api/v1/secfac/welfare/checks?operationType=SECURITY_GUARDING&contractId=CON-TEST-123&postId=POST-GATE-01");
    const res = await getWelfareChecks(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checks).toBeDefined();
  });

  it("5. Operational Scope Isolation: Security Guarding user cannot access FM welfare checks", async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({
      user: {
        id: "emp-sg-user",
        name: "SG User",
        role: "SECURITY_ADMIN",
        permissions: ["secfac.welfare.view"],
        operationAccess: {
          allowedSecurityGuarding: true,
          allowedFacilityManagement: false
        }
      }
    });

    const req = new NextRequest("http://localhost/api/v1/secfac/welfare/checks?operationType=FACILITY_MANAGEMENT");
    const res = await getWelfareChecks(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Forbidden");
  });
});
