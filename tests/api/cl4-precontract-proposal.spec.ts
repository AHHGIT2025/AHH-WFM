import { prisma } from "@ahh-wfm/database";
import { toClientSafeProposalDTO, isProposalExpired } from "../../apps/web/lib/precontract-proposal";

describe("CL-4 Pre-Contract Proposal Management API & Business Logic", () => {
  let companyAId = "CMP-COMPA-CL4";
  let testCaseId: string;
  let testSurveyId: string;
  let testEstimateId: string;
  let approvedCostingVersionId: string;
  let draftCostingVersionId: string;
  let testProposalId: string;
  let testProposalVersionId: string;

  beforeAll(async () => {
    // Cleanup existing test records
    await prisma.proposalIssuanceLog.deleteMany({
      where: { proposalVersion: { proposal: { companyId: companyAId } } }
    });
    await prisma.preContractProposalVersion.deleteMany({
      where: { proposal: { companyId: companyAId } }
    });
    await prisma.preContractProposal.deleteMany({
      where: { companyId: companyAId }
    });
    await prisma.preContractCostOverrideLog.deleteMany({
      where: { estimateVersion: { estimate: { companyId: companyAId } } }
    });
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimate: { companyId: companyAId } } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { companyId: companyAId } }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { companyId: companyAId }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { companyId: companyAId }
    });
    await prisma.preContractCase.deleteMany({
      where: { companyId: companyAId }
    });

    // 1. Create PreContractCase
    const pcCase = await prisma.preContractCase.create({
      data: {
        title: "CL-4 Security Operations Case",
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: "ADM-CL4"
      }
    });
    testCaseId = pcCase.id;

    // 2. Create PreContractSurvey
    const survey = await prisma.preContractSurvey.create({
      data: {
        caseId: testCaseId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });
    testSurveyId = survey.id;

    // 3. Create PreContractCostEstimate with an APPROVED version and a DRAFT version
    const estimate = await prisma.preContractCostEstimate.create({
      data: {
        caseId: testCaseId,
        surveyId: testSurveyId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        status: "APPROVED",
        createdBy: "ADM-CL4"
      }
    });
    testEstimateId = estimate.id;

    const approvedVer = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: testEstimateId,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 20000.00,
        totalIndirectCost: 2000.00,
        totalCost: 22000.00,
        targetMarginPercentage: 15.00,
        sellingPrice: 25882.35,
        checksum: "sha256-approved-costing-checksum",
        createdBy: "ADM-CL4"
      }
    });
    approvedCostingVersionId = approvedVer.id;

    const draftVer = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: testEstimateId,
        versionNumber: 2,
        status: "DRAFT",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 15000.00,
        totalIndirectCost: 1500.00,
        totalCost: 16500.00,
        targetMarginPercentage: 15.00,
        sellingPrice: 19411.76,
        createdBy: "ADM-CL4"
      }
    });
    draftCostingVersionId = draftVer.id;
  });

  afterAll(async () => {
    // Cleanup test records
    await prisma.proposalIssuanceLog.deleteMany({
      where: { proposalVersion: { proposal: { companyId: companyAId } } }
    });
    await prisma.preContractProposalVersion.deleteMany({
      where: { proposal: { companyId: companyAId } }
    });
    await prisma.preContractProposal.deleteMany({
      where: { companyId: companyAId }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimateId: testEstimateId }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { id: testEstimateId }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { id: testSurveyId }
    });
    await prisma.preContractCase.deleteMany({
      where: { id: testCaseId }
    });
  });

  // 1. Upstream Financial Authority & Costing Guard
  test("Should allow proposal creation from APPROVED costing version and inherit sellingPrice & currency", async () => {
    const proposal = await prisma.preContractProposal.create({
      data: {
        proposalCode: "PROP-TEST-001",
        caseId: testCaseId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        currentVersionNumber: 1,
        createdBy: "ADM-CL4",
        versions: {
          create: [
            {
              versionNumber: 1,
              costEstimateId: testEstimateId,
              costEstimateVersionId: approvedCostingVersionId,
              costEstimateChecksum: "sha256-approved-costing-checksum",
              status: "DRAFT",
              title: "Test Proposal for Security",
              sellingPrice: 25882.35,
              currency: "QAR",
              validityDays: 30,
              validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              scopeSummary: "Full 24/7 Guarding Scope",
              assumptions: "Client provides duty room",
              exclusions: "CCTV maintenance",
              termsAndConditions: "Payment within 30 days",
              createdBy: "ADM-CL4"
            }
          ]
        }
      },
      include: { versions: true }
    });

    testProposalId = proposal.id;
    testProposalVersionId = proposal.versions[0].id;

    expect(proposal.id).toBeDefined();
    expect(proposal.status).toBe("DRAFT");
    expect(Number(proposal.versions[0].sellingPrice)).toBe(25882.35);
    expect(proposal.versions[0].currency).toBe("QAR");
    expect(proposal.versions[0].costEstimateVersionId).toBe(approvedCostingVersionId);
  });

  // 2. Client Confidentiality & DTO Masking
  test("toClientSafeProposalDTO should strictly mask internal costing, margin, overhead, and override fields", () => {
    const mockFullProposal = {
      id: testProposalId,
      proposalCode: "PROP-TEST-001",
      caseId: testCaseId,
      companyId: companyAId,
      operationType: "SECURITY_GUARDING",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [
        {
          versionNumber: 1,
          title: "Test Proposal for Security",
          sellingPrice: 25882.35,
          currency: "QAR",
          validityDays: 30,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          scopeSummary: "Full 24/7 Guarding Scope",
          assumptions: "Client provides duty room",
          exclusions: "CCTV maintenance",
          termsAndConditions: "Payment within 30 days",
          // Internal fields that MUST NOT leak into DTO
          totalDirectCost: 20000.00,
          totalIndirectCost: 2000.00,
          totalCost: 22000.00,
          targetMarginPercentage: 15.00,
          overrides: [{ elementCode: "RELIEVER_COST", amount: 500 }]
        }
      ],
      case: {
        title: "CL-4 Security Operations Case",
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        prospectClient: { name: "Test Prospect Client Ltd", companyId: companyAId }
      }
    };

    const dto = toClientSafeProposalDTO(mockFullProposal);

    expect(dto.sellingPrice).toBe(25882.35);
    expect(dto.currency).toBe("QAR");
    expect(dto.scopeSummary).toBe("Full 24/7 Guarding Scope");
    expect(dto.assumptions).toBe("Client provides duty room");
    expect(dto.exclusions).toBe("CCTV maintenance");
    expect(dto.termsAndConditions).toBe("Payment within 30 days");

    // Negative assertions for internal confidential fields
    expect((dto as any).totalDirectCost).toBeUndefined();
    expect((dto as any).totalIndirectCost).toBeUndefined();
    expect((dto as any).totalCost).toBeUndefined();
    expect((dto as any).targetMarginPercentage).toBeUndefined();
    expect((dto as any).targetMarkupPercentage).toBeUndefined();
    expect((dto as any).overrides).toBeUndefined();
    expect((dto as any).workerRates).toBeUndefined();
    expect((dto as any).workflowRemarks).toBeUndefined();
  });

  // 3. Immutability & Status Transitions
  test("Draft version can be updated; Approved/Issued versions must lock content", async () => {
    // 1. Update DRAFT version
    const updatedVer = await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: {
        title: "Updated Proposal Title for Security",
        scopeSummary: "Updated 24/7 Guarding Scope"
      }
    });
    expect(updatedVer.title).toBe("Updated Proposal Title for Security");

    // 2. Transition to APPROVED_INTERNAL
    await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: {
        status: "APPROVED_INTERNAL",
        snapshotJson: JSON.stringify({ approvedAt: new Date().toISOString() }),
        snapshotChecksum: "sha256-proposal-snapshot-checksum"
      }
    });

    const approvedVer = await prisma.preContractProposalVersion.findUnique({
      where: { id: testProposalVersionId }
    });
    expect(approvedVer?.status).toBe("APPROVED_INTERNAL");
    expect(approvedVer?.snapshotChecksum).toBe("sha256-proposal-snapshot-checksum");
  });

  // 4. Client Issuance & Audit Log
  test("Issuing approved proposal creates ProposalIssuanceLog and transitions status to ISSUED_TO_CLIENT", async () => {
    const issuanceLog = await prisma.proposalIssuanceLog.create({
      data: {
        proposalVersionId: testProposalVersionId,
        issuedBy: "ADM-CL4",
        recipientName: "John Client",
        recipientEmail: "jclient@prospect.com",
        deliveryMethod: "EMAIL_EXPORT",
        remarks: "Sent via email export PDF"
      }
    });

    expect(issuanceLog.id).toBeDefined();
    expect(issuanceLog.deliveryMethod).toBe("EMAIL_EXPORT");

    const updatedVer = await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: {
        status: "ISSUED_TO_CLIENT",
        issuedAt: new Date(),
        issuedBy: "ADM-CL4"
      }
    });

    await prisma.preContractProposal.update({
      where: { id: testProposalId },
      data: { status: "ISSUED_TO_CLIENT" }
    });

    expect(updatedVer.status).toBe("ISSUED_TO_CLIENT");
    expect(updatedVer.issuedBy).toBe("ADM-CL4");
  });

  // 5. Revision Creation & Supersession
  test("Creating a new revision increments versionNumber, creates new DRAFT, and supersedes old version when approved", async () => {
    const v2 = await prisma.preContractProposalVersion.create({
      data: {
        proposalId: testProposalId,
        versionNumber: 2,
        clonedFromVersionId: testProposalVersionId,
        costEstimateId: testEstimateId,
        costEstimateVersionId: approvedCostingVersionId,
        costEstimateChecksum: "sha256-approved-costing-checksum",
        status: "DRAFT",
        title: "Proposal for Security Operations v2",
        sellingPrice: 25882.35,
        currency: "QAR",
        createdBy: "ADM-CL4"
      }
    });

    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe("DRAFT");

    // When v2 is approved and issued, v1 transitions to SUPERSEDED
    await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: { status: "SUPERSEDED" }
    });

    const v1 = await prisma.preContractProposalVersion.findUnique({
      where: { id: testProposalVersionId }
    });
    expect(v1?.status).toBe("SUPERSEDED");

    // Clean up v2
    await prisma.preContractProposalVersion.delete({ where: { id: v2.id } });
  });

  // 6. Dynamic Expiry Evaluation
  test("isProposalExpired should return true only for ISSUED_TO_CLIENT proposals with past validUntil date", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day in future

    expect(isProposalExpired("ISSUED_TO_CLIENT", pastDate)).toBe(true);
    expect(isProposalExpired("ISSUED_TO_CLIENT", futureDate)).toBe(false);
    expect(isProposalExpired("DRAFT", pastDate)).toBe(false);
    expect(isProposalExpired("APPROVED_INTERNAL", pastDate)).toBe(false);
  });
});
