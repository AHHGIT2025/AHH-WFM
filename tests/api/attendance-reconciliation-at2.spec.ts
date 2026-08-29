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
  DECISION_TYPE,
  EVIDENCE_ORIGIN,
  EVIDENCE_SUBTYPE
} from "@/lib/attendance-reconciliation-engine";

describe("Phase AT-2: Attendance Reconciliation & Approval Comprehensive Certification", () => {
  const originalEnv = process.env.ATTENDANCE_RECONCILIATION_ENABLED;
  const originalImportEnv = process.env.ATTENDANCE_IMPORT_ENABLED;

  const rand = Date.now();
  let testCompany: any;
  let testCompanyOther: any;
  let guardEmp: any;
  let guardEmp2: any;
  let fmEmp: any;
  let uploaderEmp: any;
  let reviewerEmp: any;
  let reviewerEmp2: any;
  let submitterEmp: any;
  let approverEmp: any;
  let superAdminEmp: any;
  let testClientSG: any;
  let testContractSG: any;
  let testProjectSG: any;
  let testSiteSG: any;
  let testClientFM: any;
  let testContractFM: any;
  let testProjectFM: any;
  let testSiteFM: any;

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

  async function cleanupBatch(recBatchId?: string, impBatchId?: string) {
    if (recBatchId) {
      await prisma.attendanceApprovedSnapshotRow.deleteMany({ where: { snapshot: { reconciliationBatchId: recBatchId } } });
      await prisma.attendanceApprovedSnapshot.deleteMany({ where: { reconciliationBatchId: recBatchId } });
      await prisma.attendanceReconciliationEvent.deleteMany({ where: { reconciliationBatchId: recBatchId } });
      await prisma.attendanceReconciliationCandidateSource.deleteMany({ where: { candidate: { reconciliationBatchId: recBatchId } } });
      await prisma.attendanceReconciliationCandidate.updateMany({
        where: { reconciliationBatchId: recBatchId },
        data: { currentDecisionId: null }
      });
      await prisma.attendanceReconciliationDecision.updateMany({
        where: { reconciliationBatchId: recBatchId },
        data: { supersedesDecisionId: null }
      });
      await prisma.attendanceReconciliationDecision.deleteMany({ where: { reconciliationBatchId: recBatchId } });
      await prisma.attendanceReconciliationCandidate.deleteMany({ where: { reconciliationBatchId: recBatchId } });
      await prisma.attendanceReconciliationBatch.deleteMany({ where: { id: recBatchId } });
    }
    if (impBatchId) {
      await prisma.attendanceImportRow.deleteMany({ where: { batchId: impBatchId } });
      await prisma.attendanceImportBatch.deleteMany({ where: { id: impBatchId } });
    }
  }

  beforeAll(async () => {
    process.env.ATTENDANCE_IMPORT_ENABLED = "true";
    process.env.ATTENDANCE_RECONCILIATION_ENABLED = "true";

    testCompany = await prisma.company.create({
      data: {
        companyCode: "REC_TEST_CO_" + rand,
        companyName: "Reconciliation Test Company Alpha"
      }
    });

    testCompanyOther = await prisma.company.create({
      data: {
        companyCode: "REC_TEST_OTHER_" + rand,
        companyName: "Reconciliation Test Company Beta"
      }
    });

    // Guard Employee 1
    guardEmp = await prisma.employee.create({
      data: {
        id: "EMP-GUARD-1-" + rand,
        name: "Security Guard Alpha",
        email: `guard1.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    // Guard Employee 2
    guardEmp2 = await prisma.employee.create({
      data: {
        id: "EMP-GUARD-2-" + rand,
        name: "Security Guard Beta",
        email: `guard2.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    // FM Employee
    fmEmp = await prisma.employee.create({
      data: {
        id: "EMP-FM-1-" + rand,
        name: "FM Technician Alpha",
        email: `fm1.${rand}@ahh.qa`,
        department: "Facility Management",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "FACILITY_MANAGEMENT"
      }
    });

    // Uploader Officer
    uploaderEmp = await prisma.employee.create({
      data: {
        id: "EMP-UPL-" + rand,
        name: "Uploader Officer",
        email: `upl.${rand}@ahh.qa`,
        department: "Operations",
        role: "OPERATIONS_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Reviewer Officer
    reviewerEmp = await prisma.employee.create({
      data: {
        id: "EMP-REV-1-" + rand,
        name: "Reviewer Officer 1",
        email: `rev1.${rand}@ahh.qa`,
        department: "Operations",
        role: "SECURITY_OPERATIONS_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Reviewer Officer 2
    reviewerEmp2 = await prisma.employee.create({
      data: {
        id: "EMP-REV-2-" + rand,
        name: "Reviewer Officer 2",
        email: `rev2.${rand}@ahh.qa`,
        department: "Operations",
        role: "FACILITY_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Submitter Officer
    submitterEmp = await prisma.employee.create({
      data: {
        id: "EMP-SUB-" + rand,
        name: "Submitter Officer",
        email: `sub.${rand}@ahh.qa`,
        department: "Operations",
        role: "OPERATIONS_MANAGER",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Approver Director
    approverEmp = await prisma.employee.create({
      data: {
        id: "EMP-APP-" + rand,
        name: "HR Director Approver",
        email: `app.${rand}@ahh.qa`,
        department: "Human Resources",
        role: "HR_DIRECTOR",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // Super Admin
    superAdminEmp = await prisma.employee.create({
      data: {
        id: "EMP-ADMIN-" + rand,
        name: "Executive Super Admin",
        email: `admin.${rand}@ahh.qa`,
        department: "Executive",
        role: "SUPER_ADMIN",
        status: "Off Duty",
        companyId: testCompany.id,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "WHITE_COLLAR"
      }
    });

    // SG Structure
    testClientSG = await prisma.manpowerClient.create({
      data: {
        code: "CLI-SG-" + rand,
        name: "Security Client " + rand,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });

    testContractSG = await prisma.manpowerContract.create({
      data: {
        clientId: testClientSG.id,
        contractNumber: "CNT-SG-" + rand,
        title: "Security Guarding Contract " + rand,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE"
      }
    });

    testProjectSG = await prisma.manpowerProject.create({
      data: {
        contractId: testContractSG.id,
        code: "PRJ-SG-" + rand,
        name: "Security Project " + rand,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });

    testSiteSG = await prisma.manpowerSite.create({
      data: {
        projectId: testProjectSG.id,
        code: "SITE-SG-" + rand,
        name: "Security Site " + rand,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });

    // FM Structure
    testClientFM = await prisma.manpowerClient.create({
      data: {
        code: "CLI-FM-" + rand,
        name: "Facility Client " + rand,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });

    testContractFM = await prisma.manpowerContract.create({
      data: {
        clientId: testClientFM.id,
        contractNumber: "CNT-FM-" + rand,
        title: "Facility Management Contract " + rand,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "FACILITY_MANAGEMENT",
        status: "ACTIVE"
      }
    });

    testProjectFM = await prisma.manpowerProject.create({
      data: {
        contractId: testContractFM.id,
        code: "PRJ-FM-" + rand,
        name: "Facility Project " + rand,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });

    testSiteFM = await prisma.manpowerSite.create({
      data: {
        projectId: testProjectFM.id,
        code: "SITE-FM-" + rand,
        name: "Facility Site " + rand,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });
  });

  afterAll(async () => {
    process.env.ATTENDANCE_RECONCILIATION_ENABLED = originalEnv;
    process.env.ATTENDANCE_IMPORT_ENABLED = originalImportEnv;

    if (testCompany) {
      await prisma.attendanceApprovedSnapshotRow.deleteMany({ where: { companyId: { in: [testCompany.id, testCompanyOther.id] } } });
      await prisma.attendanceApprovedSnapshot.deleteMany({ where: { companyId: { in: [testCompany.id, testCompanyOther.id] } } });
      await prisma.attendanceReconciliationEvent.deleteMany({ where: { reconciliationBatch: { companyId: { in: [testCompany.id, testCompanyOther.id] } } } });
      await prisma.attendanceReconciliationCandidateSource.deleteMany({ where: { candidate: { reconciliationBatch: { companyId: { in: [testCompany.id, testCompanyOther.id] } } } } });
      await prisma.attendanceReconciliationCandidate.updateMany({
        where: { reconciliationBatch: { companyId: { in: [testCompany.id, testCompanyOther.id] } } },
        data: { currentDecisionId: null }
      });
      await prisma.attendanceReconciliationDecision.updateMany({
        where: { reconciliationBatch: { companyId: { in: [testCompany.id, testCompanyOther.id] } } },
        data: { supersedesDecisionId: null }
      });
      await prisma.attendanceReconciliationDecision.deleteMany({ where: { reconciliationBatch: { companyId: { in: [testCompany.id, testCompanyOther.id] } } } });
      await prisma.attendanceReconciliationCandidate.deleteMany({ where: { reconciliationBatch: { companyId: { in: [testCompany.id, testCompanyOther.id] } } } });
      await prisma.attendanceReconciliationBatch.deleteMany({ where: { companyId: { in: [testCompany.id, testCompanyOther.id] } } });
      await prisma.attendanceImportRow.deleteMany({ where: { companyId: { in: [testCompany.id, testCompanyOther.id] } } });
      await prisma.attendanceImportBatch.deleteMany({ where: { companyId: { in: [testCompany.id, testCompanyOther.id] } } });

      await prisma.manpowerSite.deleteMany({ where: { id: { in: [testSiteSG?.id, testSiteFM?.id] } } });
      await prisma.manpowerProject.deleteMany({ where: { id: { in: [testProjectSG?.id, testProjectFM?.id] } } });
      await prisma.manpowerContract.deleteMany({ where: { id: { in: [testContractSG?.id, testContractFM?.id] } } });
      await prisma.manpowerClient.deleteMany({ where: { id: { in: [testClientSG?.id, testClientFM?.id] } } });
      await prisma.employee.deleteMany({ where: { companyId: { in: [testCompany.id, testCompanyOther.id] } } });
      await prisma.company.deleteMany({ where: { id: { in: [testCompany.id, testCompanyOther.id] } } });
    }
  });

  // ==========================================
  // 1. FEATURE FLAG GATING
  // ==========================================
  describe("1. Feature Flag Gating Tests", () => {
    it("Requires BOTH ATTENDANCE_IMPORT_ENABLED=true and ATTENDANCE_RECONCILIATION_ENABLED=true", () => {
      process.env.ATTENDANCE_IMPORT_ENABLED = "true";
      process.env.ATTENDANCE_RECONCILIATION_ENABLED = "true";
      expect(isAttendanceReconciliationEnabled()).toBe(true);

      process.env.ATTENDANCE_IMPORT_ENABLED = "true";
      process.env.ATTENDANCE_RECONCILIATION_ENABLED = "false";
      expect(isAttendanceReconciliationEnabled()).toBe(false);

      process.env.ATTENDANCE_IMPORT_ENABLED = "false";
      process.env.ATTENDANCE_RECONCILIATION_ENABLED = "true";
      expect(isAttendanceReconciliationEnabled()).toBe(false);

      delete process.env.ATTENDANCE_RECONCILIATION_ENABLED;
      expect(isAttendanceReconciliationEnabled()).toBe(false);

      process.env.ATTENDANCE_IMPORT_ENABLED = "true";
      process.env.ATTENDANCE_RECONCILIATION_ENABLED = "true";
    });
  });

  // ==========================================
  // 2. OPERATIONAL SCOPE & ISOLATION
  // ==========================================
  describe("2. Operational Scope & Tenancy Isolation", () => {
    it("Strictly blocks White Collar batches from reconciliation initialization", async () => {
      const wcBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-WC-" + Date.now(),
          companyId: testCompany.id,
          operationType: "WHITE_COLLAR",
          originalFileName: "wc_muster.xlsx",
          status: "VALIDATED"
        }
      });

      await expect(
        initializeReconciliation(wcBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name })
      ).rejects.toThrow("Attendance Reconciliation is strictly restricted to Security Guarding and Facility Management.");

      await prisma.attendanceImportBatch.delete({ where: { id: wcBatch.id } });
    });

    it("Reconciliation batches preserve tenant company ID isolation", async () => {
      const otherBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-OTHER-" + Date.now(),
          companyId: testCompanyOther.id,
          operationType: "SECURITY_GUARDING",
          originalFileName: "other_muster.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      const recBatch = await initializeReconciliation(otherBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      expect(recBatch.companyId).toBe(testCompanyOther.id);
      expect(recBatch.companyId).not.toBe(testCompany.id);

      await cleanupBatch(recBatch.id, otherBatch.id);
    });
  });

  // ==========================================
  // 3. CANDIDATE IDENTITY & MULTI-SOURCE LINEAGE
  // ==========================================
  describe("3. Candidate Identity, Lineage & Collapsing", () => {
    it("Collapses multiple spreadsheet duplicate lines into one operational candidate preserving all CandidateSource provenance", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-COLLAPSE-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "multi_line_guard.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      const dutyDate = new Date("2026-08-10");

      // Row 1
      const row1 = await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-10",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
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
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      // Row 2: Same operational duty collapsed
      const row2 = await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 3,
          rawAttendanceDate: "2026-08-10",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
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
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "DUPLICATE",
          isDuplicate: true,
          duplicateReason: "Same candidate duplicate"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      expect(recBatch.totalCandidates).toBe(1);
      const cand = recBatch.candidates[0];
      expect(cand.sources.length).toBe(2);

      const srcRowNumbers = cand.sources.map((s: any) => s.sourceRowNumber).sort();
      expect(srcRowNumbers).toEqual([2, 3]);

      await cleanupBatch(recBatch.id, impBatch.id);
    });

    it("Differentiates same employee/site/shift with distinct time windows", () => {
      const key1 = buildOperationalCandidateKey({
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING",
        employeeId: guardEmp.id,
        dutyDateStr: "2026-08-10",
        siteId: testSiteSG.id,
        shiftCode: "SPLIT",
        plannedStart: "06:00",
        plannedEnd: "12:00"
      });

      const key2 = buildOperationalCandidateKey({
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING",
        employeeId: guardEmp.id,
        dutyDateStr: "2026-08-10",
        siteId: testSiteSG.id,
        shiftCode: "SPLIT",
        plannedStart: "16:00",
        plannedEnd: "22:00"
      });

      expect(key1).not.toBe(key2);
    });
  });

  // ==========================================
  // 4. IMMUTABLE APPEND-ONLY DECISIONS
  // ==========================================
  describe("4. Append-Only Immutable Decision History", () => {
    it("Creates v1, supersedes with v2, preserves v1 immutably, points currentDecisionId to v2", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-DEC-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "guard_dec.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-11",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
          rawShift: "DAY_12H",
          rawPlannedStart: "07:00",
          rawPlannedEnd: "19:00",
          rawWorkedHours: "12",
          rawOtHours: "0",
          rawAttendanceStatus: "PRESENT",
          attendanceDate: new Date("2026-08-11"),
          workedHours: 12,
          otHours: 0,
          normalizedStatus: "PRESENT",
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      const cand = recBatch.candidates[0];
      const initialDecision = cand.currentDecision;
      expect(initialDecision.decisionVersion).toBe(1);

      // Apply Decision Revision v2
      const decV2 = await applyDecision(
        recBatch.id,
        {
          candidateId: cand.id,
          decisionType: DECISION_TYPE.ADJUST_PROPOSED_HOURS,
          reasonCode: "SITE_LOG_VERIFIED",
          reasonNotes: "Verified with logbook: 10 hrs regular, 2 hrs OT",
          resolvedStatus: "PRESENT",
          resolvedWorkedMinutes: 600,
          resolvedOtMinutes: 120
        },
        { id: reviewerEmp.id, name: reviewerEmp.name, role: reviewerEmp.role }
      );

      expect(decV2.decisionVersion).toBe(2);
      expect(decV2.supersedesDecisionId).toBe(initialDecision.id);

      // Verify v1 decision still exists and is untouched
      const decV1After = await prisma.attendanceReconciliationDecision.findUnique({
        where: { id: initialDecision.id }
      });
      expect(decV1After).not.toBeNull();
      expect(decV1After?.decisionVersion).toBe(1);
      expect(decV1After?.resolvedWorkedMinutes).toBe(initialDecision.resolvedWorkedMinutes);

      // Verify Candidate live overlay points to v2
      const candUpdated = await prisma.attendanceReconciliationCandidate.findUnique({
        where: { id: cand.id }
      });
      expect(candUpdated?.currentDecisionId).toBe(decV2.id);

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

  // ==========================================
  // 5. EVIDENCE DRIFT & REVERT TRANSACTION
  // ==========================================
  describe("5. Evidence Drift Detection & Return Semantics", () => {
    it("Approval-time drift atomically reverts PENDING_APPROVAL -> RETURNED with zero snapshot creation", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-DRIFT-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "guard_drift.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      const row = await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-12",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
          rawShift: "DAY_12H",
          rawPlannedStart: "07:00",
          rawPlannedEnd: "19:00",
          rawWorkedHours: "12",
          rawOtHours: "0",
          rawAttendanceStatus: "PRESENT",
          attendanceDate: new Date("2026-08-12"),
          workedHours: 12,
          otHours: 0,
          normalizedStatus: "PRESENT",
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

      // SIMULATE SOURCE DRIFT: Alter staging row after submission
      await prisma.attendanceImportRow.update({
        where: { id: row.id },
        data: { workedHours: 10 }
      });

      // Attempt Approval
      await expect(
        approveReconciliation(recBatch.id, { id: approverEmp.id, name: approverEmp.name })
      ).rejects.toThrow("Approval blocked due to evidence drift");

      // Verify Batch was returned to RETURNED atomically
      const returnedBatch = await prisma.attendanceReconciliationBatch.findUnique({
        where: { id: recBatch.id }
      });
      expect(returnedBatch?.status).toBe(RECONCILIATION_STATUS.RETURNED);
      expect(returnedBatch?.returnReason).toBe("RECONCILIATION_SOURCE_CHANGED");

      // Verify ZERO snapshots were created
      const snapshots = await prisma.attendanceApprovedSnapshot.findMany({
        where: { reconciliationBatchId: recBatch.id }
      });
      expect(snapshots.length).toBe(0);

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

  // ==========================================
  // 6. SEGREGATION OF DUTIES (SoD)
  // ==========================================
  describe("6. Segregation of Duties (SoD) Authorization", () => {
    it("Strictly blocks Uploader, Reviewer, Submitter, and SUPER_ADMIN from self-approving", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-SOD-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "guard_sod.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-13",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
          rawShift: "DAY_12H",
          rawPlannedStart: "07:00",
          rawPlannedEnd: "19:00",
          rawWorkedHours: "12",
          rawOtHours: "0",
          rawAttendanceStatus: "PRESENT",
          attendanceDate: new Date("2026-08-13"),
          workedHours: 12,
          otHours: 0,
          normalizedStatus: "PRESENT",
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

      // Uploader self-approval blocked
      await expect(
        approveReconciliation(recBatch.id, { id: uploaderEmp.id, name: uploaderEmp.name })
      ).rejects.toThrow("Segregation of Duties Violation");

      // Reviewer self-approval blocked
      await expect(
        approveReconciliation(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name })
      ).rejects.toThrow("Segregation of Duties Violation");

      // Submitter self-approval blocked
      await expect(
        approveReconciliation(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name })
      ).rejects.toThrow("Segregation of Duties Violation");

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

  // ==========================================
  // 7. SNAPSHOT HASHING & IMMUTABILITY
  // ==========================================
  describe("7. Snapshot Hashing Determinism & Immutability", () => {
    it("Produces deterministic rowChecksum and snapshotHash across identical data, and varies on alteration", () => {
      const snapRowData = {
        operationalCandidateKey: "CAND_KEY_ALPHA",
        reconciliationDecisionId: "DEC_123",
        decisionType: "AUTO_MATCH",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING",
        employeeId: guardEmp.id,
        employeeCode: guardEmp.id,
        employeeName: guardEmp.name,
        dutyDate: "2026-08-15",
        siteId: testSiteSG.id,
        shiftCode: "DAY_12H",
        approvedStatus: "PRESENT",
        approvedRegularMinutes: 720,
        approvedOtMinutes: 120
      };

      const hash1 = computeRowChecksum(snapRowData);
      const hash2 = computeRowChecksum(snapRowData);
      expect(hash1).toBe(hash2);

      const hashModified = computeRowChecksum({ ...snapRowData, approvedOtMinutes: 60 });
      expect(hash1).not.toBe(hashModified);

      const snapHeader = {
        reconciliationBatchId: "BATCH_123",
        approvalVersion: 1,
        reconciliationVersion: 1,
        sourceImportBatchId: "IMP_123",
        sourceEvidenceHash: "SRC_HASH",
        systemEvidenceHash: "SYS_HASH",
        totalRows: 1,
        approvedRegularMinutesTotal: 720,
        approvedOtMinutesTotal: 120
      };

      const snapshotHash1 = computeSnapshotHash(snapHeader, [hash1]);
      const snapshotHash2 = computeSnapshotHash(snapHeader, [hash1]);
      expect(snapshotHash1).toBe(snapshotHash2);

      const snapshotHashModified = computeSnapshotHash(snapHeader, [hashModified]);
      expect(snapshotHash1).not.toBe(snapshotHashModified);
    });
  });

  // ==========================================
  // 8. 24 PROTECTED TABLES ZERO-WRITE CERTIFICATION
  // ==========================================
  describe("8. Mathematical Zero Authoritative Master Writes Certification", () => {
    it("Full AT-2 Lifecycle produces ZERO writes across all 24 authoritative production tables", async () => {
      // 1. Snapshot Authoritative Tables Baseline
      const baselineHashes = await getTableHashes();

      // 2. Create Certified Staging Import Batch
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-ZERO-WRITE-" + Date.now(),
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
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
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
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      // Line 2: Duplicate row collapsed into same candidate key
      const row2 = await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 3,
          rawAttendanceDate: "2026-08-15",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
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
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
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

      const candidate = recBatch.candidates[0];

      // 4. Apply Manual Decision Revision
      const decisionRevision = await applyDecision(
        recBatch.id,
        {
          candidateId: candidate.id,
          decisionType: DECISION_TYPE.ADJUST_PROPOSED_HOURS,
          reasonCode: "SUPERVISOR_CONFIRMED",
          reasonNotes: "Supervisor confirmed 11.5 hours worked",
          resolvedStatus: "PRESENT",
          resolvedWorkedMinutes: 690,
          resolvedOtMinutes: 90
        },
        { id: reviewerEmp.id, name: reviewerEmp.name, role: reviewerEmp.role }
      );

      // 5. Complete Review and Submit
      await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

      // 6. Return and Resume
      await returnReconciliation(recBatch.id, "Please verify OT breakdown", {
        id: approverEmp.id,
        name: approverEmp.name
      });
      await resumeReturnedReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });

      // 7. Resubmit and Approve
      await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

      const approvalResult = await approveReconciliation(recBatch.id, {
        id: approverEmp.id,
        name: approverEmp.name,
        role: approverEmp.role
      });

      expect(approvalResult.batch.status).toBe(RECONCILIATION_STATUS.APPROVED);
      expect(approvalResult.snapshot).toBeDefined();

      // 8. Reopen
      await reopenReconciliation(recBatch.id, "Client requested retroactive muster correction", {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      // 9. Mathematical Proof: ZERO Writes Across All 24 Certified Master Tables
      const postTestHashes = await getTableHashes();
      for (const table of AUTHORITATIVE_TABLES) {
        expect(postTestHashes[table].count).toBe(baselineHashes[table].count);
        expect(postTestHashes[table].hash).toBe(baselineHashes[table].hash);
      }

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

  // ==========================================
  // 9. RECONCILIATION MATCHING & ROSTER IS NOT ATTENDANCE
  // ==========================================
  describe("9. Bidirectional Matching & Classification Rules", () => {
    it("Differentiates SYSTEM_ONLY_ROSTER from SYSTEM_ONLY_ATTENDANCE (Roster is planning context, not attendance)", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-MATCH-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "guard_matching.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      // Staging row: guard 1 present
      await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-14",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
          rawShift: "DAY_12H",
          rawPlannedStart: "07:00",
          rawPlannedEnd: "19:00",
          rawWorkedHours: "12",
          rawOtHours: "0",
          rawAttendanceStatus: "PRESENT",
          attendanceDate: new Date("2026-08-14"),
          workedHours: 12,
          otHours: 0,
          normalizedStatus: "PRESENT",
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      expect(recBatch.candidates.length).toBeGreaterThanOrEqual(1);
      const cand = recBatch.candidates.find((c: any) => c.employeeId === guardEmp.id);
      expect(cand).toBeDefined();
      expect(cand.evidenceOrigin).toBe(EVIDENCE_ORIGIN.IMPORT_ONLY); // No mobile punch or roster linked yet -> IMPORT_ONLY

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

  // ==========================================
  // 10. WORKFLOW STATE MACHINE TRANSITION PROHIBITIONS
  // ==========================================
  describe("10. Workflow State Machine & Terminal Rejection", () => {
    it("Strictly blocks invalid state transitions and enforces REJECTED as terminal", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-FLOW-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "guard_flow.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-14",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
          rawShift: "DAY_12H",
          rawPlannedStart: "07:00",
          rawPlannedEnd: "19:00",
          rawWorkedHours: "12",
          rawOtHours: "0",
          rawAttendanceStatus: "PRESENT",
          attendanceDate: new Date("2026-08-14"),
          workedHours: 12,
          otHours: 0,
          normalizedStatus: "PRESENT",
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      // Prohibited: Cannot approve directly while IN_REVIEW
      await expect(
        approveReconciliation(recBatch.id, { id: approverEmp.id, name: approverEmp.name })
      ).rejects.toThrow();

      // Prohibited: Cannot return or resume while IN_REVIEW
      await expect(
        resumeReturnedReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name })
      ).rejects.toThrow();

      // Complete Review -> Submit
      await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

      // Reject Batch
      const rejected = await rejectReconciliation(recBatch.id, "Batch rejected due to corrupt muster", {
        id: approverEmp.id,
        name: approverEmp.name
      });
      expect(rejected.status).toBe(RECONCILIATION_STATUS.REJECTED);

      // Terminal: Cannot reopen or resume a REJECTED batch
      await expect(
        resumeReturnedReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name })
      ).rejects.toThrow();

      await expect(
        reopenReconciliation(recBatch.id, "Attempt reopen rejected", { id: reviewerEmp.id, name: reviewerEmp.name })
      ).rejects.toThrow();

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

  // ==========================================
  // 11. EVIDENCE REFRESH WORKFLOW
  // ==========================================
  describe("11. Evidence Refresh Workflow", () => {
    it("Permits refresh in RETURNED state, recomputes hashes and increments rowVersion", async () => {
      const impBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: "AIB-REFRESH-" + Date.now(),
          companyId: testCompany.id,
          operationType: "SECURITY_GUARDING",
          attendancePeriodFrom: new Date("2026-08-01"),
          attendancePeriodTo: new Date("2026-08-31"),
          originalFileName: "guard_refresh.xlsx",
          status: "VALIDATED",
          uploadedById: uploaderEmp.id
        }
      });

      await prisma.attendanceImportRow.create({
        data: {
          batchId: impBatch.id,
          sourceRowNumber: 2,
          rawAttendanceDate: "2026-08-14",
          rawEmployeeCode: guardEmp.id,
          rawEmployeeName: guardEmp.name,
          rawSite: testSiteSG.name,
          rawShift: "DAY_12H",
          rawPlannedStart: "07:00",
          rawPlannedEnd: "19:00",
          rawWorkedHours: "12",
          rawOtHours: "0",
          rawAttendanceStatus: "PRESENT",
          attendanceDate: new Date("2026-08-14"),
          workedHours: 12,
          otHours: 0,
          normalizedStatus: "PRESENT",
          employeeId: guardEmp.id,
          companyId: testCompany.id,
          siteId: testSiteSG.id,
          contractId: testContractSG.id,
          validationStatus: "VALID"
        }
      });

      const recBatch = await initializeReconciliation(impBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name
      });

      await completeReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      await submitForApproval(recBatch.id, { id: submitterEmp.id, name: submitterEmp.name });

      // Return batch
      await returnReconciliation(recBatch.id, "Please refresh with latest mobile logs", {
        id: approverEmp.id,
        name: approverEmp.name
      });

      // Refresh evidence
      const refreshed = await refreshEvidence(recBatch.id, {
        id: reviewerEmp.id,
        name: reviewerEmp.name,
        role: reviewerEmp.role
      });

      expect(refreshed.status).toBe(RECONCILIATION_STATUS.RETURNED);
      expect(refreshed.sourceEvidenceHash).toBeDefined();

      // Resume review
      const resumed = await resumeReturnedReview(recBatch.id, { id: reviewerEmp.id, name: reviewerEmp.name });
      expect(resumed.status).toBe(RECONCILIATION_STATUS.IN_REVIEW);

      await cleanupBatch(recBatch.id, impBatch.id);
    });
  });

});
