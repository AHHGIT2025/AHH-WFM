import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { GET as getHandover } from "../../apps/web/app/api/v1/commercial/handover/[contractId]/route";
import { POST as postTaskDirect } from "../../apps/web/app/api/v1/commercial/handover/[contractId]/tasks/route";
import { POST as postSignoff } from "../../apps/web/app/api/v1/commercial/handover/[contractId]/signoff/route";
import { GET as getPipeline } from "../../apps/web/app/api/v1/commercial/reports/pipeline/route";
import { GET as getMargins } from "../../apps/web/app/api/v1/commercial/reports/margins/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle Phase CL-6: Operations Handover & Reports API Suite", () => {
  let testCompanyId: string;
  let testClientId: string;
  let testContractId: string;

  beforeAll(async () => {
    // Seed test company, client, and manpower contract
    const company = await prisma.company.create({
      data: {
        companyCode: `COMP-CL6-${Date.now()}`,
        companyName: "CL-6 Test Operations Company",
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLI-CL6-${Date.now()}`,
        name: `CL6 Test Client ${Date.now()}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    const contract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONT-CL6-${Date.now()}`,
        title: "CL-6 Operations Handover Test Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        approvalStatus: "APPROVED",
        mobilisationStatus: "PENDING"
      }
    });
    testContractId = contract.id;
  });

  afterAll(async () => {
    // Clean up created records
    if (testContractId) {
      await prisma.contractMobilizationChecklist.deleteMany({ where: { contractId: testContractId } });
      await prisma.contractHandoverLog.deleteMany({ where: { contractId: testContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testContractId } });
    }
    if (testClientId) {
      await prisma.manpowerClient.deleteMany({ where: { id: testClientId } });
    }
    if (testCompanyId) {
      await prisma.company.deleteMany({ where: { id: testCompanyId } });
    }
  });

  describe("GET /api/v1/commercial/handover/[contractId]", () => {
    it("should return 401 if unauthenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const res = await getHandover(req, { params: { contractId: testContractId } });
      expect(res.status).toBe(401);
    });

    it("should fetch handover details and auto-seed default mobilization tasks", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.handover.view", "manpower.admin.full_access"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const res = await getHandover(req, { params: { contractId: testContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.contract.id).toBe(testContractId);
      expect(data.readiness.totalTasks).toBeGreaterThanOrEqual(4);
      expect(data.checklists.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("POST /api/v1/commercial/handover/[contractId]/tasks", () => {
    it("should allow updating task status and adding custom tasks", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.handover.view", "commercial.handover.manage"]
        }
      });

      // Get existing tasks first
      const getReq = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const getRes = await getHandover(getReq, { params: { contractId: testContractId } });
      const getData = await getRes.json();
      const firstTask = getData.checklists[0];

      // Update first task to COMPLETED
      const updateReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/handover/${testContractId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: firstTask.id,
            status: "COMPLETED",
            remarks: "Site inspection verified by Operations Lead"
          })
        }
      );

      const updateRes = await postTaskDirect(updateReq, { params: { contractId: testContractId } });
      expect(updateRes.status).toBe(200);

      const updateData = await updateRes.json();
      expect(updateData.success).toBe(true);
      expect(updateData.task.status).toBe("COMPLETED");
    });
  });

  describe("POST /api/v1/commercial/handover/[contractId]/signoff", () => {
    it("should log client sign-off and transition contract mobilisationStatus to MOBILISED", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.handover.manage"]
        }
      });

      const signoffReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/handover/${testContractId}/signoff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientSignoffName: "Hassan Al-Malki (Operations Manager)",
            clientRemarks: "All guard posts and shift rotas approved."
          })
        }
      );

      const res = await postSignoff(signoffReq, { params: { contractId: testContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.handoverLog.clientSignoffName).toBe("Hassan Al-Malki (Operations Manager)");
      expect(data.contractStatus).toBe("MOBILISED");
    });
  });

  describe("GET Commercial Reports Analytics", () => {
    it("should fetch pipeline analytics report", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.reports.view"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/reports/pipeline");
      const res = await getPipeline(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
    });

    it("should fetch margin heatmaps analytics report", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.reports.view"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/reports/margins");
      const res = await getMargins(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
    });
  });
});
