import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { GET as getRateCards, POST as postRateCard } from "../../apps/web/app/api/v1/settings/commercial-contract/cost-configurations/[entityType]/route";
import { POST as postVersion } from "../../apps/web/app/api/v1/settings/commercial-contract/cost-configurations/[entityType]/[id]/versions/route";
import { POST as postLifecycle } from "../../apps/web/app/api/v1/settings/commercial-contract/cost-configurations/[entityType]/[id]/versions/[versionId]/lifecycle/route";
import { GET as getAuditLogs } from "../../apps/web/app/api/v1/audit/logs/route";
import { GET as getActivities } from "../../apps/web/app/api/v1/commercial/activities/route";
import { assessCostingValidation } from "../../apps/web/lib/precontract-costing";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

const mockedGetServerSession = getServerSession as jest.Mock;

describe("Shana UAT Day 9 Consolidated Remediation (PC-2A, DEF-104, Audit Logs, Activity Feed)", () => {
  const suffix = `UAT9-${Date.now()}`;
  const companyAId = `comp-uat9-a-${suffix}`;
  const companyBId = `comp-uat9-b-${suffix}`;
  let createdMasterId: string | null = null;
  let createdVersionId: string | null = null;

  beforeAll(async () => {
    await prisma.company.createMany({
      data: [
        { id: companyAId, companyName: `UAT9 Company A ${suffix}`, companyCode: `U9A-${Date.now().toString().slice(-5)}` },
        { id: companyBId, companyName: `UAT9 Company B ${suffix}`, companyCode: `U9B-${Date.now().toString().slice(-5)}` },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    if (createdVersionId) {
      await prisma.costRateCardVersion.deleteMany({ where: { id: createdVersionId } });
    }
    if (createdMasterId) {
      await prisma.costRateCardMaster.deleteMany({ where: { id: createdMasterId } });
      await prisma.userActivityLog.deleteMany({ where: { entityId: createdMasterId } });
    }
    if (createdVersionId) {
      await prisma.userActivityLog.deleteMany({ where: { entityId: createdVersionId } });
    }
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
  });

  const makeSession = (id: string, role: string, companyId: string) => ({
    user: {
      id,
      email: `${id}@uat.local`,
      name: id,
      role,
      companyId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
    },
  });

  test("1. PC-2A Rate Card: Finance Manager & Commercial Maker/Checker separation + audit logging", async () => {
    // Finance Viewer can view (200) but cannot create (403)
    mockedGetServerSession.mockResolvedValue(makeSession(`fin-view-${suffix}`, "FINANCE_VIEWER", companyAId));
    const viewRes = await getRateCards(
      new Request("http://localhost/api/v1/settings/commercial-contract/cost-configurations/rate-cards"),
      { params: { entityType: "rate-cards" } }
    );
    expect(viewRes.status).toBe(200);

    const viewerPostRes = await postRateCard(
      new Request("http://localhost/api/v1/settings/commercial-contract/cost-configurations/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `RC-DENY-${suffix}`, name: "Denied", currency: "QAR" }),
      }),
      { params: { entityType: "rate-cards" } }
    );
    expect(viewerPostRes.status).toBe(403);

    // Commercial Maker creates Rate Card Master + Draft Version + Submits for Review
    mockedGetServerSession.mockResolvedValue(makeSession(`maker-${suffix}`, "COMMERCIAL_MAKER", companyAId));
    const createRes = await postRateCard(
      new Request("http://localhost/api/v1/settings/commercial-contract/cost-configurations/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `RC-${suffix}`, name: "SG Synthetic Rate Card", currency: "QAR" }),
      }),
      { params: { entityType: "rate-cards" } }
    );
    expect(createRes.status).toBe(201);
    const createdMaster = await createRes.json();
    createdMasterId = createdMaster.data.id;

    const verRes = await postVersion(
      new Request(`http://localhost/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${createdMasterId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom: "2026-01-01",
          ratesJson: { BASIC_PAY: 1500, ALLOWANCES: 500, RELIEVER_COST: 350 },
        }),
      }),
      { params: { entityType: "rate-cards", id: createdMasterId! } }
    );
    expect(verRes.status).toBe(201);
    const verData = await verRes.json();
    createdVersionId = verData.data.id;

    const submitRes = await postLifecycle(
      new Request("http://localhost/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { entityType: "rate-cards", id: createdMasterId!, versionId: createdVersionId! } }
    );
    expect(submitRes.status).toBe(200);

    // Maker cannot self-APPROVE (409 Maker/Checker SoD enforcement)
    const makerApproveRes = await postLifecycle(
      new Request("http://localhost/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { entityType: "rate-cards", id: createdMasterId!, versionId: createdVersionId! } }
    );
    expect(makerApproveRes.status).toBe(409);

    // Cross-company Checker cannot APPROVE (403 company boundary)
    mockedGetServerSession.mockResolvedValue(makeSession(`checker-b-${suffix}`, "COMMERCIAL_CHECKER", companyBId));
    const crossCompRes = await postLifecycle(
      new Request("http://localhost/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { entityType: "rate-cards", id: createdMasterId!, versionId: createdVersionId! } }
    );
    expect(crossCompRes.status).toBe(403);

    // Same-company Commercial Checker can APPROVE and ACTIVATE
    mockedGetServerSession.mockResolvedValue(makeSession(`checker-a-${suffix}`, "COMMERCIAL_CHECKER", companyAId));
    const approveRes = await postLifecycle(
      new Request("http://localhost/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { entityType: "rate-cards", id: createdMasterId!, versionId: createdVersionId! } }
    );
    expect(approveRes.status).toBe(200);

    const activateRes = await postLifecycle(
      new Request("http://localhost/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE" }),
      }),
      { params: { entityType: "rate-cards", id: createdMasterId!, versionId: createdVersionId! } }
    );
    expect(activateRes.status).toBe(200);

    // Verify User Action Audit recorded the PC-2A creation in UserActivityLog
    mockedGetServerSession.mockResolvedValue(makeSession(`admin-${suffix}`, "ADMIN", companyAId));
    const auditRes = await getAuditLogs();
    expect(auditRes.status).toBe(200);
    const logs = await auditRes.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.some((l: any) => l.entityId === createdMasterId)).toBe(true);
  });

  test("2. DEF-104 Costing Validation: HEADCOUNT=14 + RELIEVER_REQUIRED=true + ACTIVE rate card validates cleanly", () => {
    const summary = assessCostingValidation(
      [
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-active-1",
        items: [
          { elementCode: "BASIC_PAY", quantity: 14, unitRate: 1500, calculationBasis: "CONFIGURED_RATE_CARD" },
          { elementCode: "ALLOWANCES", quantity: 14, unitRate: 500, calculationBasis: "CONFIGURED_RATE_CARD" },
          { elementCode: "RELIEVER_COST", quantity: 2.33, unitRate: 350, calculationBasis: "CONFIGURED_RATE_CARD" },
        ],
        overrides: [],
      }
    );
    expect(summary.hasMappedSurveyHeadcount).toBe(true);
    expect(summary.assumedFallbackHeadcount).toBe(false);
    expect(summary.blocksCommercialSubmission).toBe(false);
    expect(summary.validationStatus).toBe("VALIDATED_CONFIGURED");
  });

  test("3. Activity Feed: Finance Manager, Finance Viewer, Commercial Maker & Checker all load feed (200)", async () => {
    for (const role of ["FINANCE_MANAGER", "FINANCE_VIEWER", "COMMERCIAL_MAKER", "COMMERCIAL_CHECKER", "ADMIN"]) {
      mockedGetServerSession.mockResolvedValue(makeSession(`act-${role}-${suffix}`, role, companyAId));
      const res = await getActivities(
        new NextRequest("http://localhost/api/v1/commercial/activities?feedMode=true")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.feed)).toBe(true);
    }
  });

  test("4. User Action Audit RBAC: unauthorized Finance Viewer receives 403", async () => {
    mockedGetServerSession.mockResolvedValue(makeSession(`fin-view-audit-${suffix}`, "FINANCE_VIEWER", companyAId));
    const res = await getAuditLogs();
    expect(res.status).toBe(403);
  });
});
