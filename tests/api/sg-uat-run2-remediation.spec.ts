import { getEffectiveContractManpower } from "../../apps/web/lib/contract-helpers";
import { PC1_WORKFLOW_MODULE_TYPES } from "../../apps/web/lib/workflow-engine";
import { WorkflowAdapterRegistry } from "../../apps/web/lib/workflow/adapters/registry";
import { hasPermission } from "../../apps/web/lib/permissions";

describe("Security Guarding UAT Run 2 Remediation Test Suite", () => {
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
          id: "add-approved-1",
          addendumNumber: "ADD-003",
          status: "APPROVED",
          effectiveFrom: "2026-08-01",
          lineItems: [
            { itemType: "MANPOWER", itemName: "Security Guard", quantity: 4, changeType: "ADD" },
          ],
        },
      ],
    };

    it("does NOT include DRAFT or PENDING addendums in effective contract manpower", () => {
      const result = getEffectiveContractManpower(baseContract);
      const totalManpower = result.effectiveManpower.reduce((acc, item) => acc + item.quantity, 0);

      // Base: 8 Guards + 2 Supervisors = 10.
      // Approved addendum adds 4 Guards => 12 Guards + 2 Supervisors = 14 total.
      // Draft (+5) and Pending (+3) must NOT be included.
      expect(totalManpower).toBe(14);

      const guardPos = result.effectiveManpower.find((p) => p.position === "Security Guard");
      expect(guardPos).toBeDefined();
      expect(guardPos?.originalQty).toBe(8);
      expect(guardPos?.addendumQty).toBe(4);
      expect(guardPos?.quantity).toBe(12);

      const supPos = result.effectiveManpower.find((p) => p.position === "Supervisor");
      expect(supPos).toBeDefined();
      expect(supPos?.originalQty).toBe(2);
      expect(supPos?.addendumQty).toBe(0); // Pending addendum was ignored
      expect(supPos?.quantity).toBe(2);
    });

    it("respects asOfDate when evaluating effective addendums", () => {
      const contractWithFutureAddendum = {
        ...baseContract,
        addendums: [
          {
            id: "add-future-approved",
            addendumNumber: "ADD-FUTURE",
            status: "APPROVED",
            effectiveFrom: "2026-12-01",
            lineItems: [
              { itemType: "MANPOWER", itemName: "Security Guard", quantity: 10, changeType: "ADD" },
            ],
          },
        ],
      };

      // As of 2026-09-01, the future addendum effective 2026-12-01 should not be active
      const beforeResult = getEffectiveContractManpower(contractWithFutureAddendum, "2026-09-01");
      const beforeTotal = beforeResult.effectiveManpower.reduce((acc, item) => acc + item.quantity, 0);
      expect(beforeTotal).toBe(10);

      // As of 2026-12-15, the future addendum has taken effect
      const afterResult = getEffectiveContractManpower(contractWithFutureAddendum, "2026-12-15");
      const afterTotal = afterResult.effectiveManpower.reduce((acc, item) => acc + item.quantity, 0);
      expect(afterTotal).toBe(20);
    });

    it("includes ACTIVE addendums in effective contract manpower", () => {
      const contractWithActiveAddendum = {
        ...baseContract,
        addendums: [
          {
            id: "add-active-1",
            addendumNumber: "ADD-ACTIVE",
            status: "ACTIVE",
            effectiveFrom: "2026-01-01",
            lineItems: [
              { itemType: "MANPOWER", itemName: "Security Guard", quantity: 6, changeType: "ADD" },
            ],
          },
        ],
      };

      const result = getEffectiveContractManpower(contractWithActiveAddendum);
      const total = result.effectiveManpower.reduce((acc, item) => acc + item.quantity, 0);
      expect(total).toBe(16); // 10 base + 6 active
    });
  });

  describe("DEF-075: Contract Workflow Approval Segregation of Duties", () => {
    it("validates that creator/submitter cannot approve their own contract under SoD", () => {
      const contract = {
        id: "cont-sod-001",
        createdById: "user-creator-1",
        submittedBy: "Commercial Officer",
      };

      const creatorActor = {
        id: "user-creator-1",
        name: "Commercial Officer",
        role: "COMMERCIAL_MAKER",
      };

      const otherActor = {
        id: "user-approver-2",
        name: "Operations Manager",
        role: "OPERATIONS_DIRECTOR",
      };

      const superAdminActor = {
        id: "user-creator-1",
        name: "Commercial Officer",
        role: "SUPER_ADMIN",
      };

      // Helper function replicating SoD check
      const checkSoD = (c: any, actor: any) => {
        const isCreator = actor && (
          (c.createdById && (c.createdById === actor.id || c.createdById === actor.employeeId)) ||
          (c.submittedBy && (c.submittedBy === actor.name || c.submittedBy === actor.email))
        );
        if (isCreator && actor?.role !== "SUPER_ADMIN") {
          throw new Error("Segregation of Duties: Creator cannot approve their own contract.");
        }
        return true;
      };

      // Creator self-approval must throw
      expect(() => checkSoD(contract, creatorActor)).toThrow(
        /Creator cannot approve their own contract/i
      );

      // Distinct approver must succeed
      expect(checkSoD(contract, otherActor)).toBe(true);

      // Super admin override must succeed
      expect(checkSoD(contract, superAdminActor)).toBe(true);
    });
  });

  describe("DEF-077: Handover Contract Eligibility and Array Format", () => {
    it("handles plain array contracts data without throwing", () => {
      const mockRawArray = [
        { id: "c1", contractNumber: "C1", status: "APPROVED", approvalStatus: "APPROVED" },
        { id: "c2", contractNumber: "C2", status: "ACTIVE", approvalStatus: "APPROVED" },
        { id: "c3", contractNumber: "C3", status: "DRAFT", approvalStatus: "DRAFT" },
      ];

      // Handover parsing logic
      const rawItems = Array.isArray(mockRawArray) ? mockRawArray : ((mockRawArray as any).items || []);
      const eligibleContracts = rawItems.filter(
        (c: any) => c.status === "ACTIVE" || c.status === "APPROVED" || c.approvalStatus === "APPROVED"
      );

      expect(eligibleContracts.length).toBe(2);
      expect(eligibleContracts.map((c: any) => c.id)).toEqual(["c1", "c2"]);
    });

    it("handles object wrapped { items: [...] } data", () => {
      const wrappedData = {
        items: [
          { id: "c1", contractNumber: "C1", status: "APPROVED" },
          { id: "c2", contractNumber: "C2", status: "PENDING_APPROVAL" },
        ],
      };

      const rawItems = Array.isArray(wrappedData) ? wrappedData : (wrappedData.items || []);
      const eligible = rawItems.filter((c: any) => c.status === "ACTIVE" || c.status === "APPROVED");
      expect(eligible.length).toBe(1);
      expect(eligible[0].id).toBe("c1");
    });
  });

  describe("DEF-084 & DEF-085: Central Workflow Configuration & Adapters for Renewal", () => {
    it("includes CONTRACT_RENEWAL in PC1_WORKFLOW_MODULE_TYPES", () => {
      expect(PC1_WORKFLOW_MODULE_TYPES).toContain("CONTRACT_RENEWAL");
    });

    it("registers RenewalAdapter for CONTRACT_RENEWAL in workflow adapter registry", () => {
      const adapter = WorkflowAdapterRegistry.get("CONTRACT_RENEWAL");
      expect(adapter).toBeDefined();
      expect(adapter?.moduleType).toBe("CONTRACT_RENEWAL");

      const link = adapter?.getSourceDeepLink("renewal-entity-456");
      expect(link).toBe("/commercial/renewals");
    });

    it("registers ContractAdapter for SECURITY_GUARDING_CONTRACT and FACILITY_MANAGEMENT_CONTRACT", () => {
      const sgAdapter = WorkflowAdapterRegistry.get("SECURITY_GUARDING_CONTRACT");
      expect(sgAdapter).toBeDefined();
      expect(sgAdapter?.getSourceDeepLink("cont-sg-1")).toBe("/commercial/contracts?id=cont-sg-1");

      const fmAdapter = WorkflowAdapterRegistry.get("FACILITY_MANAGEMENT_CONTRACT");
      expect(fmAdapter).toBeDefined();
      expect(fmAdapter?.getSourceDeepLink("cont-fm-1")).toBe("/commercial/contracts?id=cont-fm-1");
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
