import { GET as wallboardGET } from "../../apps/mobile/app/api/v1/commercial/command-center/wallboard/route";
import { GET as escalationsGET } from "../../apps/mobile/app/api/v1/commercial/command-center/escalations/route";
import { GET as escalationDetailGET, PATCH as escalationActionPATCH } from "../../apps/mobile/app/api/v1/commercial/command-center/escalations/[id]/route";
import { GET as coverageGET } from "../../apps/mobile/app/api/v1/commercial/command-center/roster-coverage/route";
import { GET as healthGET } from "../../apps/mobile/app/api/v1/commercial/command-center/commercial-health/route";
import { hasPermission } from "../../apps/mobile/lib/api-guards";
import { hasClientPermission } from "../../apps/mobile/lib/client-permissions";
import { getWebApiBaseUrl } from "../../apps/mobile/lib/server-config";

const globalFetch = global.fetch;

describe("CCC-6 Mobile Command Suite BFF & Authorization Tests", () => {
  const originalEnv = process.env.WEB_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WEB_API_URL;
  });

  afterAll(() => {
    global.fetch = globalFetch;
    if (originalEnv) process.env.WEB_API_URL = originalEnv;
    else delete process.env.WEB_API_URL;
  });

  test("1. Wallboard BFF GET forwards request to default LOCAL Web API target (http://localhost:3100)", async () => {
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

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/wallboard?operationType=ALL&businessDate=2026-08-09", {
      headers: { cookie: "next-auth.session-token=mock-token-123" }
    });

    const res = await wallboardGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.primaryKpis.overallHealthScore).toBe(85);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3100/api/v1/commercial/command-center/wallboard?operationType=ALL&businessDate=2026-08-09",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ cookie: "next-auth.session-token=mock-token-123" })
      })
    );
  });

  test("2. Wallboard BFF GET resolves SERVER Web API target when WEB_API_URL is configured", async () => {
    process.env.WEB_API_URL = "http://10.10.50.24:3200";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ status: "OK" })
    });

    const req = new Request("http://localhost:3101/api/v1/commercial/command-center/wallboard?scope=test");
    await wallboardGET(req);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://10.10.50.24:3200/api/v1/commercial/command-center/wallboard?scope=test",
      expect.anything()
    );
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

  test("4. Centralized authorization helpers hasPermission & hasClientPermission evaluate permissions & admin bypass accurately", () => {
    // Permission-holding user
    expect(hasPermission({ role: "EMPLOYEE", permissions: ["commercial.commandCenter.view"] }, "commercial.commandCenter.view")).toBe(true);
    expect(hasClientPermission({ role: "EMPLOYEE", permissions: ["commercial.commandCenter.view"] }, "commercial.commandCenter.view")).toBe(true);

    // Centralized SUPER_ADMIN and ADMIN bypass
    expect(hasPermission({ role: "SUPER_ADMIN" }, "commercial.commandCenter.view")).toBe(true);
    expect(hasClientPermission({ role: "SUPER_ADMIN" }, "commercial.commandCenter.view")).toBe(true);
    expect(hasPermission({ role: "ADMIN" }, "commercial.commandCenter.view")).toBe(true);
    expect(hasClientPermission({ role: "ADMIN" }, "commercial.commandCenter.view")).toBe(true);

    // Centralized manpower.admin.full_access bypass
    expect(hasPermission({ role: "MANAGER", permissions: ["manpower.admin.full_access"] }, "commercial.commandCenter.view")).toBe(true);
    expect(hasClientPermission({ role: "MANAGER", permissions: ["manpower.admin.full_access"] }, "commercial.commandCenter.view")).toBe(true);

    // Unauthorized user
    expect(hasPermission({ role: "EMPLOYEE", permissions: ["self.profile.view"] }, "commercial.commandCenter.view")).toBe(false);
    expect(hasClientPermission({ role: "EMPLOYEE", permissions: ["self.profile.view"] }, "commercial.commandCenter.view")).toBe(false);

    // Null/undefined user
    expect(hasPermission(null, "commercial.commandCenter.view")).toBe(false);
    expect(hasClientPermission(null, "commercial.commandCenter.view")).toBe(false);
  });

  test("5. getWebApiBaseUrl helper resolves SERVER vs LOCAL target deterministically", () => {
    delete process.env.WEB_API_URL;
    expect(getWebApiBaseUrl()).toBe("http://localhost:3100");

    process.env.WEB_API_URL = "http://10.10.50.24:3200";
    expect(getWebApiBaseUrl()).toBe("http://10.10.50.24:3200");

    process.env.WEB_API_URL = "http://10.10.50.24:3200/";
    expect(getWebApiBaseUrl()).toBe("http://10.10.50.24:3200");
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
