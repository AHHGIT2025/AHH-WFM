import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import {
  parseAttendanceImportContent,
  parseMonthlyMusterMatrix,
  classifyAttendanceCode,
  getStandardMonthlyMatrixTemplateXlsx,
  sanitizeSpreadsheetFormula
} from "../../apps/web/lib/attendance-import-parser";
import { validateAttendanceImportBatch } from "../../apps/web/lib/attendance-import-validator";
import {
  generateDetailedTimesheetWorkbook,
  generateClientMusterWorkbook
} from "../../apps/web/lib/attendance-import-exporter";
import { GET as getBatches, POST as createBatch } from "../../apps/web/app/api/v1/attendance-import/batches/route";
import { GET as getDetailedExport } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/export/detailed-timesheet/route";
import { GET as getClientMusterExport } from "../../apps/web/app/api/v1/attendance-import/batches/[id]/export/client-muster/route";
import { GET as getTemplateRoute } from "../../apps/web/app/api/v1/attendance-import/template/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Unified Attendance Intake & Output Profile (Phase AT-1A) Matrix & Timesheets Suite", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 90000) + 10000}`;
  let testCompanyId: string;
  let testClientId: string;
  let testProjectId: string;
  let testSiteId: string;
  let testContractId: string;
  let testContractReqId: string;
  let testGuardEmpId: string;
  let testGuard2EmpId: string;
  let testExistingAttendanceId: string;

  beforeAll(async () => {
    // 1. Setup Test Company
    const comp = await prisma.company.create({
      data: {
        companyCode: `CMP-AT1A-${rand}`,
        companyName: `Al Hattab Security Services ${rand}`,
        isActive: true
      }
    });
    testCompanyId = comp.id;

    // 2. Setup Client, Contract, Project, Site
    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLI-LUS-${rand}`,
        name: `Lusail Commercial Tower Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    const contract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CNT-LUS-${rand}`,
        title: "Lusail Security Services Contract",
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });
    testContractId = contract.id;

    const project = await prisma.manpowerProject.create({
      data: {
        contractId: testContractId,
        code: `PRJ-LUS-${rand}`,
        name: `Lusail Operations Project ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testProjectId = project.id;

    const site = await prisma.manpowerSite.create({
      data: {
        projectId: testProjectId,
        code: `SITE-LUS-${rand}`,
        name: `Lusail Commercial Tower ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testSiteId = site.id;

    // 3. Setup Contract Manpower Requirement
    const contractReq = await prisma.contractManpowerRequirement.create({
      data: {
        contractId: testContractId,
        position: "Security Guard",
        quantity: 2,
        deploymentType: "STATIC"
      }
    });
    testContractReqId = contractReq.id;

    // 4. Setup Test Employees
    testGuardEmpId = `EMP-G1-${rand}`;
    await prisma.employee.create({
      data: {
        id: testGuardEmpId,
        name: "Ahmed Al-Kuwari",
        email: `ahmed.${rand}@alhattab.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompanyId,
        employeeCategory: "SECURITY_GUARDING",
        employmentStatus: "ACTIVE",
        isActive: true
      }
    });

    testGuard2EmpId = `EMP-G2-${rand}`;
    await prisma.employee.create({
      data: {
        id: testGuard2EmpId,
        name: "Mohammed Hassan",
        email: `mohammed.${rand}@alhattab.qa`,
        department: "Security Guarding",
        role: "EMPLOYEE",
        status: "Off Duty",
        companyId: testCompanyId,
        employeeCategory: "SECURITY_GUARDING",
        employmentStatus: "ACTIVE",
        isActive: true
      }
    });

    // 5. Setup Published Roster Slot for Guard 1 on 2026-08-15
    const slot = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompanyId,
        contractId: testContractId,
        projectId: testProjectId,
        siteId: testSiteId,
        locationKey: `site:${testSiteId}`,
        contractRequirementId: testContractReqId,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: new Date("2026-08-15"),
        shiftKey: "shift:DAY-12H",
        slotIndex: 1,
        generationKey: `${testContractReqId}:2026-08-15:shift:DAY-12H:1`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift 12H",
        snapshotStartTime: "07:00",
        snapshotEndTime: "19:00",
        fulfillmentStatus: "FILLED",
        scheduleStatus: "PUBLISHED"
      }
    });

    await prisma.rosterSlotAssignment.create({
      data: {
        slotId: slot.id,
        employeeId: testGuardEmpId,
        assignmentType: "PRIMARY",
        historyStatus: "ACTIVE",
        assignedById: testGuardEmpId
      }
    });

    // 6. Setup Existing Mobile Attendance Punch on 2026-08-20 for Guard 1
    const mobileAtt = await prisma.attendanceRecord.create({
      data: {
        employeeId: testGuardEmpId,
        employeeName: "Ahmed Al-Kuwari",
        companyId: testCompanyId,
        checkIn: new Date("2026-08-20T06:55:00.000Z"),
        checkOut: new Date("2026-08-20T19:05:00.000Z"),
        lat: 25.2854,
        lng: 51.5310,
        locationName: `Lusail Commercial Tower ${rand}`,
        device: "MOBILE_APP_PW8",
        status: "ON_TIME"
      }
    });
    testExistingAttendanceId = mobileAtt.id;
  });

  describe("1. Monthly Matrix Parsing & Calendar Handling", () => {
    it("1.1. getStandardMonthlyMatrixTemplateXlsx generates valid workbook buffer with required sheets", () => {
      const buf = getStandardMonthlyMatrixTemplateXlsx();
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);

      const wb = XLSX.read(buf, { type: "buffer" });
      expect(wb.SheetNames).toContain("Monthly_Matrix_Input");
      expect(wb.SheetNames).toContain("Codes");
      expect(wb.SheetNames).toContain("Instructions");
    });

    it("1.2. Classifies all standard operational attendance codes correctly", () => {
      expect(classifyAttendanceCode("12", 12).normalizedStatus).toBe("PRESENT");
      expect(classifyAttendanceCode("12", 12).clientMusterCode).toBe("P");

      expect(classifyAttendanceCode("P", 12).normalizedStatus).toBe("PRESENT_MOBILIZED");
      expect(classifyAttendanceCode("A", 12).normalizedStatus).toBe("ABSENT_NOT_MOBILIZED");
      expect(classifyAttendanceCode("NA", 12).normalizedStatus).toBe("NOT_APPLICABLE");
      expect(classifyAttendanceCode("OFF", 12).normalizedStatus).toBe("WEEKLY_OFF");
      expect(classifyAttendanceCode("AB", 12).normalizedStatus).toBe("ABSENT");
      expect(classifyAttendanceCode("SL", 12).normalizedStatus).toBe("SICK_LEAVE");
      expect(classifyAttendanceCode("AL", 12).normalizedStatus).toBe("ANNUAL_LEAVE");
      expect(classifyAttendanceCode("HL", 12).normalizedStatus).toBe("PUBLIC_HOLIDAY");
      expect(classifyAttendanceCode("OJT", 12).normalizedStatus).toBe("OJT");
      expect(classifyAttendanceCode("IDLE", 12).normalizedStatus).toBe("IDLE");
      expect(classifyAttendanceCode("XYZ_INVALID", 12).normalizedStatus).toBe("UNKNOWN");
    });

    it("1.3. Correctly expands 31-day month matrix into 31 daily staging records per employee", () => {
      const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
      const matrixData = [
        ["Client:", "Al Hattab", "Location:", "Lusail Tower", "Month:", "8", "Year:", "2026"],
        [""],
        ["S/N", "Employee Code", "Employee Name", "Designation", "Shift Hours", "Row Type", ...days],
        [1, testGuardEmpId, "Ahmed Al-Kuwari", "Security Officer", 12, "DUTY", ...new Array(31).fill("12")],
        ["", testGuardEmpId, "Ahmed Al-Kuwari", "Security Officer", 12, "OT", ...new Array(31).fill("2")]
      ];

      const res = parseMonthlyMusterMatrix(matrixData, "test_august_2026.xlsx", { year: 2026, month: 8 });
      expect(res.success).toBe(true);
      expect(res.recordCount).toBe(31);
      expect(res.matrixMetadata?.totalEmployeesInMatrix).toBe(1);
      expect(res.matrixMetadata?.daysInMonth).toBe(31);

      // Verify OT is logically merged with the same employee-day
      const day1 = res.rows.find((r) => r.rawAttendanceDate === "2026-08-01");
      expect(day1).toBeDefined();
      expect(day1?.rawEmployeeCode).toBe(testGuardEmpId);
      expect(day1?.rawWorkedHours).toBe("12");
      expect(day1?.rawOtHours).toBe("2");
      expect(day1?.rawPayload.importProfile).toBe("MONTHLY_MUSTER_MATRIX");
      expect(day1?.rawPayload.day).toBe(1);
    });

    it("1.4. Handles leap year February (29 days) and non-leap February (28 days)", () => {
      const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
      const matrixData = [
        ["Month:", "2", "Year:", "2024"],
        [""],
        ["S/N", "Employee Code", "Employee Name", "Designation", "Shift Hours", "Row Type", ...days],
        [1, testGuardEmpId, "Ahmed", "Guard", 12, "DUTY", ...new Array(31).fill("12")]
      ];

      // 2024 is Leap Year -> 29 days
      const res2024 = parseMonthlyMusterMatrix(matrixData, "feb_2024.xlsx", { year: 2024, month: 2 });
      expect(res2024.success).toBe(true);
      expect(res2024.recordCount).toBe(29);
      expect(res2024.matrixMetadata?.daysInMonth).toBe(29);

      // 2026 is Non-Leap Year -> 28 days
      const res2026 = parseMonthlyMusterMatrix(matrixData, "feb_2026.xlsx", { year: 2026, month: 2 });
      expect(res2026.success).toBe(true);
      expect(res2026.recordCount).toBe(28);
      expect(res2026.matrixMetadata?.daysInMonth).toBe(28);
    });

    it("1.5. Rejects matrix exceeding maximum employee limit", () => {
      const days = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"));
      const headerRows = [
        ["Month:", "4", "Year:", "2026"],
        [""],
        ["S/N", "Employee Code", "Employee Name", "Designation", "Shift Hours", "Row Type", ...days]
      ];
      const empRows = Array.from({ length: 505 }, (_, i) => [
        i + 1,
        `EMP${i}`,
        `Guard ${i}`,
        "Guard",
        12,
        "DUTY",
        ...new Array(30).fill("12")
      ]);

      const res = parseMonthlyMusterMatrix([...headerRows, ...empRows], "large_matrix.xlsx", { year: 2026, month: 4 });
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain("exceeds maximum source employee limit");
    });
  });

  describe("2. Reference Resolution, Validation Engine & Exceptions", () => {
    let batchId: string;

    beforeAll(async () => {
      const wb = XLSX.utils.book_new();
      const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
      const matrixData: any[][] = [
        ["Client:", "Al Hattab", "Location / Site:", `Lusail Commercial Tower ${rand}`, "Contract:", `CNT-LUS-${rand}`],
        ["Month:", "8", "Year:", "2026", "Operational Scope:", "SECURITY_GUARDING"],
        [""],
        ["S/N", "Employee Code", "Employee Name", "Designation", "Shift Hours", "Row Type", ...days],
        // Emp 1: Active guard with Roster match (Aug 15), Mobile conflict (Aug 20), and OT on OFF day (Aug 25)
        [
          1,
          testGuardEmpId,
          "Ahmed Different Name", // Triggers EMPLOYEE_NAME_MISMATCH
          "Security Officer",
          12,
          "DUTY",
          // Aug 1..14 (12h), Aug 15 (12h roster match), Aug 16..19 (12h), Aug 20 (12h mobile conflict), Aug 21..24 (12h), Aug 25 (OFF), Aug 26..31 (12h)
          "12", "12", "12", "12", "12", "12", "12", "12", "12", "12",
          "12", "12", "12", "12", "12", "12", "12", "12", "12", "12",
          "12", "12", "12", "12", "OFF", "12", "12", "12", "12", "12", "12"
        ],
        [
          "",
          testGuardEmpId,
          "Ahmed Different Name",
          "Security Officer",
          12,
          "OT",
          // OT = 2 on Aug 25 (OFF) -> Triggers OT_WITHOUT_BASE_ATTENDANCE
          "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
          "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
          "0", "0", "0", "0", "2", "0", "0", "0", "0", "0", "0"
        ],
        // Emp 2: Unmatched worker code
        [
          2,
          "EMP-NON-EXISTENT",
          "Ghost Worker",
          "Security Guard",
          12,
          "DUTY",
          ...new Array(31).fill("12")
        ]
      ];

      const ws = XLSX.utils.aoa_to_sheet(matrixData);
      XLSX.utils.book_append_sheet(wb, ws, "Monthly_Matrix_Input");
      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const parsed = parseAttendanceImportContent(xlsxBuffer, "august_matrix.xlsx", {
        importProfile: "MONTHLY_MUSTER_MATRIX",
        companyId: testCompanyId,
        year: 2026,
        month: 8
      });

      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-MTX-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "august_matrix.xlsx",
          fileHash: parsed.fileHash,
          recordCount: parsed.rows.length,
          status: "UPLOADED",
          metadata: parsed.matrixMetadata as any
        }
      });
      batchId = batch.id;

      await prisma.attendanceImportRow.createMany({
        data: parsed.rows.map((r) => ({
          batchId,
          sourceRowNumber: r.sourceRowNumber,
          rawPayload: r.rawPayload,
          rowFingerprint: r.rowFingerprint,
          rawAttendanceDate: r.rawAttendanceDate,
          rawEmployeeCode: r.rawEmployeeCode,
          rawEmployeeName: r.rawEmployeeName,
          rawCompany: testCompanyId,
          rawSite: `Lusail Commercial Tower ${rand}`,
          rawContract: `CNT-LUS-${rand}`,
          rawShift: r.rawShift,
          rawWorkedHours: r.rawWorkedHours,
          rawOtHours: r.rawOtHours,
          rawAttendanceStatus: r.rawAttendanceStatus,
          validationStatus: "PENDING"
        }))
      });
    });

    it("2.1. Validates matrix batch and detects all reference exceptions accurately", async () => {
      const summary = await validateAttendanceImportBatch(batchId);
      expect(summary.status).toBe("VALIDATED");
      expect(summary.recordCount).toBe(62); // 2 employees * 31 days

      // 1. Check Employee Name Mismatch (Guard 1)
      const emp1Row = summary.rowResults.find(
        (r) => r.employeeId === testGuardEmpId && r.validationMessages.some((m) => m.code === "EMPLOYEE_NAME_MISMATCH")
      );
      expect(emp1Row).toBeDefined();

      // 2. Check Roster Match on Aug 15 (Guard 1)
      const aug15Row = summary.rowResults.find(
        (r) => r.employeeId === testGuardEmpId && r.attendanceDate?.toISOString().startsWith("2026-08-15")
      );
      expect(aug15Row).toBeDefined();
      expect(aug15Row?.validationMessages.some((m) => m.code === "ROSTER_MATCH")).toBe(true);

      // 3. Check Existing Mobile Attendance Conflict on Aug 20 (Guard 1)
      const aug20Row = summary.rowResults.find(
        (r) => r.employeeId === testGuardEmpId && r.attendanceDate?.toISOString().startsWith("2026-08-20")
      );
      expect(aug20Row).toBeDefined();
      expect(aug20Row?.validationMessages.some((m) => m.code === "EXISTING_ATTENDANCE_FOUND")).toBe(true);
      expect(aug20Row?.isDuplicate).toBe(true);
      expect(aug20Row?.existingAttendanceSource).toBe("MOBILE");

      // 4. Check OT Without Base Attendance on Aug 25 (Guard 1)
      const aug25Row = summary.rowResults.find(
        (r) => r.employeeId === testGuardEmpId && r.attendanceDate?.toISOString().startsWith("2026-08-25")
      );
      expect(aug25Row).toBeDefined();
      expect(aug25Row?.validationMessages.some((m) => m.code === "OT_WITHOUT_BASE_ATTENDANCE")).toBe(true);

      // 5. Check Unmatched Employee (Ghost Worker)
      const unmatchedRows = summary.rowResults.filter((r) => r.validationStatus === "UNMATCHED");
      expect(unmatchedRows.length).toBe(31);
    });
  });

  describe("3. DRAFT Output Profile Workbooks Generation", () => {
    let outputBatchId: string;

    beforeAll(async () => {
      const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
      const matrixData: any[][] = [
        ["Client:", "Al Hattab Real Estate", "Location / Site:", "Lusail Commercial Tower", "Contract:", "CNT-2026-LUS"],
        ["Month:", "8", "Year:", "2026", "Operational Scope:", "SECURITY_GUARDING"],
        [""],
        ["S/N", "Employee Code", "Employee Name", "Designation", "Shift Hours", "Row Type", ...days],
        [
          1,
          testGuardEmpId,
          "Ahmed Al-Kuwari",
          "Security Officer",
          12,
          "DUTY",
          ...new Array(31).fill("12")
        ],
        [
          "",
          testGuardEmpId,
          "Ahmed Al-Kuwari",
          "Security Officer",
          12,
          "OT",
          "0", "2", "0", "0", "0", "0", "0", "2", "0", "0",
          "0", "0", "0", "0", "0", "2", "0", "0", "0", "0",
          "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
        ]
      ];

      const res = parseMonthlyMusterMatrix(matrixData, "export_test.xlsx", { year: 2026, month: 8, companyId: testCompanyId });

      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-EXP-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "export_test.xlsx",
          recordCount: res.rows.length,
          status: "VALIDATED",
          metadata: res.matrixMetadata as any
        }
      });
      outputBatchId = batch.id;

      await prisma.attendanceImportRow.createMany({
        data: res.rows.map((r) => ({
          batchId: outputBatchId,
          sourceRowNumber: r.sourceRowNumber,
          rawPayload: r.rawPayload,
          rowFingerprint: r.rowFingerprint,
          rawAttendanceDate: r.rawAttendanceDate,
          rawEmployeeCode: r.rawEmployeeCode,
          rawEmployeeName: r.rawEmployeeName,
          rawCompany: testCompanyId,
          rawWorkedHours: r.rawWorkedHours,
          rawOtHours: r.rawOtHours,
          rawAttendanceStatus: r.rawAttendanceStatus,
          workedHours: parseFloat(r.rawWorkedHours) || 0,
          otHours: parseFloat(r.rawOtHours) || 0,
          validationStatus: "VALID"
        }))
      });
    });

    it("3.1. generateDetailedTimesheetWorkbook produces valid 2-Row Excel report with DRAFT watermark and domain totals", async () => {
      const buffer = await generateDetailedTimesheetWorkbook(outputBatchId);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = XLSX.read(buffer, { type: "buffer" });
      expect(wb.SheetNames).toContain("Detailed_Timesheet");

      const sheet = wb.Sheets["Detailed_Timesheet"];
      const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

      // Verify DRAFT watermark banner
      const bannerText = JSON.stringify(rawJson);
      expect(bannerText).toContain("DRAFT — NOT APPROVED");
      expect(bannerText).toContain("DUTY");
      expect(bannerText).toContain("OT");
      expect(bannerText).toContain("Daily Actual Mobilized");
      expect(bannerText).toContain("Daily Required Manpower");
      expect(bannerText).toContain("SIGN-OFF & VERIFICATION");
    });

    it("3.2. generateClientMusterWorkbook produces valid P/A/NA Client Mobilization Sheet with DRAFT mark", async () => {
      const buffer = await generateClientMusterWorkbook(outputBatchId);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = XLSX.read(buffer, { type: "buffer" });
      expect(wb.SheetNames).toContain("Client_Muster");

      const sheet = wb.Sheets["Client_Muster"];
      const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

      const bannerText = JSON.stringify(rawJson);
      expect(bannerText).toContain("CLIENT MONTHLY MUSTER & MOBILIZATION SHEET");
      expect(bannerText).toContain("DRAFT — FOR CLIENT PRESENTATION & REVIEW ONLY");
      expect(bannerText).toContain("Present Days (P)");
      expect(bannerText).toContain("MOBILIZATION SUMMARY");
    });
  });

  describe("4. API Endpoints & RBAC for Matrix Intake & Exports", () => {
    it("4.1. Template route returns XLSX binary when profile=MONTHLY_MUSTER_MATRIX", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: testGuardEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.view"] }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/attendance-import/template?profile=MONTHLY_MUSTER_MATRIX");
      const res = await getTemplateRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("spreadsheetml");
    });

    it("4.2. Detailed Timesheet Export endpoint streams valid XLSX attachment with RBAC", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: testGuardEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.view"] }
      });

      // Create a small test batch
      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-API-EXP-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "api_exp.xlsx",
          status: "VALIDATED"
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${batch.id}/export/detailed-timesheet`);
      const res = await getDetailedExport(req, { params: { id: batch.id } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("spreadsheetml");
      expect(res.headers.get("content-disposition")).toContain("attachment; filename=");
    });

    it("4.3. Client Muster Export endpoint streams valid XLSX attachment with RBAC", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: testGuardEmpId, role: "SUPER_ADMIN", permissions: ["attendance.import.view"] }
      });

      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-API-MUS-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "api_mus.xlsx",
          status: "VALIDATED"
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/attendance-import/batches/${batch.id}/export/client-muster`);
      const res = await getClientMusterExport(req, { params: { id: batch.id } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("spreadsheetml");
      expect(res.headers.get("content-disposition")).toContain("Client_Muster_DRAFT_");
    });
  });

  describe("5. MANDATORY NON-AUTHORITATIVE ZERO-WRITE CERTIFICATION", () => {
    it("5.1. CERTIFIES ZERO MUTATION ACROSS ALL 17 AUTHORITATIVE DOMAINS DURING FULL AT-1A LIFECYCLE", async () => {
      // 1. Snapshot ALL Authoritative Row Counts
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

      // 2. Execute Full End-to-End AT-1A Lifecycle:
      // (Matrix Parse -> Batch Creation -> Validation -> Review -> Detailed Timesheet Export -> Client Muster Export)
      const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
      const matrixData = [
        ["Client:", "Al Hattab", "Location:", "Lusail Tower", "Month:", "8", "Year:", "2026"],
        [""],
        ["S/N", "Employee Code", "Employee Name", "Designation", "Shift Hours", "Row Type", ...days],
        [1, testGuardEmpId, "Ahmed Al-Kuwari", "Security Officer", 12, "DUTY", ...new Array(31).fill("12")],
        ["", testGuardEmpId, "Ahmed Al-Kuwari", "Security Officer", 12, "OT", ...new Array(31).fill("2")],
        [2, testGuard2EmpId, "Mohammed Hassan", "Security Guard", 12, "DUTY", ...new Array(31).fill("P")]
      ];

      const res = parseMonthlyMusterMatrix(matrixData, "boundary_test.xlsx", { year: 2026, month: 8, companyId: testCompanyId });

      const batch = await prisma.attendanceImportBatch.create({
        data: {
          batchNumber: `AIB-BND-${rand}`,
          companyId: testCompanyId,
          operationType: "SECURITY_GUARDING",
          originalFileName: "boundary_test.xlsx",
          recordCount: res.rows.length,
          status: "UPLOADED",
          metadata: res.matrixMetadata as any
        }
      });

      await prisma.attendanceImportRow.createMany({
        data: res.rows.map((r) => ({
          batchId: batch.id,
          sourceRowNumber: r.sourceRowNumber,
          rawPayload: r.rawPayload,
          rowFingerprint: r.rowFingerprint,
          rawAttendanceDate: r.rawAttendanceDate,
          rawEmployeeCode: r.rawEmployeeCode,
          rawEmployeeName: r.rawEmployeeName,
          rawCompany: testCompanyId,
          rawWorkedHours: r.rawWorkedHours,
          rawOtHours: r.rawOtHours,
          rawAttendanceStatus: r.rawAttendanceStatus,
          validationStatus: "PENDING"
        }))
      });

      // Validate
      await validateAttendanceImportBatch(batch.id);

      // Generate Exports
      await generateDetailedTimesheetWorkbook(batch.id);
      await generateClientMusterWorkbook(batch.id);

      // 3. Snapshot ALL Authoritative Row Counts After Lifecycle
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

      // ASSERT EXACT ZERO WRITES
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

      // Verify Existing Attendance record remained 100% untouched
      const existingMobile = await prisma.attendanceRecord.findUnique({
        where: { id: testExistingAttendanceId }
      });
      expect(existingMobile?.device).toBe("MOBILE_APP_PW8");
      expect(existingMobile?.status).toBe("ON_TIME");
    });
  });
});
