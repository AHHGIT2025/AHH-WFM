import { prisma } from "@ahh-wfm/database";
import { getHoldingCompany } from "./server/master-data-service";

export interface ResolvedCalendarContext {
  profile: any | null;
  ramadanPeriod: any | null;
  holidayDate: any | null;
  seasonalRule: any | null;
  isRamadanActive: boolean;
  isPublicHoliday: boolean;
  isWeeklyRestDay: boolean;
  dailyThresholdMinutes: number | null;
  weeklyThresholdMinutes: number | null;
  missingProfileReason?: string;
  seasonalViolations?: string[];
}

/**
 * Resolves Blue Collar authoritative Roster Rest Day status.
 * Queries ManpowerRosterDayClassification persistence table.
 * Returns WEEKLY_REST ONLY when an explicit WEEKLY_REST record exists.
 * Never infers WEEKLY_REST from missing assignments.
 */
export async function resolveBlueCollarRosterRestDay(params: {
  employeeId: string;
  businessDate: Date | string;
}): Promise<"WORKING_DAY" | "WEEKLY_REST" | "UNASSIGNED" | "NOT_SCHEDULED"> {
  const targetDate = new Date(params.businessDate);

  const classification = await (prisma as any).manpowerRosterDayClassification.findUnique({
    where: {
      employeeId_businessDate: {
        employeeId: params.employeeId,
        businessDate: targetDate
      }
    }
  });

  if (classification) {
    return classification.classification;
  }

  // Check requirement slot / assignment fallback
  const assignment = await prisma.rosterSlotAssignment.findFirst({
    where: {
      employeeId: params.employeeId,
      slot: {
        businessDate: targetDate
      }
    }
  });

  if (assignment) {
    return "WORKING_DAY";
  }

  return "UNASSIGNED";
}

/**
 * Resolves Work Calendar Profile according to White Collar & Blue Collar precedence rules.
 */
export async function resolveApplicableWorkCalendarProfile(params: {
  workerClass: "WHITE_COLLAR" | "BLUE_COLLAR";
  companyId?: string | null;
  departmentId?: string | null;
  positionCategoryId?: string | null;
  operationType?: string | null;
  workerCategory?: string | null;
  businessDate: Date | string;
}) {
  const targetDate = new Date(params.businessDate);

  if (params.workerClass === "WHITE_COLLAR") {
    // 1. Department Override
    if (params.departmentId && params.companyId) {
      const deptProfile = await prisma.manpowerWorkCalendarProfile.findFirst({
        where: {
          workerClass: "WHITE_COLLAR",
          applicability: "DEPARTMENT",
          applicableCompanyId: params.companyId,
          departmentId: params.departmentId,
          approvalStatus: "APPROVED",
          effectiveFrom: { lte: targetDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }]
        },
        include: { restDays: true },
        orderBy: { version: "desc" }
      });
      if (deptProfile) return deptProfile;
    }

    // 2. Company Override
    if (params.companyId) {
      const compProfile = await prisma.manpowerWorkCalendarProfile.findFirst({
        where: {
          workerClass: "WHITE_COLLAR",
          applicability: "COMPANY",
          applicableCompanyId: params.companyId,
          approvalStatus: "APPROVED",
          effectiveFrom: { lte: targetDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }]
        },
        include: { restDays: true },
        orderBy: { version: "desc" }
      });
      if (compProfile) return compProfile;
    }

    // 3. Group-wide Holding Profile
    const groupProfile = await prisma.manpowerWorkCalendarProfile.findFirst({
      where: {
        workerClass: "WHITE_COLLAR",
        applicability: "GROUP_WIDE",
        approvalStatus: "APPROVED",
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }]
      },
      include: { restDays: true },
      orderBy: { version: "desc" }
    });
    if (groupProfile) return groupProfile;

    return null;
  } else {
    // Blue Collar Resolution: Position Normal Profile -> Company Normal Profile
    if (params.companyId && params.positionCategoryId) {
      const posProfile = await prisma.manpowerWorkCalendarProfile.findFirst({
        where: {
          workerClass: "BLUE_COLLAR",
          applicableCompanyId: params.companyId,
          positionCategoryId: params.positionCategoryId,
          appliesToAllPositionCategories: false,
          approvalStatus: "APPROVED",
          effectiveFrom: { lte: targetDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }]
        },
        orderBy: { version: "desc" }
      });
      if (posProfile) return posProfile;
    }

    if (params.companyId) {
      const compProfile = await prisma.manpowerWorkCalendarProfile.findFirst({
        where: {
          workerClass: "BLUE_COLLAR",
          applicableCompanyId: params.companyId,
          appliesToAllPositionCategories: true,
          approvalStatus: "APPROVED",
          ...(params.operationType ? { operationType: params.operationType as any } : {}),
          ...(params.workerCategory ? { workerCategory: params.workerCategory as any } : {}),
          effectiveFrom: { lte: targetDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }]
        },
        orderBy: { version: "desc" }
      });
      if (compProfile) return compProfile;
    }

    return null;
  }
}

/**
 * Resolves Seasonal Work Rule according to Blue Collar precedence rules:
 * Position Seasonal Rule -> Company Seasonal Rule.
 */
