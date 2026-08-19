import { GET as approvalsListGET } from "../../apps/mobile/app/api/v1/approvals/route";
import { GET as approvalDetailGET } from "../../apps/mobile/app/api/v1/approvals/[id]/route";
import { POST as approvalActionPOST } from "../../apps/mobile/app/api/v1/approvals/[id]/action/route";

const globalFetch = global.fetch;

describe("PW-8 Mobile Universal Approval Center BFF & Security Tests", () => {
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

  test("1. Mobile Approvals List BFF forwards query params, cookies, and auth headers to authoritative Web API", async () => {
    const mockInboxResponse = {
      success: true,
      items: [
        { id: "wf-inst-01", reference: "CONV-2026-001", sourceModule: "COMMERCIAL", currentWorkflowStatus: "PENDING_APPROVAL", requesterName: "Officer A" }
      ],
      stats: { pendingCount: 1, totalOutboxCount: 5 }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockInboxResponse)
    });

    const req = new Request("http://localhost:3101/api/v1/approvals?tab=inbox&module=COMMERCIAL&search=CONV", {
      headers: {
        cookie: "next-auth.session-token=mock-user-session",
        authorization: "Bearer mock-bearer-token"
      }
    });

    const res = await approvalsListGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].reference).toBe("CONV-2026-001");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3100/api/v1/approvals?tab=inbox&module=COMMERCIAL&search=CONV",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          cookie: "next-auth.session-token=mock-user-session",
          authorization: "Bearer mock-bearer-token"
        })
      })
    );
  });

  test("2. Mobile Approval Detail BFF forwards ID param and preserves business detail contract", async () => {
    const mockDetailResponse = {
      success: true,
      data: {
        summary: { reference: "CONV-2026-001", moduleType: "COMMERCIAL", title: "Contract Conversion Approval", requesterName: "Officer A" },
        canAct: true,
        instance: { id: "wf-inst-01", status: "IN_PROGRESS" },
        lifecycle: [
          { stepNumber: 0, title: "Request Submitted", status: "COMPLETED", action: "SUBMIT" }
        ]
      }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockDetailResponse)
    });

    const req = new Request("http://localhost:3101/api/v1/approvals/wf-inst-01", {
      headers: { cookie: "next-auth.session-token=mock-user-session" }
    });

    const res = await approvalDetailGET(req, { params: { id: "wf-inst-01" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.canAct).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3100/api/v1/approvals/wf-inst-01",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ cookie: "next-auth.session-token=mock-user-session" })
      })
    );
  });

  test("3. Mobile Approval Action BFF forwards action payload with remarks to authoritative WorkflowEngine", async () => {
    const mockActionResponse = {
      success: true,
      message: "Action APPROVE executed successfully.",
      data: { instanceId: "wf-inst-01", status: "APPROVED", currentLevelNumber: 2 }
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockActionResponse)
    });

    const req = new Request("http://localhost:3101/api/v1/approvals/wf-inst-01/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "next-auth.session-token=mock-approver-session"
      },
      body: JSON.stringify({ action: "APPROVE", remarks: "Approved on Mobile via PW-8" })
    });

    const res = await approvalActionPOST(req, { params: { id: "wf-inst-01" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("APPROVED");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3100/api/v1/approvals/wf-inst-01/action",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          cookie: "next-auth.session-token=mock-approver-session"
        }),
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved on Mobile via PW-8" })
      })
    );
  });

  test("4. Security & Fail-Closed: Unauthenticated request propagates 401 Unauthorized from Web API", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: "Unauthorized: Missing session or invalid token" })
    });

    const req = new Request("http://localhost:3101/api/v1/approvals");
    const res = await approvalsListGET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Unauthorized");
  });

  test("5. Security & Isolation: Cross-company boundary or unauthorized access propagates 403 Forbidden", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ error: "Forbidden: Company boundary violation" })
    });

    const req = new Request("http://localhost:3101/api/v1/approvals/wf-inst-other-company", {
      headers: { cookie: "next-auth.session-token=mock-tenant-session" }
    });

    const res = await approvalDetailGET(req, { params: { id: "wf-inst-other-company" } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Forbidden: Company boundary violation");
  });

  test("6. SoD & Workflow Rules: Self-approval or invalid workflow transition propagates 403/409 from Web Engine", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ success: false, error: "Segregation of Duties Violation: Requester cannot approve their own request." })
    });

    const req = new Request("http://localhost:3101/api/v1/approvals/wf-inst-01/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "next-auth.session-token=mock-requester-session"
      },
      body: JSON.stringify({ action: "APPROVE", remarks: "Self approval attempt" })
    });

    const res = await approvalActionPOST(req, { params: { id: "wf-inst-01" } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Segregation of Duties Violation");
  });

  test("7. Upstream Availability: Web API network failure returns structured 502 Bad Gateway without leaking internals", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:3100"));

    const req = new Request("http://localhost:3101/api/v1/approvals");
    const res = await approvalsListGET(req);

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("Failed to connect to authoritative Universal Approvals API.");
  });
});
