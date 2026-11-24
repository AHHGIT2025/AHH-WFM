import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { PATCH as patchCostingRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #10: Estimator Override Authorization & UI (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyAId: string;
  let companyBId: string;
  let makerId: string;
  let commAdminId: string;
  let adminId: string;
  let compBAdminId: string;
  let clientId: string;
  let oppId: string;
  let surveyId: string;
  let estimateId: string;
  let inWfEstimateId: string;

  const makerSession = () => ({
    user: {
      id: makerId,
      email: `iss10-mk-${rand}@ahh.local`,
      name: "Issue10 Maker",
      role: "COMMERCIAL_MAKER",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const commAdminSession = () => ({
    user: {
      id: commAdminId,
      email: `iss10-ca-${rand}@ahh.local`,
      name: "Issue10 CommAdmin",
      role: "COMMERCIAL_ADMIN",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const adminSession = () => ({
    user: {
      id: adminId,
      email: `iss10-ad-${rand}@ahh.local`,
      name: "Issue10 Admin",
      role: "ADMIN",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const compBMakerSession = () => ({
    user: {
      id: compBAdminId,
      email: `iss10-cb-${rand}@ahh.local`,
      name: "Issue10 CompB Maker",
      role: "COMMERCIAL_MAKER",
      companyId: companyBId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  beforeAll(async () => {
    const [compA, compB] = await Promise.all([
      prisma.company.create({ data: { companyName: `Issue10 CoA ${rand}`, companyCode: `I10A-${rand}`, isActive: true } }),
      prisma.company.create({ data: { companyName: `Issue10 CoB ${rand}`, companyCode: `I10B-${rand}`, isActive: true } }),
    ]);
    companyAId = compA.id;
    companyBId = compB.id;

    const [m, ca, ad, cb] = await Promise.all([
      prisma.employee.create({ data: { id: `emp-i10-mk-${rand}`, name: "Issue10 Maker", department: "Commercial", companyId: companyAId, role: "COMMERCIAL_MAKER", status: "Active", email: `iss10-mk-${rand}@ahh.local` } }),
      prisma.employee.create({ data: { id: `emp-i10-ca-${rand}`, name: "Issue10 CommAdmin", department: "Commercial", companyId: companyAId, role: "COMMERCIAL_ADMIN", status: "Active", email: `iss10-ca-${rand}@ahh.local` } }),
      prisma.employee.create({ data: { id: `emp-i10-ad-${rand}`, name: "Issue10 Admin", department: "Admin", companyId: companyAId, role: "ADMIN", status: "Active", email: `iss10-ad-${rand}@ahh.local` } }),
      prisma.employee.create({ data: { id: `emp-i10-cb-${rand}`, name: "Issue10 CompB", department: "Commercial", companyId: companyBId, role: "COMMERCIAL_ADMIN", status: "Active", email: `iss10-cb-${rand}@ahh.local` } }),
    ]);
    makerId = m.id;
    commAdminId = ca.id;
    adminId = ad.id;
    compBAdminId = cb.id;

    const client = await prisma.preContractProspectClient.create({
      data: { companyId: companyAId, operationType: "SECURITY_GUARDING", name: `Issue10 Client ${rand}` },
    });
    clientId = client.id;

    const opp = await prisma.preContractCase.create({
      data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `Issue10 Opp ${rand}`, prospectClientId: clientId, lifecycle: "COMPLETED", businessOutcome: "IN_PROGRESS", createdBy: makerId },
    });
    oppId = opp.id;

    const survey = await prisma.preContractSurvey.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        lifecycle: "COMPLETED",
        conductedBy: makerId,
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 10 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        },
      },
    });
    surveyId = survey.id;

    const est = await prisma.preContractCostEstimate.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        surveyId,
        status: "DRAFT",
        createdBy: makerId,
        versions: {
          create: [
            {
              versionNumber: 1,
              status: "DRAFT",
              pricingBasis: "MARKUP",
              totalDirectCost: 20000,
              totalIndirectCost: 0,
              totalCost: 20000,
              targetMarkupPercentage: 20,
              sellingPrice: 24000,
              createdBy: makerId,
            },
          ],
        },
      },
    });
    estimateId = est.id;

    const est2 = await prisma.preContractCostEstimate.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        surveyId,
        status: "IN_WORKFLOW",
        createdBy: makerId,
        versions: {
          create: [
            {
              versionNumber: 1,
              status: "SUBMITTED",
              pricingBasis: "MARKUP",
              totalDirectCost: 20000,
              totalIndirectCost: 0,
              totalCost: 20000,
              targetMarkupPercentage: 20,
              sellingPrice: 24000,
              createdBy: makerId,
            },
          ],
        },
      },
    });
    inWfEstimateId = est2.id;
  });

  afterAll(async () => {
    try {
      await prisma.preContractCostOverrideLog.deleteMany({ where: { estimateVersion: { estimateId: { in: [estimateId, inWfEstimateId] } } } });
      await prisma.preContractCostEstimateItem.deleteMany({ where: { estimateVersion: { estimateId: { in: [estimateId, inWfEstimateId] } } } });
      await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId: { in: [estimateId, inWfEstimateId] } } });
      await prisma.preContractCostEstimate.deleteMany({ where: { id: { in: [estimateId, inWfEstimateId] } } });
      await prisma.surveyResponse.deleteMany({ where: { surveyId } });
      await prisma.preContractSurvey.deleteMany({ where: { id: surveyId } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.preContractProspectClient.deleteMany({ where: { id: clientId } });
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, commAdminId, adminId, compBAdminId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    await prisma.$disconnect();
  });

  it("1. Standard estimator (COMMERCIAL_MAKER) can edit DRAFT pricingBasis (200) but CANNOT apply overrides (403)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());

    const marginRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricingBasis: "MARKUP", targetMarkupPercentage: 22 }),
      }),
      { params: { id: estimateId } }
    );
    expect(marginRes.status).toBe(200);

    const overrideRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 3000, reason: "Unauthorized attempt" }],
        }),
      }),
      { params: { id: estimateId } }
    );
    expect(overrideRes.status).toBe(403);
  });

  it("2. COMMERCIAL_ADMIN can apply override-only PATCH (200) with audit log, but cannot edit non-override fields (403)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(commAdminSession());

    const nonOverrideRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMarkupPercentage: 25 }),
      }),
      { params: { id: estimateId } }
    );
    expect(nonOverrideRes.status).toBe(403);

    // Mixed override + non-override edit by COMMERCIAL_ADMIN (lacks manage) must be rejected (403)
    const mixedRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMarkupPercentage: 25,
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 2800, reason: "Mixed attempt" }],
        }),
      }),
      { params: { id: estimateId } }
    );
    expect(mixedRes.status).toBe(403);

    // Malformed non-array overrides rejected (400)
    const malformedRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: "malformed" }),
      }),
      { params: { id: estimateId } }
    );
    expect(malformedRes.status).toBe(400);

    const overrideRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 2800, reason: "Authorized commercial admin calibration" }],
        }),
      }),
      { params: { id: estimateId } }
    );
    expect(overrideRes.status).toBe(200);
    const data = await overrideRes.json();
    expect(data.estimate.versions[0].overrides.length).toBeGreaterThanOrEqual(1);
    expect(data.estimate.versions[0].overrides[0].reason).toContain("Authorized commercial admin calibration");
  });

  it("3. Cross-company override is blocked (403) and IN_WORKFLOW estimate blocks overrides (400)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(compBMakerSession());
    const crossRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 2500, reason: "Cross company" }],
        }),
      }),
      { params: { id: estimateId } }
    );
    expect(crossRes.status).toBe(403);

    (getServerSession as jest.Mock).mockResolvedValue(adminSession());
    const inWfRes = await patchCostingRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${inWfEstimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 2500, reason: "In workflow attempt" }],
        }),
      }),
      { params: { id: inWfEstimateId } }
    );
    expect(inWfRes.status).toBe(400);
  });

  it("4. Costing UI restricts Override Line Rate to DRAFT + canOverrideCosting and explains authorization to non-override users", () => {
    const uiPath = path.resolve(__dirname, "../../apps/web/app/commercial/costing/page.tsx");
    const source = fs.readFileSync(uiPath, "utf8");
    expect(source).toContain('selectedEstimate.status === "DRAFT" && canOverrideCosting');
    expect(source).toContain("precontract.costing.override");
  });
});
