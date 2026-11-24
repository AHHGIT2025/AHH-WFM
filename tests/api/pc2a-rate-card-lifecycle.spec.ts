import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { GET as listRateCardsRoute, POST as createRateCardRoute } from "@/app/api/v1/settings/commercial-contract/cost-configurations/[entityType]/route";
import { POST as createVersionRoute } from "@/app/api/v1/settings/commercial-contract/cost-configurations/[entityType]/[id]/versions/route";
import { POST as lifecycleRoute } from "@/app/api/v1/settings/commercial-contract/cost-configurations/[entityType]/[id]/versions/[versionId]/lifecycle/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("PC-2A Rate Card Configuration, Maker/Checker & Activation Lifecycle (TEST DATABASE)", () => {
  jest.setTimeout(30000);
  const rand = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const companyId = `COMP-PC2A-${rand}`;
  const makerId = `emp-pc2a-mk-${rand}`;
  const checkerId = `emp-pc2a-ck-${rand}`;
  const viewerId = `emp-pc2a-vw-${rand}`;
  let masterId = "";
  let versionId = "";

  const financeMakerSession = {
    id: makerId,
    employeeId: makerId,
    name: "Finance Maker",
    email: `fin-mk-${rand}@test.local`,
    role: "COMMERCIAL_FINANCE",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
  };

  const financeCheckerSession = {
    id: checkerId,
    employeeId: checkerId,
    name: "Finance Checker",
    email: `fin-ck-${rand}@test.local`,
    role: "COMMERCIAL_ADMIN",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
  };

  const unauthorizedSession = {
    id: viewerId,
    employeeId: viewerId,
    name: "Employee No CostConfig",
    email: `vw-${rand}@test.local`,
    role: "EMPLOYEE",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
  };

  beforeAll(async () => {
    await prisma.company.create({
      data: { id: companyId, companyCode: `PC2A-${rand}`, companyName: `PC2A Synthetic Co ${rand}`, isActive: true },
    });
    await prisma.employee.createMany({
      data: [
        { id: makerId, name: "Finance Maker", department: "Finance", companyId, role: "COMMERCIAL_FINANCE", status: "Active", email: `fin-mk-${rand}@test.local` },
        { id: checkerId, name: "Finance Checker", department: "Commercial", companyId, role: "COMMERCIAL_ADMIN", status: "Active", email: `fin-ck-${rand}@test.local` },
        { id: viewerId, name: "Viewer Only", department: "HR", companyId, role: "COMMERCIAL_HR", status: "Active", email: `vw-${rand}@test.local` },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (masterId) {
        await (prisma as any).costRateCardMaster.deleteMany({ where: { id: masterId } });
      }
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checkerId, viewerId] } } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Denies unauthorized users (403) from creating or viewing PC-2A rate cards", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: unauthorizedSession });

    const listRes = await listRateCardsRoute(
      new Request("http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards"),
      { params: { entityType: "rate-cards" } }
    );
    expect(listRes.status).toBe(403);

    const createRes = await createRateCardRoute(
      new Request("http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `RC-DENY-${rand}`, name: "Denied", currency: "QAR" }),
      }),
      { params: { entityType: "rate-cards" } }
    );
    expect(createRes.status).toBe(403);
  });

  it("2. Finance Maker creates rate card + draft version, submits, self-approval blocked (409), Checker approves, and ACTIVATE preserves Checker approvedBy", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: financeMakerSession });

    const createMasterRes = await createRateCardRoute(
      new Request("http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `RC-SYN-${rand}`, name: "Synthetic SG Rate Card", currency: "QAR" }),
      }),
      { params: { entityType: "rate-cards" } }
    );
    expect(createMasterRes.status).toBe(201);
    const createdMaster = await createMasterRes.json();
    masterId = createdMaster.data.id;

    const createVerRes = await createVersionRoute(
      new Request(`http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
          ratesJson: { BASIC_PAY: 2450, ALLOWANCES: 950 },
        }),
      }),
      { params: { entityType: "rate-cards", id: masterId } }
    );
    expect(createVerRes.status).toBe(201);
    const createdVer = await createVerRes.json();
    versionId = createdVer.data.id;
    expect(createdVer.data.status).toBe("DRAFT");

    const submitRes = await lifecycleRoute(
      new Request(`http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions/${versionId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { entityType: "rate-cards", id: masterId, versionId } }
    );
    expect(submitRes.status).toBe(200);
    expect((await submitRes.json()).data.status).toBe("UNDER_REVIEW");

    // Maker self-approval blocked (409)
    const selfApproveRes = await lifecycleRoute(
      new Request(`http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions/${versionId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { entityType: "rate-cards", id: masterId, versionId } }
    );
    expect(selfApproveRes.status).toBe(409);

    // Cross-company Finance user cannot lifecycle-act on another company's rate card (403)
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { ...financeCheckerSession, id: `emp-other-${rand}`, companyId: `COMP-OTHER-${rand}` },
    });
    const crossCompRes = await lifecycleRoute(
      new Request(`http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions/${versionId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { entityType: "rate-cards", id: masterId, versionId } }
    );
    expect(crossCompRes.status).toBe(403);

    // Independent Checker approves
    (getServerSession as jest.Mock).mockResolvedValue({ user: financeCheckerSession });
    const approveRes = await lifecycleRoute(
      new Request(`http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions/${versionId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", comment: "Checker approved" }),
      }),
      { params: { entityType: "rate-cards", id: masterId, versionId } }
    );
    expect(approveRes.status).toBe(200);
    const approvedData = await approveRes.json();
    expect(approvedData.data.status).toBe("APPROVED");
    expect(approvedData.data.approvedBy).toBe(checkerId);

    // Even if Maker executes ACTIVATE, approvedBy must remain checkerId (never overwritten with makerId)
    (getServerSession as jest.Mock).mockResolvedValue({ user: financeMakerSession });
    const activateRes = await lifecycleRoute(
      new Request(`http://localhost:3100/api/v1/settings/commercial-contract/cost-configurations/rate-cards/${masterId}/versions/${versionId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE" }),
      }),
      { params: { entityType: "rate-cards", id: masterId, versionId } }
    );
    expect(activateRes.status).toBe(200);
    const activeData = await activateRes.json();
    expect(activeData.data.status).toBe("ACTIVE");
    expect(activeData.data.createdBy).toBe(makerId);
    expect(activeData.data.approvedBy).toBe(checkerId);
  });
});
