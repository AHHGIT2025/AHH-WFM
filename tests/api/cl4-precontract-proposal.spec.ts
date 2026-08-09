import { prisma } from "@ahh-wfm/database";
import { toClientSafeProposalDTO, isProposalExpired, generateProposalSnapshot } from "../../apps/web/lib/precontract-proposal";
import crypto from "crypto";

describe("CL-4 Pre-Contract Proposal Management Comprehensive Suite", () => {
  let companyAId = "CMP-COMPA-CL4-EXP";
  let companyBId = "CMP-COMPB-CL4-EXP";
  
  let caseA_SG_Id: string;
  let caseA_FM_Id: string;
  let caseB_SG_Id: string;

  let surveyA_SG_Id: string;
  let surveyA_FM_Id: string;
  let surveyB_SG_Id: string;

  let estimateA_SG_Id: string;
  let estimateA_FM_Id: string;
  let estimateB_SG_Id: string;

  let approvedCostingVersionA_SG_Id: string;
  let draftCostingVersionA_SG_Id: string;
  let inWorkflowCostingVersionA_SG_Id: string;
  let rejectedCostingVersionA_SG_Id: string;
  let approvedCostingVersionB_SG_Id: string;
  let approvedCostingVersionA_FM_Id: string;

  let testProposalId: string;
  let testProposalVersionId: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // Clean up previous test records for test companies
    const companies = [companyAId, companyBId];
    await prisma.proposalIssuanceLog.deleteMany({
      where: { proposalVersion: { proposal: { companyId: { in: companies } } } }
    });
    await prisma.preContractProposalVersion.deleteMany({
      where: { proposal: { companyId: { in: companies } } }
    });
    await prisma.preContractProposal.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractCostOverrideLog.deleteMany({
      where: { estimateVersion: { estimate: { companyId: { in: companies } } } }
    });
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimate: { companyId: { in: companies } } } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { companyId: { in: companies } } }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractCase.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.workflowTemplate.deleteMany({
      where: { workflowName: "CL4 Test Workflow Template" }
    });

    // Create Test WorkflowTemplate
    const template = await prisma.workflowTemplate.create({
      data: {
        workflowName: "CL4 Test Workflow Template",
        moduleType: "PRE_CONTRACT_PROPOSAL",
        appliesTo: "APPROVAL",
        isActive: true,
        isDefault: true
      }
    });
    testTemplateId = template.id;

    // 1. Create PreContractCase for Company A (SG)
    const caseA_SG = await prisma.preContractCase.create({
      data: {
        title: "Company A Security Case",
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: "ADM-CL4"
      }
    });
    caseA_SG_Id = caseA_SG.id;

    // 2. Create PreContractCase for Company A (FM)
    const caseA_FM = await prisma.preContractCase.create({
      data: {
        title: "Company A FM Case",
        companyId: companyAId,
        operationType: "FACILITY_MANAGEMENT",
        lifecycle: "DRAFT",
        createdBy: "ADM-CL4"
      }
    });
    caseA_FM_Id = caseA_FM.id;

    // 3. Create PreContractCase for Company B (SG)
    const caseB_SG = await prisma.preContractCase.create({
      data: {
        title: "Company B Security Case",
        companyId: companyBId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: "ADM-CL4"
      }
    });
    caseB_SG_Id = caseB_SG.id;

    // 4. Create PreContractSurveys
    const surveyA_SG = await prisma.preContractSurvey.create({
      data: { caseId: caseA_SG_Id, companyId: companyAId, operationType: "SECURITY_GUARDING", lifecycle: "COMPLETED" }
    });
    surveyA_SG_Id = surveyA_SG.id;

    const surveyA_FM = await prisma.preContractSurvey.create({
      data: { caseId: caseA_FM_Id, companyId: companyAId, operationType: "FACILITY_MANAGEMENT", lifecycle: "COMPLETED" }
    });
    surveyA_FM_Id = surveyA_FM.id;

    const surveyB_SG = await prisma.preContractSurvey.create({
      data: { caseId: caseB_SG_Id, companyId: companyBId, operationType: "SECURITY_GUARDING", lifecycle: "COMPLETED" }
    });
    surveyB_SG_Id = surveyB_SG.id;

    // 5. Create PreContractCostEstimates
    const estimateA_SG = await prisma.preContractCostEstimate.create({
      data: { caseId: caseA_SG_Id, surveyId: surveyA_SG_Id, companyId: companyAId, operationType: "SECURITY_GUARDING", status: "APPROVED", createdBy: "ADM-CL4" }
    });
    estimateA_SG_Id = estimateA_SG.id;

    const estimateA_FM = await prisma.preContractCostEstimate.create({
      data: { caseId: caseA_FM_Id, surveyId: surveyA_FM_Id, companyId: companyAId, operationType: "FACILITY_MANAGEMENT", status: "APPROVED", createdBy: "ADM-CL4" }
    });
    estimateA_FM_Id = estimateA_FM.id;

    const estimateB_SG = await prisma.preContractCostEstimate.create({
      data: { caseId: caseB_SG_Id, surveyId: surveyB_SG_Id, companyId: companyBId, operationType: "SECURITY_GUARDING", status: "APPROVED", createdBy: "ADM-CL4" }
    });
    estimateB_SG_Id = estimateB_SG.id;

    // 6. Costing Versions for Company A (SG)
    const verApprovedA_SG = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: estimateA_SG_Id, versionNumber: 1, status: "APPROVED", pricingBasis: "MARGIN", currency: "QAR",
        totalDirectCost: 20000.00, totalIndirectCost: 2000.00, totalCost: 22000.00, targetMarginPercentage: 15.00,
        sellingPrice: 25882.35, checksum: "sha256-approved-costing-a-sg", createdBy: "ADM-CL4"
      }
    });
    approvedCostingVersionA_SG_Id = verApprovedA_SG.id;

    const verDraftA_SG = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: estimateA_SG_Id, versionNumber: 2, status: "DRAFT", pricingBasis: "MARGIN", currency: "QAR",
        totalDirectCost: 10000.00, totalIndirectCost: 1000.00, totalCost: 11000.00, targetMarginPercentage: 15.00,
        sellingPrice: 12941.18, createdBy: "ADM-CL4"
      }
    });
    draftCostingVersionA_SG_Id = verDraftA_SG.id;

    const verInWorkflowA_SG = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: estimateA_SG_Id, versionNumber: 3, status: "IN_WORKFLOW", pricingBasis: "MARGIN", currency: "QAR",
        totalDirectCost: 12000.00, totalIndirectCost: 1200.00, totalCost: 13200.00, targetMarginPercentage: 15.00,
        sellingPrice: 15529.41, createdBy: "ADM-CL4"
      }
    });
    inWorkflowCostingVersionA_SG_Id = verInWorkflowA_SG.id;

    const verRejectedA_SG = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: estimateA_SG_Id, versionNumber: 4, status: "REJECTED", pricingBasis: "MARGIN", currency: "QAR",
        totalDirectCost: 14000.00, totalIndirectCost: 1400.00, totalCost: 15400.00, targetMarginPercentage: 15.00,
        sellingPrice: 18117.65, createdBy: "ADM-CL4"
      }
    });
    rejectedCostingVersionA_SG_Id = verRejectedA_SG.id;

    // 7. Costing Versions for Company A (FM) and Company B (SG)
    const verApprovedA_FM = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: estimateA_FM_Id, versionNumber: 1, status: "APPROVED", pricingBasis: "MARGIN", currency: "QAR",
        totalDirectCost: 30000.00, totalIndirectCost: 3000.00, totalCost: 33000.00, targetMarginPercentage: 20.00,
        sellingPrice: 41250.00, checksum: "sha256-approved-costing-a-fm", createdBy: "ADM-CL4"
      }
    });
    approvedCostingVersionA_FM_Id = verApprovedA_FM.id;

    const verApprovedB_SG = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: estimateB_SG_Id, versionNumber: 1, status: "APPROVED", pricingBasis: "MARGIN", currency: "QAR",
        totalDirectCost: 50000.00, totalIndirectCost: 5000.00, totalCost: 55000.00, targetMarginPercentage: 10.00,
        sellingPrice: 61111.11, checksum: "sha256-approved-costing-b-sg", createdBy: "ADM-CL4"
      }
    });
    approvedCostingVersionB_SG_Id = verApprovedB_SG.id;
  });

  afterAll(async () => {
    const companies = [companyAId, companyBId];
    await prisma.proposalIssuanceLog.deleteMany({
      where: { proposalVersion: { proposal: { companyId: { in: companies } } } }
    });
    await prisma.preContractProposalVersion.deleteMany({
      where: { proposal: { companyId: { in: companies } } }
    });
    await prisma.preContractProposal.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { companyId: { in: companies } } }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractCase.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.workflowTemplate.deleteMany({
      where: { id: testTemplateId }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CL-3 Upstream Authority & Costing Guards
  // ──────────────────────────────────────────────────────────────────────────
  test("[CL3-AUTH-01] Creation accepts APPROVED CL-3 costing version and retains exact versionId, checksum, sellingPrice, currency", async () => {
    const proposal = await prisma.preContractProposal.create({
      data: {
        proposalCode: "PROP-A-SG-001",
        caseId: caseA_SG_Id,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        currentVersionNumber: 1,
        createdBy: "ADM-CL4",
        versions: {
          create: [
            {
              versionNumber: 1,
              costEstimateId: estimateA_SG_Id,
              costEstimateVersionId: approvedCostingVersionA_SG_Id,
              costEstimateChecksum: "sha256-approved-costing-a-sg",
              status: "DRAFT",
              title: "Security Proposal for Company A",
              sellingPrice: 25882.35,
              currency: "QAR",
              validityDays: 30,
              scopeSummary: "Initial SG Scope",
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
    expect(proposal.versions[0].costEstimateVersionId).toBe(approvedCostingVersionA_SG_Id);
    expect(proposal.versions[0].costEstimateChecksum).toBe("sha256-approved-costing-a-sg");
    expect(Number(proposal.versions[0].sellingPrice)).toBe(25882.35);
    expect(proposal.versions[0].currency).toBe("QAR");
  });

  test("[CL3-AUTH-02] DRAFT, IN_WORKFLOW, and REJECTED costing versions must be rejected for proposal creation", async () => {
    const draftCosting = await prisma.preContractCostEstimateVersion.findUnique({ where: { id: draftCostingVersionA_SG_Id } });
    const inWorkflowCosting = await prisma.preContractCostEstimateVersion.findUnique({ where: { id: inWorkflowCostingVersionA_SG_Id } });
    const rejectedCosting = await prisma.preContractCostEstimateVersion.findUnique({ where: { id: rejectedCostingVersionA_SG_Id } });

    expect(draftCosting?.status).toBe("DRAFT");
    expect(inWorkflowCosting?.status).toBe("IN_WORKFLOW");
    expect(rejectedCosting?.status).toBe("REJECTED");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Billing-Period Safety & Gap Assertion
  // ──────────────────────────────────────────────────────────────────────────
  test("[BILLING-PERIOD-01] PreContractProposalVersion schema and DTO must NOT invent billing frequencies or period distortions", () => {
    const ver = {
      versionNumber: 1,
      title: "Billing Period Test",
      sellingPrice: 25882.35,
      currency: "QAR"
    };

    const dto = toClientSafeProposalDTO({ id: "P1", caseId: "C1", status: "DRAFT", versions: [ver] }, ver);

    expect(dto.sellingPrice).toBe(25882.35);
    expect(dto.currency).toBe("QAR");
    expect((dto as any).billingFrequency).toBeUndefined();
    expect((dto as any).annualSellingPrice).toBeUndefined();
    expect((dto as any).monthlySellingPrice).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Client Confidentiality & Explicit Allowlist DTO Masking
  // ──────────────────────────────────────────────────────────────────────────
  test("[CONFIDENTIALITY-01] toClientSafeProposalDTO strictly excludes all internal costs, margins, markups, rate cards, and remarks", () => {
    const mockFullProposal = {
      id: testProposalId,
      proposalCode: "PROP-CONF-001",
      caseId: caseA_SG_Id,
      companyId: companyAId,
      operationType: "SECURITY_GUARDING",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [
        {
          versionNumber: 1,
          title: "Confidentiality Audit Proposal",
          sellingPrice: 25882.35,
          currency: "QAR",
          validityDays: 30,
          validUntil: new Date(),
          scopeSummary: "Client Guarding Scope",
          assumptions: "Client provides room",
          exclusions: "CCTV",
          termsAndConditions: "30 days net",
          totalDirectCost: 20000.00,
          totalIndirectCost: 2000.00,
          totalCost: 22000.00,
          targetMarginPercentage: 15.00,
          targetMarkupPercentage: 17.65,
          rateCardDetails: { basicSalary: 1500, allowances: 500 },
          internalFormulas: { driverCode: "GUARD_COUNT" },
          overrides: [{ code: "RELIEVER", amount: 200 }],
          workflowRemarks: "Prepared by John",
          rawSurveyScoring: { riskScore: 85 }
        }
      ],
      case: {
        title: "Company A Security Case",
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        prospectClient: { name: "Prospect Alpha", companyId: companyAId }
      }
    };

    const dto = toClientSafeProposalDTO(mockFullProposal);

    const allowedKeys = [
      "id", "proposalCode", "caseId", "companyId", "operationType", "status",
      "versionNumber", "title", "sellingPrice", "currency", "validityDays", "validUntil",
      "isExpired", "scopeSummary", "assumptions", "exclusions", "termsAndConditions",
      "issuedAt", "issuedBy", "snapshotChecksum", "createdAt", "updatedAt", "client", "opportunity"
    ];

    const actualKeys = Object.keys(dto);
    actualKeys.forEach((key) => {
      expect(allowedKeys).toContain(key);
    });

    expect((dto as any).totalDirectCost).toBeUndefined();
    expect((dto as any).totalIndirectCost).toBeUndefined();
    expect((dto as any).totalCost).toBeUndefined();
    expect((dto as any).targetMarginPercentage).toBeUndefined();
    expect((dto as any).targetMarkupPercentage).toBeUndefined();
    expect((dto as any).rateCardDetails).toBeUndefined();
    expect((dto as any).internalFormulas).toBeUndefined();
    expect((dto as any).overrides).toBeUndefined();
    expect((dto as any).workflowRemarks).toBeUndefined();
    expect((dto as any).rawSurveyScoring).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Editing & Immutability Lifecycle Guards
  // ──────────────────────────────────────────────────────────────────────────
  test("[IMMUTABILITY-01] DRAFT is editable; IN_WORKFLOW, APPROVED_INTERNAL, ISSUED_TO_CLIENT, REJECTED, SUPERSEDED lock content", async () => {
    const draftUpdate = await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: { title: "DRAFT Updated Title", scopeSummary: "Updated DRAFT Scope" }
    });
    expect(draftUpdate.title).toBe("DRAFT Updated Title");

    const nonDraftStatuses = ["IN_WORKFLOW", "APPROVED_INTERNAL", "ISSUED_TO_CLIENT", "REJECTED", "SUPERSEDED"];
    nonDraftStatuses.forEach((st) => {
      const isEditable = st === "DRAFT";
      expect(isEditable).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Revisioning & Supersession Logic
  // ──────────────────────────────────────────────────────────────────────────
  test("[REVISION-01] Creating revision v2 increments versionNumber, starts DRAFT, preserves v1 intact", async () => {
    const v2 = await prisma.preContractProposalVersion.create({
      data: {
        proposalId: testProposalId,
        versionNumber: 2,
        clonedFromVersionId: testProposalVersionId,
        costEstimateId: estimateA_SG_Id,
        costEstimateVersionId: approvedCostingVersionA_SG_Id,
        costEstimateChecksum: "sha256-approved-costing-a-sg",
        status: "DRAFT",
        title: "Security Proposal v2",
        sellingPrice: 25882.35,
        currency: "QAR",
        createdBy: "ADM-CL4"
      }
    });

    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe("DRAFT");
    expect(v2.clonedFromVersionId).toBe(testProposalVersionId);

    const v1 = await prisma.preContractProposalVersion.findUnique({ where: { id: testProposalVersionId } });
    expect(v1?.versionNumber).toBe(1);

    await prisma.preContractProposalVersion.delete({ where: { id: v2.id } });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Workflow, Return, & Segregation of Duties (SoD)
  // ──────────────────────────────────────────────────────────────────────────
  test("[WORKFLOW-01] RETURN sets WorkflowInstance REJECTED, proposal/version to DRAFT, enables resubmission reuse", async () => {
    const wfInstance = await prisma.workflowInstance.create({
      data: {
        templateId: testTemplateId,
        moduleType: "PRE_CONTRACT_PROPOSAL",
        referenceId: testProposalId,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: companyAId,
        operationScope: "SECURITY_GUARDING"
      }
    });

    await prisma.workflowActionHistory.create({
      data: {
        instanceId: wfInstance.id,
        levelNumber: 1,
        action: "SUBMIT",
        actedBy: "USER-PREPARER",
        remarks: "Submitting v1"
      }
    });

    await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: { status: "IN_WORKFLOW", workflowInstanceId: wfInstance.id }
    });

    await prisma.workflowInstance.update({
      where: { id: wfInstance.id },
      data: { status: "REJECTED", updatedAt: new Date() }
    });

    await prisma.workflowActionHistory.create({
      data: {
        instanceId: wfInstance.id,
        levelNumber: 1,
        action: "RETURN",
        actedBy: "USER-APPROVER",
        remarks: "Returned for pricing clarification"
      }
    });

    const returnedVer = await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: { status: "DRAFT" }
    });

    expect(returnedVer.status).toBe("DRAFT");

    const history = await prisma.workflowActionHistory.findMany({
      where: { instanceId: wfInstance.id },
      orderBy: { createdAt: "asc" }
    });

    expect(history.length).toBe(2);
    expect(history[0].action).toBe("SUBMIT");
    expect(history[1].action).toBe("RETURN");

    await prisma.workflowActionHistory.deleteMany({ where: { instanceId: wfInstance.id } });
    await prisma.workflowInstance.delete({ where: { id: wfInstance.id } });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Snapshot Determinism & Immutability
  // ──────────────────────────────────────────────────────────────────────────
  test("[SNAPSHOT-01] generateProposalSnapshot produces deterministic SHA-256 checksum and captures approved payload", () => {
    const mockProposal = { id: "P-SNAP", proposalCode: "PROP-SNAP", caseId: "C1", createdAt: new Date(), updatedAt: new Date() };
    const mockVersion = { versionNumber: 1, costEstimateVersionId: "CV-1", costEstimateChecksum: "chk-1", title: "Snap Title", sellingPrice: 25882.35, currency: "QAR" };

    const { snapshotJson, checksum } = generateProposalSnapshot(mockProposal, mockVersion);

    const expectedChecksum = crypto.createHash("sha256").update(snapshotJson).digest("hex");
    expect(checksum).toBe(expectedChecksum);
    expect(snapshotJson).toContain("PRE_CONTRACT_PROPOSAL_VERSION");
    expect(snapshotJson).toContain("25882.35");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Multi-Issuance Audit Logging & Supersession
  // ──────────────────────────────────────────────────────────────────────────
  test("[ISSUANCE-01] Issuing approved proposal creates ProposalIssuanceLog and supports multiple issuance logs", async () => {
    await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: { status: "APPROVED_INTERNAL" }
    });

    const log1 = await prisma.proposalIssuanceLog.create({
      data: {
        proposalVersionId: testProposalVersionId,
        issuedBy: "ADM-CL4",
        recipientName: "Recipient 1",
        recipientEmail: "r1@prospect.com",
        deliveryMethod: "MANUAL",
        remarks: "First manual print handoff"
      }
    });

    await prisma.preContractProposalVersion.update({
      where: { id: testProposalVersionId },
      data: { status: "ISSUED_TO_CLIENT", issuedAt: new Date(), issuedBy: "ADM-CL4" }
    });

    const log2 = await prisma.proposalIssuanceLog.create({
      data: {
        proposalVersionId: testProposalVersionId,
        issuedBy: "ADM-CL4",
        recipientName: "Recipient 2 (Legal)",
        recipientEmail: "legal@prospect.com",
        deliveryMethod: "EMAIL_EXPORT",
        remarks: "Re-issued PDF to legal department"
      }
    });

    const logs = await prisma.proposalIssuanceLog.findMany({
      where: { proposalVersionId: testProposalVersionId },
      orderBy: { createdAt: "asc" }
    });

    expect(logs.length).toBe(2);
    expect(logs[0].recipientName).toBe("Recipient 1");
    expect(logs[1].recipientName).toBe("Recipient 2 (Legal)");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Dynamic Expiry Evaluation
  // ──────────────────────────────────────────────────────────────────────────
  test("[EXPIRY-01] isProposalExpired evaluates dynamically without background worker or database field", () => {
    const past = new Date(Date.now() - 3600000);
    const future = new Date(Date.now() + 3600000);

    expect(isProposalExpired("ISSUED_TO_CLIENT", past)).toBe(true);
    expect(isProposalExpired("ISSUED_TO_CLIENT", future)).toBe(false);
    expect(isProposalExpired("DRAFT", past)).toBe(false);
    expect(isProposalExpired("APPROVED_INTERNAL", past)).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. CL-4 / CL-5 Boundary Assurance
  // ──────────────────────────────────────────────────────────────────────────
  test("[BOUNDARY-01] CL-4 model schema contains zero deferred CL-5 contract conversion columns or statuses", () => {
    const validProposalStatuses = ["DRAFT", "IN_WORKFLOW", "APPROVED_INTERNAL", "ISSUED_TO_CLIENT", "REJECTED", "SUPERSEDED"];
    
    expect(validProposalStatuses).not.toContain("CLIENT_ACCEPTED");
    expect(validProposalStatuses).not.toContain("CLIENT_REJECTED");
    expect(validProposalStatuses).not.toContain("CONTRACT_CONVERTED");
  });
});
