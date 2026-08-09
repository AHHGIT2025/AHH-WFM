import { GET as wallboardGET } from "../../apps/mobile/app/api/v1/commercial/command-center/wallboard/route";
import { GET as escalationsGET } from "../../apps/mobile/app/api/v1/commercial/command-center/escalations/route";
import { GET as escalationDetailGET, PATCH as escalationActionPATCH } from "../../apps/mobile/app/api/v1/commercial/command-center/escalations/[id]/route";
import { GET as coverageGET } from "../../apps/mobile/app/api/v1/commercial/command-center/roster-coverage/route";
import { GET as healthGET } from "../../apps/mobile/app/api/v1/commercial/command-center/commercial-health/route";

const globalFetch = global.fetch;

describe("CCC-6 Mobile Command Suite BFF & Proxy Route Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = globalFetch;
  });

  test("1. Wallboard BFF GET forwards request to authoritative Web API and returns 200 payload", async () => {
    const mockResponse = {
      context: { businessDate: "2026-08-09", operationType: "ALL", companyId: null },
      primaryKpis: { overallHealthScore: 85, overallCoveragePercentage: 96, totalOpenEscalations: 2 },
      attendancePulse: { presentToday: 40, absentToday: 2 },
      rosterCoverage: { requiredSlotsCount: 42, assignedSlotsCount: 40 },
      escalationSummary: { metrics: { totalOpen: 2, criticalCount: 0 } },
      commercialPortfolio: { portfolioMetrics: { totalActiveContracts: 8 } }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/wallboard?operationType=ALL", {
      headers: { cookie: "next-auth.session-token=mock-token-123" }
    });

    const res = await wallboardGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.primaryKpis.overallHealthScore).toBe(85);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3100/api/v1/commercial/command-center/wallboard?operationType=ALL",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ cookie: "next-auth.session-token=mock-token-123" })
      })
    );
  });

  test("2. Escalation List BFF GET forwards request to Web API", async () => {
    const mockResponse = {
      summaryMetrics: { totalOpen: 1, criticalCount: 0 },
      escalations: [{ id: "UNCOVERED_ROSTER_SLOT:1", status: "OPEN" }]
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/escalations", {
      headers: { cookie: "next-auth.session-token=mock-token-123" }
    });

    const res = await escalationsGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.escalations.length).toBe(1);
  });

  test("3. Escalation Action BFF PATCH forwards action body (ACKNOWLEDGE) to Web API", async () => {
    const mockResponse = {
      success: true,
      escalationId: "UNCOVERED_ROSTER_SLOT:1",
      action: "ACKNOWLEDGE",
      updatedStatus: "ACKNOWLEDGED"
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/escalations/UNCOVERED_ROSTER_SLOT:1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: "next-auth.session-token=mock-token-123"
      },
      body: JSON.stringify({ action: "ACKNOWLEDGE", remarks: "Acknowledged from Mobile" })
    });

    const res = await escalationActionPATCH(req, { params: { id: "UNCOVERED_ROSTER_SLOT:1" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.action).toBe("ACKNOWLEDGE");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3100/api/v1/commercial/command-center/escalations/UNCOVERED_ROSTER_SLOT:1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "ACKNOWLEDGE", remarks: "Acknowledged from Mobile" })
      })
    );
  });

  test("4. Roster Coverage BFF GET forwards request to Web API", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ coveragePercentage: 95 })
    });

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/roster-coverage");
    const res = await coverageGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.coveragePercentage).toBe(95);
  });

  test("5. Commercial Health BFF GET forwards request to Web API", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ portfolioMetrics: { healthyContractsCount: 5 } })
    });

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/commercial-health");
    const res = await healthGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.portfolioMetrics.healthyContractsCount).toBe(5);
  });

  test("6. Returns 502 Bad Gateway if Web API is unreachable", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/wallboard");
    const res = await wallboardGET(req);

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("Failed to connect");
  });
});