export async function resolveApplicableSeasonalRule(params: {
  companyId: string;
  positionCategoryId?: string | null;
  profileId?: string | null;
  businessDate: Date | string;
}) {
  const targetDate = new Date(params.businessDate);

  // 1. Profile specific seasonal rule
  if (params.profileId) {
    const profRule = await (prisma as any).manpowerSeasonalWorkRule.findFirst({
      where: {
        ruleScope: "PROFILE_SPECIFIC",
        profileId: params.profileId,
        approvalStatus: "APPROVED",
        effectiveFrom: { lte: targetDate },
        effectiveTo: { gte: targetDate }
      },
      orderBy: { version: "desc" }
    });
    if (profRule) return profRule;
  }

  // 2. Position Category seasonal rule
  if (params.companyId && params.positionCategoryId) {
    const posRule = await (prisma as any).manpowerSeasonalWorkRule.findFirst({
      where: {
        ruleScope: "POSITION_CATEGORY",
        companyId: params.companyId,
        positionCategoryId: params.positionCategoryId,
        approvalStatus: "APPROVED",
        effectiveFrom: { lte: targetDate },
        effectiveTo: { gte: targetDate }
      },
      orderBy: { version: "desc" }
    });
    if (posRule) return posRule;
  }

  // 3. Company-wide seasonal rule
  if (params.companyId) {
    const compRule = await (prisma as any).manpowerSeasonalWorkRule.findFirst({
      where: {
        ruleScope: "COMPANY_WIDE",
        companyId: params.companyId,
        approvalStatus: "APPROVED",
        effectiveFrom: { lte: targetDate },
        effectiveTo: { gte: targetDate }
      },
      orderBy: { version: "desc" }
    });
    if (compRule) return compRule;
  }

  return null;
}

/**
 * Main resolution engine combining profile, seasonal rule, Ramadan, holiday, and roster day status.
 */
export async function resolveEmployeeCalendarContext(params: {
  employeeId?: string;
  workerClass?: "WHITE_COLLAR" | "BLUE_COLLAR";
  workerCategory?: string;
  operationType?: string;
  companyId?: string | null;
  departmentId?: string | null;
  positionCategoryId?: string | null;
  date: Date | string;
}): Promise<ResolvedCalendarContext> {
  const targetDate = new Date(params.date);
  const resolvedClass = params.workerClass || (params.workerCategory === "WHITE_COLLAR" || params.operationType === "WHITE_COLLAR" ? "WHITE_COLLAR" : "BLUE_COLLAR");

  // 1. Resolve Profile
  const profile = await resolveApplicableWorkCalendarProfile({
    workerClass: resolvedClass,
    companyId: params.companyId,
    departmentId: params.departmentId,
    positionCategoryId: params.positionCategoryId,
    operationType: params.operationType,
    workerCategory: params.workerCategory,
    businessDate: targetDate
  });

  if (!profile) {
    return {
      profile: null,
      ramadanPeriod: null,
      holidayDate: null,
      seasonalRule: null,
      isRamadanActive: false,
      isPublicHoliday: false,
      isWeeklyRestDay: false,
      dailyThresholdMinutes: null,
      weeklyThresholdMinutes: null,
      missingProfileReason: `DATA_INCOMPLETE: No approved Work Calendar Profile found for class ${resolvedClass}`
    };
  }

  // 2. Resolve Ramadan Period
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

  // 3. Resolve Holiday
  const holidayDate = await prisma.manpowerHolidayDate.findFirst({
    where: {
      holidayDate: targetDate,
      approvalStatus: "APPROVED"
    }
  });
  const isPublicHoliday = !!holidayDate;

  // 4. Resolve Weekly Rest Day
  let isWeeklyRestDay = false;
  if (resolvedClass === "WHITE_COLLAR") {
    const dayName = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][targetDate.getDay()];
    isWeeklyRestDay = (profile as any).restDays ? (profile as any).restDays.some((rd: any) => rd.dayOfWeek === dayName) : false;
  } else if (params.employeeId) {
    const rosterStatus = await resolveBlueCollarRosterRestDay({
      employeeId: params.employeeId,
      businessDate: targetDate
    });
    isWeeklyRestDay = rosterStatus === "WEEKLY_REST";
  }

  // 5. Resolve Seasonal Rule
  let seasonalRule = null;
  if (params.companyId) {
    seasonalRule = await resolveApplicableSeasonalRule({
      companyId: params.companyId,
      positionCategoryId: params.positionCategoryId,
      profileId: profile.id,
      businessDate: targetDate
    });
  }

  const dailyThresholdMinutes = isRamadanActive && profile.ramadanDailyMinutes ? profile.ramadanDailyMinutes : profile.ordinaryDailyMinutes;
  const weeklyThresholdMinutes = isRamadanActive && profile.ramadanWeeklyMinutes ? profile.ramadanWeeklyMinutes : profile.ordinaryWeeklyMinutes;

  return {
    profile,
    ramadanPeriod,
    holidayDate,
    seasonalRule,
    isRamadanActive,
    isPublicHoliday,
    isWeeklyRestDay,
    dailyThresholdMinutes,
    weeklyThresholdMinutes
  };
}

export async function validateProfileOverlap(params: {
  operationType?: string | null;
  workerCategory?: string | null;
  effectiveFrom: Date;
  effectiveTo: Date;
  companyId?: string | null;
}): Promise<{ hasOverlap: boolean; overlappingProfileId?: string }> {
  const existing = await prisma.manpowerWorkCalendarProfile.findFirst({
    where: {
      approvalStatus: "APPROVED",
      ...(params.companyId ? { applicableCompanyId: params.companyId } : {}),
      effectiveFrom: { lte: params.effectiveTo },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: params.effectiveFrom } }
      ]
    }
  });

  if (existing) {
    return { hasOverlap: true, overlappingProfileId: existing.id };
  }
  return { hasOverlap: false };
}
