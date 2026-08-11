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
    const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const company = await prisma.company.create({
      data: {
        companyCode: `CC6-${rand}`,
        companyName: `CL-6 Test Operations Company ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLIC6-${rand}`,
        name: `CL6 Test Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    const contract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC6-${rand}`,
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

  describe("GET /api/v1/commercial/handover/[contractId] (Read-Only Verification)", () => {
    it("should return 401 if unauthenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const res = await getHandover(req, { params: { contractId: testContractId } });
      expect(res.status).toBe(401);
    });

    it("should return 403 if missing commercial.handover.view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "emp-unauthorized",
          role: "EMPLOYEE",
          permissions: ["self.profile.view"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const res = await getHandover(req, { params: { contractId: testContractId } });
      expect(res.status).toBe(403);
    });

    it("should fetch handover details without mutating database (GET_IS_READ_ONLY)", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.handover.view", "manpower.admin.full_access"]
        }
      });

      const initialDbCount = await prisma.contractMobilizationChecklist.count({ where: { contractId: testContractId } });

      const req1 = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const res1 = await getHandover(req1, { params: { contractId: testContractId } });
      expect(res1.status).toBe(200);

      const req2 = new NextRequest(`http://localhost:3100/api/v1/commercial/handover/${testContractId}`);
      const res2 = await getHandover(req2, { params: { contractId: testContractId } });
      expect(res2.status).toBe(200);

      const postDbCount = await prisma.contractMobilizationChecklist.count({ where: { contractId: testContractId } });
      expect(postDbCount).toBe(initialDbCount); // Proven 100% read-only!
    });
  });

  describe("POST /api/v1/commercial/handover/[contractId]/tasks", () => {
    it("should persist task completion upon explicit POST", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.handover.view", "commercial.handover.manage"]
        }
      });

      const updateReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/handover/${testContractId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: "default-ops-1",
            status: "COMPLETED",
            remarks: "Site inspection verified by Operations Manager"
          })
        }
      );

      const updateRes = await postTaskDirect(updateReq, { params: { contractId: testContractId } });
      expect(updateRes.status).toBe(200);

      const updateData = await updateRes.json();
      expect(updateData.success).toBe(true);
      expect(updateData.task.status).toBe("COMPLETED");

      const dbCount = await prisma.contractMobilizationChecklist.count({ where: { contractId: testContractId } });
      expect(dbCount).toBeGreaterThan(0);
    });
  });

  describe("POST /api/v1/commercial/handover/[contractId]/signoff (Idempotency & Lifecycle)", () => {
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
            clientSignoffName: "Hassan Al-Malki (Operations Director)",
            clientRemarks: "All guard posts and shift rotas approved."
          })
        }
      );

      const res = await postSignoff(signoffReq, { params: { contractId: testContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadySignedOff).toBe(false);
      expect(data.handoverLog.clientSignoffName).toBe("Hassan Al-Malki (Operations Director)");
      expect(data.contractStatus).toBe("MOBILISED");
    });

    it("should be idempotent and not create duplicate handover logs on repeated sign-off", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl6",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.handover.manage"]
        }
      });

      const initialLogCount = await prisma.contractHandoverLog.count({ where: { contractId: testContractId } });

      const retryReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/handover/${testContractId}/signoff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientSignoffName: "Hassan Al-Malki (Operations Director)",
            clientRemarks: "Duplicate request attempt"
          })
        }
      );

      const res = await postSignoff(retryReq, { params: { contractId: testContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadySignedOff).toBe(true); // Proven idempotent!

      const postLogCount = await prisma.contractHandoverLog.count({ where: { contractId: testContractId } });
      expect(postLogCount).toBe(initialLogCount); // Zero duplicate rows!
    });
  });

  describe("GET Commercial Reports Analytics & Confidentiality", () => {
    it("should return 401 for unauthenticated report requests", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/reports/margins");
      const res = await getMargins(req);
      expect(res.status).toBe(401);
    });

    it("should return 403 for unauthorized users lacking commercial.reports.view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "emp-unauthorized-viewer",
          role: "EMPLOYEE",
          permissions: ["self.profile.view"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/reports/margins");
      const res = await getMargins(req);
      expect(res.status).toBe(403);
    });

    it("should fetch pipeline analytics report for authorized commercial users", async () => {
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

    it("should fetch margin heatmaps analytics report for authorized commercial users", async () => {
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
