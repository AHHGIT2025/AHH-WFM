import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateProfileOverlap } from "@/lib/manpower-work-calendar-engine";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id },
    include: {
      company: true,
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
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id }
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
      ordinaryDailyMinutes,
      ordinaryWeeklyMinutes,
      ramadanDailyMinutes,
      ramadanWeeklyMinutes,
      weeklyRestConfigType,
      weeklyRestFixedDay,
      weeklyRestCustomSchedule,
      effectiveFrom,
      effectiveTo,
      notes
    } = body;

    const newProfile = await prisma.manpowerWorkCalendarProfile.create({
      data: {
        code: code || `${profile.code}-V${nextVersion}`,
        name: name || `${profile.name} (V${nextVersion})`,
        operationType: profile.operationType,
        workerCategory: profile.workerCategory,
        companyId: profile.companyId,
        ordinaryDailyMinutes: ordinaryDailyMinutes != null ? parseInt(ordinaryDailyMinutes) : profile.ordinaryDailyMinutes,
        ordinaryWeeklyMinutes: ordinaryWeeklyMinutes != null ? parseInt(ordinaryWeeklyMinutes) : profile.ordinaryWeeklyMinutes,
        ramadanDailyMinutes: ramadanDailyMinutes != null ? parseInt(ramadanDailyMinutes) : profile.ramadanDailyMinutes,
        ramadanWeeklyMinutes: ramadanWeeklyMinutes != null ? parseInt(ramadanWeeklyMinutes) : profile.ramadanWeeklyMinutes,
        weeklyRestConfigType: weeklyRestConfigType || profile.weeklyRestConfigType,
        weeklyRestFixedDay: weeklyRestFixedDay || profile.weeklyRestFixedDay,
        weeklyRestCustomSchedule: weeklyRestCustomSchedule || profile.weeklyRestCustomSchedule,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        approvalStatus: "DRAFT" as any,
        version: nextVersion,
        supersedesProfileId: profile.id,
        notes
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
    operationType,
    workerCategory,
    ordinaryDailyMinutes,
    ordinaryWeeklyMinutes,
    ramadanDailyMinutes,
    ramadanWeeklyMinutes,
    weeklyRestConfigType,
    weeklyRestFixedDay,
    weeklyRestCustomSchedule,
    effectiveFrom,
    effectiveTo,
    companyId,
    notes
  } = body;

  try {
    const updated = await prisma.manpowerWorkCalendarProfile.update({
      where: { id: params.id },
      data: {
        ...(code ? { code } : {}),
        ...(name ? { name } : {}),
        ...(operationType ? { operationType: operationType as any } : {}),
        ...(workerCategory ? { workerCategory: workerCategory as any } : {}),
        ...(ordinaryDailyMinutes !== undefined ? { ordinaryDailyMinutes: ordinaryDailyMinutes != null ? parseInt(ordinaryDailyMinutes) : null } : {}),
        ...(ordinaryWeeklyMinutes !== undefined ? { ordinaryWeeklyMinutes: ordinaryWeeklyMinutes != null ? parseInt(ordinaryWeeklyMinutes) : null } : {}),
        ...(ramadanDailyMinutes !== undefined ? { ramadanDailyMinutes: ramadanDailyMinutes != null ? parseInt(ramadanDailyMinutes) : null } : {}),
        ...(ramadanWeeklyMinutes !== undefined ? { ramadanWeeklyMinutes: ramadanWeeklyMinutes != null ? parseInt(ramadanWeeklyMinutes) : null } : {}),
        ...(weeklyRestConfigType ? { weeklyRestConfigType: weeklyRestConfigType as any } : {}),
        ...(weeklyRestFixedDay !== undefined ? { weeklyRestFixedDay } : {}),
        ...(weeklyRestCustomSchedule !== undefined ? { weeklyRestCustomSchedule } : {}),
        ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom) } : {}),
        ...(effectiveTo !== undefined ? { effectiveTo: effectiveTo ? new Date(effectiveTo) : null } : {}),
        ...(companyId !== undefined ? { companyId: companyId || null } : {}),
        ...(notes !== undefined ? { notes } : {})
      }
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const profile = await prisma.manpowerWorkCalendarProfile.findUnique({
    where: { id: params.id }
  });

  if (!profile) {
    return NextResponse.json({ success: false, error: "Work calendar profile not found" }, { status: 404 });
  }

  if (profile.approvalStatus === "APPROVED") {
    return NextResponse.json({ success: false, error: "Approved work calendar profiles cannot be deleted" }, { status: 400 });
  }

  try {
    await prisma.manpowerWorkCalendarProfile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Profile deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
