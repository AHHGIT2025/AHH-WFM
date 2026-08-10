import { prisma } from "@ahh-wfm/database";
import { recordClientResponse, getConversionReadiness, convertToContract } from "../../apps/web/lib/contract-conversion";
import crypto from "crypto";

describe("CL-5 Client Acceptance, Award & Contract Conversion Suite", () => {
  const companyId = "CMP-COMPA-CL5-TEST";
  let clientMasterId: string;
  let caseId: string;
  let surveyId: string;
  let estimateId: string;
  let estimateVersionId: string;
  let proposalId: string;
  let proposalVersionId: string;
  let checksum: string;

  beforeAll(async () => {
    // Clean up existing test records
    await prisma.manpowerClientDocument.deleteMany({
      where: { client: { name: { contains: "CL5" } } }
    });
    await prisma.contractManpowerRequirement.deleteMany({
      where: { contract: { client: { name: { contains: "CL5" } } } }
    });
    await prisma.manpowerContract.deleteMany({
      where: { client: { name: { contains: "CL5" } } }
    });
    await prisma.preContractClientResponse.deleteMany({
      where: { proposal: { companyId } }
    });
    await prisma.proposalIssuanceLog.deleteMany({
      where: { proposalVersion: { proposal: { companyId } } }
    });
    await prisma.preContractProposalVersion.deleteMany({
      where: { proposal: { companyId } }
    });
    await prisma.preContractProposal.deleteMany({
      where: { companyId }
    });
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimate: { companyId } } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { companyId } }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { companyId }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { companyId }
    });
    await prisma.preContractCase.deleteMany({
      where: { companyId }
    });
    await prisma.manpowerClient.deleteMany({
      where: { name: { contains: "CL5" } }
    });

    // 1. Create Client Master
    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLI-CL5-${Date.now()}`,
        name: "Test Client Corporation CL5",
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    clientMasterId = client.id;

    // 2. Create Case linked to Client
    const caseRec = await prisma.preContractCase.create({
      data: {
        companyId,
        title: "CL5 Facility Security Operations Case",
        operationType: "SECURITY_GUARDING",
        existingClientId: clientMasterId,
        lifecycle: "DRAFT",
        createdBy: "ADM-CL5"
      }
    });
    caseId = caseRec.id;

    // 3. Create Survey
    const survey = await prisma.preContractSurvey.create({
      data: {
        companyId,
        caseId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });
    surveyId = survey.id;

    // 4. Create Cost Estimate & Approved Version
    const estimate = await prisma.preContractCostEstimate.create({
      data: {
        companyId,
        caseId,
        surveyId,
        operationType: "SECURITY_GUARDING",
        status: "APPROVED",
        createdBy: "ADM-CL5"
      }
    });
    estimateId = estimate.id;

    const estVersion = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId,
        versionNumber: 1,
        status: "APPROVED",
        currency: "QAR",
        totalDirectCost: 40000,
        totalIndirectCost: 10000,
        totalCost: 50000,
        targetMarginPercentage: 20,
        sellingPrice: 60000,
        createdBy: "ADM-CL5",
        items: {
          create: [
            {
              elementCode: "DIRECT_MANPOWER",
              elementName: "Security Guard Senior",
              categoryCode: "LABOR",
              quantity: 5,
              unitRate: 4200,
              totalAmount: 21000
            },
            {
              elementCode: "DIRECT_MANPOWER",
              elementName: "Security Supervisor",
              categoryCode: "LABOR",
              quantity: 2,
              unitRate: 6600,
              totalAmount: 13200
            }
          ]
        }
      }
    });
    estimateVersionId = estVersion.id;

    // 5. Create Proposal & Version
    checksum = crypto.createHash("sha256").update(`PROPOSAL-CL5-SNAPSHOT-${Date.now()}`).digest("hex");
    const proposal = await prisma.preContractProposal.create({
      data: {
        companyId,
        caseId,
        proposalCode: `PROP-CL5-${Date.now()}`,
        operationType: "SECURITY_GUARDING",
        status: "ISSUED_TO_CLIENT",
        createdBy: "ADM-CL5"
      }
    });
    proposalId = proposal.id;

    const proposalVersion = await prisma.preContractProposalVersion.create({
      data: {
        proposalId,
        versionNumber: 1,
        costEstimateId: estimateId,
        costEstimateVersionId: estimateVersionId,
        status: "ISSUED_TO_CLIENT",
        title: "CL5 Commercial Proposal for Security Guarding",
        sellingPrice: 60000,
        currency: "QAR",
        snapshotChecksum: checksum,
        snapshotJson: JSON.stringify({ items: [] }),
        createdBy: "ADM-CL5"
      }
    });
    proposalVersionId = proposalVersion.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.manpowerClientDocument.deleteMany({
      where: { client: { name: { contains: "CL5" } } }
    });
    await prisma.contractManpowerRequirement.deleteMany({
      where: { contract: { client: { name: { contains: "CL5" } } } }
    });
    await prisma.manpowerContract.deleteMany({
      where: { client: { name: { contains: "CL5" } } }
    });
    await prisma.preContractClientResponse.deleteMany({
      where: { proposal: { companyId } }
    });
    await prisma.proposalIssuanceLog.deleteMany({
      where: { proposalVersion: { proposal: { companyId } } }
    });
    await prisma.preContractProposalVersion.deleteMany({
      where: { proposal: { companyId } }
    });
    await prisma.preContractProposal.deleteMany({
      where: { companyId }
    });
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimate: { companyId } } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { companyId } }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { companyId }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { companyId }
    });
    await prisma.preContractCase.deleteMany({
      where: { companyId }
    });
    await prisma.manpowerClient.deleteMany({
      where: { name: { contains: "CL5" } }
    });
  });

  describe("1. Client Response Recording (recordClientResponse)", () => {
    it("should reject client response recording if proposal version status is not ISSUED_TO_CLIENT", async () => {
      // Create a draft version
      const draftVer = await prisma.preContractProposalVersion.create({
        data: {
          proposalId,
          versionNumber: 2,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "DRAFT",
          title: "Draft Revision",
          sellingPrice: 60000,
          currency: "QAR",
          snapshotChecksum: "draft-checksum",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      await expect(recordClientResponse({
        proposalId,
        proposalVersionId: draftVer.id,
        responseType: "ACCEPTED",
        snapshotChecksum: "draft-checksum",
        recordedById: "test-user"
      })).rejects.toThrow(/Client response can only be recorded for ISSUED_TO_CLIENT proposals/);
    });

    it("should reject client response if snapshot checksum mismatches", async () => {
      await expect(recordClientResponse({
        proposalId,
        proposalVersionId,
        responseType: "ACCEPTED",
        snapshotChecksum: "INVALID_CHECKSUM_XYZ",
        recordedById: "test-user"
      })).rejects.toThrow(/Snapshot integrity checksum mismatch/);
    });

    it("should record ACCEPTED client response successfully for ISSUED_TO_CLIENT proposal", async () => {
      const response = await recordClientResponse({
        proposalId,
        proposalVersionId,
        responseType: "ACCEPTED",
        clientContactName: "Mr. Hamad Al-Thani",
        clientReference: "PO-2026-9901",
        notes: "Approved without exceptions.",
        snapshotChecksum: checksum,
        recordedById: "test-user-01"
      });

      expect(response).toBeDefined();
      expect(response.responseType).toBe("ACCEPTED");
      expect(response.clientContactName).toBe("Mr. Hamad Al-Thani");
      expect(response.snapshotChecksum).toBe(checksum);

      // Verify ProposalVersion status remains ISSUED_TO_CLIENT
      const ver = await prisma.preContractProposalVersion.findUnique({ where: { id: proposalVersionId } });
      expect(ver?.status).toBe("ISSUED_TO_CLIENT");
    });

    it("should prevent duplicate client responses on the same proposal version (@unique proposalVersionId)", async () => {
      await expect(recordClientResponse({
        proposalId,
        proposalVersionId,
        responseType: "ACCEPTED",
        snapshotChecksum: checksum,
        recordedById: "test-user-02"
      })).rejects.toThrow(/A terminal client response has already been recorded for this proposal version/);
    });
  });

  describe("2. Conversion Readiness Gate (getConversionReadiness)", () => {
    it("should report ready = true when ACCEPTED client response exists and client master resolved", async () => {
      const readiness = await getConversionReadiness(proposalVersionId);
      expect(readiness.ready).toBe(true);
      expect(readiness.resolvedClientId).toBe(clientMasterId);
      expect(readiness.blockers).toHaveLength(0);
      expect(readiness.clientResponse?.responseType).toBe("ACCEPTED");
    });
  });

  describe("3. Contract Conversion Execution (convertToContract)", () => {
    let convertedContractId: string;

    it("should convert accepted proposal into DRAFT ManpowerContract with zero auto-activation", async () => {
      const contractNum = `CON-CL5-${Date.now()}`;
      const result = await convertToContract({
        proposalVersionId,
        contractNumber: contractNum,
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        clientId: clientMasterId,
        billingBasis: "MONTHLY",
        totalContractValue: 720000,
        userId: "test-user"
      });

      expect(result.alreadyConverted).toBe(false);
      const contract = result.contract;
      convertedContractId = contract.id;

      expect(contract.contractNumber).toBe(contractNum);
      expect(contract.status).toBe("DRAFT");
      expect(contract.approvalStatus).toBe("DRAFT");
      expect(contract.currency).toBe("QAR");
      expect(contract.sourceClientResponseId).toBeDefined();
      expect(contract.sourceProposalVersionId).toBe(proposalVersionId);
      expect(contract.sourceSnapshotChecksum).toBe(checksum);
      expect(contract.totalContractValue).toBe(720000);

      // Verify requirements inherited
      expect(contract.manpowerRequirements).toHaveLength(2);
      const guardReq = contract.manpowerRequirements.find((r: any) => r.position === "Security Guard Senior");
      expect(guardReq).toBeDefined();
      expect(guardReq.quantity).toBe(5);
      expect(guardReq.billingEligible).toBe(true);
      expect(guardReq.focStatus).toBe("NOT_APPLICABLE");
    });

    it("should enforce duplicate conversion protection (Idempotency: returns existing contract on 2nd call)", async () => {
      const result = await convertToContract({
        proposalVersionId,
        contractNumber: `CON-DUPLICATE-${Date.now()}`,
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        clientId: clientMasterId,
        userId: "test-user"
      });

      expect(result.alreadyConverted).toBe(true);
      expect(result.contract.id).toBe(convertedContractId);
    });

    it("should prevent duplicate contractNumber across system", async () => {
      // Create a fresh accepted version
      const p2 = await prisma.preContractProposal.create({
        data: { companyId, caseId, proposalCode: `PROP-CL5-2-${Date.now()}`, status: "ISSUED_TO_CLIENT", createdBy: "ADM-CL5" }
      });
      const v2 = await prisma.preContractProposalVersion.create({
        data: {
          proposalId: p2.id,
          versionNumber: 1,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "Proposal 2",
          sellingPrice: 50000,
          currency: "QAR",
          snapshotChecksum: "checksum-v2",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });
      await recordClientResponse({
        proposalId: p2.id,
        proposalVersionId: v2.id,
        responseType: "ACCEPTED",
        snapshotChecksum: "checksum-v2",
        recordedById: "test-user"
      });

      // Fetch the contract number of the first converted contract
      const existingContract = await prisma.manpowerContract.findUnique({ where: { id: convertedContractId } });

      await expect(convertToContract({
        proposalVersionId: v2.id,
        contractNumber: existingContract!.contractNumber,
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        clientId: clientMasterId,
        userId: "test-user"
      })).rejects.toThrow(/already in use/);
    });
  });
});
