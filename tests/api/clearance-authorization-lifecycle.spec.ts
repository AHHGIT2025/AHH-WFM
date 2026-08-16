/**
 * Clearance Authorization & Security Matrix Regression
 * 
 * Section 1: Fail-closed 401 (session mock, no DB)
 * Section 2: Permission 403 (session mock, no DB)
 * Section 3: Deterministic DB fixtures — sign, fallback, self-service
 * Section 4: 200 authorized access
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@ahh-wfm/database";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

import { GET as getClearanceList, POST as createClearance } from "../../apps/web/app/api/v1/clearance/route";
import { GET as getClearanceDetail, PATCH as patchClearance, DELETE as deleteClearance } from "../../apps/web/app/api/v1/clearance/[id]/route";
import { POST as submitClearance } from "../../apps/web/app/api/v1/clearance/[id]/submit/route";
import { POST as signClearance } from "../../apps/web/app/api/v1/clearance/[id]/sign/route";
import { POST as approveClearanceStage } from "../../apps/web/app/api/v1/clearance/[id]/approve/route";
import { POST as rejectClearanceStage } from "../../apps/web/app/api/v1/clearance/[id]/reject/route";
import { POST as returnClearanceStage } from "../../apps/web/app/api/v1/clearance/[id]/return/route";
import { POST as markNotApplicableStage } from "../../apps/web/app/api/v1/clearance/[id]/mark-not-applicable/route";
import { GET as getClearanceTemplates, POST as createClearanceTemplate } from "../../apps/web/app/api/v1/clearance/templates/route";
import { GET as getTemplateDetail, PATCH as patchTemplate, DELETE as deleteTemplate } from "../../apps/web/app/api/v1/clearance/templates/[id]/route";

// =====================================================================
// TEST USER DEFINITIONS
// =====================================================================
const ADMIN_USER = {
  id: "clr-admin-001",
  name: "Admin User",
  role: "ADMIN",
  permissions: ["clearance.view", "clearance.create", "clearance.edit", "clearance.approve", "clearance.manage"]
};

const GUEST_USER = {
  id: "clr-guest-001",
  name: "No Perm User",
  role: "GUEST",
  permissions: []
};

// Subject employee: user.id = Employee.id (canonical identity)
const EMPLOYEE_A = {
  id: "clr-emp-A-001",
  employeeId: "clr-emp-A-001", // same as id (canonical)
  name: "Employee A",
  role: "EMPLOYEE",
  companyId: "clr-test-company-A",
  isSelfServiceOnly: true,
  permissions: ["clearance.view"]
};

const EMPLOYEE_B = {
  id: "clr-emp-B-001",
  employeeId: "clr-emp-B-001",
  name: "Employee B",
  role: "EMPLOYEE",
  companyId: "clr-test-company-A",
  isSelfServiceOnly: true,
  permissions: ["clearance.view"]
};

const APPROVER_USER_A = {
  id: "clr-approver-A-001",
  name: "Approver A",
  role: "HR_MANAGER",
  companyId: "clr-test-company-A",
  permissions: ["clearance.approve"]
};

const APPROVER_USER_B = {
  id: "clr-approver-B-001",
  name: "Approver B",
  role: "HR_MANAGER",
  companyId: "clr-test-company-A",
  permissions: ["clearance.approve"]
};

const WRONG_COMPANY_USER = {
  id: "clr-wrong-comp-001",
  name: "Wrong Company",
  role: "SUPERVISOR",
  companyId: "clr-test-company-Z",
  permissions: ["clearance.view", "clearance.approve"]
};

// =====================================================================
// FIXTURE IDs (deterministic)
// =====================================================================
const TEST_COMPANY_A_ID = "clr-test-company-A";
const CLR_A_ID = "clr-fixture-request-A-001"; // Owned by EMPLOYEE_A, sign-ready
const CLR_B_ID = "clr-fixture-request-B-001"; // Owned by EMPLOYEE_B
const CLR_WRONG_STATUS_ID = "clr-fixture-wrong-status-001"; // Already signed
const CLR_REPLAY_ID = "clr-fixture-replay-001"; // Completed (replay test)
const STEP_A_ID = "clr-step-A-001"; // Assigned to APPROVER_USER_A
const STEP_B_ID = "clr-step-B-001"; // fallbackRole = HR_MANAGER (no assignedApproverId)

// =====================================================================
// FIXTURE SETUP / TEARDOWN
// =====================================================================
beforeAll(async () => {
  // Cleanup any prior test data
  await prisma.clearanceHistory.deleteMany({ where: { clearanceRequestId: { in: [CLR_A_ID, CLR_B_ID, CLR_WRONG_STATUS_ID, CLR_REPLAY_ID] } } });
  await prisma.clearanceApprovalResponse.deleteMany({ where: { stepId: { in: [STEP_A_ID, STEP_B_ID] } } });
  await prisma.clearanceApprovalStep.deleteMany({ where: { clearanceRequestId: { in: [CLR_A_ID, CLR_B_ID, CLR_WRONG_STATUS_ID, CLR_REPLAY_ID] } } });
  await prisma.clearanceRequest.deleteMany({ where: { id: { in: [CLR_A_ID, CLR_B_ID, CLR_WRONG_STATUS_ID, CLR_REPLAY_ID] } } });

  // Ensure test company exists
  await prisma.company.upsert({
    where: { id: TEST_COMPANY_A_ID },
    create: { id: TEST_COMPANY_A_ID, companyCode: "CLR_TEST_A", companyName: "Clearance Test Company A" },
    update: { companyName: "Clearance Test Company A" }
  });

  // Ensure test employees exist (upsert)
  await prisma.employee.upsert({
    where: { id: EMPLOYEE_A.id },
    create: { id: EMPLOYEE_A.id, name: "Employee A Test", email: "clr-emp-a@test.local", department: "Operations", status: "On Duty", role: "EMPLOYEE", companyId: TEST_COMPANY_A_ID },
    update: { name: "Employee A Test", email: "clr-emp-a@test.local", department: "Operations", status: "On Duty", companyId: TEST_COMPANY_A_ID }
  });
  await prisma.employee.upsert({
    where: { id: EMPLOYEE_B.id },
    create: { id: EMPLOYEE_B.id, name: "Employee B Test", email: "clr-emp-b@test.local", department: "Operations", status: "On Duty", role: "EMPLOYEE", companyId: TEST_COMPANY_A_ID },
    update: { name: "Employee B Test", email: "clr-emp-b@test.local", department: "Operations", status: "On Duty", companyId: TEST_COMPANY_A_ID }
  });
  await prisma.employee.upsert({
    where: { id: APPROVER_USER_A.id },
    create: { id: APPROVER_USER_A.id, name: "Approver A Test", email: "clr-apr-a@test.local", department: "HR", status: "On Duty", role: "SUPERVISOR", companyId: TEST_COMPANY_A_ID },
    update: { name: "Approver A Test", email: "clr-apr-a@test.local", department: "HR", status: "On Duty", companyId: TEST_COMPANY_A_ID }
  });
  await prisma.employee.upsert({
    where: { id: APPROVER_USER_B.id },
    create: { id: APPROVER_USER_B.id, name: "Approver B Test", email: "clr-apr-b@test.local", department: "HR", status: "On Duty", role: "SUPERVISOR", companyId: TEST_COMPANY_A_ID },
    update: { name: "Approver B Test", email: "clr-apr-b@test.local", department: "HR", status: "On Duty", companyId: TEST_COMPANY_A_ID }
  });

  // CLR_A: Owned by EMPLOYEE_A, status PENDING_EMPLOYEE_SIGNATURE (sign-ready)
  await prisma.clearanceRequest.create({
    data: {
      id: CLR_A_ID,
      clearanceNumber: "CLR-NUM-A-001",
      employeeId: EMPLOYEE_A.id,
      requestedById: EMPLOYEE_A.id,
      clearanceType: "LEAVE_VACATION",
      status: "PENDING_EMPLOYEE_SIGNATURE",
      companyId: TEST_COMPANY_A_ID
    }
  });
  await prisma.clearanceApprovalStep.create({
    data: {
      id: STEP_A_ID,
      clearanceRequestId: CLR_A_ID,
      stepOrder: 1,
      sectionName: "HR Department",
      isApplicable: true,
      status: "PENDING",
      assignedApproverId: APPROVER_USER_A.id, // ONLY User A is authorized
      fallbackRole: null
    }
  });

  // CLR_B: Owned by EMPLOYEE_B, status PENDING_EMPLOYEE_SIGNATURE
  await prisma.clearanceRequest.create({
    data: {
      id: CLR_B_ID,
      clearanceNumber: "CLR-NUM-B-001",
      employeeId: EMPLOYEE_B.id,
      requestedById: EMPLOYEE_B.id,
      clearanceType: "LEAVE_VACATION",
      status: "PENDING_EMPLOYEE_SIGNATURE",
      companyId: TEST_COMPANY_A_ID
    }
  });
  await prisma.clearanceApprovalStep.create({
    data: {
      id: STEP_B_ID,
      clearanceRequestId: CLR_B_ID,
      stepOrder: 1,
      sectionName: "Finance Department",
      isApplicable: true,
      status: "PENDING",
      assignedApproverId: null,        // No specific approver
      fallbackRole: "HR_MANAGER"       // Role-based fallback only
    }
  });

  // CLR_WRONG_STATUS: Already signed (IN_PROGRESS — wrong status for sign endpoint)
  await prisma.clearanceRequest.create({
    data: {
      id: CLR_WRONG_STATUS_ID,
      clearanceNumber: "CLR-NUM-WRONG-001",
      employeeId: EMPLOYEE_A.id,
      requestedById: EMPLOYEE_A.id,
      clearanceType: "SEPARATION",
      status: "IN_PROGRESS",
      companyId: TEST_COMPANY_A_ID,
      employeeSignedAt: new Date(),
      employeeSignatureName: "Employee A"
    }
  });

  // CLR_REPLAY: COMPLETED (replay test)
  await prisma.clearanceRequest.create({
    data: {
      id: CLR_REPLAY_ID,
      clearanceNumber: "CLR-NUM-REPLAY-001",
      employeeId: EMPLOYEE_A.id,
      requestedById: EMPLOYEE_A.id,
      clearanceType: "SEPARATION",
      status: "COMPLETED",
      companyId: TEST_COMPANY_A_ID,
      employeeSignedAt: new Date(),
      employeeSignatureName: "Employee A",
      finalApprovedAt: new Date(),
      completedAt: new Date()
    }
  });
});

afterAll(async () => {
  // Clean up all test fixtures
  await prisma.clearanceHistory.deleteMany({ where: { clearanceRequestId: { in: [CLR_A_ID, CLR_B_ID, CLR_WRONG_STATUS_ID, CLR_REPLAY_ID] } } });
  await prisma.clearanceApprovalResponse.deleteMany({ where: { stepId: { in: [STEP_A_ID, STEP_B_ID] } } });
  await prisma.clearanceApprovalStep.deleteMany({ where: { clearanceRequestId: { in: [CLR_A_ID, CLR_B_ID, CLR_WRONG_STATUS_ID, CLR_REPLAY_ID] } } });
  await prisma.clearanceRequest.deleteMany({ where: { id: { in: [CLR_A_ID, CLR_B_ID, CLR_WRONG_STATUS_ID, CLR_REPLAY_ID] } } });
  await prisma.employee.deleteMany({ where: { id: { in: [EMPLOYEE_A.id, EMPLOYEE_B.id, APPROVER_USER_A.id, APPROVER_USER_B.id] } } });
  await prisma.company.deleteMany({ where: { id: TEST_COMPANY_A_ID } });
  await prisma.$disconnect();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// =====================================================================
// 1. FAIL-CLOSED: 401 UNAUTHENTICATED
// =====================================================================
describe("1. Fail-Closed Unauthenticated Access Guards (401)", () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
  });

  it("GET /api/v1/clearance returns 401", async () => {
    const res = await getClearanceList(new NextRequest("http://localhost:3100/api/v1/clearance"));
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance returns 401", async () => {
    const res = await createClearance(new NextRequest("http://localhost:3100/api/v1/clearance", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/clearance/[id] returns 401", async () => {
    const res = await getClearanceDetail(new NextRequest("http://localhost:3100/api/v1/clearance/x"), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/v1/clearance/[id] returns 401", async () => {
    const res = await patchClearance(new NextRequest("http://localhost:3100/api/v1/clearance/x", { method: "PATCH", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/v1/clearance/[id] returns 401", async () => {
    const res = await deleteClearance(new NextRequest("http://localhost:3100/api/v1/clearance/x", { method: "DELETE" }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/[id]/submit returns 401", async () => {
    const res = await submitClearance(new NextRequest("http://localhost:3100/api/v1/clearance/x/submit", { method: "POST" }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/[id]/sign returns 401", async () => {
    const res = await signClearance(new NextRequest("http://localhost:3100/api/v1/clearance/x/sign", { method: "POST", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/[id]/approve returns 401", async () => {
    const res = await approveClearanceStage(new NextRequest("http://localhost:3100/api/v1/clearance/x/approve", { method: "POST", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/[id]/reject returns 401", async () => {
    const res = await rejectClearanceStage(new NextRequest("http://localhost:3100/api/v1/clearance/x/reject", { method: "POST", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/[id]/return returns 401", async () => {
    const res = await returnClearanceStage(new NextRequest("http://localhost:3100/api/v1/clearance/x/return", { method: "POST", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/[id]/mark-not-applicable returns 401", async () => {
    const res = await markNotApplicableStage(new NextRequest("http://localhost:3100/api/v1/clearance/x/mark-not-applicable", { method: "POST", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/clearance/templates returns 401", async () => {
    const res = await getClearanceTemplates(new NextRequest("http://localhost:3100/api/v1/clearance/templates"));
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clearance/templates returns 401", async () => {
    const res = await createClearanceTemplate(new NextRequest("http://localhost:3100/api/v1/clearance/templates", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/clearance/templates/[id] returns 401", async () => {
    const res = await getTemplateDetail(new NextRequest("http://localhost:3100/api/v1/clearance/templates/x"), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/v1/clearance/templates/[id] returns 401", async () => {
    const res = await patchTemplate(new NextRequest("http://localhost:3100/api/v1/clearance/templates/x", { method: "PATCH", body: JSON.stringify({}) }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/v1/clearance/templates/[id] returns 401", async () => {
    const res = await deleteTemplate(new NextRequest("http://localhost:3100/api/v1/clearance/templates/x", { method: "DELETE" }), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });
});

// =====================================================================
// 2. PERMISSION GUARDS: 403
// =====================================================================
describe("2. Route-Level Permission Guards (403)", () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: GUEST_USER });
  });

  it("GET /api/v1/clearance returns 403 for user lacking clearance.view", async () => {
    const res = await getClearanceList(new NextRequest("http://localhost:3100/api/v1/clearance"));
    expect(res.status).toBe(403);
  });

  it("POST /api/v1/clearance returns 403 for user lacking clearance.create", async () => {
    const res = await createClearance(new NextRequest("http://localhost:3100/api/v1/clearance", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(403);
  });

  it("POST /api/v1/clearance/templates returns 403 for user lacking clearance.manage", async () => {
    const res = await createClearanceTemplate(new NextRequest("http://localhost:3100/api/v1/clearance/templates", { method: "POST", body: JSON.stringify({ name: "T" }) }));
    expect(res.status).toBe(403);
  });
});

// =====================================================================
// 3. SIGN ENDPOINT — DETERMINISTIC FIXTURE TESTS
// =====================================================================
describe("3. Sign Endpoint — Deterministic Fixture Authorization", () => {
  it("3a. Subject employee (EMPLOYEE_A) signs own clearance — 200 success", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_A });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_A_ID}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "Employee A", signatureData: "sig-data-001" })
    });
    const res = await signClearance(req, { params: { id: CLR_A_ID } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify signature was stored in DB
    const updated = await prisma.clearanceRequest.findUnique({ where: { id: CLR_A_ID } });
    expect(updated?.employeeSignatureName).toBe("Employee A");
    expect(updated?.status).toBe("IN_PROGRESS");
    expect(updated?.employeeSignedAt).not.toBeNull();
  });

  it("3b. Different employee (EMPLOYEE_B) attempts to sign EMPLOYEE_A's clearance — 403", async () => {
    const tempId = "clr-temp-cross-emp-001";
    await prisma.clearanceRequest.upsert({
      where: { id: tempId },
      create: { id: tempId, clearanceNumber: "CLR-NUM-TEMP-001", employeeId: EMPLOYEE_A.id, requestedById: EMPLOYEE_A.id, clearanceType: "LEAVE_VACATION", status: "PENDING_EMPLOYEE_SIGNATURE", companyId: TEST_COMPANY_A_ID },
      update: { status: "PENDING_EMPLOYEE_SIGNATURE", employeeSignedAt: null, employeeSignatureName: null }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_B });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${tempId}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "Employee B Impersonating A" })
    });
    const res = await signClearance(req, { params: { id: tempId } });
    expect(res.status).toBe(403);

    // Verify signature was NOT stored
    const unchanged = await prisma.clearanceRequest.findUnique({ where: { id: tempId } });
    expect(unchanged?.employeeSignatureName).toBeNull();
    expect(unchanged?.status).toBe("PENDING_EMPLOYEE_SIGNATURE");

    await prisma.clearanceRequest.delete({ where: { id: tempId } });
  });

  it("3c. Unrelated view-only user signs — 403 (company check or identity check fires)", async () => {
    const tempId = "clr-temp-view-only-001";
    await prisma.clearanceRequest.upsert({
      where: { id: tempId },
      create: { id: tempId, clearanceNumber: "CLR-NUM-TEMP-002", employeeId: EMPLOYEE_A.id, requestedById: EMPLOYEE_A.id, clearanceType: "LEAVE_VACATION", status: "PENDING_EMPLOYEE_SIGNATURE", companyId: TEST_COMPANY_A_ID },
      update: { status: "PENDING_EMPLOYEE_SIGNATURE", employeeSignedAt: null, employeeSignatureName: null }
    });
    const viewOnlyUser = { id: "clr-view-only-x", name: "View", role: "EMPLOYEE", companyId: TEST_COMPANY_A_ID, isSelfServiceOnly: true, permissions: ["clearance.view"] };
    (getServerSession as jest.Mock).mockResolvedValue({ user: viewOnlyUser });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${tempId}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "View Only Signer" })
    });
    const res = await signClearance(req, { params: { id: tempId } });
    expect(res.status).toBe(403);

    const unchanged = await prisma.clearanceRequest.findUnique({ where: { id: tempId } });
    expect(unchanged?.employeeSignatureName).toBeNull();

    await prisma.clearanceRequest.delete({ where: { id: tempId } });
  });

  it("3d. Admin actor signs EMPLOYEE_A clearance — 403 (no admin bypass)", async () => {
    const tempId = "clr-temp-admin-sign-001";
    await prisma.clearanceRequest.upsert({
      where: { id: tempId },
      create: { id: tempId, clearanceNumber: "CLR-NUM-TEMP-003", employeeId: EMPLOYEE_A.id, requestedById: EMPLOYEE_A.id, clearanceType: "LEAVE_VACATION", status: "PENDING_EMPLOYEE_SIGNATURE", companyId: TEST_COMPANY_A_ID },
      update: { status: "PENDING_EMPLOYEE_SIGNATURE", employeeSignedAt: null, employeeSignatureName: null }
    });
    (getServerSession as jest.Mock).mockResolvedValue({ user: ADMIN_USER });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${tempId}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "Admin Override" })
    });
    const res = await signClearance(req, { params: { id: tempId } });
    expect(res.status).toBe(403);

    const unchanged = await prisma.clearanceRequest.findUnique({ where: { id: tempId } });
    expect(unchanged?.employeeSignatureName).toBeNull();

    await prisma.clearanceRequest.delete({ where: { id: tempId } });
  });

  it("3e. Wrong-company employee signs — 403 (company isolation)", async () => {
    const tempId = "clr-temp-wrong-comp-001";
    await prisma.clearanceRequest.upsert({
      where: { id: tempId },
      create: { id: tempId, clearanceNumber: "CLR-NUM-TEMP-004", employeeId: EMPLOYEE_A.id, requestedById: EMPLOYEE_A.id, clearanceType: "LEAVE_VACATION", status: "PENDING_EMPLOYEE_SIGNATURE", companyId: TEST_COMPANY_A_ID },
      update: { status: "PENDING_EMPLOYEE_SIGNATURE", employeeSignedAt: null, employeeSignatureName: null }
    });
    (getServerSession as jest.Mock).mockResolvedValue({ user: WRONG_COMPANY_USER });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${tempId}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "Wrong Company" })
    });
    const res = await signClearance(req, { params: { id: tempId } });
    expect(res.status).toBe(403);

    const unchanged = await prisma.clearanceRequest.findUnique({ where: { id: tempId } });
    expect(unchanged?.employeeSignatureName).toBeNull();

    await prisma.clearanceRequest.delete({ where: { id: tempId } });
  });

  it("3f. Wrong status — clearance not in PENDING_EMPLOYEE_SIGNATURE — 400", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_A });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_WRONG_STATUS_ID}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "Employee A" })
    });
    const res = await signClearance(req, { params: { id: CLR_WRONG_STATUS_ID } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not waiting for employee signature/i);
  });

  it("3g. Replay — already signed (COMPLETED) clearance — 400 (wrong status guard)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_A });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_REPLAY_ID}/sign`, {
      method: "POST",
      body: JSON.stringify({ signatureName: "Employee A Replay" })
    });
    const res = await signClearance(req, { params: { id: CLR_REPLAY_ID } });
    expect(res.status).toBe(400);

    const unchanged = await prisma.clearanceRequest.findUnique({ where: { id: CLR_REPLAY_ID } });
    expect(unchanged?.status).toBe("COMPLETED");
    expect(unchanged?.employeeSignatureName).toBe("Employee A");
  });
});

// =====================================================================
// 4. FALLBACK ROLE BYPASS — REAL ENDPOINT
// =====================================================================
describe("4. Fallback Role Bypass — assignedApproverId is Authoritative", () => {
  it("4a. APPROVER_USER_A (assignedApproverId) approves step — 200 success", async () => {
    await prisma.clearanceApprovalStep.update({
      where: { id: STEP_A_ID },
      data: { status: "PENDING", actedAt: null, actedById: null }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: APPROVER_USER_A });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_A_ID}/approve`, {
      method: "POST",
      body: JSON.stringify({ stepId: STEP_A_ID, remarks: "Approved by User A" })
    });
    const res = await approveClearanceStage(req, { params: { id: CLR_A_ID } });
    expect(res.status).toBe(200);

    const step = await prisma.clearanceApprovalStep.findUnique({ where: { id: STEP_A_ID } });
    expect(step?.status).toBe("APPROVED");
    expect(step?.actedById).toBe(APPROVER_USER_A.id);
  });

  it("4b. APPROVER_USER_B (same role HR_MANAGER, different id) attempts to approve step assigned to A — 403", async () => {
    await prisma.clearanceApprovalStep.update({
      where: { id: STEP_A_ID },
      data: { status: "PENDING", actedAt: null, actedById: null }
    });
    await prisma.clearanceRequest.update({ where: { id: CLR_A_ID }, data: { status: "IN_PROGRESS" } });

    (getServerSession as jest.Mock).mockResolvedValue({ user: APPROVER_USER_B });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_A_ID}/approve`, {
      method: "POST",
      body: JSON.stringify({ stepId: STEP_A_ID, remarks: "Attempted by User B" })
    });
    const res = await approveClearanceStage(req, { params: { id: CLR_A_ID } });
    expect(res.status).toBe(403);

    const step = await prisma.clearanceApprovalStep.findUnique({ where: { id: STEP_A_ID } });
    expect(step?.status).toBe("PENDING");
    expect(step?.actedById).toBeNull();
  });

  it("4c. fallbackRole only (no assignedApproverId): HR_MANAGER role user — 200 success", async () => {
    await prisma.clearanceRequest.update({ where: { id: CLR_B_ID }, data: { status: "IN_PROGRESS" } });

    (getServerSession as jest.Mock).mockResolvedValue({ user: APPROVER_USER_B });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_B_ID}/approve`, {
      method: "POST",
      body: JSON.stringify({ stepId: STEP_B_ID, remarks: "Fallback role approval" })
    });
    const res = await approveClearanceStage(req, { params: { id: CLR_B_ID } });
    expect(res.status).toBe(200);

    const step = await prisma.clearanceApprovalStep.findUnique({ where: { id: STEP_B_ID } });
    expect(step?.status).toBe("APPROVED");
  });
});

// =====================================================================
// 5. SELF-SERVICE ACCESS — DETERMINISTIC FIXTURES
// =====================================================================
describe("5. Self-Service Access — Employee Isolation", () => {
  it("5a. Employee A GET list — returns CLR_A, does NOT return CLR_B", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_A });
    const req = new NextRequest("http://localhost:3100/api/v1/clearance");
    const res = await getClearanceList(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toContain(CLR_A_ID);
    expect(ids).not.toContain(CLR_B_ID);
  });

  it("5b. Employee A GET own clearance (CLR_A) — 200 success", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_A });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_A_ID}`);
    const res = await getClearanceDetail(req, { params: { id: CLR_A_ID } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(CLR_A_ID);
  });

  it("5c. Employee A GET Employee B's clearance (CLR_B) — 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: EMPLOYEE_A });
    const req = new NextRequest(`http://localhost:3100/api/v1/clearance/${CLR_B_ID}`);
    const res = await getClearanceDetail(req, { params: { id: CLR_B_ID } });
    expect(res.status).toBe(403);
  });

  it("5d. Identity mapping: user.id = Employee.id; user.employeeId falls through to user.id", () => {
    const canonicalEmployeeId = EMPLOYEE_A.employeeId || EMPLOYEE_A.id;
    expect(canonicalEmployeeId).toBe("clr-emp-A-001");
    expect(canonicalEmployeeId).toBe(EMPLOYEE_A.id);
  });
});

// =====================================================================
// 6. AUTHORIZED ADMIN ACCESS (200)
// =====================================================================
describe("6. Authorized Admin Access (200)", () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: ADMIN_USER });
  });

  it("GET /api/v1/clearance returns 200 for admin", async () => {
    const res = await getClearanceList(new NextRequest("http://localhost:3100/api/v1/clearance"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/v1/clearance/templates returns 200 for admin", async () => {
    const res = await getClearanceTemplates(new NextRequest("http://localhost:3100/api/v1/clearance/templates"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
