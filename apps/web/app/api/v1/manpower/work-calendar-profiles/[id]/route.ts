import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateProfileOverlap } from "@/lib/manpower-work-calendar-engine";
import { validateCompanyDepartment, validatePositionApplicability, validateRestDayLifecycle } from "@/lib/master-data-validator";
import { getHoldingCompany } from "@/lib/server/master-data-service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id },
    include: {
      ownerCompany: true,
      applicableCompany: true,
      department: true,
      positionCategory: true,
      restDays: true,
      supersedesProfile: true,
      supersededByProfiles: true
    }
  });

  if (!profile) {
    return NextResponse.json({ success: false, error: "Work calendar profile not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, profile });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id },
    include: { restDays: true }
  });

  if (!profile) {
    return NextResponse.json({ success: false, error: "Work calendar profile not found" }, { status: 404 });
  }

  let body: any = {};
  try { body = await req.json(); } catch (e) {}

  const { action } = body;

  // Handle submit action
  if (action === "submit") {
    if (profile.approvalStatus !== "DRAFT") {
      return NextResponse.json({ success: false, error: "Only DRAFT profiles can be submitted" }, { status: 400 });
    }
    const updated = await prisma.manpowerWorkCalendarProfile.update({
      where: { id: params.id },
      data: { approvalStatus: "SUBMITTED" as any }
    });
    return NextResponse.json({ success: true, profile: updated });
  }

  // Handle reject action
  if (action === "reject") {
    const updated = await prisma.manpowerWorkCalendarProfile.update({
      where: { id: params.id },
      data: { approvalStatus: "REJECTED" as any }
    });
    return NextResponse.json({ success: true, profile: updated });
  }

  // Handle supersede action (create next version)
  if (action === "supersede") {
    const nextVersion = profile.version + 1;
    const {
      code,
      name,
      ownerCompanyId,
      workerClass,
      applicability,
      applicableCompanyId,
      departmentId,
      operationType,
      appliesToAllPositionCategories,
      positionCategoryId,
      ordinaryDailyMinutes,
      ordinaryWeeklyMinutes,
      ramadanDailyMinutes,
      ramadanWeeklyMinutes,
      ramadanExcessCreatesOtCandidate,
      weeklyRestSource,
      restDays,
      effectiveFrom,
      effectiveTo,
      notes
    } = body;

    let resolvedOwnerCompanyId = ownerCompanyId || profile.ownerCompanyId;
    if (!resolvedOwnerCompanyId) {
      try {
        const holding = await getHoldingCompany();
        resolvedOwnerCompanyId = holding.id;
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    const resolvedWorkerClass = workerClass || profile.workerClass;

    const newProfile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: code || `${profile.code}-V${nextVersion}`,
        name: name || `${profile.name} (V${nextVersion})`,
        ownerCompanyId: resolvedOwnerCompanyId,
        workerClass: resolvedWorkerClass,
        applicability: applicability || profile.applicability,
        applicableCompanyId: applicableCompanyId !== undefined ? (applicableCompanyId || null) : profile.applicableCompanyId,
        departmentId: departmentId !== undefined ? (departmentId || null) : profile.departmentId,
        operationType: operationType !== undefined ? (operationType || null) : profile.operationType,
        appliesToAllPositionCategories: appliesToAllPositionCategories !== undefined ? appliesToAllPositionCategories : profile.appliesToAllPositionCategories,
        positionCategoryId: positionCategoryId !== undefined ? (positionCategoryId || null) : profile.positionCategoryId,
        ordinaryDailyMinutes: ordinaryDailyMinutes != null ? parseInt(ordinaryDailyMinutes) : profile.ordinaryDailyMinutes,
        ordinaryWeeklyMinutes: ordinaryWeeklyMinutes != null ? parseInt(ordinaryWeeklyMinutes) : profile.ordinaryWeeklyMinutes,
        ramadanDailyMinutes: ramadanDailyMinutes != null ? parseInt(ramadanDailyMinutes) : profile.ramadanDailyMinutes,
        ramadanWeeklyMinutes: ramadanWeeklyMinutes != null ? parseInt(ramadanWeeklyMinutes) : profile.ramadanWeeklyMinutes,
        ramadanExcessCreatesOtCandidate: ramadanExcessCreatesOtCandidate !== undefined ? !!ramadanExcessCreatesOtCandidate : profile.ramadanExcessCreatesOtCandidate,
        weeklyRestSource: weeklyRestSource || profile.weeklyRestSource,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : profile.effectiveTo,
        approvalStatus: "DRAFT" as any,
        version: nextVersion,
        supersedesProfileId: profile.id,
        notes: notes !== undefined ? notes : profile.notes,
        restDays: resolvedWorkerClass === "WHITE_COLLAR" && restDays && Array.isArray(restDays) ? {
          create: restDays.map((day: string) => ({ dayOfWeek: day as any }))
        } : undefined
      }
    });

    return NextResponse.json({ success: true, profile: newProfile }, { status: 201 });
  }

  // General edit: Approved records are immutable
  if (profile.approvalStatus === "APPROVED" || profile.approvalStatus === "SUPERSEDED") {
    return NextResponse.json({ success: false, error: "Approved or Superseded profiles are immutable and cannot be edited directly" }, { status: 400 });
  }

  const {
    code,
    name,
    ownerCompanyId,
    workerClass,
    applicability,
    applicableCompanyId,
    departmentId,
    operationType,
    appliesToAllPositionCategories,
    positionCategoryId,
    ordinaryDailyMinutes,
    ordinaryWeeklyMinutes,
    ramadanDailyMinutes,
    ramadanWeeklyMinutes,
    ramadanExcessCreatesOtCandidate,
    weeklyRestSource,
    restDays,
    effectiveFrom,
    effectiveTo,
    notes
  } = body;

  try {
    const resolvedWorkerClass = workerClass || profile.workerClass;

    // Validate if necessary
    if (applicableCompanyId && departmentId) {
      await validateCompanyDepartment(applicableCompanyId, departmentId);
    }

    if (resolvedWorkerClass || appliesToAllPositionCategories !== undefined || positionCategoryId !== undefined) {
      validatePositionApplicability({
        workerClass: resolvedWorkerClass,
        appliesToAllPositionCategories: appliesToAllPositionCategories !== undefined ? appliesToAllPositionCategories : profile.appliesToAllPositionCategories,
        positionCategoryId: positionCategoryId !== undefined ? positionCategoryId : profile.positionCategoryId
      });
    }

    if (restDays) {
      validateRestDayLifecycle({
        workerClass: resolvedWorkerClass,
        approvalStatus: profile.approvalStatus,
        restDays
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If restDays are provided, replace them transactionally
      if (restDays && Array.isArray(restDays)) {
        await tx.manpowerWorkCalendarRestDay.deleteMany({
          where: { profileId: params.id }
        });
      }

      return tx.manpowerWorkCalendarProfile.update({
        where: { id: params.id },
        data: {
          ...(code ? { code } : {}),
          ...(name ? { name } : {}),
          ...(ownerCompanyId ? { ownerCompanyId } : {}),
          ...(workerClass ? { workerClass: workerClass as any } : {}),
          ...(applicability ? { applicability: applicability as any } : {}),
          ...(applicableCompanyId !== undefined ? { applicableCompanyId: applicableCompanyId || null } : {}),
          ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
          ...(operationType !== undefined ? { operationType: operationType || null } : {}),
          ...(appliesToAllPositionCategories !== undefined ? { appliesToAllPositionCategories } : {}),
          ...(positionCategoryId !== undefined ? { positionCategoryId: positionCategoryId || null } : {}),
          ...(ordinaryDailyMinutes !== undefined ? { ordinaryDailyMinutes: ordinaryDailyMinutes != null ? parseInt(ordinaryDailyMinutes) : null } : {}),
          ...(ordinaryWeeklyMinutes !== undefined ? { ordinaryWeeklyMinutes: ordinaryWeeklyMinutes != null ? parseInt(ordinaryWeeklyMinutes) : null } : {}),
          ...(ramadanDailyMinutes !== undefined ? { ramadanDailyMinutes: ramadanDailyMinutes != null ? parseInt(ramadanDailyMinutes) : null } : {}),
          ...(ramadanWeeklyMinutes !== undefined ? { ramadanWeeklyMinutes: ramadanWeeklyMinutes != null ? parseInt(ramadanWeeklyMinutes) : null } : {}),
          ...(ramadanExcessCreatesOtCandidate !== undefined ? { ramadanExcessCreatesOtCandidate: !!ramadanExcessCreatesOtCandidate } : {}),
          ...(weeklyRestSource ? { weeklyRestSource: weeklyRestSource as any } : {}),
          ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom) } : {}),
          ...(effectiveTo !== undefined ? { effectiveTo: effectiveTo ? new Date(effectiveTo) : null } : {}),
          ...(notes !== undefined ? { notes: notes || null } : {}),
          ...(restDays && Array.isArray(restDays) ? {
            restDays: {
              create: restDays.map((day: string) => ({ dayOfWeek: day as any }))
            }
          } : {})
        },
        include: { restDays: true }
      });
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id },
    include: {
      supersededByProfiles: true,
      seasonalRules: true,
      payrollAdvisoryRuns: true,
      billingSupportRuns: true
    }
  });

  if (!profile) {
    return NextResponse.json({ success: false, error: "Work calendar profile not found" }, { status: 404 });
  }

  // Hard deletion allowed ONLY for dependency-free DRAFT records
  if (profile.approvalStatus !== "DRAFT") {
    return NextResponse.json({
      success: false,
      error: `PROFILE_LIFECYCLE_PROTECTION: Only DRAFT profiles can be deleted. Current status is ${profile.approvalStatus}.`
    }, { status: 400 });
  }

  if (
    profile.supersededByProfiles.length > 0 ||
    profile.seasonalRules.length > 0 ||
    profile.payrollAdvisoryRuns.length > 0 ||
    profile.billingSupportRuns.length > 0
  ) {
    return NextResponse.json({
      success: false,
      error: "PROFILE_DEPENDENCY_PROTECTION: Cannot delete profile referenced by superseded versions, seasonal rules, or advisory runs."
    }, { status: 400 });
  }

  try {
    await prisma.manpowerWorkCalendarProfile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Profile deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

