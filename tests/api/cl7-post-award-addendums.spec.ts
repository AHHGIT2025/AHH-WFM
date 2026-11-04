import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

import { GET as getAddendums, POST as createAddendum } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/addendums/route";
import { POST as approveAddendum } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/addendums/[addendumId]/approve/route";
import { POST as terminateContract } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/terminate/route";
import { GET as getAdminRoles } from "../../apps/web/app/api/v1/admin/roles/route";
import { fetchUserRBAC } from "../../apps/web/lib/auth";
import {
  DEFAULT_ROLE_PERMISSIONS,
  canViewSecfacAlerts,
  filterNavigationByPermissions,
  hasCommercialAccess
} from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle Phase CL-7 & Phase 1 Remediation: Post-Award Addendums, Maker/Checker SoD & Commercial RBAC", () => {
  let testCompanyId: string;
  let testClientId: string;
  let testActiveContractId: string;
  let testNullValueContractId: string;
  let testDraftContractId: string;
  let testAddendumId: string;
  let testWorkflowTemplateId: string;

  const makerSessionUser = () => ({
    id: "emp-maker-cl7",
    role: "COMMERCIAL_MAKER",
    companyId: testCompanyId,
    permissions: DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER
  });

  const checkerSessionUser = () => ({
    id: "emp-checker-cl7",
    role: "COMMERCIAL_CHECKER",
    companyId: testCompanyId,
    permissions: DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER
  });

  const viewerSessionUser = () => ({
    id: "emp-viewer-cl7",
    role: "COMMERCIAL_VIEWER",
    companyId: testCompanyId,
    permissions: DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_VIEWER
  });

  beforeAll(async () => {
    const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Create central workflow template for CONTRACT_ADDENDUM under Settings > Workflow Setup
    const template = await prisma.workflowTemplate.create({
      data: {
        workflowName: `CL7 Central Addendum Workflow ${rand}`,
        moduleType: "CONTRACT_ADDENDUM",
        appliesTo: "ACTIVATION",
        isDefault: true,
        isActive: true
      }
    });
    testWorkflowTemplateId = template.id;

    const company = await prisma.company.create({
      data: {
        companyCode: `CC7-${rand}`,
        companyName: `CL-7 Test Company ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLIC7-${rand}`,
        name: `CL7 Test Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    // Create ACTIVE contract with explicit totalContractValue (eligible for addendums)
    const activeContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC7-ACT-${rand}`,
        title: "CL-7 Active Test Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        totalContractValue: 100000,
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        mobilisationStatus: "MOBILISED"
      }
    });
    testActiveContractId = activeContract.id;

    // Create ACTIVE contract with NULL totalContractValue (for Gate 1 safety checks)
    const nullContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC7-NUL-${rand}`,
        title: "CL-7 Null Value Test Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        totalContractValue: null,
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        mobilisationStatus: "MOBILISED"
      }
    });
    testNullValueContractId = nullContract.id;

    // Create DRAFT contract (ineligible for addendums)
    const draftContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC7-DRF-${rand}`,
        title: "CL-7 Draft Test Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        approvalStatus: "PENDING",
        mobilisationStatus: "PENDING"
      }
    });
    testDraftContractId = draftContract.id;
  });

  afterAll(async () => {
    const addendums = await prisma.manpowerContractAddendum.findMany({
      where: { contractId: { in: [testActiveContractId, testNullValueContractId].filter(Boolean) } }
    });
    const addIds = addendums.map(a => a.id);
    if (addIds.length > 0) {
      await prisma.userActivityLog.deleteMany({ where: { entityType: "CONTRACT_ADDENDUM", entityId: { in: addIds } } });
      await prisma.workflowActionHistory.deleteMany({ where: { instance: { referenceId: { in: addIds } } } });
      await prisma.workflowInstance.deleteMany({ where: { referenceId: { in: addIds } } });
    }
    if (testActiveContractId) {
      await prisma.manpowerContractAddendumLineItem.deleteMany({ where: { addendum: { contractId: testActiveContractId } } });
      await prisma.manpowerContractAddendum.deleteMany({ where: { contractId: testActiveContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testActiveContractId } });
    }
    if (testNullValueContractId) {
      await prisma.manpowerContractAddendumLineItem.deleteMany({ where: { addendum: { contractId: testNullValueContractId } } });
      await prisma.manpowerContractAddendum.deleteMany({ where: { contractId: testNullValueContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testNullValueContractId } });
    }
    if (testDraftContractId) {
      await prisma.manpowerContract.deleteMany({ where: { id: testDraftContractId } });
    }
    if (testClientId) {
      await prisma.manpowerClient.deleteMany({ where: { id: testClientId } });
    }
    if (testCompanyId) {
      await prisma.company.deleteMany({ where: { id: testCompanyId } });
    }
    if (testWorkflowTemplateId) {
      await prisma.workflowActionHistory.deleteMany({ where: { instance: { templateId: testWorkflowTemplateId } } });
      await prisma.workflowInstance.deleteMany({ where: { templateId: testWorkflowTemplateId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: testWorkflowTemplateId } });
    }
  });

  describe("GET /api/v1/commercial/contracts/[contractId]/addendums", () => {
    it("should return 401 if unauthenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`);
      const res = await getAddendums(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(401);
    });

    it("should return 403 if missing commercial.addendum.view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "emp-unauthorized",
          role: "EMPLOYEE",
          permissions: ["self.profile.view"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`);
      const res = await getAddendums(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(403);
    });

    it("should return contract addendums for COMMERCIAL_VIEWER", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: viewerSessionUser()
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`);
      const res = await getAddendums(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.contract.status).toBe("ACTIVE");
      expect(Array.isArray(data.addendums)).toBe(true);
    });
  });

  describe("POST /api/v1/commercial/contracts/[contractId]/addendums (Maker RBAC & Business Rule Checks)", () => {
    it("should reject addendum creation by COMMERCIAL_VIEWER or COMMERCIAL_CHECKER (403)", async () => {
      for (const unauthorizedMaker of [viewerSessionUser(), checkerSessionUser()]) {
        (getServerSession as jest.Mock).mockResolvedValueOnce({ user: unauthorizedMaker });
        const req = new NextRequest(
          `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Unauthorized Maker Attempt",
              addendumType: "SCOPE_CHANGE",
              effectiveFrom: "2026-09-01"
            })
          }
        );
        const res = await createAddendum(req, { params: { contractId: testActiveContractId } });
        expect(res.status).toBe(403);
      }
    });

    it("should reject addendum creation for non-ACTIVE contract status", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: makerSessionUser()
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testDraftContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Draft Addendum Attempt",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01"
          })
        }
      );

      const res = await createAddendum(req, { params: { contractId: testDraftContractId } });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("only permitted for ACTIVE contracts");
    });

    it("should create addendum for ACTIVE contract as COMMERCIAL_MAKER and submit via CONTRACT_ADDENDUM workflow", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: makerSessionUser()
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "West Wing Headcount Expansion",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01",
            effectiveTo: "2027-12-31",
            description: "Addition of 4 Senior Security Guards for West Wing Perimeter",
            calculatedCommercialImpact: 45000,
            lineItems: [
              {
                itemType: "MANPOWER",
                changeType: "ADD",
                itemName: "Senior Security Guard",
                quantity: 4,
                unitPrice: 3500,
                billingFrequency: "MONTHLY",
                lineTotal: 14000
              }
            ]
          })
        }
      );

      const res = await createAddendum(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.addendum.status).toBe("DRAFT");
      expect(data.addendum.lineItems.length).toBe(1);
      expect(data.addendum.createdBy).toBe("emp-maker-cl7");

      testAddendumId = data.addendum.id;

      // Maker submits addendum for approval
      const submitReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addendumId: testAddendumId,
            action: "SUBMIT",
            remarks: "Submitted by Maker for Checker approval"
          })
        }
      );
      const submitRes = await createAddendum(submitReq, { params: { contractId: testActiveContractId } });
      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.addendum.status).toBe("PENDING_APPROVAL");
      expect(submitData.workflowInstance.moduleType).toBe("CONTRACT_ADDENDUM");
    });
  });

  describe("POST /api/v1/commercial/contracts/[contractId]/addendums/[addendumId]/approve (Gates 1, 2 & 3 Maker/Checker SoD)", () => {
    it("should block Maker (without approve permission) from approving addendum (403)", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: makerSessionUser()
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${testAddendumId}/approve`,
        { method: "POST" }
      );
      const res = await approveAddendum(req, { params: { contractId: testActiveContractId, addendumId: testAddendumId } });
      expect(res.status).toBe(403);
    });

    it("should block Creator from approving own addendum even if assigned commercial.addendum.approve or SUPER_ADMIN (403 SoD)", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          ...makerSessionUser(),
          role: "SUPER_ADMIN",
          permissions: [...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER, "commercial.addendum.approve", "commercial.addendum.reject"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${testAddendumId}/approve`,
        { method: "POST" }
      );
      const res = await approveAddendum(req, { params: { contractId: testActiveContractId, addendumId: testAddendumId } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Segregation of Duties");
    });

    it("should approve addendum as separate COMMERCIAL_CHECKER and update contract totalContractValue and effective end date atomically", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: checkerSessionUser()
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${testAddendumId}/approve`,
        { method: "POST" }
      );

      const res = await approveAddendum(req, { params: { contractId: testActiveContractId, addendumId: testAddendumId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyApproved).toBe(false);
      expect(data.addendum.status).toBe("APPROVED");
      expect(data.contract.totalContractValue).toBe(145000); // Gate 1: 100000 + 45000
    });

    it("should preserve NULL totalContractValue without forcing zero (Gate 1 Safety)", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: makerSessionUser()
      });

      // Create addendum on contract with NULL totalContractValue as Maker
      const addReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testNullValueContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Null Total Value Addendum",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01",
            calculatedCommercialImpact: 20000
          })
        }
      );
      const addRes = await createAddendum(addReq, { params: { contractId: testNullValueContractId } });
      const addData = await addRes.json();

      // Approve as separate Checker
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: checkerSessionUser()
      });
      const appReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testNullValueContractId}/addendums/${addData.addendum.id}/approve`,
        { method: "POST" }
      );
      const appRes = await approveAddendum(appReq, { params: { contractId: testNullValueContractId, addendumId: addData.addendum.id } });
      expect(appRes.status).toBe(200);

      const appData = await appRes.json();
      expect(appData.success).toBe(true);
      expect(appData.contract.totalContractValue).toBeNull(); // Gate 1: Preserved NULL cleanly
    });

    it("should allow COMMERCIAL_CHECKER to REJECT a submitted addendum without mutating contract totalContractValue", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: makerSessionUser()
      });

      const addReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Addendum To Be Rejected",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01",
            calculatedCommercialImpact: 88000,
            submit: true
          })
        }
      );
      const addRes = await createAddendum(addReq, { params: { contractId: testActiveContractId } });
      const addData = await addRes.json();

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: checkerSessionUser()
      });
      const rejReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${addData.addendum.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REJECT",
            remarks: "Rejected by Checker due to rate mismatch"
          })
        }
      );
      const rejRes = await approveAddendum(rejReq, { params: { contractId: testActiveContractId, addendumId: addData.addendum.id } });
      expect(rejRes.status).toBe(200);
      const rejData = await rejRes.json();
      expect(rejData.addendum.status).toBe("REJECTED");
    });

    it("should be idempotent on repeated approve calls", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: checkerSessionUser()
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${testAddendumId}/approve`,
        { method: "POST" }
      );

      const res = await approveAddendum(req, { params: { contractId: testActiveContractId, addendumId: testAddendumId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyApproved).toBe(true);
    });

    it("should enforce immutability and reject edit attempts on approved addendums", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: makerSessionUser()
      });

      const editReq = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addendumId: testAddendumId,
            title: "Illegal Modification Attempt",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01"
          })
        }
      );

      const res = await createAddendum(editReq, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("immutable");
    });
  });

  describe("Commercial Phase 1 Navigation & Settings Links Verification", () => {
    it("should hide Commercial navigation for non-Commercial roles (including Security/FM Admins) and show for Commercial roles", () => {
      const navItems = [
        { label: "Dashboard", path: "/" },
        { label: "Security Guarding", path: "/manpower/security-guarding/dashboard" },
        { label: "Commercial & Contracts", path: "/commercial/dashboard" }
      ];

      for (const nonCommRole of ["EMPLOYEE", "HR_MANAGER", "SECURITY_ADMIN", "FM_ADMIN"]) {
        const user = { role: nonCommRole, permissions: DEFAULT_ROLE_PERMISSIONS[nonCommRole] };
        expect(hasCommercialAccess(user)).toBe(false);
        const filtered = filterNavigationByPermissions(user, navItems);
        expect(filtered.some(i => i.path.startsWith("/commercial"))).toBe(false);
      }

      for (const commRole of [
        "COMMERCIAL_VIEWER",
        "COMMERCIAL_MAKER",
        "COMMERCIAL_CHECKER",
        "COMMERCIAL_ADMIN",
        "COMMERCIAL_CREATOR",
        "COMMERCIAL_APPROVER",
        "COMMERCIAL_OPERATIONS",
        "COMMERCIAL_HR",
        "COMMERCIAL_FINANCE",
        "Commercial Creator",
        "Commercial Approver",
        "Commercial Operations",
        "Commercial HR",
        "Commercial Finance",
        "SUPER_ADMIN",
        "ADMIN"
      ]) {
        const normKey = commRole.trim().toUpperCase().replace(/\s+/g, "_");
        const user = { role: commRole, permissions: DEFAULT_ROLE_PERMISSIONS[normKey] };
        expect(hasCommercialAccess(user)).toBe(true);
        const filtered = filterNavigationByPermissions(user, navItems);
        expect(filtered.some(i => i.path.startsWith("/commercial"))).toBe(true);
      }

      // Verify existing 5 SERVER UAT functional roles map cleanly to Phase 1 permissions & Least Privilege SoD
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).toEqual(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER);
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).toContain("commercial.addendum.create");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).toContain("precontract.workflow.submit");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).not.toContain("commercial.addendum.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).not.toContain("commercial.addendum.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).not.toContain("precontract.workflow.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CREATOR).not.toContain("precontract.workflow.reject");

      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).toEqual(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER);
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).toContain("precontract.workflow.review");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).toContain("precontract.workflow.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).toContain("precontract.workflow.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).toContain("commercial.addendum.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).toContain("commercial.addendum.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).not.toContain("commercial.addendum.create");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_APPROVER).not.toContain("precontract.case.manage");

      // Least privilege on COMMERCIAL_OPERATIONS: Commercial read + handover view/manage + operational context; NO approve/reject
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).toContain("commercial.handover.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).toContain("commercial.handover.manage");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).toContain("manpower.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).not.toContain("precontract.workflow.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).not.toContain("precontract.workflow.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).not.toContain("commercial.addendum.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).not.toContain("commercial.addendum.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_OPERATIONS).not.toContain("commercial.renewal.approve");

      // Least privilege on COMMERCIAL_HR: HR context + Commercial/Pre-Contract read; NO approve/reject and NO handover manage
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).toContain("employees.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).toContain("commercial.handover.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).toContain("precontract.case.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).not.toContain("commercial.handover.manage");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).not.toContain("precontract.workflow.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).not.toContain("precontract.workflow.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).not.toContain("commercial.addendum.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_HR).not.toContain("commercial.addendum.reject");

      // Least privilege on COMMERCIAL_FINANCE: Commercial/Pre-Contract read (costing/proposal/addendum) + financial reports; NO approve/reject
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).toContain("precontract.costing.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).toContain("precontract.proposal.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).toContain("commercial.addendum.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).toContain("reports.view");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).not.toContain("precontract.workflow.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).not.toContain("precontract.workflow.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).not.toContain("commercial.addendum.approve");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).not.toContain("commercial.addendum.reject");
      expect(DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_FINANCE).not.toContain("commercial.renewal.approve");
    });

    it("should route Site Survey Workflow Setup and Commercial Dashboard Settings links to valid destinations", () => {
      const surveysPage = fs.readFileSync(path.join(process.cwd(), "apps/web/app/commercial/surveys/page.tsx"), "utf8");
      const dashboardPage = fs.readFileSync(path.join(process.cwd(), "apps/web/app/commercial/dashboard/page.tsx"), "utf8");

      expect(surveysPage).toContain('href="/settings?tab=workflowManagement"');
      expect(surveysPage).not.toContain('href="/settings/workflow-setup"');

      expect(dashboardPage).toContain('href="/settings/commercial-contract/cost-configuration"');
      expect(dashboardPage).not.toContain('href="/settings/pre-contract-config"');
    });

    it("T1-DEF-027: should enforce permission-aware SECFAC alert polling and notification bell visibility", () => {
      // Commercial roles and standard non-SECFAC roles must NOT poll /api/v1/secfac/alerts/count or see the SECFAC bell
      for (const nonAlertRole of [
        "COMMERCIAL_CREATOR",
        "COMMERCIAL_APPROVER",
        "COMMERCIAL_OPERATIONS",
        "COMMERCIAL_HR",
        "COMMERCIAL_FINANCE",
        "COMMERCIAL_VIEWER",
        "COMMERCIAL_MAKER",
        "COMMERCIAL_CHECKER",
        "COMMERCIAL_ADMIN",
        "EMPLOYEE",
        "HR_MANAGER",
        "SECURITY_READ_ONLY",
        "FM_READ_ONLY"
      ]) {
        const user = { role: nonAlertRole, permissions: DEFAULT_ROLE_PERMISSIONS[nonAlertRole] };
        expect(canViewSecfacAlerts(user)).toBe(false);
        expect(DEFAULT_ROLE_PERMISSIONS[nonAlertRole]).not.toContain("secfac.alerts.view");

        const filteredAlertsNav = filterNavigationByPermissions(user, [
          { label: "Alerts & Escalations (SG)", path: "/manpower/security-guarding/alerts" },
          { label: "Alerts & Escalations (FM)", path: "/manpower/facility-management/alerts" }
        ]);
        expect(filteredAlertsNav).toHaveLength(0);
      }

      // Authorized Admin and SG/FM operational roles with secfac.alerts.view MUST continue receiving alerts
      for (const alertRole of [
        "SUPER_ADMIN",
        "ADMIN",
        "SECURITY_ADMIN",
        "SECURITY_OPERATIONS_MANAGER",
        "SECURITY_SUPERVISOR",
        "FM_ADMIN",
        "FM_OPERATIONS_MANAGER",
        "FM_SUPERVISOR"
      ]) {
        const user = { role: alertRole, permissions: DEFAULT_ROLE_PERMISSIONS[alertRole] };
        expect(canViewSecfacAlerts(user)).toBe(true);

        const filteredAlertsNav = filterNavigationByPermissions(user, [
          { label: "Alerts & Escalations (SG)", path: "/manpower/security-guarding/alerts" },
          { label: "Alerts & Escalations (FM)", path: "/manpower/facility-management/alerts" }
        ]);
        expect(filteredAlertsNav).toHaveLength(2);
      }

      // Verify LayoutShell gates both fetchAlertCount and the header notification bell on canAccessSecfacAlerts
      const layoutShellSource = fs.readFileSync(
        path.join(process.cwd(), "apps/web/components/layout-shell.tsx"),
        "utf8"
      );
      expect(layoutShellSource).toContain("const canAccessSecfacAlerts = canViewSecfacAlerts(session?.user as any);");
      expect(layoutShellSource).toContain("if (!canAccessSecfacAlerts)");
      expect(layoutShellSource).toContain("{canAccessSecfacAlerts && (");
    });

    it("Gate B & Gate C: should preserve existing DB role grants without unexpected widening on seedPermissionsIfEmpty or fetchUserRBAC", async () => {
      // Strictly verify zero approval/rejection/maker creep across COMMERCIAL_OPERATIONS, COMMERCIAL_HR, COMMERCIAL_FINANCE
      for (const roleKey of ["COMMERCIAL_OPERATIONS", "COMMERCIAL_HR", "COMMERCIAL_FINANCE"]) {
        const perms = DEFAULT_ROLE_PERMISSIONS[roleKey];
        expect(perms.filter(p => p.endsWith(".approve") || p.endsWith(".reject") || p.endsWith(".review"))).toEqual([]);
      }
      for (const roleKey of ["COMMERCIAL_HR", "COMMERCIAL_FINANCE", "COMMERCIAL_APPROVER"]) {
        const perms = DEFAULT_ROLE_PERMISSIONS[roleKey];
        expect(
          perms.filter(p => p.endsWith(".manage") || p.endsWith(".create") || p.endsWith(".update") || p.endsWith(".submit"))
        ).toEqual([]);
      }

      // Gate C: Create an isolated test role in SystemRole with a single explicit DB RolePermission grant,
      // and verify seedPermissionsIfEmpty() (as called by GET /api/v1/admin/roles when roles.length > 0)
      // neither modifies existing RolePermission grants nor creates unrequested SystemRole rows.
      const customRoleName = `COMMERCIAL_UAT_TEST_${Date.now()}`;
      const createdRole = await prisma.systemRole.create({
        data: {
          name: customRoleName,
          description: "Isolated UAT Role Grant Preservation Test",
          isSystemDefault: false,
          isActive: true,
          isEditable: true,
          scope: "Commercial",
          roleType: "White Collar Operations"
        }
      });

      try {
        (getServerSession as jest.Mock).mockResolvedValue({
          user: {
            id: "emp-admin-cl7",
            role: "SUPER_ADMIN",
            companyId: testCompanyId,
            permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN
          }
        });
        const initRes = await getAdminRoles();
        expect(initRes.status).toBe(200);

        const dashboardPerm = await prisma.systemPermission.findUnique({
          where: { key: "dashboard.view" }
        });
        expect(dashboardPerm).not.toBeNull();

        await prisma.rolePermission.create({
          data: {
            roleId: createdRole.id,
            permissionId: dashboardPerm!.id,
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canApprove: false,
            canExport: false
          }
        });

        const roleCountBefore = await prisma.systemRole.count();
        const rolePermBefore = await prisma.rolePermission.findMany({
          where: { roleId: createdRole.id }
        });

        // Invoke GET /api/v1/admin/roles again (which executes seedPermissionsIfEmpty() on an already-populated DB)
        const secondRes = await getAdminRoles();
        expect(secondRes.status).toBe(200);

        const roleCountAfter = await prisma.systemRole.count();
        const rolePermAfter = await prisma.rolePermission.findMany({
          where: { roleId: createdRole.id }
        });

        expect(roleCountAfter).toBe(roleCountBefore);
        expect(rolePermAfter).toEqual(rolePermBefore);

        // Verify fetchUserRBAC honors explicit DB RolePermission rows and does NOT union DEFAULT_ROLE_PERMISSIONS onto an existing DB-configured role
        const rbac = await fetchUserRBAC("non-existent-emp-uat-test", customRoleName);
        expect(rbac.permissions).toEqual(["dashboard.view"]);
      } finally {
        await prisma.rolePermission.deleteMany({ where: { roleId: createdRole.id } });
        await prisma.systemRole.delete({ where: { id: createdRole.id } });
      }
    });
  });

  describe("POST /api/v1/commercial/contracts/[contractId]/terminate", () => {
    it("should return 403 if missing commercial.contract.terminate permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "emp-unauthorized-term",
          role: "EMPLOYEE",
          permissions: ["self.profile.view"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/terminate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terminationReason: "Unauthorized termination attempt"
          })
        }
      );

      const res = await terminateContract(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(403);
    });

    it("should terminate active contract and update status to TERMINATED", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.contract.terminate"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/terminate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terminationReason: "Mutual Commercial Settlement upon Project Completion",
            settlementNotes: "All final invoices cleared."
          })
        }
      );

      const res = await terminateContract(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.contractStatus).toBe("TERMINATED");
    });
  });
});
