import { prisma } from "@ahh-wfm/database";

export interface ResolvedCalendarContext {
  profile: any | null;
  ramadanPeriod: any | null;
  holidayDate: any | null;
  isRamadanActive: boolean;
  isPublicHoliday: boolean;
  isWeeklyRestDay: boolean;
  dailyThresholdMinutes: number | null;
  weeklyThresholdMinutes: number | null;
  missingProfileReason?: string;
}

/**
 * Resolves work calendar rules for a specific employee category, operation scope, and date.
 */
export async function resolveEmployeeCalendarContext(params: {
  employeeId: string;
  workerCategory: string; // "GENERAL" | "SECURITY_GUARDING" | "CLEANING" | "OTHER_FACILITY_MANAGEMENT" | "WHITE_COLLAR"
  operationType: string;  // "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  companyId?: string | null;
  date: Date | string;
  employeeWeeklyRestDay?: string | null; // e.g. "FRIDAY" or "SUNDAY"
}): Promise<ResolvedCalendarContext> {
  const targetDate = new Date(params.date);
  const dateStr = targetDate.toISOString().split("T")[0];

  // 1. Resolve Approved Work Calendar Profile
  const profile = await prisma.manpowerWorkCalendarProfile.findFirst({
    where: {
      operationType: params.operationType as any,
      workerCategory: params.workerCategory as any,
      approvalStatus: "APPROVED" as any,
      effectiveFrom: { lte: targetDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: targetDate } }
      ],
      ...(params.companyId ? { companyId: params.companyId } : {})
    },
    orderBy: { version: "desc" }
  });

  if (!profile) {
    return {
      profile: null,
      ramadanPeriod: null,
      holidayDate: null,
      isRamadanActive: false,
      isPublicHoliday: false,
      isWeeklyRestDay: false,
      dailyThresholdMinutes: null,
      weeklyThresholdMinutes: null,
      missingProfileReason: `RAMADAN_RULE_NOT_CONFIGURED: No approved profile for category ${params.workerCategory} and scope ${params.operationType}`
    };
  }

  // Verify completeness of minute thresholds and weekly rest in APPROVED profile
  if (
    profile.ordinaryDailyMinutes == null ||
    profile.ordinaryWeeklyMinutes == null ||
    profile.ramadanDailyMinutes == null ||
    profile.ramadanWeeklyMinutes == null ||
    !profile.weeklyRestConfigType
  ) {
    return {
      profile,
      ramadanPeriod: null,
      holidayDate: null,
      isRamadanActive: false,
      isPublicHoliday: false,
      isWeeklyRestDay: false,
      dailyThresholdMinutes: null,
      weeklyThresholdMinutes: null,
      missingProfileReason: "DATA_INCOMPLETE: Approved profile is missing daily/weekly minute thresholds or weekly rest configuration"
    };
  }

  // 2. Resolve Annual Approved Ramadan Period
  const year = targetDate.getFullYear();
  const ramadanPeriod = await prisma.manpowerRamadanPeriod.findFirst({
    where: {
      year,
      approvalStatus: "APPROVED",
      startDate: { lte: targetDate },
      endDate: { gte: targetDate }
    },
    orderBy: { version: "desc" }
  });

  const isRamadanActive = !!ramadanPeriod;

  // 3. Resolve Approved Holiday Date (checking company-specific or global calendar)
  const holidayDate = await prisma.manpowerHolidayDate.findFirst({
    where: {
      holidayDate: targetDate,
      approvalStatus: "APPROVED",
      operationType: { in: [params.operationType, "BOTH"] },
      calendar: {
        year,
        approvalStatus: "APPROVED",
        scope: { in: [params.operationType as any, "BOTH"] },
        ...(params.companyId ? { OR: [{ companyId: params.companyId }, { companyId: null }] } : {})
      }
    }
  });

  const isPublicHoliday = !!holidayDate;

  // 4. Resolve Weekly Rest Day
  let isWeeklyRestDay = false;
  const dayOfWeekNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const dayName = dayOfWeekNames[targetDate.getDay()];

  const targetRestDay = profile.weeklyRestFixedDay
    ? profile.weeklyRestFixedDay.toUpperCase()
    : params.employeeWeeklyRestDay
    ? params.employeeWeeklyRestDay.toUpperCase()
    : null;

  if (profile.weeklyRestConfigType === "FIXED_DAY") {
    if (targetRestDay) {
      isWeeklyRestDay = dayName === targetRestDay;
    }
  } else if (profile.weeklyRestConfigType === "ROTATING" || profile.weeklyRestConfigType === "CUSTOM_SCHEDULE") {
    const restDays: string[] = Array.isArray((profile.weeklyRestCustomSchedule as any)?.restDays)
      ? (profile.weeklyRestCustomSchedule as any).restDays.map((d: string) => d.toUpperCase())
      : targetRestDay
      ? [targetRestDay]
      : [];
    isWeeklyRestDay = restDays.includes(dayName);
  }

  // 5. Select Threshold Minutes (Ramadan vs Ordinary)
  const dailyThresholdMinutes = isRamadanActive ? profile.ramadanDailyMinutes : profile.ordinaryDailyMinutes;
  const weeklyThresholdMinutes = isRamadanActive ? profile.ramadanWeeklyMinutes : profile.ordinaryWeeklyMinutes;

  return {
    profile,
    ramadanPeriod,
    holidayDate,
    isRamadanActive,
    isPublicHoliday,
    isWeeklyRestDay,
    dailyThresholdMinutes,
    weeklyThresholdMinutes
  };
}

/**
 * Validates whether a proposed Work Calendar Profile overlaps with an existing APPROVED profile.
 */
export async function validateProfileOverlap(params: {
  id?: string;
  operationType: string;
  workerCategory: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  companyId?: string | null;
}): Promise<{ hasOverlap: boolean; overlappingProfileId?: string }> {
  const existing = await prisma.manpowerWorkCalendarProfile.findFirst({
    where: {
      ...(params.id ? { id: { not: params.id } } : {}),
      operationType: params.operationType as any,
      workerCategory: params.workerCategory as any,
      approvalStatus: "APPROVED" as any,
      ...(params.companyId ? { companyId: params.companyId } : {}),
      effectiveFrom: params.effectiveTo ? { lte: params.effectiveTo } : undefined,
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: params.effectiveFrom } }
      ]
    }
  });

  return {
    hasOverlap: !!existing,
    overlappingProfileId: existing?.id
  };
}

