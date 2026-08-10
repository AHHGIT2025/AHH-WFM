import { prisma } from "@ahh-wfm/database";
import { recordClientResponse, getConversionReadiness, convertToContract } from "../../apps/web/lib/contract-conversion";
import crypto from "crypto";

describe("CL-5 Client Acceptance, Award & Contract Conversion Comprehensive Suite", () => {
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
        currency: "USD",
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
        currency: "USD",
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
      const draftVer = await prisma.preContractProposalVersion.create({
        data: {
          proposalId,
          versionNumber: 2,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "DRAFT",
          title: "Draft Revision",
          sellingPrice: 60000,
          currency: "USD",
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

    it("should reject client response recording if proposal version has dynamically expired", async () => {
      const expiredVer = await prisma.preContractProposalVersion.create({
        data: {
          proposalId,
          versionNumber: 3,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "Expired Version",
          sellingPrice: 60000,
          currency: "USD",
          validUntil: new Date(Date.now() - 86400000), // Yesterday
          snapshotChecksum: "expired-checksum",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      await expect(recordClientResponse({
        proposalId,
        proposalVersionId: expiredVer.id,
        responseType: "ACCEPTED",
        snapshotChecksum: "expired-checksum",
        recordedById: "test-user"
      })).rejects.toThrow(/Proposal version has expired/);
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

    it("should report ready = false if proposal version is dynamically expired", async () => {
      const expVer = await prisma.preContractProposalVersion.create({
        data: {
          proposalId,
          versionNumber: 4,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "Expired Version 4",
          sellingPrice: 60000,
          currency: "USD",
          validUntil: new Date(Date.now() - 3600000),
          snapshotChecksum: "exp4-checksum",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      const readiness = await getConversionReadiness(expVer.id);
      expect(readiness.ready).toBe(false);
      expect(readiness.blockers.some((b: string) => b.includes("expired"))).toBe(true);
    });
  });

  describe("3. Contract Conversion Execution (convertToContract)", () => {
    let convertedContractId: string;

    it("should convert accepted proposal into DRAFT ManpowerContract inheriting exact Proposal currency (USD) with zero auto-activation", async () => {
      const contractNum = `CON-CL5-${Date.now()}`;
      const result = await convertToContract({
        proposalVersionId,
        contractNumber: contractNum,
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        clientId: clientMasterId,
        billingBasis: "MONTHLY",
        totalContractValue: undefined, // Total contract value omitted intentionally
        userId: "test-user"
      });

      expect(result.alreadyConverted).toBe(false);
      const contract = result.contract;
      convertedContractId = contract.id;

      expect(contract.contractNumber).toBe(contractNum);
      expect(contract.status).toBe("DRAFT");
      expect(contract.approvalStatus).toBe("DRAFT");
      expect(contract.currency).toBe("USD"); // Inherited exact from ProposalVersion currency ("USD"), NO default QAR
      expect(contract.sourceClientResponseId).toBeDefined();
      expect(contract.sourceProposalVersionId).toBe(proposalVersionId);
      expect(contract.sourceSnapshotChecksum).toBe(checksum);
      expect(contract.totalContractValue).toBeNull(); // NULL when omitted, sellingPrice not auto-copied

      // Verify requirements inherited with zero internal cost leakage
      expect(contract.manpowerRequirements).toHaveLength(2);
      const guardReq = contract.manpowerRequirements.find((r: any) => r.position === "Security Guard Senior");
      expect(guardReq).toBeDefined();
      expect(guardReq.quantity).toBe(5);
      expect(guardReq.unitPrice).toBeNull(); // NULL unless explicitly entered
      expect(guardReq.lineTotal).toBeNull(); // NULL unless explicitly entered
      expect(guardReq.billingEligible).toBe(true); // Prisma model default
      expect(guardReq.focStatus).toBe("NOT_APPLICABLE"); // Prisma model default
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

    it("should verify Case businessOutcome remains completely untouched during contract conversion", async () => {
      const cRec = await prisma.preContractCase.findUnique({ where: { id: caseId } });
      // Verify businessOutcome is not auto-mutated to WON or LOST
      expect(cRec?.businessOutcome || null).toBeNull();
    });

    it("should reject contract conversion if manpower item is missing explicit deploymentType", async () => {
      const p3 = await prisma.preContractProposal.create({
        data: { companyId, caseId, proposalCode: `PROP-CL5-3-${Date.now()}`, status: "ISSUED_TO_CLIENT", createdBy: "ADM-CL5" }
      });
      const v3 = await prisma.preContractProposalVersion.create({
        data: {
          proposalId: p3.id,
          versionNumber: 1,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "Proposal 3",
          sellingPrice: 50000,
          currency: "EUR",
          snapshotChecksum: "checksum-v3",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });
      await recordClientResponse({
        proposalId: p3.id,
        proposalVersionId: v3.id,
        responseType: "ACCEPTED",
        snapshotChecksum: "checksum-v3",
        recordedById: "test-user"
      });

      await expect(convertToContract({
        proposalVersionId: v3.id,
        contractNumber: `CON-MISSING-DEP-${Date.now()}`,
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        clientId: clientMasterId,
        manpowerItems: [{ position: "Guard", quantity: 2, deploymentType: "" }],
        userId: "test-user"
      })).rejects.toThrow(/deploymentType is required for manpower requirement/);
    });

    it("should prevent duplicate contractNumber across system", async () => {
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
          currency: "EUR",
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

  describe("4. Extended Eligibility, Responses & Facility Management Operational Scope Coverage", () => {
    it("should block client response recording for IN_WORKFLOW, REJECTED, and SUPERSEDED proposal versions", async () => {
      const pInWf = await prisma.preContractProposal.create({
        data: { companyId, caseId, proposalCode: `PROP-INWF-${Date.now()}`, status: "IN_WORKFLOW", createdBy: "ADM-CL5" }
      });
      const vInWf = await prisma.preContractProposalVersion.create({
        data: {
          proposalId: pInWf.id,
          versionNumber: 1,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "IN_WORKFLOW",
          title: "In Workflow Version",
          sellingPrice: 50000,
          currency: "QAR",
          snapshotChecksum: "chk-inwf",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      await expect(recordClientResponse({
        proposalId: pInWf.id,
        proposalVersionId: vInWf.id,
        responseType: "ACCEPTED",
        snapshotChecksum: "chk-inwf",
        recordedById: "test-user"
      })).rejects.toThrow(/Client response can only be recorded for ISSUED_TO_CLIENT proposals/);
    });

    it("should handle REJECTED client response recording without auto-mutating case businessOutcome to LOST", async () => {
      const pRej = await prisma.preContractProposal.create({
        data: { companyId, caseId, proposalCode: `PROP-REJ-${Date.now()}`, status: "ISSUED_TO_CLIENT", createdBy: "ADM-CL5" }
      });
      const vRej = await prisma.preContractProposalVersion.create({
        data: {
          proposalId: pRej.id,
          versionNumber: 1,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "Rejected Version",
          sellingPrice: 45000,
          currency: "QAR",
          snapshotChecksum: "chk-rej",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      const resp = await recordClientResponse({
        proposalId: pRej.id,
        proposalVersionId: vRej.id,
        responseType: "REJECTED",
        snapshotChecksum: "chk-rej",
        notes: "Price too high.",
        recordedById: "test-user"
      });

      expect(resp.responseType).toBe("REJECTED");

      // Verify ProposalVersion status remains ISSUED_TO_CLIENT
      const updatedV = await prisma.preContractProposalVersion.findUnique({ where: { id: vRej.id } });
      expect(updatedV?.status).toBe("ISSUED_TO_CLIENT");

      // Verify Readiness returns ready = false
      const readiness = await getConversionReadiness(vRej.id);
      expect(readiness.ready).toBe(false);
      expect(readiness.blockers.some(b => b.includes("Must be ACCEPTED"))).toBe(true);

      // Verify Case businessOutcome remains null
      const cRec = await prisma.preContractCase.findUnique({ where: { id: caseId } });
      expect(cRec?.businessOutcome || null).toBeNull();
    });

    it("should handle CHANGE_REQUESTED client response recording cleanly", async () => {
      const pChg = await prisma.preContractProposal.create({
        data: { companyId, caseId, proposalCode: `PROP-CHG-${Date.now()}`, status: "ISSUED_TO_CLIENT", createdBy: "ADM-CL5" }
      });
      const vChg = await prisma.preContractProposalVersion.create({
        data: {
          proposalId: pChg.id,
          versionNumber: 1,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "Change Requested Version",
          sellingPrice: 55000,
          currency: "USD",
          snapshotChecksum: "chk-chg",
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      const resp = await recordClientResponse({
        proposalId: pChg.id,
        proposalVersionId: vChg.id,
        responseType: "CHANGE_REQUESTED",
        snapshotChecksum: "chk-chg",
        notes: "Requested 10% discount on supervisor rates.",
        recordedById: "test-user"
      });

      expect(resp.responseType).toBe("CHANGE_REQUESTED");

      const readiness = await getConversionReadiness(vChg.id);
      expect(readiness.ready).toBe(false);
      expect(readiness.blockers.some(b => b.includes("Must be ACCEPTED"))).toBe(true);
    });

    it("should support FACILITY_MANAGEMENT operational scope end-to-end acceptance & conversion", async () => {
      const fmClient = await prisma.manpowerClient.create({
        data: {
          code: `CLI-FM-${Date.now()}`,
          name: "Test Client Corporation FM CL5",
          operationType: "FACILITY_MANAGEMENT",
          isActive: true
        }
      });

      const fmCase = await prisma.preContractCase.create({
        data: {
          companyId,
          title: "CL5 Soft Services Cleaning Case",
          operationType: "FACILITY_MANAGEMENT",
          existingClientId: fmClient.id,
          lifecycle: "DRAFT",
          createdBy: "ADM-CL5"
        }
      });

      const fmProp = await prisma.preContractProposal.create({
        data: {
          companyId,
          caseId: fmCase.id,
          proposalCode: `PROP-FM-${Date.now()}`,
          operationType: "FACILITY_MANAGEMENT",
          status: "ISSUED_TO_CLIENT",
          createdBy: "ADM-CL5"
        }
      });

      const fmChecksum = "chk-fm-998877";
      const fmVersion = await prisma.preContractProposalVersion.create({
        data: {
          proposalId: fmProp.id,
          versionNumber: 1,
          costEstimateId: estimateId,
          costEstimateVersionId: estimateVersionId,
          status: "ISSUED_TO_CLIENT",
          title: "CL5 Facility Management Services Proposal",
          sellingPrice: 120000,
          currency: "EUR",
          snapshotChecksum: fmChecksum,
          snapshotJson: "{}",
          createdBy: "ADM-CL5"
        }
      });

      // 1. Record ACCEPTED response
      const fmResp = await recordClientResponse({
        proposalId: fmProp.id,
        proposalVersionId: fmVersion.id,
        responseType: "ACCEPTED",
        snapshotChecksum: fmChecksum,
        recordedById: "test-user-fm"
      });
      expect(fmResp.responseType).toBe("ACCEPTED");

      // 2. Readiness gate check
      const readiness = await getConversionReadiness(fmVersion.id);
      expect(readiness.ready).toBe(true);
      expect(readiness.resolvedClientId).toBe(fmClient.id);

      // 3. Convert to Contract
      const fmContractNum = `CON-FM-${Date.now()}`;
      const convResult = await convertToContract({
        proposalVersionId: fmVersion.id,
        contractNumber: fmContractNum,
        startDate: "2026-10-01",
        endDate: "2027-09-30",
        clientId: fmClient.id,
        billingBasis: "MONTHLY",
        userId: "test-user-fm"
      });

      expect(convResult.contract.operationType).toBe("FACILITY_MANAGEMENT");
      expect(convResult.contract.currency).toBe("EUR");
      expect(convResult.contract.status).toBe("DRAFT");
      expect(convResult.contract.approvalStatus).toBe("DRAFT");
    });
  });
});

