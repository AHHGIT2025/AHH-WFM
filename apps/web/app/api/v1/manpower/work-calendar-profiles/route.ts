import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";
import { validateProfileOverlap } from "@/lib/manpower-work-calendar-engine";
import { validateCompanyDepartment, validatePositionApplicability, validateRestDayLifecycle } from "@/lib/master-data-validator";
import { getHoldingCompany } from "@/lib/server/master-data-service";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const workerClass = searchParams.get("workerClass") || undefined;
  const applicability = searchParams.get("applicability") || undefined;
  const companyId = searchParams.get("companyId") || undefined;

  const profiles = await prisma.manpowerWorkCalendarProfile.findMany({
    where: {
      ...(workerClass ? { workerClass: workerClass as any } : {}),
      ...(applicability ? { applicability: applicability as any } : {}),
      ...(companyId ? { ownerCompanyId: companyId } : {})
    },
    include: {
      ownerCompany: true,
      applicableCompany: true,
      department: true,
      positionCategory: true,
      restDays: true
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ success: true, profiles });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;

  let body: any = {};
  try { body = await request.json(); } catch (e) {}

  const {
    code,
    name,
    ownerCompanyId,
    workerClass,
    applicability,
    applicableCompanyId,
    departmentId,
    operationType,
    workerCategory,
    appliesToAllPositionCategories,
    positionCategoryId,
    ordinaryDailyMinutes,
    ordinaryWeeklyMinutes,
    ramadanDailyMinutes,
    ramadanWeeklyMinutes,
    ramadanExcessCreatesOtCandidate,
    effectiveFrom,
    effectiveTo,
    approvalStatus,
    restDays, // Array of day names e.g. ["FRIDAY", "SATURDAY"]
    notes
  } = body;

  const userId = auth.session?.user?.id || "AD-0001";

  // Enforce mandatory ownerCompanyId or fallback to Holding Company
  let resolvedOwnerCompanyId = ownerCompanyId;
  if (!resolvedOwnerCompanyId) {
    try {
      const holding = await getHoldingCompany();
      resolvedOwnerCompanyId = holding.id;
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  }

  const resolvedWorkerClass = workerClass || (workerCategory === "WHITE_COLLAR" || operationType === "WHITE_COLLAR" ? "WHITE_COLLAR" : "BLUE_COLLAR");
  const resolvedApplicability = applicability || (applicableCompanyId ? "COMPANY" : "GROUP_WIDE");
  const weeklyRestSource = resolvedWorkerClass === "WHITE_COLLAR" ? "PROFILE_FIXED_DAYS" : "ROSTER_MANAGED";

  if (!code || !name || !effectiveFrom) {
    return NextResponse.json({ success: false, error: "Missing required profile fields" }, { status: 400 });
  }

  try {
    // Perform validators
    if (applicableCompanyId && departmentId) {
      await validateCompanyDepartment(applicableCompanyId, departmentId);
    }

    validatePositionApplicability({
      workerClass: resolvedWorkerClass,
      appliesToAllPositionCategories,
      positionCategoryId
    });

    validateRestDayLifecycle({
      workerClass: resolvedWorkerClass,
      approvalStatus: approvalStatus || "DRAFT",
      restDays
    });

    const targetStatus = approvalStatus || "DRAFT";
    if (targetStatus === "APPROVED") {
      if (
        ordinaryDailyMinutes == null ||
        ordinaryWeeklyMinutes == null ||
        ramadanDailyMinutes == null ||
        ramadanWeeklyMinutes == null
      ) {
        return NextResponse.json({
          success: false,
          error: "All daily and weekly minute thresholds are required before approving a Work Calendar Profile."
        }, { status: 400 });
      }

      const overlap = await validateProfileOverlap({
        operationType,
        workerCategory,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : new Date("2099-12-31"),
        companyId: applicableCompanyId
      });

      if (overlap.hasOverlap) {
        return NextResponse.json({
          success: false,
          error: `Profile overlaps with existing approved profile ID: ${overlap.overlappingProfileId}`
        }, { status: 409 });
      }
    }

    const profile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code,
        name,
        ownerCompanyId: resolvedOwnerCompanyId,
        workerClass: resolvedWorkerClass,
        applicability: resolvedApplicability,
        applicableCompanyId: applicableCompanyId || null,
        departmentId: departmentId || null,
        operationType: operationType || null,
        workerCategory: workerCategory || null,
        appliesToAllPositionCategories: appliesToAllPositionCategories ?? null,
        positionCategoryId: positionCategoryId || null,
        ordinaryDailyMinutes: ordinaryDailyMinutes != null ? parseInt(ordinaryDailyMinutes) : null,
        ordinaryWeeklyMinutes: ordinaryWeeklyMinutes != null ? parseInt(ordinaryWeeklyMinutes) : null,
        ramadanDailyMinutes: ramadanDailyMinutes != null ? parseInt(ramadanDailyMinutes) : null,
        ramadanWeeklyMinutes: ramadanWeeklyMinutes != null ? parseInt(ramadanWeeklyMinutes) : null,
        ramadanExcessCreatesOtCandidate: !!ramadanExcessCreatesOtCandidate,
        weeklyRestSource: weeklyRestSource as any,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        approvalStatus: targetStatus,
        approvedBy: targetStatus === "APPROVED" ? userId : null,
        approvedAt: targetStatus === "APPROVED" ? new Date() : null,
        createdById: userId,
        notes: notes || null,
        restDays: resolvedWorkerClass === "WHITE_COLLAR" && restDays && Array.isArray(restDays) ? {
          create: restDays.map((day: string) => ({ dayOfWeek: day as any }))
        } : undefined
      },
      include: { restDays: true }
    });

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
