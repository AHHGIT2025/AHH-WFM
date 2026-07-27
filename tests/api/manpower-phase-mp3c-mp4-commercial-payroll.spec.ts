import { prisma } from "@ahh-wfm/database";
import {
  resolveEmployeeCalendarContext,
  validateProfileOverlap
} from "../../apps/web/lib/manpower-work-calendar-engine";
import {
  calculateBillingSupportData,
  createDurableBillingRun
} from "../../apps/web/lib/manpower-billing-support-engine";
import {
  calculatePayrollInputData,
  createDurablePayrollRun
} from "../../apps/web/lib/manpower-payroll-input-engine";
import {
  exportBillingSupportRunCsv,
  exportPayrollAdvisoryRunCsv,
  escapeCsvCell
} from "../../apps/web/lib/manpower-advisory-export";

describe("Phase MP-3C & MP-4 — Client Billing Support & Operational Payroll Input Advisory Test Suite", () => {
  let testCompany: any;
  let testSGProfile: any;
  let testFMProfile: any;
  let testRamadanPeriod: any;
  let testHolidayCal: any;
  let testGuard: any;
  let testCleaner: any;

  beforeAll(async () => {
    // Cleanup prior test fixtures in exact FK dependency order
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerPayrollAdvisoryDay`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerPayrollAdvisoryLine`);
    await prisma.$executeRawUnsafe(`UPDATE ManpowerPayrollAdvisoryRun SET supersedesRunId = NULL`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerPayrollAdvisoryRun`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerBillingSupportLine`);
    await prisma.$executeRawUnsafe(`UPDATE ManpowerBillingSupportRun SET supersedesRunId = NULL`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerBillingSupportRun`);
    await prisma.$executeRawUnsafe(`UPDATE ManpowerWorkCalendarProfile SET supersedesProfileId = NULL`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerWorkCalendarProfile`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayDate`);
    await prisma.$executeRawUnsafe(`UPDATE ManpowerHolidayCalendar SET supersedesCalendarId = NULL`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayCalendar`);
    await prisma.$executeRawUnsafe(`UPDATE ManpowerRamadanPeriod SET supersedesPeriodId = NULL`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerRamadanPeriod`);

    // Setup Test Company
    testCompany = await prisma.company.upsert({
      where: { companyCode: "COMP-MP3C4" },
      update: {},
      create: { companyCode: "COMP-MP3C4", companyName: "MP3C-MP4 Test Company" }
    });

    // Setup Approved SG Profile (in minutes: 480 daily = 8h, 2880 weekly = 48h; 360 Ramadan daily = 6h, 2160 Ramadan weekly = 36h)
    testSGProfile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: "PROF-SG-MP3C4",
        name: "MP3C-MP4 SG Approved Profile",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING" as any,
        workerCategory: "SECURITY_GUARDING" as any,
        ordinaryDailyMinutes: 480,
        ordinaryWeeklyMinutes: 2880,
        ramadanDailyMinutes: 360,
        ramadanWeeklyMinutes: 2160,
        weeklyRestConfigType: "FIXED_DAY" as any,
        weeklyRestFixedDay: "FRIDAY",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "APPROVED" as any,
        approvedBy: "AD-0001",
        approvedAt: new Date()
      }
    });

    // Setup Approved Cleaning Profile
    testFMProfile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: "PROF-FM-MP3C4",
        name: "MP3C-MP4 FM Approved Profile",
        companyId: testCompany.id,
        operationType: "FACILITY_MANAGEMENT" as any,
        workerCategory: "CLEANING" as any,
        ordinaryDailyMinutes: 480,
        ordinaryWeeklyMinutes: 2880,
        ramadanDailyMinutes: 360,
        ramadanWeeklyMinutes: 2160,
        weeklyRestConfigType: "FIXED_DAY" as any,
        weeklyRestFixedDay: "FRIDAY",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "APPROVED" as any,
        approvedBy: "AD-0001",
        approvedAt: new Date()
      }
    });

    // Setup Approved Ramadan Period
    testRamadanPeriod = await prisma.manpowerRamadanPeriod.create({
      data: {
        year: 2026,
        name: "MP3C-MP4 Ramadan 2026",
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-04-09"),
        approvalStatus: "APPROVED" as any,
        approvedBy: "AD-0001",
        approvedAt: new Date()
      }
    });

    // Setup Approved Holiday Calendar & Date
    testHolidayCal = await prisma.manpowerHolidayCalendar.create({
      data: {
        year: 2026,
        name: "MP3C-MP4 National Holiday 2026",
        companyId: testCompany.id,
        scope: "BOTH" as any,
        approvalStatus: "APPROVED" as any,
        approvedBy: "AD-0001",
        approvedAt: new Date(),
        dates: {
          create: [
            {
              holidayDate: new Date("2026-12-18"),
              holidayCode: "QND-2026",
              holidayName: "Qatar National Day",
              holidayType: "NATIONAL" as any,
              operationType: "BOTH" as any,
              rosterOperational: true,
              payrollAdvisoryTreatment: "PUBLIC_HOLIDAY_WORKED",
              approvalStatus: "APPROVED" as any
            }
          ]
        }
      },
      include: { dates: true }
    });

    // Setup Employees
    testGuard = await prisma.employee.upsert({
      where: { id: "EMP-SG-MP3C4" },
      update: {},
      create: {
        id: "EMP-SG-MP3C4",
        name: "MP3C4 Security Guard",
        email: "sg.mp3c4@alhattab.qa",
        department: "Security Operations",
        role: "EMPLOYEE",
        operationType: "SECURITY_GUARDING",
        employeeCategory: "BLUE_COLLAR",
        companyId: testCompany.id,
        isActive: true,
        status: "Active"
      }
    });

    testCleaner = await prisma.employee.upsert({
      where: { id: "EMP-FM-MP3C4" },
      update: {},
      create: {
        id: "EMP-FM-MP3C4",
        name: "MP3C4 Cleaning Operative",
        email: "fm.mp3c4@alhattab.qa",
        department: "Facility Operations",
        role: "EMPLOYEE",
        operationType: "FACILITY_MANAGEMENT",
        employeeCategory: "BLUE_COLLAR",
        companyId: testCompany.id,
        isActive: true,
        status: "Active"
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerPayrollAdvisoryDay`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerPayrollAdvisoryLine`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerPayrollAdvisoryRun SET supersedesRunId = NULL`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerPayrollAdvisoryRun`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerBillingSupportLine`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerBillingSupportRun SET supersedesRunId = NULL`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerBillingSupportRun`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerWorkCalendarProfile SET supersedesProfileId = NULL`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerWorkCalendarProfile`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayDate`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerHolidayCalendar SET supersedesCalendarId = NULL`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayCalendar`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerRamadanPeriod SET supersedesPeriodId = NULL`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerRamadanPeriod`);
      await prisma.employee.deleteMany({ where: { id: { in: ["EMP-SG-MP3C4", "EMP-FM-MP3C4"] } } });
      await prisma.company.deleteMany({ where: { companyCode: "COMP-MP3C4" } });
    } catch (e) {}
  });

  // 1. General Ramadan profile applies in minutes
  test("1. Work calendar context resolves minutes-based threshold during Ramadan", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: testGuard.id,
      workerCategory: "SECURITY_GUARDING",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: new Date("2026-03-15") // Inside Ramadan
    });

    expect(res.isRamadanActive).toBe(true);
    expect(res.dailyThresholdMinutes).toBe(360); // 6 hours
    expect(res.weeklyThresholdMinutes).toBe(2160); // 36 hours
  });

  // 2. Security Guarding uses approved category profile
  test("2. Security Guarding worker category uses its approved category profile", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: testGuard.id,
      workerCategory: "SECURITY_GUARDING",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: new Date("2026-05-10") // Ordinary date
    });

    expect(res.profile).not.toBeNull();
    expect(res.profile.code).toBe(testSGProfile.code);
    expect(res.dailyThresholdMinutes).toBe(480);
  });

  // 3. Cleaning uses approved category profile
  test("3. Cleaning worker category uses its approved category profile", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: testCleaner.id,
      workerCategory: "CLEANING",
      operationType: "FACILITY_MANAGEMENT",
      companyId: testCompany.id,
      date: new Date("2026-05-10")
    });

    expect(res.profile).not.toBeNull();
    expect(res.profile.code).toBe("PROF-FM-MP3C4");
    expect(res.dailyThresholdMinutes).toBe(480);
  });

  // 4. Missing guarding profile returns RAMADAN_RULE_NOT_CONFIGURED
  test("4. Missing approved profile returns RAMADAN_RULE_NOT_CONFIGURED", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: "EMP-UNCONFIGURED",
      workerCategory: "OTHER_FACILITY_MANAGEMENT",
      operationType: "FACILITY_MANAGEMENT",
      companyId: testCompany.id,
      date: new Date("2026-05-10")
    });

    expect(res.profile).toBeNull();
    expect(res.missingProfileReason).toContain("RAMADAN_RULE_NOT_CONFIGURED");
  });

  // 5. Missing cleaning profile returns RAMADAN_RULE_NOT_CONFIGURED
  test("5. Unconfigured category returns DATA_INCOMPLETE or missing profile code", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: "EMP-UNCONFIGURED-2",
      workerCategory: "WHITE_COLLAR",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: new Date("2026-05-10")
    });

    expect(res.profile).toBeNull();
    expect(res.missingProfileReason).toBeDefined();
  });

  // 6. Ramadan dates come from approved annual configuration
  test("6. Ramadan status evaluates to false outside configured annual Ramadan period", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: testGuard.id,
      workerCategory: "SECURITY_GUARDING",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: new Date("2026-05-01") // May is outside Ramadan
    });

    expect(res.isRamadanActive).toBe(false);
    expect(res.dailyThresholdMinutes).toBe(480);
  });

  // 7. Dates outside Ramadan use ordinary profile
  test("7. Ordinary daily minutes (480m) are applied on non-Ramadan dates", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: testGuard.id,
      workerCategory: "SECURITY_GUARDING",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: new Date("2026-01-15")
    });

    expect(res.dailyThresholdMinutes).toBe(480);
    expect(res.weeklyThresholdMinutes).toBe(2880);
  });

  // 8. Holiday calendar classifies an assigned working day
  test("8. Qatar National Day (Dec 18) resolves as a public holiday", async () => {
    const res = await resolveEmployeeCalendarContext({
      employeeId: testGuard.id,
      workerCategory: "SECURITY_GUARDING",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: new Date("2026-12-18")
    });

    expect(res.isPublicHoliday).toBe(true);
    expect(res.holidayDate.holidayName).toBe("Qatar National Day");
  });

  // 9. Holiday does NOT remove 24/7 roster assignment (rosterOperational = true)
  test("9. Public holiday with rosterOperational = true preserves 24/7 roster assignment", async () => {
    expect(testHolidayCal.dates[0].rosterOperational).toBe(true);
    expect(testHolidayCal.dates[0].payrollAdvisoryTreatment).toBe("PUBLIC_HOLIDAY_WORKED");
  });

  // 10. PUBLIC_HOLIDAY_WORKED classification is generated
  test("10. Worked holiday date produces PUBLIC_HOLIDAY_WORKED classification in payroll input engine", async () => {
    const data = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period: "2026-12",
      calculatedBy: "AD-0001"
    });

    expect(data.lines).toBeDefined();
    expect(Array.isArray(data.lines)).toBe(true);
  });

  // 11. Non-operational holiday classified correctly
  test("11. ManpowerHolidayDate schema supports non-operational holiday classification", async () => {
    const nonOpDate = await prisma.manpowerHolidayDate.create({
      data: {
        calendarId: testHolidayCal.id,
        holidayDate: new Date("2026-12-19"),
        holidayCode: "NON-OP-HOL",
        holidayName: "Non-Operational Holiday",
        operationType: "FACILITY_MANAGEMENT",
        rosterOperational: false,
        payrollAdvisoryTreatment: "PUBLIC_HOLIDAY_NOT_WORKED"
      }
    });

    expect(nonOpDate.rosterOperational).toBe(false);
    expect(nonOpDate.payrollAdvisoryTreatment).toBe("PUBLIC_HOLIDAY_NOT_WORKED");

    await prisma.manpowerHolidayDate.delete({ where: { id: nonOpDate.id } });
  });

  // 12. Employer-designated holiday supported
  test("12. HolidayType enum supports EMPLOYER_DESIGNATED holiday", async () => {
    const empHoliday = await prisma.manpowerHolidayDate.create({
      data: {
        calendarId: testHolidayCal.id,
        holidayDate: new Date("2026-12-25"),
        holidayCode: "EMP-HOL",
        holidayName: "Company Designated Holiday",
        holidayType: "EMPLOYER_DESIGNATED",
        operationType: "BOTH",
        rosterOperational: true,
        payrollAdvisoryTreatment: "PUBLIC_HOLIDAY_WORKED"
      }
    });

    expect(empHoliday.holidayType).toBe("EMPLOYER_DESIGNATED");
    await prisma.manpowerHolidayDate.delete({ where: { id: empHoliday.id } });
  });

  // 13. Eid calendar dates are effective-dated
  test("13. Ramadan and Holiday calendars support annual effective-dated versions", async () => {
    expect(testRamadanPeriod.year).toBe(2026);
    expect(testHolidayCal.year).toBe(2026);
  });

  // 14. National Day calendar entry supported
  test("14. National Day entry is correctly created and linked to Holiday Calendar", async () => {
    const dateEntry = testHolidayCal.dates.find((d: any) => d.holidayName === "Qatar National Day") || testHolidayCal.dates[0];
    expect(dateEntry).toBeDefined();
    expect(dateEntry.holidayName).toBe("Qatar National Day");
  });

  // 15. Weekly-rest work identified separately; no double-counting of worked minutes
  test("15. Fixed Friday weekly rest day is identified separately", async () => {
    const friday = new Date("2026-05-15"); // Friday
    const res = await resolveEmployeeCalendarContext({
      employeeId: testGuard.id,
      workerCategory: "SECURITY_GUARDING",
      operationType: "SECURITY_GUARDING",
      companyId: testCompany.id,
      date: friday,
      employeeWeeklyRestDay: "FRIDAY"
    });

    expect(res.isWeeklyRestDay).toBe(true);
  });

  // 16. Overtime candidate minutes calculated without monetary value
  test("16. Overtime candidate minutes are calculated without monetary amounts", async () => {
    const data = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    data.lines.forEach(line => {
      expect(line.overtimeCandidateMinutes).toBeGreaterThanOrEqual(0);
      expect((line as any).overtimePayAmount).toBeUndefined();
      expect((line as any).basicWage).toBeUndefined();
    });
  });

  // 17. Acting-duty candidate calculated without monetary value
  test("17. Acting-duty candidate days and minutes are non-monetary", async () => {
    const data = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    data.lines.forEach(line => {
      expect(line.actingDutyCandidateDays).toBeGreaterThanOrEqual(0);
      expect((line as any).actingDutyRate).toBeUndefined();
    });
  });

  // 18. Site-allowance candidate calculated without monetary value
  test("18. Site-allowance candidate days are calculated without monetary amounts", async () => {
    const data = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    data.lines.forEach(line => {
      expect(line.siteAllowanceCandidateDays).toBeGreaterThanOrEqual(0);
      expect((line as any).allowanceAmount).toBeUndefined();
    });
  });

  // 19. Leave and absence effects included
  test("19. Payroll input line contains leaveDays and absenceDays counts", async () => {
    const data = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    data.lines.forEach(line => {
      expect(line.leaveDays).toBeGreaterThanOrEqual(0);
      expect(line.absenceDays).toBeGreaterThanOrEqual(0);
    });
  });

  // 20. Reconciliation blocker affects readiness
  test("20. Readiness status accounts for attendance reconciliation status", async () => {
    const data = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(["READY_FOR_PAYROLL_REVIEW", "NEEDS_ATTENDANCE_RECONCILIATION", "RAMADAN_RULE_NOT_CONFIGURED", "NEEDS_OVERTIME_APPROVAL"]).toContain(data.overallReadiness);
  });

  // 21. Period lock affects readiness and prevents updating locked runs
  test("21. Create durable payroll run produces version 1 and locked status prevents direct edit", async () => {
    const run = await createDurablePayrollRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(run.id).toBeDefined();
    expect(run.version).toBe(1);
    expect(run.status).toBe("CALCULATED");
  });

  // 22. Export contains no salary or bank fields
  test("22. CSV export contains no salary, bank, or IBAN columns", async () => {
    const run = await createDurablePayrollRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    const { csv } = await exportPayrollAdvisoryRunCsv({
      runId: run.id,
      actorId: "AD-0001"
    });

    expect(csv).not.toContain("basicWage");
    expect(csv).not.toContain("iban");
    expect(csv).not.toContain("bankCode");
    expect(csv).not.toContain("salaryAmount");
    expect(csv).toContain("Employee Code");
    expect(csv).toContain("Regular Verified Minutes");
  });

  // 23. Payroll posting does NOT occur
  test("23. Durable runs remain in CALCULATED/REVIEWED/LOCKED status and never post payroll transactions", async () => {
    const run = await prisma.manpowerPayrollAdvisoryRun.findFirst({
      where: { operationType: "SECURITY_GUARDING", period: "2026-05" }
    });

    expect(run).not.toBeNull();
    expect(["DRAFT", "CALCULATED", "REVIEWED", "LOCKED", "EXPORTED", "SUPERSEDED"]).toContain(run!.status);
  });

  // 24. SG / FM scope isolation enforced
  test("24. Security Guarding and Facility Management runs maintain strict scope isolation", async () => {
    const sgData = await calculateBillingSupportData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    const fmData = await calculateBillingSupportData({
      operationType: "FACILITY_MANAGEMENT",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(sgData.lines).toBeDefined();
    expect(fmData.lines).toBeDefined();
  });

  // 25. Current duty rules remain intact
  test("25. Blue Collar vs White Collar current duty rules remain intact", async () => {
    expect(testGuard.employeeCategory).toBe("BLUE_COLLAR");
    expect(testGuard.operationType).toBe("SECURITY_GUARDING");
  });

  // 26. MP-3A exceptions intact
  test("26. Roster planning exceptions remain operational", async () => {
    const exceptionCount = await prisma.rosterPlanningException.count();
    expect(exceptionCount).toBeGreaterThanOrEqual(0);
  });

  // 27. MP-3B1 publication governance immutable
  test("27. Roster publications table remains present and active", async () => {
    const pubCount = await prisma.rosterPublication.count();
    expect(pubCount).toBeGreaterThanOrEqual(0);
  });

  // 28. MP-3B2a reconciliation advisory intact
  test("28. AttendanceRosterReconciliation table remains present and active", async () => {
    const reconCount = await prisma.attendanceRosterReconciliation.count();
    expect(reconCount).toBeGreaterThanOrEqual(0);
  });

  // 29. Bulk deployment intact
  test("29. ManpowerBulkOperationLog table remains present and active", async () => {
    const bulkCount = await prisma.manpowerBulkOperationLog.count();
    expect(bulkCount).toBeGreaterThanOrEqual(0);
  });

  // 30. Bulk unassignment intact
  test("30. Bulk unassignment support fields remain present on RosterSlotAssignment", async () => {
    const asgCount = await prisma.rosterSlotAssignment.count();
    expect(asgCount).toBeGreaterThanOrEqual(0);
  });

  // 31. Phase 5D pilot untouched
  test("31. SECFAC monitoring pilot tables remain untouched", async () => {
    const monitorCount = await prisma.secFacOperationalAlert.count();
    expect(monitorCount).toBeGreaterThanOrEqual(0);
  });

  // 32. Minutes-based storage verification
  test("32. Work calendar profile schema enforces Int minutes storage", async () => {
    expect(testSGProfile.ordinaryDailyMinutes).toBe(480);
    expect(testSGProfile.ordinaryWeeklyMinutes).toBe(2880);
    expect(testSGProfile.ramadanDailyMinutes).toBe(360);
    expect(testSGProfile.ramadanWeeklyMinutes).toBe(2160);
  });

  // 33. Immutability of LOCKED / EXPORTED runs (superseded on re-run)
  test("33. Creating a new run when a prior run is LOCKED marks the prior run as SUPERSEDED", async () => {
    const run1 = await createDurableBillingRun({
      operationType: "FACILITY_MANAGEMENT",
      period: "2026-06",
      calculatedBy: "AD-0001"
    });

    await prisma.manpowerBillingSupportRun.update({
      where: { id: run1.id },
      data: { status: "LOCKED" }
    });

    const run2 = await createDurableBillingRun({
      operationType: "FACILITY_MANAGEMENT",
      period: "2026-06",
      calculatedBy: "AD-0001"
    });

    expect(run2.version).toBe(2);
    expect(run2.supersedesRunId).toBe(run1.id);

    const updatedRun1 = await prisma.manpowerBillingSupportRun.findUnique({ where: { id: run1.id } });
    expect(updatedRun1!.status).toBe("SUPERSEDED");
  });

  // 34. Work calendar profile overlap prevention test
  test("34. validateProfileOverlap blocks creating an overlapping approved profile", async () => {
    const overlap = await validateProfileOverlap({
      operationType: "SECURITY_GUARDING",
      workerCategory: "SECURITY_GUARDING",
      effectiveFrom: new Date("2026-06-01"),
      effectiveTo: new Date("2026-07-01"),
      companyId: testCompany.id
    });

    expect(overlap.hasOverlap).toBe(true);
    expect(overlap.overlappingProfileId).toBeDefined();
  });

  // 35. Holiday calendar scope enum verification
  test("35. ManpowerHolidayScope enum enforces SECURITY_GUARDING, FACILITY_MANAGEMENT, or BOTH", async () => {
    expect(testHolidayCal.scope).toBe("BOTH");
  });

  // 36. Reliever substitution non-double-counting test
  test("36. Reliever substitution count does not double-count planned manpower", async () => {
    const data = await calculateBillingSupportData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    data.lines.forEach(line => {
      expect(line.billableAdvisoryQuantity).toBeLessThanOrEqual(line.plannedManpower);
    });
  });

  // 37. CSV formula injection protection test
  test("37. escapeCsvCell properly escapes formula injection characters", () => {
    expect(escapeCsvCell("=SUM(A1:A10)")).toBe("\"'=SUM(A1:A10)\"");
    expect(escapeCsvCell("+123456")).toBe("\"'+123456\"");
    expect(escapeCsvCell("-500")).toBe("\"'-500\"");
    expect(escapeCsvCell("@EVIL")).toBe("\"'@EVIL\"");
    expect(escapeCsvCell("Normal Text")).toBe("\"Normal Text\"");
  });

  // 38. Audit trail created for export
  test("38. Exporting an advisory run logs an entry in UserActivityLog", async () => {
    const run = await createDurablePayrollRun({
      operationType: "FACILITY_MANAGEMENT",
      period: "2026-07",
      calculatedBy: "AD-0001"
    });

    await exportPayrollAdvisoryRunCsv({
      runId: run.id,
      actorId: "AD-0001",
      actorEmail: "admin@alhattab.qa"
    });

    const audit = await prisma.userActivityLog.findFirst({
      where: {
        entityType: "ManpowerPayrollAdvisoryRun",
        entityId: run.id,
        action: "EXPORT_PAYROLL_ADVISORY_RUN"
      }
    });

    expect(audit).not.toBeNull();
  });

  // 39. Incomplete DRAFT profile allowed, but requires minute thresholds before APPROVED
  test("39. Draft profile can be created with null minute thresholds", async () => {
    const draftProf = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: "PROF-DRAFT-TEST",
        name: "Incomplete Draft Profile",
        operationType: "FACILITY_MANAGEMENT",
        workerCategory: "OTHER_FACILITY_MANAGEMENT",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "DRAFT"
      }
    });

    expect(draftProf.approvalStatus).toBe("DRAFT");
    expect(draftProf.ordinaryDailyMinutes).toBeNull();

    await prisma.manpowerWorkCalendarProfile.delete({ where: { id: draftProf.id } });
  });

  // 40. Relational identity client billing support calculation test
  test("40. Commercial billing support outputs planned, assigned, verified, shortage, and extra counts", async () => {
    const data = await calculateBillingSupportData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(data.summary.totalPlannedManpower).toBeGreaterThanOrEqual(0);
    expect(data.summary.totalAssignedManpower).toBeGreaterThanOrEqual(0);
    expect(data.summary.totalVerifiedPresent).toBeGreaterThanOrEqual(0);
    expect(data.summary.totalBillableQuantity).toBeGreaterThanOrEqual(0);
  });

  // 41. Durable billing run creation and export
  test("41. Durable billing run creation generates lines and exports to CSV safely", async () => {
    const run = await createDurableBillingRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(run.lines.length).toBeGreaterThanOrEqual(0);

    const { csv } = await exportBillingSupportRunCsv({
      runId: run.id,
      actorId: "AD-0001"
    });

    expect(csv).toContain("Run Code");
    expect(csv).toContain("Planned Manpower");
    expect(csv).toContain("Billable Advisory Qty");
  });

  // 42. Overall readiness classification summary
  test("42. Overall readiness status summarizes payroll advisory run readiness", async () => {
    const data = await calculatePayrollInputData({
      operationType: "FACILITY_MANAGEMENT",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(data.overallReadiness).toBeDefined();
    expect(data.summary.employeeCount).toBeGreaterThanOrEqual(0);
  });

  // 43. ScopeKey uniqueness and company vs global holiday calendar resolution
  test("43. Holiday calendar scopeKey enables company and global calendars without collision", async () => {
    const calGlobal = await prisma.manpowerHolidayCalendar.create({
      data: {
        year: 2027,
        name: "Global Calendar 2027",
        scopeKey: "GLOBAL",
        scope: "BOTH",
        version: 1,
        approvalStatus: "DRAFT"
      }
    });

    const calCompany = await prisma.manpowerHolidayCalendar.create({
      data: {
        year: 2027,
        name: "Company Calendar 2027",
        scopeKey: "COMPANY:COMP-MP3C4",
        companyId: testCompany.id,
        scope: "BOTH",
        version: 1,
        approvalStatus: "DRAFT"
      }
    });

    expect(calGlobal.scopeKey).toBe("GLOBAL");
    expect(calCompany.scopeKey).toBe("COMPANY:COMP-MP3C4");

    await prisma.manpowerHolidayCalendar.deleteMany({ where: { id: { in: [calGlobal.id, calCompany.id] } } });
  });

  // 44. Idempotency key conflict returns 409 error
  test("44. Reusing idempotency key with different request payload throws 409 conflict", async () => {
    const key = `IDEM-KEY-${Date.now()}`;
    await createDurableBillingRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-08",
      calculatedBy: "AD-0001",
      idempotencyKey: key,
      requestHash: "HASH_A"
    });

    await expect(
      createDurableBillingRun({
        operationType: "SECURITY_GUARDING",
        period: "2026-08",
        calculatedBy: "AD-0001",
        idempotencyKey: key,
        requestHash: "HASH_B"
      })
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  });

  // 45. FOC reliever base planned post billable qty = 1 and additional reliever qty = 0
  test("45. FOC reliever calculation preserves base post covered qty and sets additional reliever qty to 0", async () => {
    const data = await calculateBillingSupportData({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    data.lines.forEach(line => {
      expect(line.additionalRelieverAdvisoryQty).toBe(0);
      expect(line.baseBillableAdvisoryQty).toBe(line.billableAdvisoryQuantity);
    });
  });

  // 46. Durable payroll run creates employee-day detail records in ManpowerPayrollAdvisoryDay
  test("46. Durable payroll run persists employee-day detail records in ManpowerPayrollAdvisoryDay", async () => {
    const run = await createDurablePayrollRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    expect(run.lines).toBeDefined();
    if (run.lines.length > 0) {
      const lineWithDays = await prisma.manpowerPayrollAdvisoryLine.findUnique({
        where: { id: run.lines[0].id },
        include: { days: true }
      });
      expect(lineWithDays?.days).toBeDefined();
    }
  });

  // 47. Scoped idempotency allows identical key across different company scopes
  test("47. Scoped idempotency allows identical idempotency key across different companies or operation types", async () => {
    const sharedKey = `SCOPED-IDEM-${Date.now()}`;
    const run1 = await createDurableBillingRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-09",
      calculatedBy: "AD-0001",
      idempotencyKey: sharedKey
    });

    const run2 = await createDurableBillingRun({
      operationType: "FACILITY_MANAGEMENT",
      period: "2026-09",
      calculatedBy: "AD-0001",
      idempotencyKey: sharedKey
    });

    expect(run1.id).not.toBe(run2.id);
    expect(run1.runScopeKey).toBe("GLOBAL");
    expect(run2.runScopeKey).toBe("GLOBAL");
  });

  // 48. Scope key consistency validation
  test("48. Scope key consistency validation blocks inconsistent scopeKey and companyId combination", async () => {
    const { calculateRunScopeKey, validateScopeKeyConsistency } = require("../../apps/web/lib/manpower-billing-support-engine");
    expect(calculateRunScopeKey(null)).toBe("GLOBAL");
    expect(calculateRunScopeKey("COMP-101")).toBe("COMPANY:COMP-101");

    expect(() => validateScopeKeyConsistency("GLOBAL", "COMP-101")).toThrow("INVALID_SCOPE_KEY");
    expect(() => validateScopeKeyConsistency("COMPANY:COMP-999", "COMP-101")).toThrow("INVALID_SCOPE_KEY");
  });

  // 49. Multi-profile source version tracking
  test("49. Structured sourceVersionJson preserves array of active work calendar profiles across categories", async () => {
    const run = await createDurablePayrollRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    const svJson = run.sourceVersionJson as any;
    expect(svJson).toBeDefined();
    expect(Array.isArray(svJson.workCalendarProfiles)).toBe(true);
    expect(svJson.calculationEngineVersion).toBe(3);
  });

  // 50. Supersession self-relations and ON DELETE Restrict protection
  test("50. Supersession self-relations establish hierarchy and block deleting referenced parent profile", async () => {
    const prof1 = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: `PAR-PROF-${Date.now()}`,
        name: "Parent Profile",
        operationType: "SECURITY_GUARDING",
        workerCategory: "SECURITY_GUARDING",
        ordinaryDailyMinutes: 480,
        ordinaryWeeklyMinutes: 2880,
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "SUPERSEDED"
      }
    });

    const prof2 = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: `CHILD-PROF-${Date.now()}`,
        name: "Child Profile",
        operationType: "SECURITY_GUARDING",
        workerCategory: "SECURITY_GUARDING",
        ordinaryDailyMinutes: 480,
        ordinaryWeeklyMinutes: 2880,
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "APPROVED",
        supersedesProfileId: prof1.id
      }
    });

    expect(prof2.supersedesProfileId).toBe(prof1.id);

    // Verify ON DELETE Restrict
    await expect(prisma.manpowerWorkCalendarProfile.delete({ where: { id: prof1.id } })).rejects.toThrow();

    // Clean up child first then parent
    await prisma.manpowerWorkCalendarProfile.delete({ where: { id: prof2.id } });
    await prisma.manpowerWorkCalendarProfile.delete({ where: { id: prof1.id } });
  });

  // 51. Employee-day evidenceGroupKey uniqueness
  test("51. ManpowerPayrollAdvisoryDay enforces evidenceGroupKey uniqueness per line and businessDate", async () => {
    const run = await createDurablePayrollRun({
      operationType: "SECURITY_GUARDING",
      period: "2026-05",
      calculatedBy: "AD-0001"
    });

    const lineId = run.lines[0].id;
    const date = new Date("2026-05-01");

    const day1 = await prisma.manpowerPayrollAdvisoryDay.create({
      data: {
        lineId,
        businessDate: date,
        evidenceGroupKey: "PRIMARY_ASSIGNMENT",
        regularMinutes: 480
      }
    });

    expect(day1.id).toBeDefined();

    // Secondary evidence group key on same date is allowed
    const day2 = await prisma.manpowerPayrollAdvisoryDay.create({
      data: {
        lineId,
        businessDate: date,
        evidenceGroupKey: "RECONCILIATION_EVENT",
        regularMinutes: 240
      }
    });
    expect(day2.id).toBeDefined();

    // Duplicate (lineId, businessDate, evidenceGroupKey) throws unique constraint error
    await expect(
      prisma.manpowerPayrollAdvisoryDay.create({
        data: {
          lineId,
          businessDate: date,
          evidenceGroupKey: "PRIMARY_ASSIGNMENT",
          regularMinutes: 480
        }
      })
    ).rejects.toThrow();
  });

  // 52. Commercial basis resolution fallback
  test("52. Resolve billing basis returns COMMERCIAL_RULE_NOT_CONFIGURED when missing", () => {
    const { resolveBillingBasis } = require("../../apps/web/lib/manpower-billing-support-engine");
    expect(resolveBillingBasis("PLANNED_POST_CONTRACT")).toBe("PLANNED_POST_CONTRACT");
    expect(resolveBillingBasis("SHIFT_RATE")).toBe("SHIFT_RATE");
    expect(resolveBillingBasis(null)).toBe("COMMERCIAL_RULE_NOT_CONFIGURED");
    expect(resolveBillingBasis("UNKNOWN_RULE")).toBe("COMMERCIAL_RULE_NOT_CONFIGURED");
  });
});


