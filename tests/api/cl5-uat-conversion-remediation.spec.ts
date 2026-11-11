import { prisma } from "@ahh-wfm/database";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { GET as getConversionReadiness, PATCH as patchConversionReadiness } from "../../apps/web/app/api/v1/commercial/proposals/[id]/conversion-readiness/route";
import { POST as postConvertContract } from "../../apps/web/app/api/v1/commercial/proposals/[id]/convert/route";
import { PATCH as patchOpportunity } from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { GET as getProposals } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { GET as getProposalDetail } from "../../apps/web/app/api/v1/commercial/proposals/[id]/route";
import { recordClientResponse, deriveManpowerItemsFromCosting } from "../../apps/web/lib/contract-conversion";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("CL-5 Contract Conversion UAT Remediation (DEF-049, DEF-046, DEF-047, DEF-048)", () => {
  const companyAId = "CMP-CL5-UAT-A";
  const companyBId = "CMP-CL5-UAT-B";
  const suffix = Date.now();

  const sgCreator = {
    id: "EMP-CL5-UAT-SG",
    name: "SG Commercial Creator",
    email: "sg.cl5.uat@alhattab.local",
    role: "COMMERCIAL_CREATOR",
    companyId: companyAId,
    permissions: [
      "precontract.case.view",
      "precontract.case.manage",
      "commercial.opportunities.manage",
      "precontract.proposal.view",
      "precontract.acceptance.view",
      "precontract.acceptance.manage",
      "precontract.contractConversion.execute"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
  };

  const fmCreator = {
    id: "EMP-CL5-UAT-FM",
    name: "FM Commercial Creator",
    email: "fm.cl5.uat@alhattab.local",
    role: "COMMERCIAL_CREATOR",
    companyId: companyAId,
    permissions: [
      "precontract.case.view",
      "precontract.case.manage",
      "commercial.opportunities.manage",
      "precontract.proposal.view",
      "precontract.acceptance.view",
      "precontract.acceptance.manage",
      "precontract.contractConversion.execute"
    ],
    operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true }
  };

  const viewerOnlyUser = {
    id: "EMP-CL5-UAT-VIEW",
    name: "Viewer Only User",
    email: "view.cl5.uat@alhattab.local",
    role: "COMMERCIAL_VIEWER",
    companyId: companyAId,
    permissions: ["precontract.proposal.view", "precontract.acceptance.view"],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
  };

  const companyBUser = {
    id: "EMP-CL5-UAT-COMPB",
    name: "Company B Creator",
    email: "compb.cl5.uat@alhattab.local",
    role: "COMMERCIAL_CREATOR",
    companyId: companyBId,
    permissions: [
      "precontract.case.view",
      "precontract.case.manage",
      "precontract.proposal.view",
      "precontract.contractConversion.execute"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
  };

  let sgClientId: string;
  let fmClientId: string;
  let prospectUnmatchedId: string;
  let sgCaseId: string;
  let sgSurveyId: string;
  let sgEstimateId: string;
  let sgEstimateVersionId: string;
  let sgProposalId: string;
  let sgProposalVersionId: string;
  const sgChecksum = `chk-cl5-uat-${suffix}`;

  const cleanup = async () => {
    await prisma.manpowerContract.deleteMany({
      where: { OR: [{ contractNumber: { startsWith: `UAT-SG-T1-CON-${suffix}` } }, { sourceProposalVersionId: sgProposalVersionId }] }
    });
    if (sgProposalId) {
      await prisma.preContractClientResponse.deleteMany({ where: { proposalId: sgProposalId } });
      await prisma.preContractProposalVersion.deleteMany({ where: { proposalId: sgProposalId } });
      await prisma.preContractProposal.deleteMany({ where: { id: sgProposalId } });
    }
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimate: { companyId: companyAId } } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { companyId: companyAId } }
    });
    await prisma.preContractCostEstimate.deleteMany({ where: { companyId: companyAId } });
    await prisma.preContractSurvey.deleteMany({ where: { companyId: companyAId } });
    await prisma.preContractCase.deleteMany({ where: { companyId: companyAId } });
    await prisma.preContractProspectClient.deleteMany({ where: { companyId: companyAId } });
    await prisma.manpowerClient.deleteMany({
      where: { code: { in: [`QP-UAT-${suffix}`, `FM-UAT-${suffix}`] } }
    });
  };

  beforeAll(async () => {
    await cleanup();

    const sgClient = await prisma.manpowerClient.create({
      data: {
        name: `Qatar Petroleum CL5 UAT ${suffix}`,
        code: `QP-UAT-${suffix}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    sgClientId = sgClient.id;

    const fmClient = await prisma.manpowerClient.create({
      data: {
        name: `HMC FM CL5 UAT ${suffix}`,
        code: `FM-UAT-${suffix}`,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });
    fmClientId = fmClient.id;

    const prospect = await prisma.preContractProspectClient.create({
      data: {
        name: `Qatar Petroleum Prospect ${suffix}`,
        companyId: companyAId,
        matchedClientMasterId: null,
        isActive: true
      }
    });
    prospectUnmatchedId = prospect.id;

    const opp = await prisma.preContractCase.create({
      data: {
        title: `UAT-SG-T1-20260811-OPP-${suffix}`,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        businessOutcome: "WON",
        prospectClientId: prospectUnmatchedId,
        existingClientId: null,
        createdBy: sgCreator.id
      }
    });
    sgCaseId = opp.id;

    const survey = await prisma.preContractSurvey.create({
      data: {
        companyId: companyAId,
        caseId: sgCaseId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED"
      }
    });
    sgSurveyId = survey.id;

    const est = await prisma.preContractCostEstimate.create({
      data: {
        companyId: companyAId,
        caseId: sgCaseId,
        surveyId: sgSurveyId,
        operationType: "SECURITY_GUARDING",
        status: "APPROVED",
        createdBy: sgCreator.id
      }
    });
    sgEstimateId = est.id;

    const estVer = await prisma.preContractCostEstimateVersion.create({
      data: {
        estimateId: sgEstimateId,
        versionNumber: 1,
        status: "APPROVED",
        currency: "QAR",
        totalDirectCost: 49900,
        totalIndirectCost: 4990,
        totalCost: 54890,
        sellingPrice: 63124,
        createdBy: sgCreator.id,
        items: {
          create: [
            {
              elementCode: "BASIC_PAY",
              elementName: "Basic Pay / Manpower Wage",
              categoryCode: "DIRECT_MANPOWER",
              isDirect: true,
              unitOfMeasure: "MAN_MONTH",
              quantity: 14,
              unitRate: 2864.29,
              totalAmount: 40100
            },
            {
              elementCode: "ALLOWANCES",
              elementName: "Fixed Employment Allowances",
              categoryCode: "DIRECT_MANPOWER",
              isDirect: true,
              unitOfMeasure: "MAN_MONTH",
              quantity: 14,
              unitRate: 0,
              totalAmount: 0
            },
            {
              elementCode: "RELIEVER_COST",
              elementName: "Contractual Reliever Staffing",
              categoryCode: "RELIEVER",
              isDirect: true,
              unitOfMeasure: "MAN_MONTH",
              quantity: 2,
              unitRate: 1500,
              totalAmount: 3000
            },
            {
              elementCode: "SITE_OVERHEAD",
              elementName: "Site Operations & HR Overhead",
              categoryCode: "INDIRECT_OVERHEAD",
              isDirect: false,
              unitOfMeasure: "FIXED_PCT",
              quantity: 1,
              unitRate: 4990,
              totalAmount: 4990
            }
          ]
        }
      }
    });
    sgEstimateVersionId = estVer.id;

    const prop = await prisma.preContractProposal.create({
      data: {
        companyId: companyAId,
        caseId: sgCaseId,
        operationType: "SECURITY_GUARDING",
        proposalCode: `UAT-SG-T1-PROP-${suffix}`,
        status: "ISSUED_TO_CLIENT",
        currentVersionNumber: 1,
        createdBy: sgCreator.id
      }
    });
    sgProposalId = prop.id;

    const propVer = await prisma.preContractProposalVersion.create({
      data: {
        proposalId: sgProposalId,
        versionNumber: 1,
        costEstimateId: sgEstimateId,
        costEstimateVersionId: sgEstimateVersionId,
        status: "ISSUED_TO_CLIENT",
        title: `UAT SG Proposal ${suffix}`,
        sellingPrice: 63124,
        currency: "QAR",
        snapshotChecksum: sgChecksum,
        snapshotJson: JSON.stringify({ proposalId: sgProposalId }),
        createdBy: sgCreator.id
      }
    });
    sgProposalVersionId = propVer.id;

    await recordClientResponse({
      proposalId: sgProposalId,
      proposalVersionId: sgProposalVersionId,
      responseType: "ACCEPTED",
      clientContactName: "QP Procurement Lead",
      clientReference: `PO-QP-${suffix}`,
      snapshotChecksum: sgChecksum,
      recordedById: sgCreator.id
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("DEF-046: recording ACCEPTED preserves ISSUED_TO_CLIENT status and exposes clientResponse on proposal APIs", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreator });

    const listRes = await getProposals(new NextRequest(`http://localhost:3100/api/v1/commercial/proposals?search=UAT-SG-T1-PROP-${suffix}`));
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const rawProp = listData.raw.find((r: any) => r.id === sgProposalId);
    expect(rawProp.status).toBe("ISSUED_TO_CLIENT");
    expect(rawProp.versions[0].status).toBe("ISSUED_TO_CLIENT");
    expect(rawProp.versions[0].clientResponse?.responseType).toBe("ACCEPTED");

    const detailRes = await getProposalDetail(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}`),
      { params: { id: sgProposalId } }
    );
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.proposal.versions[0].clientResponse?.responseType).toBe("ACCEPTED");
    expect((detailData.dto as any).clientResponse).toBeUndefined();
  });

  it("DEF-049 & DEF-047: blocks conversion when client master is unresolved, derives non-blank direct staffing without overhead/allowance duplication", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreator });

    const res = await getConversionReadiness(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/conversion-readiness`),
      { params: { id: sgProposalId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.ready).toBe(false);
    expect(data.resolvedClientId).toBeNull();
    expect(data.resolvedClient).toBeNull();
    expect(data.blockers).toContain("Client master is not linked or resolved. Prepare Client Master before conversion.");
    expect(data.clientAcceptanceStatus).toBe("ACCEPTED");
    expect(data.proposalStatus).toBe("ISSUED_TO_CLIENT");

    // DEF-047: 2 direct staffing lines (BASIC_PAY=14 REGULAR, RELIEVER_COST=2 RELIEVER), excluding ALLOWANCES overlay & SITE_OVERHEAD indirect item
    expect(data.manpowerItems).toHaveLength(2);
    expect(data.manpowerItems[0].position).toBe("Basic Pay / Manpower Wage");
    expect(data.manpowerItems[0].quantity).toBe(14);
    expect(data.manpowerItems[0].deploymentType).toBe("REGULAR");
    expect(data.manpowerItems[1].position).toBe("Contractual Reliever Staffing");
    expect(data.manpowerItems[1].quantity).toBe(2);
    expect(data.manpowerItems[1].deploymentType).toBe("RELIEVER");

    // Scope isolation in eligibleClients: SG proposal must include SG client and exclude FM client
    expect(data.eligibleClients.some((c: any) => c.id === sgClientId)).toBe(true);
    expect(data.eligibleClients.some((c: any) => c.id === fmClientId)).toBe(false);
  });

  it("DEF-049 SECURITY: rejects cross-scope client master linking, unauthorized users, and cross-company access", async () => {
    // 1. Cross-scope user (FM creator) blocked from SG readiness & linking
    (getServerSession as jest.Mock).mockResolvedValue({ user: fmCreator });
    const fmGetRes = await getConversionReadiness(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/conversion-readiness`),
      { params: { id: sgProposalId } }
    );
    expect(fmGetRes.status).toBe(403);

    // 2. Viewer-only user blocked from PATCH linking client master
    (getServerSession as jest.Mock).mockResolvedValue({ user: viewerOnlyUser });
    const viewPatchRes = await patchConversionReadiness(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/conversion-readiness`, {
        method: "PATCH",
        body: JSON.stringify({ clientId: sgClientId })
      }),
      { params: { id: sgProposalId } }
    );
    expect(viewPatchRes.status).toBe(403);

    // 3. Cross-company user blocked
    (getServerSession as jest.Mock).mockResolvedValue({ user: companyBUser });
    const compBRes = await patchConversionReadiness(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/conversion-readiness`, {
        method: "PATCH",
        body: JSON.stringify({ clientId: sgClientId })
      }),
      { params: { id: sgProposalId } }
    );
    expect(compBRes.status).toBe(403);

    // 4. SG creator cannot link an FM Client Master to an SG proposal
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreator });
    const crossScopeClientRes = await patchConversionReadiness(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/conversion-readiness`, {
        method: "PATCH",
        body: JSON.stringify({ clientId: fmClientId })
      }),
      { params: { id: sgProposalId } }
    );
    expect(crossScopeClientRes.status).toBe(403);

    // 5. SG creator cannot convert using an explicit FM clientId either
    const crossConvertRes = await postConvertContract(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          contractNumber: `UAT-SG-T1-CON-${suffix}-FAIL`,
          startDate: "2026-08-01",
          endDate: "2026-09-30",
          clientId: fmClientId
        })
      }),
      { params: { id: sgProposalId } }
    );
    expect(crossConvertRes.status).toBe(403);
  });

  it("DEF-049: authorized SG creator can link existing Qatar Petroleum Client Master without duplicating master records", async () => {
    const beforeCount = await prisma.manpowerClient.count();
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreator });

    const linkRes = await patchConversionReadiness(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/conversion-readiness`, {
        method: "PATCH",
        body: JSON.stringify({ clientId: sgClientId })
      }),
      { params: { id: sgProposalId } }
    );
    expect(linkRes.status).toBe(200);
    const linkData = await linkRes.json();
    expect(linkData.ready).toBe(true);
    expect(linkData.resolvedClientId).toBe(sgClientId);
    expect(linkData.resolvedClient.code).toBe(`QP-UAT-${suffix}`);
    expect(linkData.blockers).toHaveLength(0);

    const afterCount = await prisma.manpowerClient.count();
    expect(afterCount).toBe(beforeCount);

    // Opportunity API PATCH also rejects cross-scope client and accepts same-scope existingClientId
    const oppCross = await patchOpportunity(
      new NextRequest("http://localhost:3100/api/v1/commercial/opportunities", {
        method: "PATCH",
        body: JSON.stringify({ id: sgCaseId, existingClientId: fmClientId })
      })
    );
    expect(oppCross.status).toBe(403);
  });

  it("DEF-047 & DEF-048: rejects incomplete staffing or invalid noticePeriodDays without silent placeholders", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreator });

    // deriveManpowerItemsFromCosting marks blank/zero items invalid instead of injecting "General Staff" or 1
    const invalidDerived = deriveManpowerItemsFromCosting({
      items: [{ elementCode: "", elementName: "", categoryCode: "DIRECT_MANPOWER", isDirect: true, quantity: 0 }]
    });
    expect(invalidDerived[0].position).toBe("");
    expect(invalidDerived[0].quantity).toBe(0);
    expect(invalidDerived[0].isValid).toBe(false);

    // Reject blank position
    const blankPosRes = await postConvertContract(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          contractNumber: `UAT-SG-T1-CON-${suffix}-INV1`,
          startDate: "2026-08-01",
          endDate: "2026-09-30",
          manpowerItems: [{ position: "  ", quantity: 10, deploymentType: "REGULAR" }]
        })
      }),
      { params: { id: sgProposalId } }
    );
    expect(blankPosRes.status).toBe(400);

    // Reject <= 0 headcount
    const zeroQtyRes = await postConvertContract(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          contractNumber: `UAT-SG-T1-CON-${suffix}-INV2`,
          startDate: "2026-08-01",
          endDate: "2026-09-30",
          manpowerItems: [{ position: "Security Guard", quantity: 0, deploymentType: "REGULAR" }]
        })
      }),
      { params: { id: sgProposalId } }
    );
    expect(zeroQtyRes.status).toBe(400);

    // Reject negative noticePeriodDays
    const negNoticeRes = await postConvertContract(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          contractNumber: `UAT-SG-T1-CON-${suffix}-INV3`,
          startDate: "2026-08-01",
          endDate: "2026-09-30",
          noticePeriodDays: -10
        })
      }),
      { params: { id: sgProposalId } }
    );
    expect(negNoticeRes.status).toBe(400);
  });

  it("DEF-048 & DEF-047: converts accepted proposal to DRAFT contract persisting noticePeriodDays, contractNumber, and clean staffing rows", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: sgCreator });

    const contractNumber = `UAT-SG-T1-CON-${suffix}`;
    const convRes = await postConvertContract(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${sgProposalId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          contractNumber: `  ${contractNumber}  `,
          startDate: "2026-08-01",
          endDate: "2026-09-30",
          noticePeriodDays: 60,
          billingBasis: "MONTHLY",
          totalContractValue: 130000,
          manpowerItems: [
            { position: "Security Guard", quantity: 10, deploymentType: "REGULAR" },
            { position: "Security Supervisor", quantity: 2, deploymentType: "SUPERVISOR" },
            { position: "CCTV Operator", quantity: 2, deploymentType: "REGULAR" }
          ]
        })
      }),
      { params: { id: sgProposalId } }
    );
    expect(convRes.status).toBe(200);
    const convData = await convRes.json();
    expect(convData.success).toBe(true);
    expect(convData.contract.contractNumber).toBe(contractNumber);
    expect(convData.contract.status).toBe("DRAFT");
    expect(convData.contract.approvalStatus).toBe("DRAFT");
    expect(convData.contract.noticePeriodDays).toBe(60);
    expect(Number(convData.contract.totalContractValue)).toBe(130000);
    expect(convData.contract.clientId).toBe(sgClientId);
    expect(convData.contract.manpowerRequirements).toHaveLength(3);
    expect(convData.contract.manpowerRequirements.find((m: any) => m.position === "Security Guard")?.quantity).toBe(10);
  });

  it("UI regression check: conversion wizard removes broken positionTitle/headcount bindings and placeholder text", () => {
    const wizardSource = fs.readFileSync(
      path.resolve(__dirname, "../../apps/web/app/commercial/contract-conversion/[id]/page.tsx"),
      "utf8"
    );
    expect(wizardSource).not.toContain("item.positionTitle");
    expect(wizardSource).not.toContain("item.headcount");
    expect(wizardSource).not.toContain("Standard defaults will apply");
    expect(wizardSource).toContain("Notice Period (Days)");
    expect(wizardSource).toContain("Link Client Master");
  });
});
