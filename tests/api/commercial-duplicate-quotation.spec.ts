import { prisma } from "@ahh-wfm/database";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth/next";
import { GET as getProposals, POST as postProposals } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { GET as getProposalDetail } from "../../apps/web/app/api/v1/commercial/proposals/[id]/route";
import { POST as postProposalRevision } from "../../apps/web/app/api/v1/commercial/proposals/[id]/revision/route";
import { GET as getOpportunities } from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { GET as getCosting } from "../../apps/web/app/api/v1/commercial/costing/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial UAT Defect — Duplicate Quotation Prevention & Revision Controls", () => {
  const companyAId = "CMP-DUP-QUOT-A";
  const companyBId = "CMP-DUP-QUOT-B";

  const sgCreatorCompA = {
    id: "EMP-DUP-SG-A",
    name: "SG Commercial Creator A",
    email: "sg.creator.a@alhattab.local",
    role: "COMMERCIAL_OFFICER",
    companyId: companyAId,
    permissions: [
      "precontract.proposal.view",
      "precontract.proposal.manage",
      "precontract.costing.view"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
  };

  const fmCreatorCompA = {
    id: "EMP-DUP-FM-A",
    name: "FM Commercial Creator A",
    email: "fm.creator.a@alhattab.local",
    role: "COMMERCIAL_OFFICER",
    companyId: companyAId,
    permissions: [
      "precontract.proposal.view",
      "precontract.proposal.manage",
      "precontract.costing.view"
    ],
    operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true }
  };

  const sgCreatorCompB = {
    id: "EMP-DUP-SG-B",
    name: "SG Commercial Creator B",
    email: "sg.creator.b@alhattab.local",
    role: "COMMERCIAL_OFFICER",
    companyId: companyBId,
    permissions: [
      "precontract.proposal.view",
      "precontract.proposal.manage",
      "precontract.costing.view"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
  };

  const readOnlyUserCompA = {
    id: "EMP-DUP-VIEW-A",
    name: "SG Viewer A",
    email: "sg.viewer.a@alhattab.local",
    role: "COMMERCIAL_VIEWER",
    companyId: companyAId,
    permissions: ["precontract.proposal.view"],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
  };

  let prospectId: string;
  let siteId: string;

  let sgCase1Id: string;
  let sgCase2Id: string;
  let fmCase1Id: string;
  let sgLegacyCaseId: string;
  let sgConcurrencyCaseId: string;

  let sgEstimate1Id: string;
  let sgEstimate1V1ApprovedId: string;
  let sgEstimate1V2ApprovedId: string;

  let sgEstimate2Id: string;
  let sgEstimate2V1ApprovedId: string;

  let fmEstimate1Id: string;
  let fmEstimate1V1ApprovedId: string;

  let sgLegacyEstimateId: string;
  let sgLegacyApprovedVersionId: string;

  let sgConcurrencyEstimateId: string;
  let sgConcurrencyApprovedVersionId: string;

  let primaryProposalId: string;
  let legacyProp1Id: string;
  let legacyProp2Id: string;

  async function cleanupTestData() {
    const companies = [companyAId, companyBId];
    const actorIds = [sgCreatorCompA.id, fmCreatorCompA.id, sgCreatorCompB.id, readOnlyUserCompA.id];

    await prisma.userActivityLog.deleteMany({
      where: { userId: { in: actorIds } }
    });
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
    await prisma.preContractProspectiveSite.deleteMany({
      where: { companyId: { in: companies } }
    });
    await prisma.preContractProspectClient.deleteMany({
      where: { companyId: { in: companies } }
    });
  }

  beforeAll(async () => {
    await cleanupTestData();

    const prospect = await prisma.preContractProspectClient.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        name: "DUP-TEST Client Alpha"
      }
    });
    prospectId = prospect.id;

    const site = await prisma.preContractProspectiveSite.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        name: "DUP-TEST Site Alpha"
      }
    });
    siteId = site.id;

    // Opportunity 1 (SG): has 2 approved costing versions (V1 and V2)
    const sgCase1 = await prisma.preContractCase.create({
      data: {
        title: "DUP-TEST SG Opportunity 1",
        prospectClientId: prospectId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        createdBy: sgCreatorCompA.id
      }
    });
    sgCase1Id = sgCase1.id;

    const sgSurvey1 = await prisma.preContractSurvey.create({
      data: {
        caseId: sgCase1Id,
        prospectiveSiteId: siteId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });

    const sgEstimate1 = await prisma.preContractCostEstimate.create({
      data: {
        estimateNumber: "COST-DUP-SG-001",
        caseId: sgCase1Id,
        surveyId: sgSurvey1.id,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        currentVersionNumber: 2,
        status: "APPROVED",
        createdBy: sgCreatorCompA.id
      }
    });
    sgEstimate1Id = sgEstimate1.id;

    const est1v1 = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: sgEstimate1Id,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 20000,
        totalIndirectCost: 2000,
        totalCost: 22000,
        targetMarginPercentage: 15,
        sellingPrice: 25882.35,
        checksum: "chk-dup-sg1-v1",
        createdBy: sgCreatorCompA.id
      }
    });
    sgEstimate1V1ApprovedId = est1v1.id;

    const est1v2 = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: sgEstimate1Id,
        versionNumber: 2,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 25000,
        totalIndirectCost: 2500,
        totalCost: 27500,
        targetMarginPercentage: 15,
        sellingPrice: 32352.94,
        checksum: "chk-dup-sg1-v2",
        createdBy: sgCreatorCompA.id
      }
    });
    sgEstimate1V2ApprovedId = est1v2.id;

    // Opportunity 2 (SG)
    const sgCase2 = await prisma.preContractCase.create({
      data: {
        title: "DUP-TEST SG Opportunity 2",
        prospectClientId: prospectId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        createdBy: sgCreatorCompA.id
      }
    });
    sgCase2Id = sgCase2.id;

    const sgSurvey2 = await prisma.preContractSurvey.create({
      data: {
        caseId: sgCase2Id,
        prospectiveSiteId: siteId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });

    const sgEstimate2 = await prisma.preContractCostEstimate.create({
      data: {
        estimateNumber: "COST-DUP-SG-002",
        caseId: sgCase2Id,
        surveyId: sgSurvey2.id,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        currentVersionNumber: 1,
        status: "APPROVED",
        createdBy: sgCreatorCompA.id
      }
    });
    sgEstimate2Id = sgEstimate2.id;

    const est2v1 = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: sgEstimate2Id,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 15000,
        totalIndirectCost: 1500,
        totalCost: 16500,
        targetMarginPercentage: 15,
        sellingPrice: 19411.76,
        checksum: "chk-dup-sg2-v1",
        createdBy: sgCreatorCompA.id
      }
    });
    sgEstimate2V1ApprovedId = est2v1.id;

    // Opportunity 3 (FM)
    const fmCase1 = await prisma.preContractCase.create({
      data: {
        title: "DUP-TEST FM Opportunity 1",
        prospectClientId: prospectId,
        companyId: companyAId,
        operationType: "FACILITY_MANAGEMENT",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        createdBy: fmCreatorCompA.id
      }
    });
    fmCase1Id = fmCase1.id;

    const fmSurvey1 = await prisma.preContractSurvey.create({
      data: {
        caseId: fmCase1Id,
        prospectiveSiteId: siteId,
        companyId: companyAId,
        operationType: "FACILITY_MANAGEMENT",
        lifecycle: "COMPLETED"
      }
    });

    const fmEstimate1 = await prisma.preContractCostEstimate.create({
      data: {
        estimateNumber: "COST-DUP-FM-001",
        caseId: fmCase1Id,
        surveyId: fmSurvey1.id,
        companyId: companyAId,
        operationType: "FACILITY_MANAGEMENT",
        currentVersionNumber: 1,
        status: "APPROVED",
        createdBy: fmCreatorCompA.id
      }
    });
    fmEstimate1Id = fmEstimate1.id;

    const fmEst1v1 = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: fmEstimate1Id,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 18000,
        totalIndirectCost: 1800,
        totalCost: 19800,
        targetMarginPercentage: 15,
        sellingPrice: 23294.12,
        checksum: "chk-dup-fm1-v1",
        createdBy: fmCreatorCompA.id
      }
    });
    fmEstimate1V1ApprovedId = fmEst1v1.id;

    // Opportunity 4 (Legacy pre-existing duplicate records simulation)
    const sgLegacyCase = await prisma.preContractCase.create({
      data: {
        title: "DUP-TEST Legacy Duplicate Opportunity",
        prospectClientId: prospectId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        createdBy: sgCreatorCompA.id
      }
    });
    sgLegacyCaseId = sgLegacyCase.id;

    const sgLegacySurvey = await prisma.preContractSurvey.create({
      data: {
        caseId: sgLegacyCaseId,
        prospectiveSiteId: siteId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });

    const sgLegacyEst = await prisma.preContractCostEstimate.create({
      data: {
        estimateNumber: "COST-DUP-LEGACY",
        caseId: sgLegacyCaseId,
        surveyId: sgLegacySurvey.id,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        currentVersionNumber: 1,
        status: "APPROVED",
        createdBy: sgCreatorCompA.id
      }
    });
    sgLegacyEstimateId = sgLegacyEst.id;

    const sgLegacyVer = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: sgLegacyEstimateId,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 12000,
        totalIndirectCost: 1200,
        totalCost: 13200,
        targetMarginPercentage: 15,
        sellingPrice: 15529.41,
        checksum: "chk-dup-legacy-v1",
        createdBy: sgCreatorCompA.id
      }
    });
    sgLegacyApprovedVersionId = sgLegacyVer.id;

    // Seed 2 legacy duplicate proposals referencing the same baseline
    const leg1 = await prisma.preContractProposal.create({
      data: {
        proposalCode: "LEGACY-DUP-001",
        caseId: sgLegacyCaseId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        status: "ISSUED_TO_CLIENT",
        currentVersionNumber: 1,
        createdBy: sgCreatorCompA.id,
        versions: {
          create: [
            {
              versionNumber: 1,
              costEstimateId: sgLegacyEstimateId,
              costEstimateVersionId: sgLegacyApprovedVersionId,
              costEstimateChecksum: "chk-dup-legacy-v1",
              status: "ISSUED_TO_CLIENT",
              title: "Legacy Quotation 1",
              sellingPrice: 15529.41,
              currency: "QAR",
              createdBy: sgCreatorCompA.id
            }
          ]
        }
      }
    });
    legacyProp1Id = leg1.id;

    const leg2 = await prisma.preContractProposal.create({
      data: {
        proposalCode: "LEGACY-DUP-002",
        caseId: sgLegacyCaseId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        currentVersionNumber: 1,
        createdBy: sgCreatorCompA.id,
        versions: {
          create: [
            {
              versionNumber: 1,
              costEstimateId: sgLegacyEstimateId,
              costEstimateVersionId: sgLegacyApprovedVersionId,
              costEstimateChecksum: "chk-dup-legacy-v1",
              status: "DRAFT",
              title: "Legacy Quotation 2",
              sellingPrice: 15529.41,
              currency: "QAR",
              createdBy: sgCreatorCompA.id
            }
          ]
        }
      }
    });
    legacyProp2Id = leg2.id;

    // Opportunity 5 (Concurrency race test case)
    const sgConcCase = await prisma.preContractCase.create({
      data: {
        title: "DUP-TEST Concurrency Opportunity",
        prospectClientId: prospectId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        createdBy: sgCreatorCompA.id
      }
    });
    sgConcurrencyCaseId = sgConcCase.id;

    const sgConcSurvey = await prisma.preContractSurvey.create({
      data: {
        caseId: sgConcurrencyCaseId,
        prospectiveSiteId: siteId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });

    const sgConcEst = await prisma.preContractCostEstimate.create({
      data: {
        estimateNumber: "COST-DUP-CONC",
        caseId: sgConcurrencyCaseId,
        surveyId: sgConcSurvey.id,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        currentVersionNumber: 1,
        status: "APPROVED",
        createdBy: sgCreatorCompA.id
      }
    });
    sgConcurrencyEstimateId = sgConcEst.id;

    const sgConcVer = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: sgConcurrencyEstimateId,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 40000,
        totalIndirectCost: 4000,
        totalCost: 44000,
        targetMarginPercentage: 15,
        sellingPrice: 51764.71,
        checksum: "chk-dup-conc-v1",
        createdBy: sgCreatorCompA.id
      }
    });
    sgConcurrencyApprovedVersionId = sgConcVer.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test("1. Unauthorized, missing-permission, cross-company, and cross-scope (FM vs SG) requests are rejected before duplicate checks", async () => {
    // 1a. Unauthenticated -> 401
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const unauthRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: sgCase1Id, costEstimateVersionId: sgEstimate1V1ApprovedId })
      })
    );
    expect(unauthRes.status).toBe(401);

    // 1b. Viewer without precontract.proposal.manage -> 403
    (getServerSession as jest.Mock).mockResolvedValue({ user: readOnlyUserCompA });
    const viewerRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: sgCase1Id, costEstimateVersionId: sgEstimate1V1ApprovedId })
      })
    );
    expect(viewerRes.status).toBe(403);

    // 1c. Cross-company SG user -> 403
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompB });
    const compBRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: sgCase1Id, costEstimateVersionId: sgEstimate1V1ApprovedId })
      })
    );
    expect(compBRes.status).toBe(403);

    // 1d. FM-only user attempting to create quotation on SG opportunity (even on legacy duplicate case) -> 403, NOT 409
    (getServerSession as jest.Mock).mockResolvedValue({ user: fmCreatorCompA });
    const fmOnSgRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: sgLegacyCaseId, costEstimateVersionId: sgLegacyApprovedVersionId })
      })
    );
    expect(fmOnSgRes.status).toBe(403);
  });

  test("2. First quotation creation succeeds (201) and records CREATE_PROPOSAL audit log", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    const res = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: sgCase1Id,
          costEstimateVersionId: sgEstimate1V1ApprovedId,
          proposalCode: "PROP-DUP-SG1-001",
          title: "Primary SG Quotation",
          validityDays: 30
        })
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.proposal).toBeDefined();
    expect(data.proposal.status).toBe("DRAFT");
    primaryProposalId = data.proposal.id;

    const auditLogs = await prisma.userActivityLog.findMany({
      where: {
        entityType: "PreContractProposal",
        entityId: primaryProposalId,
        action: "CREATE_PROPOSAL"
      }
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].userId).toBe(sgCreatorCompA.id);
  });

  test("3. Duplicate quotation for same Opportunity Case + Approved Costing Baseline is blocked (409) across active statuses and logs audit event", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    // Double-click / repeat submission while DRAFT
    const dupDraftRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: sgCase1Id,
          costEstimateVersionId: sgEstimate1V1ApprovedId,
          proposalCode: "PROP-DUP-SG1-002",
          title: "Duplicate Attempt While Draft"
        })
      })
    );
    expect(dupDraftRes.status).toBe(409);
    const dupDraftBody = await dupDraftRes.json();
    expect(dupDraftBody.code).toBe("DUPLICATE_QUOTATION_BASELINE");
    expect(dupDraftBody.existingProposal.id).toBe(primaryProposalId);
    expect(dupDraftBody.existingProposal.url).toBe(`/commercial/proposals/${primaryProposalId}`);
    expect(dupDraftBody.error).toContain("Duplicate Quotation Blocked");

    // Verify active statuses IN_WORKFLOW, APPROVED_INTERNAL, ISSUED_TO_CLIENT also block duplicate creation
    for (const activeStatus of ["IN_WORKFLOW", "APPROVED_INTERNAL", "ISSUED_TO_CLIENT"]) {
      await prisma.preContractProposal.update({
        where: { id: primaryProposalId },
        data: { status: activeStatus }
      });
      await prisma.preContractProposalVersion.updateMany({
        where: { proposalId: primaryProposalId },
        data: { status: activeStatus }
      });

      const dupRes = await postProposals(
        new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
          method: "POST",
          body: JSON.stringify({
            caseId: sgCase1Id,
            costEstimateVersionId: sgEstimate1V1ApprovedId,
            title: `Duplicate Attempt While ${activeStatus}`
          })
        })
      );
      expect(dupRes.status).toBe(409);
    }

    // Restore to ISSUED_TO_CLIENT for subsequent revision test
    await prisma.preContractProposal.update({
      where: { id: primaryProposalId },
      data: { status: "ISSUED_TO_CLIENT" }
    });
    await prisma.preContractProposalVersion.updateMany({
      where: { proposalId: primaryProposalId },
      data: { status: "ISSUED_TO_CLIENT" }
    });

    const totalForBaseline = await prisma.preContractProposal.count({
      where: {
        caseId: sgCase1Id,
        versions: { some: { costEstimateVersionId: sgEstimate1V1ApprovedId } }
      }
    });
    expect(totalForBaseline).toBe(1);

    const blockedAuditLogs = await prisma.userActivityLog.findMany({
      where: {
        entityType: "PreContractProposal",
        entityId: primaryProposalId,
        action: "DUPLICATE_PROPOSAL_BLOCKED"
      }
    });
    expect(blockedAuditLogs.length).toBeGreaterThanOrEqual(4);
  });

  test("4. Revision workflow on the existing quotation succeeds (v2) using same baseline, while independent duplicate remains blocked", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    const revRes = await postProposalRevision(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${primaryProposalId}/revision`, {
        method: "POST",
        body: JSON.stringify({
          title: "Primary SG Quotation — Rev 2"
        })
      }),
      { params: { id: primaryProposalId } }
    );
    expect(revRes.status).toBe(201);
    const revBody = await revRes.json();
    expect(revBody.proposal.currentVersionNumber).toBe(2);
    expect(revBody.newVersion.versionNumber).toBe(2);
    expect(revBody.newVersion.costEstimateVersionId).toBe(sgEstimate1V1ApprovedId);

    // Still cannot create a second independent quotation on the same baseline
    const dupAfterRevRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: sgCase1Id,
          costEstimateVersionId: sgEstimate1V1ApprovedId
        })
      })
    );
    expect(dupAfterRevRes.status).toBe(409);
  });

  test("5. Different approved costing baseline on the same opportunity succeeds, and switching another proposal revision onto an occupied baseline is blocked (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    // Second approved baseline (V2) on sgCase1Id -> allowed!
    const secondBaselineRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: sgCase1Id,
          costEstimateVersionId: sgEstimate1V2ApprovedId,
          proposalCode: "PROP-DUP-SG1-V2",
          title: "Second Baseline SG Quotation"
        })
      })
    );
    expect(secondBaselineRes.status).toBe(201);
    const secondProposal = (await secondBaselineRes.json()).proposal;

    // Attempting to revise secondProposal to point to sgEstimate1V1ApprovedId (already owned by primaryProposalId) -> 409!
    const stealBaselineRes = await postProposalRevision(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${secondProposal.id}/revision`, {
        method: "POST",
        body: JSON.stringify({
          costEstimateVersionId: sgEstimate1V1ApprovedId
        })
      }),
      { params: { id: secondProposal.id } }
    );
    expect(stealBaselineRes.status).toBe(409);
  });

  test("6. Different opportunity cases (SG Opportunity 2 and FM Opportunity 1) succeed independently with scope isolation", async () => {
    // SG Opportunity 2 by SG creator
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });
    const sg2Res = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: sgCase2Id,
          costEstimateVersionId: sgEstimate2V1ApprovedId,
          proposalCode: "PROP-DUP-SG2-001"
        })
      })
    );
    expect(sg2Res.status).toBe(201);

    // FM Opportunity 1 by FM creator
    (getServerSession as jest.Mock).mockResolvedValue({ user: fmCreatorCompA });
    const fm1Res = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: fmCase1Id,
          costEstimateVersionId: fmEstimate1V1ApprovedId,
          proposalCode: "PROP-DUP-FM1-001"
        })
      })
    );
    expect(fm1Res.status).toBe(201);
  });

  test("7. Concurrent requests for the same Opportunity Case + Approved Costing Baseline allow strictly 1 creation (201) and reject all others (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    const concurrentRequests = Array.from({ length: 5 }, (_, idx) =>
      postProposals(
        new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
          method: "POST",
          body: JSON.stringify({
            caseId: sgConcurrencyCaseId,
            costEstimateVersionId: sgConcurrencyApprovedVersionId,
            proposalCode: `PROP-CONC-${idx + 1}`,
            title: `Concurrent Quotation Attempt ${idx + 1}`
          })
        })
      )
    );

    const responses = await Promise.all(concurrentRequests);
    const statuses = responses.map((r) => r.status).sort();

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);

    const dbCount = await prisma.preContractProposal.count({
      where: {
        caseId: sgConcurrencyCaseId,
        versions: { some: { costEstimateVersionId: sgConcurrencyApprovedVersionId } }
      }
    });
    expect(dbCount).toBe(1);
  });

  test("8. Inactive/rejected/cancelled quotations do not deadlock creating a replacement quotation", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    // Create a temporary case + baseline for rejection/cancellation lifecycle verification
    const tempCase = await prisma.preContractCase.create({
      data: {
        title: "DUP-TEST Rejected Case",
        prospectClientId: prospectId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        createdBy: sgCreatorCompA.id
      }
    });
    const tempSurvey = await prisma.preContractSurvey.create({
      data: {
        caseId: tempCase.id,
        prospectiveSiteId: siteId,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });
    const tempEst = await prisma.preContractCostEstimate.create({
      data: {
        caseId: tempCase.id,
        surveyId: tempSurvey.id,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        status: "APPROVED",
        createdBy: sgCreatorCompA.id
      }
    });
    const tempVer = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: tempEst.id,
        versionNumber: 1,
        status: "APPROVED",
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: 10000,
        totalIndirectCost: 1000,
        totalCost: 11000,
        targetMarginPercentage: 15,
        sellingPrice: 12941.18,
        checksum: "chk-temp-rej-v1",
        createdBy: sgCreatorCompA.id
      }
    });

    const firstRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: tempCase.id, costEstimateVersionId: tempVer.id, title: "To Be Rejected" })
      })
    );
    expect(firstRes.status).toBe(201);
    const firstProp = (await firstRes.json()).proposal;

    // Mark REJECTED -> replacement creation succeeds
    await prisma.preContractProposal.update({
      where: { id: firstProp.id },
      data: { status: "REJECTED" }
    });
    await prisma.preContractProposalVersion.updateMany({
      where: { proposalId: firstProp.id },
      data: { status: "REJECTED" }
    });

    const afterRejectRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: tempCase.id, costEstimateVersionId: tempVer.id, title: "After Rejection" })
      })
    );
    expect(afterRejectRes.status).toBe(201);
    const secondProp = (await afterRejectRes.json()).proposal;

    // Mark CANCELLED -> replacement creation succeeds
    await prisma.preContractProposal.update({
      where: { id: secondProp.id },
      data: { status: "CANCELLED" }
    });
    await prisma.preContractProposalVersion.updateMany({
      where: { proposalId: secondProp.id },
      data: { status: "CANCELLED" }
    });

    const afterCancelRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({ caseId: tempCase.id, costEstimateVersionId: tempVer.id, title: "After Cancellation" })
      })
    );
    expect(afterCancelRes.status).toBe(201);
  });

  test("9. Legacy duplicate records remain intact, readable, and block additional duplicates (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    const dupLegacyRes = await postProposals(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
        method: "POST",
        body: JSON.stringify({
          caseId: sgLegacyCaseId,
          costEstimateVersionId: sgLegacyApprovedVersionId,
          title: "Attempt 3rd Duplicate on Legacy Case"
        })
      })
    );
    expect(dupLegacyRes.status).toBe(409);
    const dupLegacyBody = await dupLegacyRes.json();
    expect(dupLegacyBody.existingProposal.id).toBe(legacyProp1Id);

    // Both legacy records remain completely intact and readable
    const leg1Res = await getProposalDetail(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${legacyProp1Id}`),
      { params: { id: legacyProp1Id } }
    );
    const leg2Res = await getProposalDetail(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${legacyProp2Id}`),
      { params: { id: legacyProp2Id } }
    );
    expect(leg1Res.status).toBe(200);
    expect(leg2Res.status).toBe(200);

    const listRes = await getProposals(new NextRequest("http://localhost:3100/api/v1/commercial/proposals"));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    const ids = (listBody.proposals || []).map((p: any) => p.id);
    expect(ids).toContain(legacyProp1Id);
    expect(ids).toContain(legacyProp2Id);
  });

  test("10. Opportunities & Costing APIs identify baselines linked to active quotations, and Quotations UI enforces duplicate controls", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreatorCompA });

    const oppRes = await getOpportunities(
      new Request("http://localhost:3100/api/v1/commercial/opportunities?forProposal=true")
    );
    expect(oppRes.status).toBe(200);
    const oppBody = await oppRes.json();
    const matchedCase = oppBody.cases.find((c: any) => c.id === sgCase1Id);
    expect(matchedCase).toBeDefined();
    const v1FromOpp = matchedCase.costEstimates[0].versions.find((v: any) => v.id === sgEstimate1V1ApprovedId);
    expect(v1FromOpp?.activeProposal?.id).toBe(primaryProposalId);
    expect(v1FromOpp?.activeProposal?.url).toBe(`/commercial/proposals/${primaryProposalId}`);

    const costingRes = await getCosting(
      new Request(`http://localhost:3100/api/v1/commercial/costing?caseId=${sgCase1Id}`)
    );
    expect(costingRes.status).toBe(200);
    const costingBody = await costingRes.json();
    const v1FromCosting = costingBody.estimates[0].versions.find((v: any) => v.id === sgEstimate1V1ApprovedId);
    expect(v1FromCosting?.activeProposal?.id).toBe(primaryProposalId);

    // Frontend source contract verification (double-submit lock, duplicate warning, link, shared Button)
    const quotationsSource = fs.readFileSync(
      path.resolve(__dirname, "../../apps/web/app/commercial/quotations/page.tsx"),
      "utf8"
    );
    expect(quotationsSource).toContain('import { Button } from "@ahh-wfm/ui/src"');
    expect(quotationsSource).toContain("submitLockRef");
    expect(quotationsSource).toContain("disabled={Boolean(activeProp)}");
    expect(quotationsSource).toContain("Open Existing Quotation");
    expect(quotationsSource).toContain("res.status === 409");
  });
});
