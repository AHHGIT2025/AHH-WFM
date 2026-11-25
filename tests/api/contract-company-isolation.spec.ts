import { NextRequest } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import {
  GET as sgListGet,
  POST as sgCreatePost,
  PATCH as sgListPatch,
} from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/route";
import {
  GET as sgDetailGet,
  PUT as sgDetailPut,
  DELETE as sgDetailDelete,
} from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/route";
import { GET as sgAddendumGet, POST as sgAddendumPost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/addendums/route";
import { GET as sgWorkflowGet } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/route";
import { POST as sgSubmitPost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/submit/route";
import { POST as sgApprovePost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/approve/route";
import { POST as sgRejectPost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/reject/route";
import { POST as sgActivatePost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/activate/route";
import { POST as sgTermReqPost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/terminate-request/route";
import { POST as sgTermApprovePost } from "../../apps/web/app/api/v1/manpower/security-guarding/contracts/[id]/workflow/terminate-approve/route";

import {
  GET as fmListGet,
  POST as fmCreatePost,
  PATCH as fmListPatch,
} from "../../apps/web/app/api/v1/manpower/facility-management/contracts/route";
import {
  GET as fmDetailGet,
  PUT as fmDetailPut,
  DELETE as fmDetailDelete,
} from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/route";
import { GET as fmAddendumGet, POST as fmAddendumPost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/addendums/route";
import { GET as fmWorkflowGet } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/route";
import { POST as fmSubmitPost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/submit/route";
import { POST as fmApprovePost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/approve/route";
import { POST as fmRejectPost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/reject/route";
import { POST as fmActivatePost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/activate/route";
import { POST as fmTermReqPost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/terminate-request/route";
import { POST as fmTermApprovePost } from "../../apps/web/app/api/v1/manpower/facility-management/contracts/[id]/workflow/terminate-approve/route";
import { GET as approvalDetailGet } from "../../apps/web/app/api/v1/approvals/[id]/route";
const { classifyAndBackfill } = require("../../packages/database/scripts/backfill-contract-company-ownership");

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("SG & FM Permanent Contract Company Isolation (Phase F)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let compAId: string;
  let compBId: string;
  let sgMakerAId: string;
  let sgCheckerAId: string;
  let fmUserAId: string;
  let sgUserBId: string;
  let superAdminId: string;

  let sharedClientId: string;
  let compBOnlyClientId: string;
  let sgContractAId: string;
  let sgContractBId: string;
  let sgActiveContractBId: string;
  let sgUnownedContractId: string;
  let fmContractAId: string;
  let fmContractBId: string;
  let sgTplId: string;
  let fmTplId: string;
  let wfBLevelId: string;
  let wfTermBLevelId: string;
  let wfInstanceBId: string;

  const setSession = (u: {
    id: string;
    role: string;
    companyId: string | null;
    permissions?: string[];
    sg?: boolean;
    fm?: boolean;
  }) => {
    const defaultPerms =
      u.role === "FM_ADMIN"
        ? ["manpower.fm.view", "manpower.fm.manage", "manpower.fm.contracts.manage"]
        : u.role === "SECURITY_ADMIN"
          ? ["manpower.security.view", "manpower.security.manage", "manpower.security.contracts.manage"]
          : [];
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: u.id,
        employeeId: u.id,
        name: u.id,
        email: `${u.id}@test.local`,
        role: u.role,
        companyId: u.companyId,
        permissions: u.permissions ?? defaultPerms,
        operationAccess: {
          allowedSecurityGuarding: u.sg ?? true,
          allowedFacilityManagement: u.fm ?? true,
        },
      },
    });
  };

  beforeAll(async () => {
    const [compA, compB] = await Promise.all([
      prisma.company.create({ data: { companyName: `ConIso CoA ${rand}`, companyCode: `CIA-${rand}`, isActive: true } }),
      prisma.company.create({ data: { companyName: `ConIso CoB ${rand}`, companyCode: `CIB-${rand}`, isActive: true } }),
    ]);
    compAId = compA.id;
    compBId = compB.id;

    const [mA, cA, fmA, uB, sa] = await Promise.all([
      prisma.employee.create({ data: { id: `ci-sg-mk-a-${rand}`, name: "SG Maker A", email: `ci-sg-mk-a-${rand}@t.local`, role: "SECURITY_ADMIN", companyId: compAId, department: "Security", status: "Active", isActive: true, operationType: "SECURITY_GUARDING" } }),
      prisma.employee.create({ data: { id: `ci-sg-ck-a-${rand}`, name: "SG Checker A", email: `ci-sg-ck-a-${rand}@t.local`, role: "SECURITY_ADMIN", companyId: compAId, department: "Security", status: "Active", isActive: true, operationType: "SECURITY_GUARDING" } }),
      prisma.employee.create({ data: { id: `ci-fm-a-${rand}`, name: "FM User A", email: `ci-fm-a-${rand}@t.local`, role: "FM_ADMIN", companyId: compAId, department: "FM", status: "Active", isActive: true, operationType: "FACILITY_MANAGEMENT" } }),
      prisma.employee.create({ data: { id: `ci-sg-b-${rand}`, name: "SG User B", email: `ci-sg-b-${rand}@t.local`, role: "SECURITY_ADMIN", companyId: compBId, department: "Security", status: "Active", isActive: true, operationType: "SECURITY_GUARDING" } }),
      prisma.employee.create({ data: { id: `ci-sa-${rand}`, name: "Super Admin", email: `ci-sa-${rand}@t.local`, role: "SUPER_ADMIN", companyId: compAId, department: "Exec", status: "Active", isActive: true } }),
    ]);
    sgMakerAId = mA.id;
    sgCheckerAId = cA.id;
    fmUserAId = fmA.id;
    sgUserBId = uB.id;
    superAdminId = sa.id;

    const [sharedCli, compBCli] = await Promise.all([
      prisma.manpowerClient.create({ data: { name: `Shared Client ${rand}`, code: `SH-${rand}`, operationType: "SECURITY_GUARDING", isSharedClient: true, companyId: null } }),
      prisma.manpowerClient.create({ data: { name: `CompB Client ${rand}`, code: `CB-${rand}`, operationType: "SECURITY_GUARDING", isSharedClient: false, companyId: compBId } }),
    ]);
    sharedClientId = sharedCli.id;
    compBOnlyClientId = compBCli.id;

    const [sgTpl, fmTpl] = await Promise.all([
      prisma.workflowTemplate.create({
        data: {
          workflowName: `CI SG WF ${rand}`,
          moduleType: "SECURITY_GUARDING_CONTRACT",
          appliesTo: "ACTIVATION",
          isDefault: false,
          isActive: true,
          levels: {
            create: [{
              levelNumber: 1,
              levelName: "Level 1",
              approvalRule: "ANY_ONE",
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: sgCheckerAId, employeeName: "SG Checker A" }] },
            }],
          },
        },
      }),
      prisma.workflowTemplate.create({
        data: {
          workflowName: `CI FM WF ${rand}`,
          moduleType: "FACILITY_MANAGEMENT_CONTRACT",
          appliesTo: "ACTIVATION",
          isDefault: false,
          isActive: true,
          levels: {
            create: [{
              levelNumber: 1,
              levelName: "Level 1",
              approvalRule: "ANY_ONE",
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: fmUserAId, employeeName: "FM User A" }] },
            }],
          },
        },
      }),
    ]);
    sgTplId = sgTpl.id;
    fmTplId = fmTpl.id;

    const [sgA, sgB, sgActB, sgUnowned, fmA_c, fmB_c] = await Promise.all([
      prisma.manpowerContract.create({ data: { clientId: sharedClientId, companyId: compAId, contractNumber: `CI-SGA-${rand}`, title: "SG Contract A", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), operationType: "SECURITY_GUARDING", status: "DRAFT" } }),
      prisma.manpowerContract.create({ data: { clientId: sharedClientId, companyId: compBId, contractNumber: `CI-SGB-${rand}`, title: "SG Contract B", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), operationType: "SECURITY_GUARDING", status: "DRAFT" } }),
      prisma.manpowerContract.create({ data: { clientId: compBOnlyClientId, companyId: compBId, contractNumber: `CI-SGB-ACT-${rand}`, title: "SG Active B", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), operationType: "SECURITY_GUARDING", status: "ACTIVE" } }),
      prisma.manpowerContract.create({ data: { clientId: sharedClientId, companyId: null, contractNumber: `CI-SG-UNOWNED-${rand}`, title: "SG Unowned", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), operationType: "SECURITY_GUARDING", status: "DRAFT" } }),
      prisma.manpowerContract.create({ data: { clientId: sharedClientId, companyId: compAId, contractNumber: `CI-FMA-${rand}`, title: "FM Contract A", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), operationType: "FACILITY_MANAGEMENT", status: "DRAFT" } }),
      prisma.manpowerContract.create({ data: { clientId: sharedClientId, companyId: compBId, contractNumber: `CI-FMB-${rand}`, title: "FM Contract B", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), operationType: "FACILITY_MANAGEMENT", status: "DRAFT" } }),
    ]);
    sgContractAId = sgA.id;
    sgContractBId = sgB.id;
    sgActiveContractBId = sgActB.id;
    sgUnownedContractId = sgUnowned.id;
    fmContractAId = fmA_c.id;
    fmContractBId = fmB_c.id;

    const wfB = await prisma.contractApprovalWorkflow.create({
      data: {
        contractId: sgContractBId,
        companyId: compBId,
        appliesTo: "ACTIVATION",
        status: "PENDING",
        submittedBy: "SG User B",
        levels: {
          create: [{
            levelNumber: 1,
            levelName: "L1",
            approvalRule: "ANY_ONE",
            approvers: { create: [{ employeeId: sgUserBId, employeeName: "SG User B", approvalStatus: "PENDING" }] },
          }],
        },
      },
      include: { levels: true },
    });
    wfBLevelId = wfB.levels[0].id;

    const wfTermB = await prisma.contractApprovalWorkflow.create({
      data: {
        contractId: sgActiveContractBId,
        companyId: compBId,
        appliesTo: "TERMINATION",
        status: "PENDING",
        submittedBy: "SG User B",
        levels: {
          create: [{
            levelNumber: 1,
            levelName: "Term L1",
            approvalRule: "ANY_ONE",
            approvers: { create: [{ employeeId: sgUserBId, employeeName: "SG User B", approvalStatus: "PENDING" }] },
          }],
        },
      },
      include: { levels: true },
    });
    wfTermBLevelId = wfTermB.levels[0].id;

    const wfInstB = await prisma.workflowInstance.create({
      data: {
        templateId: sgTplId,
        moduleType: "SECURITY_GUARDING_CONTRACT",
        referenceId: sgContractBId,
        companyId: compBId,
        operationScope: "SECURITY_GUARDING",
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
      },
    });
    wfInstanceBId = wfInstB.id;
  }, 30000);

  afterAll(async () => {
    await prisma.workflowInstance.deleteMany({ where: { id: wfInstanceBId } }).catch(() => {});
    await prisma.contractApprovalWorkflow.deleteMany({ where: { contractId: { in: [sgContractAId, sgContractBId, sgActiveContractBId, fmContractAId, fmContractBId] } } }).catch(() => {});
    await prisma.manpowerContractAddendum.deleteMany({ where: { contractId: { in: [sgContractAId, sgContractBId, sgActiveContractBId] } } }).catch(() => {});
    await prisma.manpowerContract.deleteMany({ where: { id: { in: [sgContractAId, sgContractBId, sgActiveContractBId, sgUnownedContractId, fmContractAId, fmContractBId] } } }).catch(() => {});
    await prisma.manpowerContract.deleteMany({ where: { clientId: { in: [sharedClientId, compBOnlyClientId] } } }).catch(() => {});
    await prisma.workflowTemplate.deleteMany({ where: { id: { in: [sgTplId, fmTplId] } } }).catch(() => {});
    await prisma.manpowerClient.deleteMany({ where: { id: { in: [sharedClientId, compBOnlyClientId] } } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { id: { in: [sgMakerAId, sgCheckerAId, fmUserAId, sgUserBId, superAdminId] } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: { in: [compAId, compBId] } } }).catch(() => {});
  }, 30000);

  it("1 & 18. Company A SG user lists only Company A contracts even on shared client", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const res = await sgListGet(new Request("http://localhost/api/v1/manpower/security-guarding/contracts"));
    expect(res.status).toBe(200);
    const list = await res.json();
    const ids = list.map((c: any) => c.id);
    expect(ids).toContain(sgContractAId);
    expect(ids).not.toContain(sgContractBId);
    expect(ids).not.toContain(sgUnownedContractId);
  });

  it("2. Company A user cannot open Company B SG contract detail", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const res = await sgDetailGet(new Request(`http://localhost/api/v1/manpower/security-guarding/contracts/${sgContractBId}`), { params: { id: sgContractBId } });
    expect(res.status).toBe(403);
  });

  it("3 & 14 & 19. Company A user cannot create Company B contract or use Company B client", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const forgedRes = await sgCreatePost(new Request("http://localhost/api/v1/manpower/security-guarding/contracts", {
      method: "POST",
      body: JSON.stringify({ clientId: sharedClientId, companyId: compBId, title: "Forged CoB", startDate: "2026-01-01", endDate: "2026-12-31" }),
    }));
    expect(forgedRes.status).toBe(403);

    const conflictClientRes = await sgCreatePost(new Request("http://localhost/api/v1/manpower/security-guarding/contracts", {
      method: "POST",
      body: JSON.stringify({ clientId: compBOnlyClientId, title: "Conflict Client", startDate: "2026-01-01", endDate: "2026-12-31" }),
    }));
    expect(conflictClientRes.status).toBe(403);
  });

  it("4 & 5. Company A user cannot update or delete Company B SG contract", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const putRes = await sgDetailPut(new Request(`http://localhost/api/v1/manpower/security-guarding/contracts/${sgContractBId}`, {
      method: "PUT",
      body: JSON.stringify({ title: "Hacked" }),
    }), { params: { id: sgContractBId } });
    expect(putRes.status).toBe(403);

    const patchRes = await sgListPatch(new Request("http://localhost/api/v1/manpower/security-guarding/contracts", {
      method: "PATCH",
      body: JSON.stringify({ id: sgContractBId, title: "Hacked" }),
    }));
    expect(patchRes.status).toBe(403);

    const delRes = await sgDetailDelete(new Request(`http://localhost/api/v1/manpower/security-guarding/contracts/${sgContractBId}`, { method: "DELETE" }), { params: { id: sgContractBId } });
    expect(delRes.status).toBe(403);
  });

  it("6. Company A user cannot add addendum to Company B contract", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const res = await sgAddendumPost(new Request(`http://localhost/api/v1/manpower/security-guarding/contracts/${sgActiveContractBId}/addendums`, {
      method: "POST",
      body: JSON.stringify({ title: "Cross Co Addendum", addendumType: "EXPANSION" }),
    }), { params: { id: sgActiveContractBId } });
    expect(res.status).toBe(403);
  });

  it("7, 8, 9, 10, 11, 12. Company A user cannot submit, approve, reject, activate, or terminate Company B contract", async () => {
    setSession({ id: sgCheckerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    expect((await sgSubmitPost(new Request("http://localhost", { method: "POST" }), { params: { id: sgContractBId } })).status).toBe(403);
    expect((await sgApprovePost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId: wfBLevelId }) }), { params: { id: sgContractBId } })).status).toBe(403);
    expect((await sgRejectPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId: wfBLevelId, remarks: "No" }) }), { params: { id: sgContractBId } })).status).toBe(403);
    expect((await sgActivatePost(new Request("http://localhost", { method: "POST" }), { params: { id: sgContractBId } })).status).toBe(403);
    expect((await sgTermReqPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "X" }) }), { params: { id: sgActiveContractBId } })).status).toBe(403);
    expect((await sgTermApprovePost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId: wfTermBLevelId }) }), { params: { id: sgActiveContractBId } })).status).toBe(403);
  });

  it("13. Missing contract ownership (companyId = null) fails closed", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    expect((await sgDetailGet(new Request("http://localhost"), { params: { id: sgUnownedContractId } })).status).toBe(403);
    expect((await sgSubmitPost(new Request("http://localhost", { method: "POST" }), { params: { id: sgUnownedContractId } })).status).toBe(403);
  });

  it("14. Query-string ?companyId= override cannot leak Company B contracts", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const res = await sgListGet(new Request(`http://localhost/api/v1/manpower/security-guarding/contracts?companyId=${compBId}`));
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.some((c: any) => c.companyId === compBId || c.id === sgContractBId)).toBe(false);
  });

  it("15 & 16. Same-company SG workflow submission sets ContractApprovalWorkflow.companyId and preserves Maker/Checker", async () => {
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const subRes = await sgSubmitPost(new Request("http://localhost", { method: "POST" }), { params: { id: sgContractAId } });
    expect(subRes.status).toBe(200);
    const updated = await prisma.manpowerContract.findUnique({ where: { id: sgContractAId }, include: { workflows: { include: { levels: true } } } });
    expect(updated?.workflows[0]?.companyId).toBe(compAId);
    const levelId = updated!.workflows[0].levels[0].id;
    // Ensure sgCheckerAId is authorized on whichever active SG contract template was selected
    await prisma.contractApprovalApprover.create({
      data: { levelId, employeeId: sgCheckerAId, employeeName: "SG Checker A", approvalStatus: "PENDING" },
    });

    // Maker self-approval denied
    const selfApp = await sgApprovePost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId }) }), { params: { id: sgContractAId } });
    expect(selfApp.status).toBe(403);

    // Checker approval allowed
    setSession({ id: sgCheckerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const chkApp = await sgApprovePost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId }) }), { params: { id: sgContractAId } });
    expect(chkApp.status).toBe(200);
  });

  it("17. Authorized cross-company SUPER_ADMIN can view both Company A & B contracts", async () => {
    setSession({ id: superAdminId, role: "SUPER_ADMIN", companyId: compAId, sg: true, fm: true });
    const res = await sgListGet(new Request("http://localhost/api/v1/manpower/security-guarding/contracts"));
    expect(res.status).toBe(200);
    const list = await res.json();
    const ids = list.map((c: any) => c.id);
    expect(ids).toContain(sgContractAId);
    expect(ids).toContain(sgContractBId);
  });

  it("20. Approval Center direct-ID access across companies is denied", async () => {
    setSession({ id: sgCheckerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    const res = await approvalDetailGet(new NextRequest(`http://localhost/api/v1/approvals/${wfInstanceBId}`), { params: { id: wfInstanceBId } });
    expect(res.status).toBe(403);
  });

  it("21 & 22. FM contract company isolation enforces list, detail, create, update, delete, submit, approve", async () => {
    setSession({ id: fmUserAId, role: "FM_ADMIN", companyId: compAId, sg: false, fm: true });
    const listRes = await fmListGet(new Request("http://localhost/api/v1/manpower/facility-management/contracts"));
    expect(listRes.status).toBe(200);
    const fmList = await listRes.json();
    expect(fmList.map((c: any) => c.id)).toContain(fmContractAId);
    expect(fmList.map((c: any) => c.id)).not.toContain(fmContractBId);

    expect((await fmDetailGet(new Request("http://localhost"), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmDetailPut(new Request("http://localhost", { method: "PUT", body: JSON.stringify({ title: "X" }) }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmListPatch(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ id: fmContractBId, title: "X" }) }))).status).toBe(403);
    expect((await fmDetailDelete(new Request("http://localhost", { method: "DELETE" }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmAddendumGet(new Request("http://localhost"), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmAddendumPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ title: "X", addendumType: "EXPANSION" }) }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmWorkflowGet(new Request("http://localhost"), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmSubmitPost(new Request("http://localhost", { method: "POST" }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmApprovePost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId: wfBLevelId }) }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmRejectPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId: wfBLevelId, remarks: "No" }) }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmActivatePost(new Request("http://localhost", { method: "POST" }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmTermReqPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "X" }) }), { params: { id: fmContractBId } })).status).toBe(403);
    expect((await fmTermApprovePost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ levelId: wfTermBLevelId }) }), { params: { id: fmContractBId } })).status).toBe(403);

    // Also verify SG addendums GET & workflow GET are denied across companies
    setSession({ id: sgMakerAId, role: "SECURITY_ADMIN", companyId: compAId, sg: true, fm: false });
    expect((await sgAddendumGet(new Request("http://localhost"), { params: { id: sgContractBId } })).status).toBe(403);
    expect((await sgWorkflowGet(new Request("http://localhost"), { params: { id: sgContractBId } })).status).toBe(403);

    const forgedFmRes = await fmCreatePost(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ clientId: sharedClientId, companyId: compBId, contractNumber: `FM-FORGED-${rand}`, title: "Forged FM", startDate: "2026-01-01", endDate: "2026-12-31" }),
    }));
    expect(forgedFmRes.status).toBe(403);
  });

  it("Gate E. Backfill script refuses --apply without --confirm-apply and safely applies deterministic synthetic mappings idempotently", async () => {
    await expect(classifyAndBackfill({ apply: true, confirmApply: false })).rejects.toThrow(/--confirm-apply/);

    const synContract = await prisma.manpowerContract.create({
      data: {
        clientId: compBOnlyClientId,
        companyId: null,
        contractNumber: `SYN-BF-${rand}`,
        title: "Synthetic Backfill Contract",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
      },
    });
    const synWf = await prisma.contractApprovalWorkflow.create({
      data: { contractId: synContract.id, companyId: null, appliesTo: "ACTIVATION", status: "PENDING" },
    });

    try {
      const dry = await classifyAndBackfill({ apply: false, contractIdsFilter: [synContract.id, sgUnownedContractId] });
      expect(dry.summary.categoryA_authoritative).toBe(1);
      expect(dry.summary.categoryC_unmapped).toBe(1);
      expect(dry.summary.updatedContracts).toBe(0);

      const applied = await classifyAndBackfill({ apply: true, confirmApply: true, contractIdsFilter: [synContract.id, sgUnownedContractId] });
      expect(applied.summary.updatedContracts).toBe(1);
      expect(applied.summary.updatedWorkflows).toBe(1);

      const reloaded = await prisma.manpowerContract.findUnique({ where: { id: synContract.id }, include: { workflows: true } });
      expect(reloaded?.companyId).toBe(compBId);
      expect(reloaded?.status).toBe("DRAFT");
      expect(reloaded?.workflows[0]?.companyId).toBe(compBId);

      // Idempotent on re-run
      const rerun = await classifyAndBackfill({ apply: true, confirmApply: true, contractIdsFilter: [synContract.id, sgUnownedContractId] });
      expect(rerun.summary.updatedContracts).toBe(0);
    } finally {
      await prisma.contractApprovalWorkflow.deleteMany({ where: { id: synWf.id } }).catch(() => {});
      await prisma.manpowerContract.deleteMany({ where: { id: synContract.id } }).catch(() => {});
    }
  });
});
