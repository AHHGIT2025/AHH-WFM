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
      operationType: params.operationType,
      workerCategory: params.workerCategory,
      approvalStatus: "APPROVED",
      effectiveFrom: { lte: targetDate },
      effectiveTo: { gte: targetDate },
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

  // Verify completeness of minute thresholds in APPROVED profile
  if (
    profile.ordinaryDailyMinutes == null ||
    profile.ordinaryWeeklyMinutes == null ||
    profile.ramadanDailyMinutes == null ||
    profile.ramadanWeeklyMinutes == null
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
      missingProfileReason: "DATA_INCOMPLETE: Approved profile is missing daily/weekly minute thresholds"
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

  // 3. Resolve Approved Holiday Date
  const holidayDate = await prisma.manpowerHolidayDate.findFirst({
    where: {
      holidayDate: targetDate,
      approvalStatus: "APPROVED",
      operationType: { in: [params.operationType, "BOTH"] },
      calendar: {
        year,
        approvalStatus: "APPROVED",
        scope: { in: [params.operationType as any, "BOTH"] }
      }
    }
  });

  const isPublicHoliday = !!holidayDate;

  // 4. Resolve Weekly Rest Day
  let isWeeklyRestDay = false;
  const dayOfWeekNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const dayName = dayOfWeekNames[targetDate.getDay()];

  if (profile.weeklyRestConfigType === "FIXED_DAY") {
    const fixedRestDay = (profile.weeklyRestFixedDay || params.employeeWeeklyRestDay || "FRIDAY").toUpperCase();
    isWeeklyRestDay = dayName === fixedRestDay;
  } else if (profile.weeklyRestConfigType === "ROTATING" || profile.weeklyRestConfigType === "CUSTOM_SCHEDULE") {
    const restDays: string[] = Array.isArray((profile.weeklyRestCustomSchedule as any)?.restDays)
      ? (profile.weeklyRestCustomSchedule as any).restDays.map((d: string) => d.toUpperCase())
      : [params.employeeWeeklyRestDay?.toUpperCase() || "FRIDAY"];
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
  effectiveTo: Date;
  companyId?: string | null;
}): Promise<{ hasOverlap: boolean; overlappingProfileId?: string }> {
  const existing = await prisma.manpowerWorkCalendarProfile.findFirst({
    where: {
      ...(params.id ? { id: { not: params.id } } : {}),
      operationType: params.operationType,
      workerCategory: params.workerCategory,
      approvalStatus: "APPROVED",
      ...(params.companyId ? { companyId: params.companyId } : {}),
      OR: [
        {
          effectiveFrom: { lte: params.effectiveTo },
          effectiveTo: { gte: params.effectiveFrom }
        }
      ]
    }
  });

  return {
    hasOverlap: !!existing,
    overlappingProfileId: existing?.id
  };
}
