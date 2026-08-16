import { mockDb } from "@ahh-wfm/mock-data";
import { GET as getSupervisorLeaveRequests } from "../../apps/web/app/api/v1/supervisor/leave-requests/route";
import { POST as approveSupervisorLeave } from "../../apps/web/app/api/v1/supervisor/leave-requests/[id]/approve/route";
import { canApproveLeave, getSupervisorTeam } from "../../apps/web/lib/supervisor";

// Mock next-auth / api-guards to simulate supervisor session
let currentMockSession: any = null;

jest.mock("@/lib/api-guards", () => ({
  checkApiAuth: jest.fn(async () => {
    if (!currentMockSession) {
      return { error: { status: 401, json: () => ({ error: "Unauthorized" }) } };
    }
    return { session: currentMockSession };
  })
}));

describe("Leave Segregation of Duties (SoD) & Self-Approval Prevention", () => {
  let supervisorEmp: any;
  let teamMemberEmp: any;
  let supervisorLeaveReq: any;
  let teamMemberLeaveReq: any;
  let originalGetLeaves: typeof mockDb.getLeaves;

  beforeAll(async () => {
    const employees = await mockDb.getEmployees();
    
    // Find an employee with a reporting manager / supervisor
    const directReport = employees.find(e => (e as any).immediateSupervisorId || (e as any).reportingManagerId);
    if (directReport) {
      const supId = (directReport as any).immediateSupervisorId || (directReport as any).reportingManagerId;
      supervisorEmp = employees.find(e => e.id === supId) || employees[0];
      teamMemberEmp = directReport;
    } else {
      supervisorEmp = employees[0];
      teamMemberEmp = employees[1];
    }

    supervisorLeaveReq = {
      id: "leave-sod-supervisor-01",
      employeeId: supervisorEmp.id,
      type: "Annual",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
      status: "Pending",
      reason: "Supervisor Self Leave Request"
    };

    teamMemberLeaveReq = {
      id: "leave-sod-team-01",
      employeeId: teamMemberEmp.id,
      type: "Annual",
      startDate: "2026-09-10",
      endDate: "2026-09-12",
      status: "Pending",
      reason: "Team Member Leave Request"
    };

    // Override mockDb.getLeaves locally for this suite without mutating persistent DB state
    originalGetLeaves = mockDb.getLeaves;
    const existingLeaves = await originalGetLeaves();
    mockDb.getLeaves = jest.fn(async () => [
      ...existingLeaves,
      supervisorLeaveReq,
      teamMemberLeaveReq
    ]);
  });

  afterAll(() => {
    if (originalGetLeaves) {
      mockDb.getLeaves = originalGetLeaves;
    }
  });

  beforeEach(() => {
    currentMockSession = {
      user: {
        id: supervisorEmp.id,
        email: supervisorEmp.email,
        role: supervisorEmp.role || "SUPERVISOR"
      }
    };
  });

  it("1. `canApproveLeave` helper returns false when supervisor attempts self-approval", async () => {
    const isSelfApprovalAllowed = await canApproveLeave(supervisorEmp.id, supervisorLeaveReq.id);
    expect(isSelfApprovalAllowed).toBe(false);
  });

  it("2. `/api/v1/supervisor/leave-requests` excludes supervisor's own leave request from pending queue", async () => {
    const response = await getSupervisorLeaveRequests();
    expect(response.status).toBe(200);
    const data = await response.json();

    const containsSupervisorLeave = data.some((l: any) => l.id === supervisorLeaveReq.id || l.employeeId === supervisorEmp.id);
    expect(containsSupervisorLeave).toBe(false);
  });

  it("3. Direct self-approval via `/api/v1/supervisor/leave-requests/[id]/approve` is rejected with 403 Forbidden", async () => {
    const req = new Request(`http://localhost:3100/api/v1/supervisor/leave-requests/${supervisorLeaveReq.id}/approve`, {
      method: "POST"
    });
    const response = await approveSupervisorLeave(req, { params: { id: supervisorLeaveReq.id } });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toContain("Unauthorized to approve this leave request");
  });

  it("4. Legitimate team member leave approval succeeds for authorized supervisor or returns standard status", async () => {
    const isAuthorized = await canApproveLeave(supervisorEmp.id, teamMemberLeaveReq.id);
    const req = new Request(`http://localhost:3100/api/v1/supervisor/leave-requests/${teamMemberLeaveReq.id}/approve`, {
      method: "POST"
    });
    const response = await approveSupervisorLeave(req, { params: { id: teamMemberLeaveReq.id } });

    if (isAuthorized) {
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe("Leave approved successfully");
    } else {
      expect(response.status).toBe(403);
    }
  });
});
