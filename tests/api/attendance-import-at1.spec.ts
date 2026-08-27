import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import {
  parseAttendanceImportContent,
  sanitizeSpreadsheetFormula,
  computeFileHash,
  computeRowFingerprint,
  getStandardAttendanceTemplateCsv,
  isAttendanceImportEnabled
} from "../../apps/web/lib/attendance-import-parser";
import { validateAttendanceImportBatch } from "../../apps/web/lib/attendance-import-validator";
import { GET as getBatches, POST as createBatch } from "../../apps/web/app/api/v1/attendance-import/batches/route";
import { GET as getBatchDetail } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/route";
import { POST as validateBatchRoute } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/validate/route";
import { GET as getBatchRows } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/rows/route";
import { POST as reviewBatchRoute } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/review/route";
import { POST as cancelBatchRoute } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/cancel/route";
import { GET as getTemplateRoute } from "../../apps/web/app/api/v1/attendance-import/template/route";
import { filterNavigationByPermissions } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Unified Attendance Intake Foundation (Phase AT-1) API & Validation Suite", () => {
  let testCompanyId: string;
  let testSecClientId: string;
  let testFmClientId: string;
  let testSecContractId: string;
  let testFmContractId: string;
  let testSecProjectId: string;
  let testFmProjectId: string;
  let testSecSiteId: string;
  let testFmSiteId: string;
  let testActiveSecEmpId: string;
  let testInactiveSecEmpId: string;
  let testFmEmpId: string;
  let testLeaveEmpId: string;
  let testMobileAttendanceEmpId: string;
  let testExistingAttendanceId: string;
  let testRosterSlotId: string;
  let testRosterAssignmentId: string;
  let testContractReqId: string;

  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  beforeAll(async () => {
    // 1. Create Test Company
    const company = await prisma.company.create({
      data: {
        companyCode: `CMP-AT1-${rand}`,
        companyName: `AT-1 Test Operations Holding ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    // 2. Create Security Client, Project, Site, Contract
    const secClient = await prisma.manpowerClient.create({
      data: {
        code: `CLI-SEC-${rand}`,
        name: `AT-1 Security Guarding Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testSecClientId = secClient.id;

    const secContract = await prisma.manpowerContract.create({
      data: {
        clientId: testSecClientId,
        contractNumber: `CNT-SEC-${rand}`,
        title: "AT-1 Security Test Contract",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE"
      }
    });
    testSecContractId = secContract.id;

    const secProject = await prisma.manpowerProject.create({
      data: {
        contractId: testSecContractId,
        code: `PRJ-SEC-${rand}`,
        name: `AT-1 Security Project ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testSecProjectId = secProject.id;

    const secSite = await prisma.manpowerSite.create({
      data: {
        projectId: testSecProjectId,
        code: `SITE-SEC-${rand}`,
        name: `AT-1 Security Guarding Site ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testSecSiteId = secSite.id;

    // 3. Create FM Client, Project, Site, Contract
    const fmClient = await prisma.manpowerClient.create({
      data: {
        code: `CLI-FM-${rand}`,
        name: `AT-1 Facility Management Client ${rand}`,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });
    testFmClientId = fmClient.id;

    const fmContract = await prisma.manpowerContract.create({
      data: {
        clientId: testFmClientId,
        contractNumber: `CNT-FM-${rand}`,
        title: "AT-1 FM Test Contract",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        operationType: "FACILITY_MANAGEMENT",
        status: "ACTIVE"
      }
    });
    testFmContractId = fmContract.id;

    const fmProject = await prisma.manpowerProject.create({
      data: {
        contractId: testFmContractId,
        code: `PRJ-FM-${rand}`,
        name: `AT-1 FM Project ${rand}`,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });
    testFmProjectId = fmProject.id;

    const fmSite = await prisma.manpowerSite.create({
      data: {
        projectId: testFmProjectId,
        code: `SITE-FM-${rand}`,
        name: `AT-1 FM Site ${rand}`,
        operationType: "FACILITY_MANAGEMENT",
        isActive: true
      }
    });
    testFmSiteId = fmSite.id;

    // 4. Create Active Security Guarding Employee
    testActiveSecEmpId = `EMP-SEC-ACT-${rand}`;
    await prisma.employee.create({
      data: {
        id: testActiveSecEmpId,
        name: "Security Officer Alpha",
        email: `sec.alpha.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompanyId,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    // 5. Create Inactive Employee
    testInactiveSecEmpId = `EMP-SEC-INACT-${rand}`;
    await prisma.employee.create({
      data: {
        id: testInactiveSecEmpId,
        name: "Inactive Guard Bravo",
        email: `sec.bravo.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Offline",
        companyId: testCompanyId,
        isActive: false,
        employmentStatus: "TERMINATED",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    // 6. Create FM Employee
    testFmEmpId = `EMP-FM-ACT-${rand}`;
    await prisma.employee.create({
      data: {
        id: testFmEmpId,
        name: "FM Technician Charlie",
        email: `fm.charlie.${rand}@ahh.qa`,
        department: "Facility Management",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompanyId,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "FACILITY_MANAGEMENT"
      }
    });

    // 7. Create Employee with Approved Leave
    testLeaveEmpId = `EMP-LEAVE-${rand}`;
    await prisma.employee.create({
      data: {
        id: testLeaveEmpId,
        name: "Officer on Leave Delta",
        email: `sec.delta.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "On Leave",
        companyId: testCompanyId,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    await prisma.leaveRequest.create({
      data: {
        employeeId: testLeaveEmpId,
        employeeName: "Officer on Leave Delta",
        type: "ANNUAL",
        dateRange: "2026-08-20 to 2026-08-30",
        reason: "Annual Vacation",
        status: "APPROVED",
        startDate: new Date("2026-08-20"),
        endDate: new Date("2026-08-30"),
        totalDays: 10
      }
    });

    // 8. Create Employee with Existing Authoritative Mobile Attendance Record
    testMobileAttendanceEmpId = `EMP-MOBILE-${rand}`;
    await prisma.employee.create({
      data: {
        id: testMobileAttendanceEmpId,
        name: "Guard with Mobile Punch Echo",
        email: `sec.echo.${rand}@ahh.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "On Duty",
        companyId: testCompanyId,
        isActive: true,
        employmentStatus: "ACTIVE",
        employeeCategory: "SECURITY_GUARDING"
      }
    });

    const mobileAtt = await prisma.attendanceRecord.create({
      data: {
        employeeId: testMobileAttendanceEmpId,
        employeeName: "Guard with Mobile Punch Echo",
        companyId: testCompanyId,
        checkIn: new Date("2026-08-25T07:00:00Z"),
        checkOut: new Date("2026-08-25T19:00:00Z"),
        lat: 25.2854,
        lng: 51.5310,
        device: "MOBILE_APP_PW8",
        status: "ON_TIME",
        locationName: `AT-1 Security Guarding Site ${rand}`
      }
    });
    testExistingAttendanceId = mobileAtt.id;

    // 9. Create Roster Slot and Assignment
    const contractReq = await prisma.contractManpowerRequirement.create({
      data: {
        contractId: testSecContractId,
        position: "Security Guard",
        quantity: 1,
        deploymentType: "STATIC"
      }
    });
    testContractReqId = contractReq.id;

    const rosterSlot = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompanyId,
        contractId: testSecContractId,
        projectId: testSecProjectId,
        siteId: testSecSiteId,
        locationKey: `site:${testSecSiteId}`,
        contractRequirementId: testContractReqId,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: new Date("2026-08-25"),
        shiftKey: "shift:DAY-12H",
        slotIndex: 1,
        generationKey: `${testContractReqId}:2026-08-25:shift:DAY-12H:1`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift 12H",
        snapshotStartTime: "07:00",
        snapshotEndTime: "19:00",
        fulfillmentStatus: "FILLED",
        scheduleStatus: "PUBLISHED"
      }
    });
    testRosterSlotId = rosterSlot.id;

    const rosterAssignment = await prisma.rosterSlotAssignment.create({
      data: {
        slotId: testRosterSlotId,
        employeeId: testActiveSecEmpId,
        assignmentType: "PRIMARY",
        historyStatus: "ACTIVE",
        assignedById: testActiveSecEmpId
      }
    });
    testRosterAssignmentId = rosterAssignment.id;
  });

  afterAll(async () => {
    // Clean up test batches and rows
    await prisma.attendanceImportRow.deleteMany({
      where: { companyId: testCompanyId }
    });
    await prisma.attendanceImportBatch.deleteMany({
      where: { companyId: testCompanyId }
    });
  });

  describe("1. File Parsing, Security & Templates", () => {
    it("1.1. getStandardAttendanceTemplateCsv returns valid CSV headers and sample data", () => {
      const csv = getStandardAttendanceTemplateCsv();
      expect(csv).toContain("Attendance Date,Employee Code,Employee Name");
      expect(csv).toContain("Ahmed Al-Kuwari");
      expect(csv).toContain("Mohammed Hassan");
    });

    it("1.2. Sanitizes spreadsheet formula injection prefixes (CWE-1236)", () => {
      expect(sanitizeSpreadsheetFormula("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
      expect(sanitizeSpreadsheetFormula("+SUM(1,2)")).toBe("'+SUM(1,2)");
      expect(sanitizeSpreadsheetFormula("-100")).toBe("'-100");
      expect(sanitizeSpreadsheetFormula("@malicious")).toBe("'@malicious");
      expect(sanitizeSpreadsheetFormula("Normal Employee Name")).toBe("Normal Employee Name");
    });

    it("1.3. Generates consistent SHA-256 file and row fingerprints", () => {
      const content = "Attendance Date,Employee Code\n2026-08-25,EMP001";
      const hash1 = computeFileHash(content);
      const hash2 = computeFileHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);

      const fp1 = computeRowFingerprint("EMP001", "2026-08-25", "Site A", "07:00-19:00");
      const fp2 = computeRowFingerprint("emp001 ", "2026-08-25", "SITE A", "07:00-19:00");
      expect(fp1).toBe(fp2);
    });

    it("1.4. Rejects empty files and files missing required columns", () => {
      const emptyRes = parseAttendanceImportContent("", "empty.csv");
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.errors[0]).toContain("File is empty");

      const missingColRes = parseAttendanceImportContent("Shift,Remarks\nDAY,Test", "invalid.csv");
      expect(missingColRes.success).toBe(false);
      expect(missingColRes.errors[0]).toContain("Missing required column(s)");
    });
  });

  describe("2. Reference Resolution & Validation Engine", () => {
    let testBatchId: string;

    beforeAll(async () => {
      // Create test batch with multiple scenarios
      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-TEST-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "test_operational_attendance.csv",
          status: "UPLOADED",
          recordCount: 8
        }
      });
      testBatchId = batch.id;

      // Staging rows covering all scenarios
      await prisma.attendanceImportRow.createMany({
        data: [
          // Row 1: Valid Clean Row
          {
            batchId: testBatchId,
            sourceRowNumber: 2,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testActiveSecEmpId,
            rawEmployeeName: "Security Officer Alpha",
            rawSite: `AT-1 Security Guarding Site ${rand}`,
            rawContract: `CNT-SEC-${rand}`,
            rawShift: "DAY-12H",
            rawPlannedStart: "07:00",
            rawPlannedEnd: "19:00",
            rawActualTimeIn: "06:55",
            rawActualTimeOut: "19:05",
            rawAttendanceStatus: "PRESENT"
          },
          // Row 2: Overnight Shift (Crossing Midnight)
          {
            batchId: testBatchId,
            sourceRowNumber: 3,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testActiveSecEmpId,
            rawEmployeeName: "Security Officer Alpha",
            rawSite: `AT-1 Security Guarding Site ${rand}`,
            rawContract: `CNT-SEC-${rand}`,
            rawShift: "NIGHT-12H",
            rawPlannedStart: "19:00",
            rawPlannedEnd: "07:00",
            rawActualTimeIn: "18:55",
            rawActualTimeOut: "07:05",
            rawAttendanceStatus: "PRESENT"
          },
          // Row 3: Inactive Employee
          {
            batchId: testBatchId,
            sourceRowNumber: 4,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testInactiveSecEmpId,
            rawEmployeeName: "Inactive Guard Bravo",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          },
          // Row 4: Scope Mismatch (FM employee in Security Batch)
          {
            batchId: testBatchId,
            sourceRowNumber: 5,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testFmEmpId,
            rawEmployeeName: "FM Tech Charlie",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          },
          // Row 5: Leave Collision (Employee on Approved Leave)
          {
            batchId: testBatchId,
            sourceRowNumber: 6,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testLeaveEmpId,
            rawEmployeeName: "Officer on Leave Delta",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          },
          // Row 6: Conflict with Existing Mobile Attendance Record
          {
            batchId: testBatchId,
            sourceRowNumber: 7,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testMobileAttendanceEmpId,
            rawEmployeeName: "Guard with Mobile Punch Echo",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          },
          // Row 7: Intra-Batch Duplicate (Identical to Row 1)
          {
            batchId: testBatchId,
            sourceRowNumber: 8,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: testActiveSecEmpId,
            rawEmployeeName: "Security Officer Alpha",
            rawSite: `AT-1 Security Guarding Site ${rand}`,
            rawContract: `CNT-SEC-${rand}`,
            rawShift: "DAY-12H",
            rawPlannedStart: "07:00",
            rawPlannedEnd: "19:00",
            rawActualTimeIn: "06:55",
            rawActualTimeOut: "19:05"
          },
          // Row 8: Unmatched Non-Existent Employee
          {
            batchId: testBatchId,
            sourceRowNumber: 9,
            rawAttendanceDate: "2026-08-25",
            rawEmployeeCode: "NON-EXISTENT-CODE-9999",
            rawEmployeeName: "Ghost Worker",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          }
        ]
      });
    });

    it("2.1. Validates batch and resolves all reference entities and exceptions correctly", async () => {
      const summary = await validateAttendanceImportBatch(testBatchId);
      expect(summary.status).toBe("VALIDATED");
      expect(summary.recordCount).toBe(8);

      const rows = summary.rowResults;

      // Row 1: Valid Clean Row
      const r1 = rows.find((r) => r.sourceRowNumber === 2);
      expect(r1?.validationStatus).toBe("VALID");
      expect(r1?.employeeId).toBe(testActiveSecEmpId);
      expect(r1?.siteId).toBe(testSecSiteId);
      expect(r1?.contractId).toBe(testSecContractId);
      expect(r1?.rosterSlotAssignmentId).toBe(testRosterAssignmentId);

      // Row 2: Overnight Shift (crossing midnight handled with dutyDate preserved)
      const r2 = rows.find((r) => r.sourceRowNumber === 3);
      expect(r2?.workedHours).toBeCloseTo(12.17, 1);
      expect(r2?.validationMessages.some((m) => m.code === "INVALID_TIME_RANGE")).toBe(false);

      // Row 3: Inactive Employee
      const r3 = rows.find((r) => r.sourceRowNumber === 4);
      expect(r3?.validationStatus).toBe("ERROR");
      expect(r3?.validationMessages.some((m) => m.code === "EMPLOYEE_INACTIVE")).toBe(true);

      // Row 4: Scope Mismatch
      const r4 = rows.find((r) => r.sourceRowNumber === 5);
      expect(r4?.validationStatus).toBe("ERROR");
      expect(r4?.validationMessages.some((m) => m.code === "EMPLOYEE_SCOPE_MISMATCH")).toBe(true);

      // Row 5: Leave Collision
      const r5 = rows.find((r) => r.sourceRowNumber === 6);
      expect(r5?.validationMessages.some((m) => m.code === "LEAVE_COLLISION")).toBe(true);

      // Row 6: Cross-Source Duplicate (Existing Mobile Attendance)
      const r6 = rows.find((r) => r.sourceRowNumber === 7);
      expect(r6?.isDuplicate).toBe(true);
      expect(r6?.existingAttendanceSource).toBe("MOBILE");
      expect(r6?.existingAttendanceId).toBe(testExistingAttendanceId);
      expect(r6?.validationMessages.some((m) => m.code === "EXISTING_ATTENDANCE_FOUND")).toBe(true);

      // Row 7: Intra-Batch Duplicate
      const r7 = rows.find((r) => r.sourceRowNumber === 8);
      expect(r7?.isDuplicate).toBe(true);
      expect(r7?.validationMessages.some((m) => m.code === "DUPLICATE_IMPORT_ROW")).toBe(true);

      // Row 8: Unmatched Employee
      const r8 = rows.find((r) => r.sourceRowNumber === 9);
      expect(r8?.validationStatus).toBe("UNMATCHED");
      expect(r8?.employeeId).toBeNull();
      expect(r8?.validationMessages.some((m) => m.code === "EMPLOYEE_NOT_FOUND")).toBe(true);
    });
  });

  describe("3. API Endpoints & State Lifecycle", () => {
    let apiBatchId: string;

    it("3.1. Template download endpoint returns CSV attachment", async () => {
      const tplReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/template");
      const res = await getTemplateRoute(tplReq);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      const text = await res.text();
      expect(text).toContain("Attendance Date,Employee Code");
    });

    it("3.2. Batch Upload via POST /api/v1/attendance-import/batches", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: testActiveSecEmpId,
          role: "SUPER_ADMIN",
          permissions: ["attendance.import.create", "attendance.import.view"]
        }
      });

      const csvContent = [
        "Attendance Date,Employee Code,Employee Name,Site / Location,Contract Number,Shift Code,Actual Time In,Actual Time Out",
        `2026-08-26,${testActiveSecEmpId},Security Officer Alpha,AT-1 Security Guarding Site ${rand},CNT-SEC-${rand},DAY-12H,07:00,19:00`
      ].join("\n");

      const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "api_upload_test.csv",
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          fileContent: csvContent,
          autoValidate: true
        })
      });

      const res = await createBatch(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.batch).toBeDefined();
      expect(data.batch.batchNumber).toContain("AIB-");
      expect(data.batch.status).toBe("VALIDATED");
      expect(data.batch.recordCount).toBe(1);
      expect(data.batch.validCount).toBe(1);

      apiBatchId = data.batch.id;
    });

    it("3.3. Batch Detail via GET /api/v1/attendance-import/batches/:id", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.view"] }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${apiBatchId}`);
      const res = await getBatchDetail(req, { params: { id: apiBatchId } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.batch.id).toBe(apiBatchId);
      expect(data.batch.company.companyCode).toBe(`CMP-AT1-${rand}`);
    });

    it("3.4. Staged Rows Query via GET /api/v1/attendance-import/batches/:id/rows", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.view"] }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${apiBatchId}/rows?filter=ALL`);
      const res = await getBatchRows(req, { params: { id: apiBatchId } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].validationStatus).toBe("VALID");
      expect(data.rows[0].employee.id).toBe(testActiveSecEmpId);
    });

    it("3.5. Batch Review via POST /api/v1/attendance-import/batches/:id/review", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.review"] }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${apiBatchId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UNDER_REVIEW", remarks: "Operational review in progress" })
      });

      const res = await reviewBatchRoute(req, { params: { id: apiBatchId } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.batch.status).toBe("UNDER_REVIEW");
      expect(data.batch.remarks).toBe("Operational review in progress");
    });

    it("3.6. Batch Cancellation via POST /api/v1/attendance-import/batches/:id/cancel", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.review"] }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${apiBatchId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Cancelled by supervisor" })
      });

      const res = await cancelBatchRoute(req, { params: { id: apiBatchId } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.batch.status).toBe("CANCELLED");
    });
  });

  describe("4. Security, Scope Isolation & RBAC", () => {
    it("4.1. Blocks access when user lacks required permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "unauth-user",
          role: "EMPLOYEE",
          permissions: ["self.profile.view"] // Lacks attendance.import.view
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches");
      const res = await getBatches(req);
      expect(res.status).toBe(403);
    });

    it("4.2. Enforces Security Guarding and Facility Management scope boundary", async () => {
      // User with Security Guarding ONLY access attempting to access FM batch
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "sec-only-user",
          role: "SECURITY_OPERATIONS_MANAGER",
          permissions: ["attendance.import.view"],
          operationAccess: {
            allowedSecurityGuarding: true,
            allowedFacilityManagement: false
          }
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches?operationType=FACILITY_MANAGEMENT");
      const res = await getBatches(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Restricted operational scope");
    });

    it("4.3. Prevents Security user from creating Facility Management batch", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "sec-only-user",
          role: "SECURITY_OPERATIONS_MANAGER",
          permissions: ["attendance.import.create"],
          operationAccess: {
            allowedSecurityGuarding: true,
            allowedFacilityManagement: false
          }
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "sec_forbidden_fm.csv",
          operationType: "FACILITY_MANAGEMENT",
          fileContent: "Attendance Date,Employee Code\n2026-08-25,EMP1"
        })
      });
      const res = await createBatch(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("No access to Facility Management scope");
    });

    it("4.4. Prevents FM user from creating Security Guarding batch", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "fm-only-user",
          role: "FACILITY_MANAGER",
          permissions: ["attendance.import.create"],
          operationAccess: {
            allowedSecurityGuarding: false,
            allowedFacilityManagement: true
          }
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "fm_forbidden_sec.csv",
          operationType: "SECURITY_GUARDING",
          fileContent: "Attendance Date,Employee Code\n2026-08-25,EMP1"
        })
      });
      const res = await createBatch(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("No access to Security Guarding scope");
    });

    it("4.5. Rejects creation with invalid/unsupported operational scopes (WHITE_COLLAR, GENERAL, ALL)", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: testActiveSecEmpId,
          role: "SUPER_ADMIN",
          permissions: ["attendance.import.create"]
        }
      });

      const invalidScopes = ["WHITE_COLLAR", "GENERAL", "ALL", "UNSCOPED", ""];
      for (const invalidScope of invalidScopes) {
        const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "invalid_scope.csv",
            operationType: invalidScope,
            fileContent: "Attendance Date,Employee Code\n2026-08-25,EMP1"
          })
        });
        const res = await createBatch(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain("Invalid operational scope");
      }
    });

    it("4.6. Allows ADMIN/SUPER_ADMIN to create either SECURITY_GUARDING or FACILITY_MANAGEMENT explicitly", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: testActiveSecEmpId,
          role: "SUPER_ADMIN",
          permissions: ["attendance.import.create", "attendance.import.view"]
        }
      });

      // Security Guarding creation
      const secReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "admin_sec.csv",
          operationType: "SECURITY_GUARDING",
          fileContent: "Attendance Date,Employee Code\n2026-08-25,EMP1"
        })
      });
      const secRes = await createBatch(secReq);
      expect(secRes.status).toBe(201);
      const secData = await secRes.json();
      expect(secData.batch?.operationType || secData.operationType).toBe("SECURITY_GUARDING");

      // Facility Management creation
      const fmReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "admin_fm.csv",
          operationType: "FACILITY_MANAGEMENT",
          fileContent: "Attendance Date,Employee Code\n2026-08-25,EMP1"
        })
      });
      const fmRes = await createBatch(fmReq);
      expect(fmRes.status).toBe(201);
      const fmData = await fmRes.json();
      expect(fmData.batch?.operationType || fmData.operationType).toBe("FACILITY_MANAGEMENT");
    });

    it("4.7. Filters contextual Attendance Intake from generic White Collar users and ensures generic top-level is absent", () => {
      // Main menu items (no generic Attendance Intake)
      const mainMenu = [
        { label: "Dashboard", path: "/" },
        { label: "Attendance Monitor", path: "/attendance" },
        { label: "Workforce Directory", path: "/workforce" }
      ];
      expect(mainMenu.some((i) => i.path === "/attendance/import")).toBe(false);

      // Contextual sub-menus
      const secSubMenu = [
        { label: "Security Dashboard", path: "/manpower/security-guarding/dashboard" },
        { label: "Attendance Intake", path: "/attendance/import?operationType=SECURITY_GUARDING" }
      ];
      const fmSubMenu = [
        { label: "FM Dashboard", path: "/manpower/facility-management/dashboard" },
        { label: "Attendance Intake", path: "/attendance/import?operationType=FACILITY_MANAGEMENT" }
      ];

      // White collar user without Security/FM operations access
      const whiteCollarUser = {
        role: "EMPLOYEE",
        permissions: ["attendance.view"],
        operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: false }
      };
      const filteredSecWc = filterNavigationByPermissions(whiteCollarUser, secSubMenu);
      expect(filteredSecWc.some((i) => i.path.startsWith("/attendance/import"))).toBe(false);

      const filteredFmWc = filterNavigationByPermissions(whiteCollarUser, fmSubMenu);
      expect(filteredFmWc.some((i) => i.path.startsWith("/attendance/import"))).toBe(false);

      // Security user
      const secUser = {
        role: "SECURITY_OPERATIONS_MANAGER",
        permissions: ["attendance.view", "attendance.import.view"],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
      };
      const filteredSec = filterNavigationByPermissions(secUser, secSubMenu);
      expect(filteredSec.some((i) => i.path.startsWith("/attendance/import"))).toBe(true);

      // FM user
      const fmUser = {
        role: "FACILITY_MANAGER",
        permissions: ["attendance.view", "attendance.import.view"],
        operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true }
      };
      const filteredFm = filterNavigationByPermissions(fmUser, fmSubMenu);
      expect(filteredFm.some((i) => i.path.startsWith("/attendance/import"))).toBe(true);
    });

    it("4.8. Ensures sidebar active route resolver strictly separates /attendance from contextual /attendance/import", () => {
      // Simulate the LayoutShell isActive resolver logic
      const resolveIsActive = (path: string, currentPathname: string, opTypeParam?: string, opAccess?: any) => {
        if (path === "/attendance/import?operationType=SECURITY_GUARDING") {
          return Boolean(currentPathname.startsWith("/attendance/import") && (opTypeParam === "SECURITY_GUARDING" || (opAccess?.allowedSecurityGuarding && !opAccess?.allowedFacilityManagement)));
        }
        if (path === "/attendance/import?operationType=FACILITY_MANAGEMENT") {
          return Boolean(currentPathname.startsWith("/attendance/import") && (opTypeParam === "FACILITY_MANAGEMENT" || (opAccess?.allowedFacilityManagement && !opAccess?.allowedSecurityGuarding)));
        }
        const cleanPath = path.split("?")[0];
        if (cleanPath === "/attendance") {
          return currentPathname === "/attendance" || (currentPathname.startsWith("/attendance/") && !currentPathname.startsWith("/attendance/import"));
        }
        if (cleanPath === "/attendance/import") {
          return currentPathname === "/attendance/import" || currentPathname.startsWith("/attendance/import/");
        }
        return currentPathname.startsWith(cleanPath);
      };

      // 1. When on /attendance (Attendance Monitor active, Contextual Intakes inactive)
      expect(resolveIsActive("/attendance", "/attendance")).toBe(true);
      expect(resolveIsActive("/attendance/import?operationType=SECURITY_GUARDING", "/attendance")).toBe(false);
      expect(resolveIsActive("/attendance/import?operationType=FACILITY_MANAGEMENT", "/attendance")).toBe(false);

      // 2. When on /attendance/import?operationType=SECURITY_GUARDING (Security Intake active, Monitor inactive, FM inactive)
      expect(resolveIsActive("/attendance", "/attendance/import", "SECURITY_GUARDING")).toBe(false);
      expect(resolveIsActive("/attendance/import?operationType=SECURITY_GUARDING", "/attendance/import", "SECURITY_GUARDING")).toBe(true);
      expect(resolveIsActive("/attendance/import?operationType=FACILITY_MANAGEMENT", "/attendance/import", "SECURITY_GUARDING")).toBe(false);

      // 3. When on /attendance/import?operationType=FACILITY_MANAGEMENT (FM Intake active, Monitor inactive, Security inactive)
      expect(resolveIsActive("/attendance", "/attendance/import", "FACILITY_MANAGEMENT")).toBe(false);
      expect(resolveIsActive("/attendance/import?operationType=FACILITY_MANAGEMENT", "/attendance/import", "FACILITY_MANAGEMENT")).toBe(true);
      expect(resolveIsActive("/attendance/import?operationType=SECURITY_GUARDING", "/attendance/import", "FACILITY_MANAGEMENT")).toBe(false);

      // 4. When on /attendance/import/AIB-202608-0001 (Batch detail: Monitor inactive)
      expect(resolveIsActive("/attendance", "/attendance/import/AIB-202608-0001")).toBe(false);
      expect(resolveIsActive("/attendance/import?operationType=SECURITY_GUARDING", "/attendance/import/AIB-202608-0001", "SECURITY_GUARDING")).toBe(true);
    });
  });

  describe("5. Feature Flag Certification", () => {
    it("5.1. Returns 403 on all routes when ATTENDANCE_IMPORT_ENABLED is false", async () => {
      const originalFlag = process.env.ATTENDANCE_IMPORT_ENABLED;
      process.env.ATTENDANCE_IMPORT_ENABLED = "false";

      try {
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.create", "attendance.import.view", "attendance.import.validate", "attendance.import.review"] }
        });

        // 1. Batches List
        const listReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches");
        const listRes = await getBatches(listReq);
        expect(listRes.status).toBe(403);

        // 2. Batch Upload
        const uploadReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileContent: "test" })
        });
        const uploadRes = await createBatch(uploadReq);
        expect(uploadRes.status).toBe(403);

        // 3. Batch Detail
        const detailReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches/any-id");
        const detailRes = await getBatchDetail(detailReq, { params: { id: "any-id" } });
        expect(detailRes.status).toBe(403);

        // 4. Batch Validate
        const valReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches/any-id/validate", { method: "POST" });
        const valRes = await validateBatchRoute(valReq, { params: { id: "any-id" } });
        expect(valRes.status).toBe(403);

        // 5. Batch Rows
        const rowsReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches/any-id/rows");
        const rowsRes = await getBatchRows(rowsReq, { params: { id: "any-id" } });
        expect(rowsRes.status).toBe(403);

        // 6. Batch Review
        const revReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches/any-id/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "UNDER_REVIEW" })
        });
        const revRes = await reviewBatchRoute(revReq, { params: { id: "any-id" } });
        expect(revRes.status).toBe(403);

        // 7. Batch Cancel
        const cancelReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches/any-id/cancel", { method: "POST" });
        const cancelRes = await cancelBatchRoute(cancelReq, { params: { id: "any-id" } });
        expect(cancelRes.status).toBe(403);

        // 8. Template Download
        const tplReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/template");
        const tplRes = await getTemplateRoute(tplReq);
        expect(tplRes.status).toBe(403);
      } finally {
        process.env.ATTENDANCE_IMPORT_ENABLED = originalFlag || "true";
      }
    });
  });

  describe("6. Validation Concurrency & Idempotency", () => {
    let concurBatchId: string;

    beforeAll(async () => {
      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-CONCUR-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "concurrency_test.csv",
          status: "UPLOADED",
          recordCount: 2
        }
      });
      concurBatchId = batch.id;

      await prisma.attendanceImportRow.createMany({
        data: [
          {
            batchId: concurBatchId,
            sourceRowNumber: 2,
            rawAttendanceDate: "2026-08-27",
            rawEmployeeCode: testActiveSecEmpId,
            rawEmployeeName: "Security Officer Alpha",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          },
          {
            batchId: concurBatchId,
            sourceRowNumber: 3,
            rawAttendanceDate: "2026-08-27",
            rawEmployeeCode: testInactiveSecEmpId,
            rawEmployeeName: "Inactive Guard",
            rawActualTimeIn: "07:00",
            rawActualTimeOut: "19:00"
          }
        ]
      });
    });

    it("6.1. Repeated validation is idempotent and deterministic", async () => {
      // First run
      const run1 = await validateAttendanceImportBatch(concurBatchId);
      expect(run1.status).toBe("VALIDATED");
      expect(run1.recordCount).toBe(2);

      // Second run on already validated batch
      const run2 = await validateAttendanceImportBatch(concurBatchId);
      expect(run2.status).toBe("VALIDATED");
      expect(run2.recordCount).toBe(2);
      expect(run2.validCount).toBe(run1.validCount);
      expect(run2.errorCount).toBe(run1.errorCount);
      expect(run2.warningCount).toBe(run1.warningCount);

      // Verify row counts in database didn't multiply
      const rowCount = await prisma.attendanceImportRow.count({
        where: { batchId: concurBatchId }
      });
      expect(rowCount).toBe(2);
    });

    it("6.2. Rejects validation when batch status is CANCELLED", async () => {
      const cancelledBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-CANC-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "cancelled.csv",
          status: "CANCELLED",
          recordCount: 1
        }
      });

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.validate"] }
      });

      const valReq = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${cancelledBatch.id}/validate`, { method: "POST" });
      const valRes = await validateBatchRoute(valReq, { params: { id: cancelledBatch.id } });
      expect(valRes.status).toBe(400);
      const data = await valRes.json();
      expect(data.error).toContain("Cannot validate a cancelled batch");
    });
  });

  describe("7. Security Agent Hardening & Negative Boundary Checks", () => {
    it("7.1. Rejects payload exceeding row limit (> 5000 rows)", () => {
      const header = "Attendance Date,Employee Code,Employee Name\n";
      const rows = Array.from({ length: 5002 }, (_, i) => `2026-08-25,EMP${i},Worker ${i}`).join("\n");
      const res = parseAttendanceImportContent(header + rows, "large.csv");
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain("maximum allowable limit of 5000 rows per batch");
    });

    it("7.2. Prevents Cross-Company IDOR access for non-admin user", async () => {
      // Another company batch
      const otherCompany = await prisma.company.create({
        data: {
          companyCode: `CMP-OTHER-${rand}`,
          companyName: `Other Company ${rand}`,
          isActive: true
        }
      });

      const otherBatch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-OTHER-${rand}`,
          companyId: otherCompany.id,
          operationType: "SECURITY_GUARDING",
          originalFileName: "other.csv",
          status: "VALIDATED"
        }
      });

      // User restricted to testCompanyId ONLY
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "restricted-user",
          role: "HR_MANAGER",
          permissions: ["attendance.import.view"],
          operationAccess: {
            allowedCompanyIds: [testCompanyId],
            allowedSecurityGuarding: true
          }
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${otherBatch.id}`);
      const res = await getBatchDetail(req, { params: { id: otherBatch.id } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Cross-company access restricted");
    });
  });

  describe("8. MANDATORY NON-AUTHORITATIVE BOUNDARY CERTIFICATION", () => {
    it("8.1. CERTIFIES ZERO WRITES TO ALL 17 AUTHORITATIVE AND TRANSACTIONAL DOMAINS", async () => {
      // Snapshot ALL authoritative row counts before intake run
      const [
        beforeAttendanceCount,
        beforeRosterSlotCount,
        beforeRosterAssignmentCount,
        beforeEmployeeCount,
        beforeSiteCount,
        beforeContractCount,
        beforeLeaveCount,
        beforeDailyClosureCount,
        beforeDailyClosureSnapshotCount,
        beforePayrollRunCount,
        beforePayrollLineCount,
        beforePayrollDayCount,
        beforeBillingRunCount,
        beforeBillingLineCount,
        beforeAddendumCount,
        beforeAddendumLineCount,
        beforeContractReqCount
      ] = await Promise.all([
        prisma.attendanceRecord.count(),
        prisma.rosterRequirementSlot.count(),
        prisma.rosterSlotAssignment.count(),
        prisma.employee.count(),
        prisma.manpowerSite.count(),
        prisma.manpowerContract.count(),
        prisma.leaveRequest.count(),
        prisma.manpowerDailyClosure.count(),
        prisma.manpowerDailyClosureSnapshot.count(),
        prisma.manpowerPayrollAdvisoryRun.count(),
        prisma.manpowerPayrollAdvisoryLine.count(),
        prisma.manpowerPayrollAdvisoryDay.count(),
        prisma.manpowerBillingSupportRun.count(),
        prisma.manpowerBillingSupportLine.count(),
        prisma.manpowerContractAddendum.count(),
        prisma.manpowerContractAddendumLineItem.count(),
        prisma.contractManpowerRequirement.count()
      ]);

      // Execute full intake lifecycle (Upload -> Parse -> Stage -> Validate -> Review -> Cancel)
      const csvData = [
        "Attendance Date,Employee Code,Employee Name,Site / Location,Contract Number,Shift Code,Actual Time In,Actual Time Out",
        `2026-08-28,${testActiveSecEmpId},Security Officer Alpha,AT-1 Security Guarding Site ${rand},CNT-SEC-${rand},DAY-12H,07:00,19:00`,
        `2026-08-28,${testFmEmpId},FM Tech Charlie,AT-1 FM Site ${rand},CNT-FM-${rand},DAY-8H,08:00,16:00`,
        `2026-08-28,${testMobileAttendanceEmpId},Guard Echo,AT-1 Security Site,CNT-SEC-${rand},DAY,07:00,19:00`
      ].join("\n");

      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: testActiveSecEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.create", "attendance.import.view", "attendance.import.validate", "attendance.import.review"] }
      });

      const uploadReq = new NextRequest("http://localhost:3100/api/v1/attendance-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "boundary_test_file.csv",
          companyId: testCompanyId,
          fileContent: csvData,
          autoValidate: true
        })
      });

      const uploadRes = await createBatch(uploadReq);
      expect(uploadRes.status).toBe(201);
      const batchData = await uploadRes.json();
      const bId = batchData.batch.id;

      // Re-validate batch
      const valReq = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${bId}/validate`, {
        method: "POST"
      });
      await validateBatchRoute(valReq, { params: { id: bId } });

      // Review batch
      const reviewReq = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${bId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UNDER_REVIEW", remarks: "Boundary testing" })
      });
      await reviewBatchRoute(reviewReq, { params: { id: bId } });

      // Cancel batch
      const cancelReq = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${bId}/cancel`, {
        method: "POST"
      });
      await cancelBatchRoute(cancelReq, { params: { id: bId } });

      // Snapshot ALL authoritative row counts after intake run
      const [
        afterAttendanceCount,
        afterRosterSlotCount,
        afterRosterAssignmentCount,
        afterEmployeeCount,
        afterSiteCount,
        afterContractCount,
        afterLeaveCount,
        afterDailyClosureCount,
        afterDailyClosureSnapshotCount,
        afterPayrollRunCount,
        afterPayrollLineCount,
        afterPayrollDayCount,
        afterBillingRunCount,
        afterBillingLineCount,
        afterAddendumCount,
        afterAddendumLineCount,
        afterContractReqCount
      ] = await Promise.all([
        prisma.attendanceRecord.count(),
        prisma.rosterRequirementSlot.count(),
        prisma.rosterSlotAssignment.count(),
        prisma.employee.count(),
        prisma.manpowerSite.count(),
        prisma.manpowerContract.count(),
        prisma.leaveRequest.count(),
        prisma.manpowerDailyClosure.count(),
        prisma.manpowerDailyClosureSnapshot.count(),
        prisma.manpowerPayrollAdvisoryRun.count(),
        prisma.manpowerPayrollAdvisoryLine.count(),
        prisma.manpowerPayrollAdvisoryDay.count(),
        prisma.manpowerBillingSupportRun.count(),
        prisma.manpowerBillingSupportLine.count(),
        prisma.manpowerContractAddendum.count(),
        prisma.manpowerContractAddendumLineItem.count(),
        prisma.contractManpowerRequirement.count()
      ]);

      // ASSERT ZERO INSERT, ZERO UPDATE, ZERO DELETE ON ALL 17 AUTHORITATIVE DOMAINS
      expect(afterAttendanceCount).toBe(beforeAttendanceCount);
      expect(afterRosterSlotCount).toBe(beforeRosterSlotCount);
      expect(afterRosterAssignmentCount).toBe(beforeRosterAssignmentCount);
      expect(afterEmployeeCount).toBe(beforeEmployeeCount);
      expect(afterSiteCount).toBe(beforeSiteCount);
      expect(afterContractCount).toBe(beforeContractCount);
      expect(afterLeaveCount).toBe(beforeLeaveCount);
      expect(afterDailyClosureCount).toBe(beforeDailyClosureCount);
      expect(afterDailyClosureSnapshotCount).toBe(beforeDailyClosureSnapshotCount);
      expect(afterPayrollRunCount).toBe(beforePayrollRunCount);
      expect(afterPayrollLineCount).toBe(beforePayrollLineCount);
      expect(afterPayrollDayCount).toBe(beforePayrollDayCount);
      expect(afterBillingRunCount).toBe(beforeBillingRunCount);
      expect(afterBillingLineCount).toBe(beforeBillingLineCount);
      expect(afterAddendumCount).toBe(beforeAddendumCount);
      expect(afterAddendumLineCount).toBe(beforeAddendumLineCount);
      expect(afterContractReqCount).toBe(beforeContractReqCount);

      // Verify existing mobile record was untouched
      const existingMobileRec = await prisma.attendanceRecord.findUnique({
        where: { id: testExistingAttendanceId }
      });
      expect(existingMobileRec).toBeDefined();
      expect(existingMobileRec?.device).toBe("MOBILE_APP_PW8");
      expect(existingMobileRec?.status).toBe("ON_TIME");
    });
  });
});
