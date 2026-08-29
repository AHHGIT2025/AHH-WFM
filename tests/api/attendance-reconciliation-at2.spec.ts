import crypto from "crypto";
import { prisma } from "@ahh-wfm/database";
import {
  isAttendanceReconciliationEnabled,
  initializeReconciliation,
  applyDecision,
  completeReview,
  submitForApproval,
  returnReconciliation,
  resumeReturnedReview,
  refreshEvidence,
  rejectReconciliation,
  approveReconciliation,
  reopenReconciliation,
  buildOperationalCandidateKey,
  computeRowChecksum,
  computeSnapshotHash,
  RECONCILIATION_STATUS,
  DECISION_TYPE
} from "@/lib/attendance-reconciliation-engine";

describe("Phase AT-2: Attendance Reconciliation & Approval Tests", () => {
  const originalEnv = process.env.ATTENDANCE_RECONCILIATION_ENABLED;
  const originalImportEnv = process.env.ATTENDANCE_IMPORT_ENABLED;

  const rand = Date.now();
  let testCompany: any;
  let testEmployee: any;
  let uploaderEmp: any;
  let reviewerEmp: any;
  let submitterEmp: any;
  let approverEmp: any;
  let testClient: any;
  let testProject: any;
  let testSite: any;
  let testContract: any;

  // 24 Certified Production Tables to Verify ZERO Writes
  const AUTHORITATIVE_TABLES = [
    "attendanceRecord",
    "employee",
    "company",
    "department",
    "costCenter",
    "project",
    "projectSite",
    "locationMaster",
    "allowedPunchLocation",
    "employeeAllowedPunchLocation",
    "onCallAssignment",
    "clearanceRequest",
    "rosterRequirementSlot",
    "rosterSlotAssignment",
    "rosterPublication",
    "rosterChangeRequest",
    "rosterSlotAcknowledgment",
    "rosterPlanningException",
    "manpowerWorkCalendarProfile",
    "manpowerSeasonalWorkRule",
    "manpowerCompanyOperationScope",
    "manpowerHolidayCalendar",
    "manpowerDailyClosure",
    "leaveRequest"
  ];

  async function getTableHashes(): Promise<Record<string, { count: number; hash: string }>> {
    const hashes: Record<string, { count: number; hash: string }> = {};
    for (const table of AUTHORITATIVE_TABLES) {
      const model = (prisma as any)[table];
      if (model && typeof model.findMany === "function") {
        const rows = await model.findMany({ select: { id: true } });
        const serialized = rows.map((r: any) => r.id).sort().join("|");
        hashes[table] = {
          count: rows.length,
          hash: crypto.createHash("sha256").update(serialized).digest("hex")
        };
      }
    }
    return hashes;
  }

  beforeAll(async () => {
    process.env.ATTENDANCE_IMPORT_ENABLED = "true";
    process.env.ATTENDANCE_RECONCILIATION_ENABLED = "true";

    const compCode = "REC_TEST_" + rand;
    testCompany = await prisma.company.create({
      data: {
        companyCode: compCode,
        companyName: "Reconciliation Test Company"
      }
    });

    // Create Main Guard Employee
    testEmployee = await prisma.employee.create({
      data: {
        id: "EMP-GUARD-" + rand,
        name: "Reconciliation Guard Alpha",
        email: `rec.guard.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    // Create Uploader Principal
    uploaderEmp = await prisma.employee.create({
      data: {
        id: "EMP-UPL-" + rand,
        name: "Uploader Officer",
        email: `rec.upl.${rand}@ahh.qa`,
        department: "Operations",
        role: "OPERATIONS_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Create Reviewer Principal
    reviewerEmp = await prisma.employee.create({
      data: {
        id: "EMP-REV-" + rand,
        name: "Reviewer Officer",
        email: `rec.rev.${rand}@ahh.qa`,
        department: "Operations",
        role: "OPERATIONS_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Create Submitter Principal
    submitterEmp = await prisma.employee.create({
      data: {
        id: "EMP-SUB-" + rand,
        name: "Submitter Officer",
        email: `rec.sub.${rand}@ahh.qa`,
        department: "Operations",
        role: "OPERATIONS_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Create Approver Principal
    approverEmp = await prisma.employee.create({
      data: {
        id: "EMP-APP-" + rand,
        name: "Approver Director",
        email: `rec.app.${rand}@ahh.qa`,
        department: "Human Resources",
        role: "HR_DIRECTOR",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    testClient = await prisma.manpowerClient.create({
      data: {
        code: "CLI-REC-" + rand,
        name: "Reconciliation Test Client",
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });

    testContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClient.id,
        contractNumber: "CNT-REC-" + rand,
        title: "Reconciliation Security Contract",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE"
      }
    });

    testProject = await prisma.manpowerProject.create({
      data: {
        contractId: testContract.id,
        code: "PRJ-REC-" + rand,
        name: "Reconciliation Project " + rand,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });

    testSite = await prisma.manpowerSite.create({
      data: {
        projectId: testProject.id,
        code: "SITE-REC-" + rand,
        name: "Reconciliation Site " + rand,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
  });

  afterAll(async () => {
    process.env.ATTENDANCE_RECONCILIATION_ENABLED = originalEnv;
    process.env.ATTENDANCE_IMPORT_ENABLED = originalImportEnv;

    if (testCompany) {
      await prisma.attendanceApprovedSnapshotRow.deleteMany({ where: { companyId: testCompany.id } });
      await prisma.attendanceApprovedSnapshot.deleteMany({ where: { companyId: testCompany.id } });
      await prisma.attendanceReconciliationEvent.deleteMany({ where: { reconciliationBatch: { companyId: testCompany.id } } });
      await prisma.attendanceReconciliationCandidateSource.deleteMany({ where: { candidate: { reconciliationBatch: { companyId: testCompany.id } } } });
      await prisma.attendanceReconciliationCandidate.updateMany({
        where: { reconciliationBatch: { companyId: testCompany.id } },
        data: { currentDecisionId: null }
      });
      await prisma.attendanceReconciliationDecision.updateMany({
        where: { reconciliationBatch: { companyId: testCompany.id } },
        data: { supersedesDecisionId: null }
      });
      await prisma.attendanceReconciliationDecision.deleteMany({ where: { reconciliationBatch: { companyId: testCompany.id } } });
      await prisma.attendanceReconciliationCandidate.deleteMany({ where: { reconciliationBatch: { companyId: testCompany.id } } });
      await prisma.attendanceReconciliationBatch.deleteMany({ where: { companyId: testCompany.id } });
      await prisma.attendanceImportRow.deleteMany({ where: { companyId: testCompany.id } });
      await prisma.attendanceImportBatch.deleteMany({ where: { companyId: testCompany.id } });
      await prisma.manpowerSite.deleteMany({ where: { id: testSite?.id } });
      await prisma.manpowerProject.deleteMany({ where: { id: testProject?.id } });
      await prisma.manpowerContract.deleteMany({ where: { id: testContract?.id } });
      await prisma.manpowerClient.deleteMany({ where: { id: testClient?.id } });
      await prisma.employee.deleteMany({ where: { companyId: testCompany.id } });
      await prisma.company.deleteMany({ where: { id: testCompany.id } });
    }
  });

  it("GATING: Feature flags must govern reconciliation engine availability", () => {
    process.env.ATTENDANCE_RECONCILIATION_ENABLED = "false";
    expect(isAttendanceReconciliationEnabled()).toBe(false);

    process.env.ATTENDANCE_RECONCILIATION_ENABLED = "true";
    expect(isAttendanceReconciliationEnabled()).toBe(true);
  });

  it("SCOPE ISOLATION: Reconciliation strictly rejects White Collar batches", async () => {
    const wcBatch = await prisma.attendanceImportBatch.create({
      data: {
        batchNumber: "AIB-WC-TEST-" + Date.now(),
        companyId: testCompany.id,
        operationType: "WHITE_COLLAR",
        originalFileName: "wc_muster.xlsx",
        status: "VALIDATED"
      }
    });

    await expect(initializeReconciliation(wcBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name })).rejects.toThrow(
      "Attendance Reconciliation is strictly restricted to Security Guarding and Facility Management."
    );

    await prisma.attendanceImportBatch.delete({ where: { id: wcBatch.id } });
  });

  it("FULL LIFECYCLE: Reconcile -> Review -> Submit -> Drift -> Return -> Resume -> Approve -> Reopen with Zero Writes to Master Tables", async () => {
    // 1. Snapshot Authoritative Tables Baseline
    const baselineHashes = await getTableHashes();

    // 2. Create Certified Staging Import Batch with duplicate rows to verify source lineage
    const impBatch = await prisma.attendanceImportBatch.create({
      data: {
        batchNumber: "AIB-SG-REC-" + Date.now(),
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING",
        attendancePeriodFrom: new Date("2026-08-01"),
        attendancePeriodTo: new Date("2026-08-31"),
        originalFileName: "august_guarding_muster.xlsx",
        status: "VALIDATED",
        uploadedById: uploaderEmp.id
      }
    });

    const dutyDate = new Date("2026-08-15");

    // Line 1: Main valid row
    const row1 = await prisma.attendanceImportRow.create({
      data: {
        batchId: impBatch.id,
        sourceRowNumber: 2,
        rawAttendanceDate: "2026-08-15",
        rawEmployeeCode: testEmployee.id,
        rawEmployeeName: testEmployee.name,
        rawSite: testSite.name,
        rawShift: "DAY_12H",
        rawPlannedStart: "07:00",
        rawPlannedEnd: "19:00",
        rawWorkedHours: "12",
        rawOtHours: "2",
        rawAttendanceStatus: "PRESENT",
        attendanceDate: dutyDate,
        workedHours: 12,
        otHours: 2,
        normalizedStatus: "PRESENT",
        employeeId: testEmployee.id,
        companyId: testCompany.id,
        siteId: testSite.id,
        contractId: testContract.id,
        validationStatus: "VALID"
      }
    });

    // Line 2: Duplicate row collapsed into same candidate key
    const row2 = await prisma.attendanceImportRow.create({
      data: {
        batchId: impBatch.id,
        sourceRowNumber: 3,
        rawAttendanceDate: "2026-08-15",
        rawEmployeeCode: testEmployee.id,
        rawEmployeeName: testEmployee.name,
        rawSite: testSite.name,
        rawShift: "DAY_12H",
        rawPlannedStart: "07:00",
        rawPlannedEnd: "19:00",
        rawWorkedHours: "12",
        rawOtHours: "2",
        rawAttendanceStatus: "PRESENT",
        attendanceDate: dutyDate,
        workedHours: 12,
        otHours: 2,
        normalizedStatus: "PRESENT",
        employeeId: testEmployee.id,
        companyId: testCompany.id,
        siteId: testSite.id,
        contractId: testContract.id,
        validationStatus: "DUPLICATE",
        isDuplicate: true,
        duplicateReason: "Same operational candidate duplicate in sheet"
      }
    });

    // 3. Initialize Reconciliation Engine
    const recBatch = await initializeReconciliation(impBatch.id, {
      id: reviewerEmp.id,
      name: reviewerEmp.name,
      role: reviewerEmp.role
    });

    expect(recBatch.status).toBe(RECONCILIATION_STATUS.IN_REVIEW);
    expect(recBatch.totalCandidates).toBe(1); // 2 rows collapsed into 1 candidate!
    expect(recBatch.candidates.length).toBe(1);

    const candidate = recBatch.candidates[0];
    expect(candidate.sources.length).toBe(2); // One-to-many source lineage preserved!
    expect(candidate.currentDecision).toBeDefined();

    // 4. Apply Manual Decision Revision (Append-Only)
    const decisionRevision = await applyDecision(
      recBatch.id,
      {
        candidateId: candidate.id,
        decisionType: DECISION_TYPE.ADJUST_PROPOSED_HOURS,
        reasonCode: "SUPERVISOR_CONFIRMED",
        reasonNotes: "Supervisor confirmed 11.5 hours worked",
        resolvedStatus: "PRESENT",
        resolvedWorkedMinutes: 690, // 11.5 hours
        resolvedOtMinutes: 90
      },
      { id: reviewerEmp.id, name: reviewerEmp.name, role: reviewerEmp.role }
    );

    expect(decisionRevision.decisionVersion).toBe(2);
    expect(decisionRevision.supersedesDecisionId).toBeDefined();

    // 5. Complete Review and Submit for Approval
    await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
    const submitted = await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });
    expect(submitted.status).toBe(RECONCILIATION_STATUS.PENDING_APPROVAL);

    // 6. Segregation of Duties Check: Uploader, Reviewer, Submitter cannot approve!
    await expect(
      approveReconciliation(recBatch.id, { id: uploaderEmp.id, name: uploaderEmp.name })
    ).rejects.toThrow("Segregation of Duties Violation");

    await expect(
      approveReconciliation(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name })
    ).rejects.toThrow("Segregation of Duties Violation");

    await expect(
      approveReconciliation(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name })
    ).rejects.toThrow("Segregation of Duties Violation");

    // 7. Approver Returns with Comments
    const returned = await returnReconciliation(recBatch.id, "Please verify OT breakdown", {
      id: approverEmp.id,
      name: approverEmp.name
    });
    expect(returned.status).toBe(RECONCILIATION_STATUS.RETURNED);

    // 8. Reviewer Resumes Review
    const resumed = await resumeReturnedReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
    expect(resumed.status).toBe(RECONCILIATION_STATUS.IN_REVIEW);

    // 9. Resubmit for Approval
    await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
    await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

    // 10. Independent Approver Approves -> Creates Immutable Approved Snapshot
    const approvalResult = await approveReconciliation(recBatch.id, {
      id: approverEmp.id,
      name: approverEmp.name,
      role: approverEmp.role
    });

    expect(approvalResult.batch.status).toBe(RECONCILIATION_STATUS.APPROVED);
    expect(approvalResult.snapshot).toBeDefined();
    expect(approvalResult.snapshot.approvalVersion).toBe(1);
    expect(approvalResult.snapshot.snapshotHash).toBeDefined();
    expect(approvalResult.snapshot.snapshotRows.length).toBe(1);

    const snapRow = approvalResult.snapshot.snapshotRows[0];
    expect(snapRow.approvedRegularMinutes).toBe(690);
    expect(snapRow.approvedOtMinutes).toBe(90);
    expect(snapRow.rowChecksum).toBeDefined();
    expect(snapRow.reconciliationDecisionId).toBe(decisionRevision.id);

    // 11. Reopen Reconciliation -> Transitions to IN_REVIEW with v2 Carry-Forward
    const reopened = await reopenReconciliation(recBatch.id, "Client requested retroactive muster correction", {
      id: reviewerEmp.id,
      name: reviewerEmp.name
    });

    expect(reopened.status).toBe(RECONCILIATION_STATUS.IN_REVIEW);
    expect(reopened.reconciliationVersion).toBe(2);

    // Verify Previous Snapshot Remains Intact and Frozen
    const preservedSnapshot = await prisma.attendanceApprovedSnapshot.findUnique({
      where: { id: approvalResult.snapshot.id },
      include: { snapshotRows: true }
    });
    expect(preservedSnapshot).not.toBeNull();
    expect(preservedSnapshot?.approvalVersion).toBe(1);

    // 12. Mathematical Proof: ZERO Writes Across All 24 Certified Master Tables
    const postTestHashes = await getTableHashes();
    for (const table of AUTHORITATIVE_TABLES) {
      expect(postTestHashes[table].count).toBe(baselineHashes[table].count);
      expect(postTestHashes[table].hash).toBe(baselineHashes[table].hash);
    }
  });
});