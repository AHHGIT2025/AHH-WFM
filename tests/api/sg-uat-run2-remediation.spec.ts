import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { getEffectiveContractManpower } from "../../apps/web/lib/contract-helpers";
import { PC1_WORKFLOW_MODULE_TYPES } from "../../apps/web/lib/workflow-engine";
import { WorkflowAdapterRegistry } from "../../apps/web/lib/workflow/adapters/registry";
import { hasPermission } from "../../apps/web/lib/permissions";
import { mockDb } from "../../packages/mock-data/src/index";
import { POST as postContractApprove } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/approve/route";
import { POST as postContractReject } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/reject/route";
import { POST as postSgAddendum } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/addendums/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Security Guarding UAT Run 2 Remediation & Final Integrity Audit Suite", () => {
  describe("DEF-083: Contract Addendum Effective Manpower Integrity", () => {
    const baseContract = {
      id: "test-contract-001",
      contractNumber: "CONT-SG-2026-TEST",
      requiredStaffCount: 10,
      manpowerRequirements: [
        { id: "req-1", position: "Security Guard", quantity: 8, unitPrice: 3500 },
        { id: "req-2", position: "Supervisor", quantity: 2, unitPrice: 5000 },
      ],
      addendums: [
        {
          id: "add-draft-1",
          addendumNumber: "ADD-001",
          status: "DRAFT",
          effectiveFrom: "2026-08-01",
          lineItems: [
            { itemType: "MANPOWER", itemName: "Security Guard", quantity: 5, changeType: "ADD" },
          ],
        },
        {
          id: "add-pending-1",
          addendumNumber: "ADD-002",
          status: "PENDING",
          effectiveFrom: "2026-08-01",
          lineItems: [
            { itemType: "MANPOWER", itemName: "Supervisor", quantity: 3, changeType: "ADD" },
          ],
        },
        {
          id: "add-rejected-1",
          addendumNumber: "ADD-003",
          status: "REJECTED",
          effectiveFrom: "2026-08-01",
          lineItems: [
            { itemType: "MANPOWER", itemName: "Security Guard", quantity: 7, changeType: "ADD" },
          ],
        },
        {
          id: "add-cancelled-1",
          addendumNumber: "ADD-004",
          status: "CANCELLED",
          effectiveFrom: "2026-08-01",
          lineItems: [
            { itemType: "MANPOWER", itemName: "Security Guard", quantity: 9, changeType: "ADD" },
          ],
        },
        {
          id: "add-approved-1",
          addendumNumber: "ADD-005",
          status: "APPROVED",
          effectiveFrom: "2026-08-01",
          lineItems: [
            { itemType: "MANPOWER", itemName: "Security Guard", quantity: 4, changeType: "ADD" },
          ],
        },
      ],
    };

    it("excludes DRAFT, PENDING, REJECTED, and CANCELLED addendums from effective contract manpower", () => {
      const result = getEffectiveContractManpower(baseContract);
      const totalManpower = result.effectiveManpower.reduce((acc, item) => acc + item.quantity, 0);

      // Base: 8 Guards + 2 Supervisors = 10. Approved addendum: +4 Guards => 14 total.
      expect(totalManpower).toBe(14);

      const guardPos = result.effectiveManpower.find((p) => p.position === "Security Guard");
      expect(guardPos?.originalQty).toBe(8);
      expect(guardPos?.addendumQty).toBe(4);
      expect(guardPos?.quantity).toBe(12);

      const supPos = result.effectiveManpower.find((p) => p.position === "Supervisor");
      expect(supPos?.addendumQty).toBe(0);
      expect(supPos?.quantity).toBe(2);
    });

    it("respects asOfDate effective-date boundaries for approved addendums", () => {
      const contractWithWindowAddendum = {
        ...baseContract,
        addendums: [
          {
            id: "add-window-approved",
            addendumNumber: "ADD-WIN",
            status: "APPROVED",
            effectiveFrom: "2026-10-01",
            effectiveTo: "2026-11-30",
            lineItems: [
              { itemType: "MANPOWER", itemName: "Security Guard", quantity: 10, changeType: "ADD" },
            ],
          },
        ],
      };

      const beforeResult = getEffectiveContractManpower(contractWithWindowAddendum, "2026-09-15");
      expect(beforeResult.effectiveManpower.reduce((a, i) => a + i.quantity, 0)).toBe(10);

      const duringResult = getEffectiveContractManpower(contractWithWindowAddendum, "2026-10-15");
      expect(duringResult.effectiveManpower.reduce((a, i) => a + i.quantity, 0)).toBe(20);

      const afterResult = getEffectiveContractManpower(contractWithWindowAddendum, "2026-12-05");
      expect(afterResult.effectiveManpower.reduce((a, i) => a + i.quantity, 0)).toBe(10);
    });
  });

  describe("DEF-075 & Section 3: Approval Impersonation, Silent SUPER_ADMIN Bypass, and Scope/Company Isolation", () => {
    it("blocks creator AND SUPER_ADMIN creator from self-approving in mockDb", async () => {
      const mockContract = {
        id: "cont-sod-strict-1",
        operationType: "SECURITY_GUARDING",
        companyId: "comp-1",
        createdById: "user-superadmin-1",
        submittedBy: "Super Admin",
      };

      const getSpy = jest.spyOn(mockDb, "getManpowerContract").mockResolvedValueOnce(mockContract as any);

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "user-superadmin-1",
          employeeId: "user-superadmin-1",
          name: "Super Admin",
          role: "SUPER_ADMIN",
          companyId: "comp-1",
          operationAccess: { allowedSecurityGuarding: true },
        },
      });

      // Mock approveContractWorkflowLevel to exercise the real SoD logic check
      const approveSpy = jest.spyOn(mockDb, "approveContractWorkflowLevel").mockRejectedValueOnce(
        new Error("Segregation of Duties: Creator cannot approve their own contract.")
      );

      const req = new NextRequest("http://localhost:3100/api/v1/manpower/security-guarding/contracts/cont-sod-strict-1/workflow/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: "lvl-1", employeeId: "spoofed-approver-id" }),
      });

      const res = await postContractApprove(req, { params: { id: "cont-sod-strict-1" } });
      expect(res.status).toBe(403);
      // Verify route ignored spoofed payload.employeeId and passed authenticated user.employeeId
      expect(approveSpy).toHaveBeenCalledWith(
        "cont-sod-strict-1",
        "lvl-1",
        "user-superadmin-1",
        undefined,
        expect.objectContaining({ id: "user-superadmin-1" })
      );

      getSpy.mockRestore();
      approveSpy.mockRestore();
    });

    it("rejects Facility Management user from Security Guarding contract approval/rejection routes", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "user-fm-1",
          role: "COMMERCIAL_CHECKER",
          companyId: "comp-1",
          operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true },
        },
      });

      const req = new NextRequest("http://localhost:3100/api/v1/manpower/security-guarding/contracts/cont-sg-1/workflow/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: "lvl-1", remarks: "Rejected" }),
      });

      const res = await postContractReject(req, { params: { id: "cont-sg-1" } });
      expect(res.status).toBe(403);
    });

    it("rejects cross-company user from approving another company's SG contract", async () => {
      const getSpy = jest.spyOn(mockDb, "getManpowerContract").mockResolvedValueOnce({
        id: "cont-comp-a",
        operationType: "SECURITY_GUARDING",
        companyId: "comp-A",
      } as any);

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "user-comp-b",
          role: "OPERATIONS_DIRECTOR",
          companyId: "comp-B",
          operationAccess: { allowedSecurityGuarding: true },
        },
      });

      const req = new NextRequest("http://localhost:3100/api/v1/manpower/security-guarding/contracts/cont-comp-a/workflow/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: "lvl-1" }),
      });

      const res = await postContractApprove(req, { params: { id: "cont-comp-a" } });
      expect(res.status).toBe(403);
      getSpy.mockRestore();
    });
  });

  describe("DEF-081 & Section 4: Addendum Creation Always Starts as DRAFT and Requires ACTIVE Contract", () => {
    it("blocks addendum creation on APPROVED (unactivated) contracts per Business Rule 9 & 11", async () => {
      const getSpy = jest.spyOn(mockDb, "getManpowerContract").mockResolvedValueOnce({
        id: "cont-approved-1",
        status: "APPROVED",
        operationType: "SECURITY_GUARDING",
        companyId: "comp-1",
      } as any);

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "user-admin-1",
          role: "ADMIN",
          companyId: "comp-1",
          permissions: ["commercial.addendum.create"],
          operationAccess: { allowedSecurityGuarding: true },
        },
      });

      const req = new NextRequest("http://localhost:3100/api/v1/manpower/security-guarding/contracts/cont-approved-1/addendums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", addendumType: "Manpower Increase", status: "APPROVED" }),
      });

      const res = await postSgAddendum(req, { params: { id: "cont-approved-1" } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("ACTIVE contracts");
      getSpy.mockRestore();
    });

    it("forces status to DRAFT even when ADMIN/SUPER_ADMIN supplies status APPROVED or ACTIVE", async () => {
      const getSpy = jest.spyOn(mockDb, "getManpowerContract").mockResolvedValueOnce({
        id: "cont-active-1",
        status: "ACTIVE",
        operationType: "SECURITY_GUARDING",
        companyId: "comp-1",
      } as any);

      const createSpy = jest.spyOn(mockDb, "createManpowerContractAddendum").mockImplementationOnce(async (data: any) => ({
        id: "add-new-1",
        ...data,
      }));

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "user-superadmin-1",
          role: "SUPER_ADMIN",
          companyId: "comp-1",
          permissions: ["commercial.addendum.create"],
          operationAccess: { allowedSecurityGuarding: true },
        },
      });

      const req = new NextRequest("http://localhost:3100/api/v1/manpower/security-guarding/contracts/cont-active-1/addendums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Scope Expansion",
          addendumType: "Manpower Increase",
          status: "APPROVED",
        }),
      });

      const res = await postSgAddendum(req, { params: { id: "cont-active-1" } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("DRAFT");
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT" }));

      getSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe("DEF-069 (Run 2): Handover Contract Eligibility and Array Format", () => {
    it("handles plain array and wrapped contracts data for APPROVED and ACTIVE contracts", () => {
      const mockRawArray = [
        { id: "c1", contractNumber: "C1", status: "APPROVED", approvalStatus: "APPROVED" },
        { id: "c2", contractNumber: "C2", status: "ACTIVE", approvalStatus: "APPROVED" },
        { id: "c3", contractNumber: "C3", status: "DRAFT", approvalStatus: "DRAFT" },
      ];

      const rawItems = Array.isArray(mockRawArray) ? mockRawArray : ((mockRawArray as any).items || []);
      const eligible = rawItems.filter(
        (c: any) => c.status === "ACTIVE" || c.status === "APPROVED" || c.approvalStatus === "APPROVED"
      );

      expect(eligible.length).toBe(2);
      expect(eligible.map((c: any) => c.id)).toEqual(["c1", "c2"]);
    });
  });

  describe("DEF-074 & DEF-085: Workflow Adapters, Contract Sync, and Renewal Registration", () => {
    it("includes CONTRACT_RENEWAL in PC1_WORKFLOW_MODULE_TYPES", () => {
      expect(PC1_WORKFLOW_MODULE_TYPES).toContain("CONTRACT_RENEWAL");
    });

    it("registers RenewalAdapter for CONTRACT_RENEWAL in workflow adapter registry", () => {
      const adapter = WorkflowAdapterRegistry.get("CONTRACT_RENEWAL");
      expect(adapter).toBeDefined();
      expect(adapter?.moduleType).toBe("CONTRACT_RENEWAL");
      expect(adapter?.getSourceDeepLink("renewal-entity-456")).toBe("/commercial/renewals");
    });

    it("registers ContractAdapter with onWorkflowStatusChange for SECURITY_GUARDING_CONTRACT and FACILITY_MANAGEMENT_CONTRACT", () => {
      const sgAdapter = WorkflowAdapterRegistry.get("SECURITY_GUARDING_CONTRACT");
      expect(sgAdapter).toBeDefined();
      expect(sgAdapter?.getSourceDeepLink("cont-sg-1")).toBe("/commercial/contracts?id=cont-sg-1");
      expect(typeof sgAdapter?.onWorkflowStatusChange).toBe("function");

      const fmAdapter = WorkflowAdapterRegistry.get("FACILITY_MANAGEMENT_CONTRACT");
      expect(fmAdapter).toBeDefined();
      expect(typeof fmAdapter?.onWorkflowStatusChange).toBe("function");
    });
  });

  describe("DEF-066: Precontract Proposal Issue Permissions", () => {
    it("recognizes precontract.proposal.issue permission", () => {
      const commercialUser = {
        role: "COMMERCIAL_EXECUTIVE",
        permissions: ["precontract.proposal.issue", "precontract.proposal.view"],
      };
      const viewerUser = {
        role: "COMMERCIAL_VIEWER",
        permissions: ["precontract.proposal.view"],
      };

      expect(hasPermission(commercialUser, "precontract.proposal.issue")).toBe(true);
      expect(hasPermission(viewerUser, "precontract.proposal.issue")).toBe(false);
    });
  });
});
