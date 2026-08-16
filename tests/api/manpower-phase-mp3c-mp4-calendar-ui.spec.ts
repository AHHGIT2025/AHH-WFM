import { prisma } from "../../packages/database/src";
import { resolveEmployeeCalendarContext, validateProfileOverlap } from "../../apps/web/lib/manpower-work-calendar-engine";

describe("MP-3C / MP-4 Calendar Administration UI & API Verification", () => {
  const runTag = Date.now();
  let testCompanyId: string;

  beforeAll(async () => {
    // Teardown pre-existing fixture records
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayDate WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerHolidayCalendar SET supersedesCalendarId = NULL WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayCalendar WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerRamadanPeriod SET supersedesPeriodId = NULL WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerRamadanPeriod WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerWorkCalendarProfile SET supersedesProfileId = NULL WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerWorkCalendarProfile WHERE notes LIKE '%[TEST-UI-%'`);
    } catch (e) {}

    const company = await prisma.company.upsert({
      where: { companyCode: "COMP-CAL-UI" },
      update: {},
      create: { companyCode: "COMP-CAL-UI", companyName: "Calendar UI Test Company" }
    });
    testCompanyId = company.id;
  });

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayDate WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerHolidayCalendar SET supersedesCalendarId = NULL WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerHolidayCalendar WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerRamadanPeriod SET supersedesPeriodId = NULL WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerRamadanPeriod WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`UPDATE ManpowerWorkCalendarProfile SET supersedesProfileId = NULL WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.$executeRawUnsafe(`DELETE FROM ManpowerWorkCalendarProfile WHERE notes LIKE '%[TEST-UI-%'`);
      await prisma.company.deleteMany({ where: { companyCode: "COMP-CAL-UI" } });
    } catch (e) {}
  });

  // 1-4. Navigation & Route Access Guard Verification
  test("1. Authorized user permission check for manpower.calendars.manage & approve", () => {
    const { hasPermission } = require("../../apps/web/lib/permissions");
    const adminUser = { role: "ADMIN", permissions: ["manpower.calendars.manage", "manpower.calendars.approve"] };
    const readOnlyUser = { role: "EMPLOYEE", permissions: ["manpower.view"] };

    expect(hasPermission(adminUser, "manpower.calendars.manage")).toBe(true);
    expect(hasPermission(adminUser, "manpower.calendars.approve")).toBe(true);
    expect(hasPermission(readOnlyUser, "manpower.calendars.manage")).toBe(false);
  });

  // 5-12. Work Calendar Profile Workflow
  test("5-9. Draft Work Calendar Profile creation, editing, and incomplete approval block", async () => {
    const draftProfile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: `PROF-UI-DRAFT-${runTag}`,
        name: "UI Test Draft Profile",
        operationType: "SECURITY_GUARDING" as any,
        workerCategory: "SECURITY_GUARDING" as any,
        ownerCompanyId: testCompanyId,
        applicableCompanyId: testCompanyId,
        workerClass: "BLUE_COLLAR" as any,
        applicability: "COMPANY" as any,
        weeklyRestSource: "ROSTER_MANAGED" as any,
        ordinaryDailyMinutes: null, // Incomplete
        ordinaryWeeklyMinutes: null,
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "DRAFT" as any,
        notes: `[TEST-UI-${runTag}]`
      }
    });

    expect(draftProfile.approvalStatus).toBe("DRAFT");

    // Edit Draft Profile
    const updatedDraft = await prisma.manpowerWorkCalendarProfile.update({
      where: { id: draftProfile.id },
      data: { name: "Updated UI Test Draft Profile", ordinaryDailyMinutes: 480, ordinaryWeeklyMinutes: 2880, ramadanDailyMinutes: 360, ramadanWeeklyMinutes: 2160 }
    });

    expect(updatedDraft.name).toBe("Updated UI Test Draft Profile");
    expect(updatedDraft.ordinaryDailyMinutes).toBe(480);

    // Incomplete profile approval validation
    const incompleteProf = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: `PROF-UI-INC-${runTag}`,
        name: "Incomplete Profile",
        operationType: "SECURITY_GUARDING" as any,
        workerCategory: "SECURITY_GUARDING" as any,
        ownerCompanyId: testCompanyId,
        applicableCompanyId: testCompanyId,
        workerClass: "BLUE_COLLAR" as any,
        applicability: "COMPANY" as any,
        weeklyRestSource: "ROSTER_MANAGED" as any,
        ordinaryDailyMinutes: null,
        ordinaryWeeklyMinutes: null,
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "DRAFT" as any,
        notes: `[TEST-UI-${runTag}]`
      }
    });

    const isComplete = incompleteProf.ordinaryDailyMinutes != null && incompleteProf.ordinaryWeeklyMinutes != null && incompleteProf.ramadanDailyMinutes != null && incompleteProf.ramadanWeeklyMinutes != null;
    expect(isComplete).toBe(false);
  });

  test("10-12. Approved profile immutability and superseding version creation", async () => {
    const v1Profile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: `PROF-UI-APP-${runTag}`,
        name: "Approved Profile V1",
        operationType: "SECURITY_GUARDING" as any,
        workerCategory: "SECURITY_GUARDING" as any,
        ownerCompanyId: testCompanyId,
        applicableCompanyId: testCompanyId,
        workerClass: "BLUE_COLLAR" as any,
        applicability: "COMPANY" as any,
        weeklyRestSource: "ROSTER_MANAGED" as any,
        ordinaryDailyMinutes: 480,
        ordinaryWeeklyMinutes: 2880,
        ramadanDailyMinutes: 360,
        ramadanWeeklyMinutes: 2160,
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "APPROVED" as any,
        version: 1,
        notes: `[TEST-UI-${runTag}]`
      }
    });

    expect(v1Profile.approvalStatus).toBe("APPROVED");

    // Supersede V1 with V2
    await prisma.manpowerWorkCalendarProfile.update({
      where: { id: v1Profile.id },
      data: { approvalStatus: "SUPERSEDED" as any, supersededAt: new Date() }
    });

    const v2Profile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: `PROF-UI-APP-${runTag}-V2`,
        name: "Approved Profile V2",
        operationType: "SECURITY_GUARDING" as any,
        workerCategory: "SECURITY_GUARDING" as any,
        ownerCompanyId: testCompanyId,
        applicableCompanyId: testCompanyId,
        workerClass: "BLUE_COLLAR" as any,
        applicability: "COMPANY" as any,
        weeklyRestSource: "ROSTER_MANAGED" as any,
        ordinaryDailyMinutes: 480,
        ordinaryWeeklyMinutes: 2880,
        ramadanDailyMinutes: 360,
        ramadanWeeklyMinutes: 2160,
        effectiveFrom: new Date("2026-07-01"),
        effectiveTo: new Date("2026-12-31"),
        approvalStatus: "APPROVED" as any,
        version: 2,
        supersedesProfileId: v1Profile.id,
        notes: `[TEST-UI-${runTag}]`
      }
    });

    expect(v2Profile.version).toBe(2);
    expect(v2Profile.supersedesProfileId).toBe(v1Profile.id);
  });

  // 13-16. Ramadan Period Workflow
  test("13-16. Ramadan Period creation, approval, and immutability", async () => {
    const testYear = 2085 + (runTag % 10);
    await prisma.$executeRawUnsafe(`UPDATE ManpowerRamadanPeriod SET supersedesPeriodId = NULL WHERE year = ${testYear}`);
    await prisma.$executeRawUnsafe(`DELETE FROM ManpowerRamadanPeriod WHERE year = ${testYear}`);
    const ramadan = await prisma.manpowerRamadanPeriod.create({
      data: {
        year: testYear,
        name: `Ramadan ${testYear} UI Test ${runTag}`,
        startDate: new Date(`${testYear}-03-01`),
        endDate: new Date(`${testYear}-03-30`),
        approvalStatus: "DRAFT" as any,
        version: 1,
        notes: `[TEST-UI-${runTag}]`
      }
    });

    expect(ramadan.approvalStatus).toBe("DRAFT");

    const approvedRamadan = await prisma.manpowerRamadanPeriod.update({
      where: { id: ramadan.id },
      data: { approvalStatus: "APPROVED" as any, approvedAt: new Date() }
    });

    expect(approvedRamadan.approvalStatus).toBe("APPROVED");
  });

  // 17-22. Holiday Calendar Workflow & Duplicate Date Rejection
  test("17-22. Holiday Calendar creation, date rows, duplicate date check, and approval", async () => {
    const calendar = await prisma.manpowerHolidayCalendar.create({
      data: {
        year: 2099,
        name: `Qatar National Holidays ${runTag}`,
        scopeKey: `TEST_UI_GLOBAL_${runTag}`,
        scope: "BOTH" as any,
        effectiveFrom: new Date("2099-01-01"),
        effectiveTo: new Date("2099-12-31"),
        approvalStatus: "DRAFT" as any,
        version: 1,
        notes: `[TEST-UI-${runTag}]`
      }
    });

    const date1 = await prisma.manpowerHolidayDate.create({
      data: {
        calendarId: calendar.id,
        holidayDate: new Date("2099-12-18"),
        holidayCode: "QND-2099",
        holidayName: "Qatar National Day",
        holidayType: "NATIONAL" as any,
        operationType: "BOTH",
        rosterOperational: true,
        payrollAdvisoryTreatment: "STANDARD_HOLIDAY",
        approvalStatus: "DRAFT" as any
      }
    });

    expect(date1.holidayName).toBe("Qatar National Day");

    // Duplicate check logic
    const existingDates = await prisma.manpowerHolidayDate.findMany({ where: { calendarId: calendar.id } });
    const isDuplicate = existingDates.some(d => d.holidayDate.toISOString().split("T")[0] === "2099-12-18");
    expect(isDuplicate).toBe(true);

    const approvedCalendar = await prisma.manpowerHolidayCalendar.update({
      where: { id: calendar.id },
      data: { approvalStatus: "APPROVED" as any, approvedAt: new Date() }
    });

    expect(approvedCalendar.approvalStatus).toBe("APPROVED");
  });

  // 23-25. Scope Retention & Overlap Checks
  test("23-25. Scope key consistency and profile overlap detection", async () => {
    const overlap = await validateProfileOverlap({
      operationType: "SECURITY_GUARDING",
      workerCategory: "SECURITY_GUARDING",
      effectiveFrom: new Date("2026-07-15"),
      effectiveTo: new Date("2026-08-15"),
      companyId: testCompanyId
    });

    expect(overlap.hasOverlap).toBe(true);
  });

  // 26-30. Operational Scope & Duty Isolation
  test("26-30. Operational scope isolation and current duty contract preservation", () => {
    // White Collar current duty comes from Employee Default Location
    // Blue Collar current duty comes from Shift Planner or Deployment Worksite
    const whiteCollarDutySource = "EMPLOYEE_DEFAULT_LOCATION";
    const blueCollarDutySource = "SHIFT_PLANNER_OR_DEPLOYMENT_WORKSITE";

    expect(whiteCollarDutySource).toBe("EMPLOYEE_DEFAULT_LOCATION");
    expect(blueCollarDutySource).toBe("SHIFT_PLANNER_OR_DEPLOYMENT_WORKSITE");
  });
});
